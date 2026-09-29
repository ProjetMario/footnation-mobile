import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { moderateText, MODERATION_ERROR_MESSAGE } from "../lib/moderation";
import {
  createPostPublication,
  freezePostDraft,
  newPostDraft,
  postMediaExtension,
  POST_PHOTO_LIMIT,
  POST_VIDEO_LIMIT,
  type PostDraft,
  type PostDraftMedia,
} from "../lib/postPublication";
import {
  persistPostMedia,
  postDraftJournal,
  postMediaPreview,
  removePostMedia,
} from "../lib/postDraftStorage";
import { postPublicationServices } from "../lib/postPublicationServices";
import { readAsset } from "../lib/readAsset";
import { useAuth } from "../lib/auth";
import { Avatar, Button, Field, Screen, useUIStyles } from "../components/ui";
import { NativeVideo } from "../components/Video";
import { AuthGate } from "../components/AuthGate";
import { PermissionSettings } from "../components/PermissionSettings";
import { displayName } from "../lib/models";
import { notifyNetworkNewContent, notifyPublicationPublished } from "../lib/notificationEvents";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import {
  CalendarDays,
  Briefcase,
  Club,
  FilePenLine,
  PlaySquare,
  Radio,
} from "lucide-react-native";
export default function Compose() {
  const { session } = useAuth();
  return <ComposeAccount key={session?.user.id || "guest"} />;
}
function ComposeAccount() {
  const { colors } = useTheme();
  const s = useUIStyles();
  const styles = useThemedStyles(createComposeStyles);

  const { session, profile } = useAuth();
  const [editorOpen, setEditorOpen] = useState(false);
  const cache = useQueryClient();
  const userId = session?.user.id;
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const draftRef = useRef<PostDraft | null>(null);
  const persisted = useRef<PostDraft | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(true),
    account = useRef(userId),
    publicationLock = useRef(false);
  const [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false),
    [pickError, setPickError] = useState("");
  const [saveError, setSaveError] = useState(""),
    [loadError, setLoadError] = useState("");
  const [assetUri, setAssetUri] = useState<string | null>(null);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const changeNumber = useRef(0);
  const pickerLock = useRef(false);
  function assertCurrentAccount() {
    if (!alive.current || !userId || account.current !== userId)
      throw new Error(
        "Votre session a changé. Revenez au compte de ce brouillon.",
      );
  }
  async function restore() {
    if (!userId) return;
    setLoadError("");
    try {
      const previous = await postDraftJournal.load(userId);
      assertCurrentAccount();
      persisted.current = previous;
      draftRef.current = previous || newPostDraft(userId, randomUUID());
      setDraft(draftRef.current);
      setReady(true);
    } catch (error) {
      if (alive.current)
        setLoadError(
          error instanceof Error
            ? error.message
            : "Impossible de récupérer votre brouillon.",
        );
    }
  }
  useEffect(() => {
    alive.current = true;
    const subscription = supabase.auth.onAuthStateChange((_event, next) => {
      account.current = next?.user.id;
    });
    void restore();
    return () => {
      alive.current = false;
      subscription.data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let active = true,
      release: (() => void) | undefined;
    setAssetUri(null);
    if (userId && draft?.media)
      void postMediaPreview(userId, draft.media)
        .then((preview) => {
          if (!active) {
            preview.release();
            return;
          }
          release = preview.release;
          setAssetUri(preview.uri);
        })
        .catch((error) => {
          if (active)
            setPickError(
              error instanceof Error
                ? error.message
                : "Pièce jointe indisponible.",
            );
        });
    return () => {
      active = false;
      release?.();
    };
  }, [userId, draft?.media?.id]);
  function saveDraft(next: PostDraft) {
    const change = ++changeNumber.current;
    setSaving(true);
    const operation = queue.current
      .catch(() => {})
      .then(async () => {
        const saved = {
          ...next,
          revision: persisted.current ? persisted.current.revision + 1 : 0,
        };
        await postDraftJournal.save(saved, persisted.current);
        persisted.current = saved;
        if (alive.current && change === changeNumber.current) {
          draftRef.current = saved;
          setDraft(saved);
          setSaveError("");
        }
      });
    queue.current = operation;
    void operation
      .catch((error) => {
        if (alive.current)
          setSaveError(
            error instanceof Error
              ? error.message
              : "Impossible de conserver le brouillon.",
          );
      })
      .finally(() => {
        if (alive.current && change === changeNumber.current) setSaving(false);
      });
    return operation;
  }
  function updateDraft(
    patch: Partial<
      Pick<PostDraft, "content" | "location" | "hashtags" | "media">
    >,
  ) {
    if (
      !ready ||
      !draftRef.current ||
      draftRef.current.attempt ||
      publicationLock.current
    )
      return Promise.resolve();
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setDiscardConfirm(false);
    return saveDraft(next);
  }
  async function pick(camera = false) {
    if (
      pickerLock.current ||
      publicationLock.current ||
      draftRef.current?.attempt
    )
      return;
    pickerLock.current = true;
    setPicking(true);
    setPickError("");
    setCameraDenied(false);
    let retained: PostDraftMedia | null = null;
    try {
      assertCurrentAccount();
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setCameraDenied(true);
          throw new Error(
            "Autorisez l’accès à la caméra dans les réglages de votre appareil.",
          );
        }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            quality: 0.8,
          });
      assertCurrentAccount();
      if (!result.canceled) {
        const picked = result.assets[0];
        const media: PostDraftMedia = {
          id: randomUUID(),
          type: picked.type === "video" ? "video" : "image",
          mime:
            picked.mimeType ||
            (picked.type === "video" ? "video/mp4" : "image/jpeg"),
        };
        postMediaExtension(media);
        const limit =
          media.type === "video" ? POST_VIDEO_LIMIT : POST_PHOTO_LIMIT;
        if ((picked.fileSize || 0) > limit)
          throw new Error(
            `Choisissez ${media.type === "video" ? "une vidéo de moins de 50 Mo" : "une photo de moins de 10 Mo"}.`,
          );
        const bytes = await readAsset(picked.uri, limit);
        if (!bytes.byteLength)
          throw new Error("Cette pièce jointe est vide ou indisponible.");
        assertCurrentAccount();
        await persistPostMedia(userId!, media, bytes);
        retained = media;
        assertCurrentAccount();
        const oldMedia = draftRef.current?.media;
        await updateDraft({ media });
        retained = null;
        if (oldMedia) await removePostMedia(userId!, oldMedia).catch(() => {});
      }
    } catch (error) {
      if (retained && userId && draftRef.current?.media?.id !== retained.id)
        await removePostMedia(userId, retained).catch(() => {});
      if (alive.current)
        setPickError(
          error instanceof Error
            ? error.message
            : "Impossible d’ouvrir la photothèque.",
        );
    } finally {
      pickerLock.current = false;
      if (alive.current) setPicking(false);
    }
  }
  async function detachMedia() {
    if (
      pickerLock.current ||
      publicationLock.current ||
      draftRef.current?.attempt
    )
      return;
    pickerLock.current = true;
    setPicking(true);
    const media = draftRef.current?.media;
    try {
      await updateDraft({ media: null });
      if (media && userId) await removePostMedia(userId, media);
      setPickError("");
    } catch {
      /* The save error stays visible and the retained media is preserved. */
    } finally {
      pickerLock.current = false;
      if (alive.current) setPicking(false);
    }
  }
  async function discardDraft() {
    if (
      !draftRef.current ||
      draftRef.current.attempt ||
      publicationLock.current
    )
      return;
    publicationLock.current = true;
    try {
      await queue.current.catch(() => {});
      assertCurrentAccount();
      const previous = persisted.current;
      const unsavedMedia = draftRef.current?.media;
      if (previous) await postDraftJournal.remove(previous);
      if (previous?.media)
        await removePostMedia(userId!, previous.media).catch(() => {});
      if (unsavedMedia && unsavedMedia.id !== previous?.media?.id)
        await removePostMedia(userId!, unsavedMedia).catch(() => {});
      persisted.current = null;
      draftRef.current = newPostDraft(userId!, randomUUID());
      setDraft(draftRef.current);
      setDiscardConfirm(false);
      setSaveError("");
      setPickError("");
    } catch (error) {
      if (alive.current)
        setSaveError(
          error instanceof Error
            ? error.message
            : "Impossible d’effacer ce brouillon.",
        );
    } finally {
      publicationLock.current = false;
    }
  }
  const publish = useMutation({
    mutationFn: async () => {
      assertCurrentAccount();
      if (!profile || !draftRef.current)
        throw new Error("Complétez votre profil avant de publier.");
      await queue.current;
      assertCurrentAccount();
      let proposal = persisted.current || draftRef.current;
      if (
        !moderateText(
          [proposal.content, proposal.location, proposal.hashtags].join(" "),
        ).isClean
      )
        throw new Error(MODERATION_ERROR_MESSAGE);
      if (!proposal.attempt) {
        const frozen = freezePostDraft(
          proposal,
          (path) =>
            supabase.storage.from("post-media").getPublicUrl(path).data
              .publicUrl,
        );
        await postDraftJournal.save(frozen, persisted.current);
        persisted.current = frozen;
        draftRef.current = frozen;
        proposal = frozen;
        if (alive.current) setDraft(frozen);
      }
      assertCurrentAccount();
      const services = await postPublicationServices(
        userId!,
        assertCurrentAccount,
      );
      const id = await createPostPublication(proposal).publish(services);
      assertCurrentAccount();
      await postDraftJournal.remove(proposal);
      if (proposal.media)
        await removePostMedia(userId!, proposal.media).catch(() => {});
      return id;
    },
    onSuccess: (id) => {
      if (!alive.current || account.current !== userId) return;
      void notifyPublicationPublished({
        authorId: userId!,
        contentId: id,
        kind: "post",
      });
      void notifyNetworkNewContent({
        authorId: userId!,
        authorName: profile ? displayName(profile) : null,
        contentId: id,
        kind: "post",
      });
      void cache.invalidateQueries({ queryKey: ["posts"] });
      void cache.invalidateQueries({ queryKey: ["shorts-native"] });
      void cache.invalidateQueries({ queryKey: ["club-public-news"] });
      void cache.invalidateQueries({ queryKey: ["club-coach-kit"] });
      void cache.invalidateQueries({ queryKey: ["notifications", userId] });
      void cache.invalidateQueries({ queryKey: ["notifications", userId, "unread-count"] });
      router.replace(`/posts/${id}`);
    },
    onSettled: () => {
      publicationLock.current = false;
    },
  });
  const locked = !!draft?.attempt || publish.isPending;
  const hasDraft = !!(
    draft?.content ||
    draft?.media ||
    draft?.location ||
    draft?.hashtags
  );
  if (!editorOpen)
    return (
      <Screen title="Créer" header={false}>
        <AuthGate>
          <View style={styles.menuScreen}>
            <View style={styles.actionsList}>
              <CreateAction
                title={hasDraft ? "Reprendre mon brouillon" : "Publier un post"}
                subtitle="Photo, vidéo ou texte"
                colors={["#2563EB", "#4F46E5"]}
                icon={<FilePenLine size={28} color={colors.white} />}
                onPress={() => setEditorOpen(true)}
              />
              <CreateAction
                title="Partager une vidéo"
                subtitle="Entraînement, match, skills..."
                colors={["#7C3AED", "#A855F7"]}
                icon={<PlaySquare size={28} color={colors.white} />}
                onPress={() => router.push("/shorts/create")}
              />
              <CreateAction
                title="Créer une opportunité"
                subtitle="Essai, recrutement, tournoi..."
                colors={["#22D3EE", "#14B8A6"]}
                icon={<Briefcase size={28} color={colors.white} />}
                onPress={() => router.push("/opportunity/new")}
              />
              <CreateAction
                title="Créer un événement"
                subtitle="Tournoi, match, rassemblement..."
                colors={["#4F46E5", "#6366F1"]}
                icon={<CalendarDays size={28} color={colors.white} />}
                onPress={() => router.push("/events/new")}
              />
              <CreateAction
                title="Faire un live"
                subtitle="Filme en direct avec ton appareil"
                colors={["#4F46E5", "#8B5CF6"]}
                icon={<Radio size={28} color={colors.white} />}
                onPress={() => router.push("/live/create?mode=simple")}
              />
              <CreateAction
                title="Ajouter un club"
                subtitle="Gérer ton club ou en proposer un"
                colors={["#9333EA", "#D946EF"]}
                icon={<Club size={28} color={colors.white} />}
                onPress={() => router.push("/club-claim")}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Annuler"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
              style={({ pressed }) => [
                styles.cancelButton,
                { opacity: pressed ? 0.76 : 1 },
              ]}
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
          </View>
        </AuthGate>
      </Screen>
    );
  return (
    <Screen title="Publier un post">
      <AuthGate>
        <View style={s.row}>
          <Avatar name={displayName(profile)} uri={profile?.avatar_url} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.h2}>{displayName(profile)}</Text>
            <Text style={s.small}>Communauté FootNation</Text>
          </View>
        </View>
        <Field
          label="Votre publication"
          value={draft?.content || ""}
          onChangeText={(content) => {
            void updateDraft({ content }).catch(() => {});
          }}
          multiline
          placeholder="Partagez votre passion du football…"
          maxLength={10000}
          autoCapitalize="sentences"
          editable={ready && !locked && !picking}
        />
        {!!draft?.media && (
          <>
            {!!assetUri &&
              (draft.media.type === "video" ? (
                <NativeVideo uri={assetUri} />
              ) : (
                <Image
                  source={{ uri: assetUri }}
                  style={{ width: "100%", aspectRatio: 1, borderRadius: 16 }}
                  contentFit="contain"
                  accessibilityLabel="Pièce jointe de votre publication"
                />
              ))}
            <Button
              title="Retirer la pièce jointe"
              secondary
              onPress={() => void detachMedia()}
              disabled={!ready || locked || picking}
            />
          </>
        )}
        <Button
          title="Ajouter une photo ou une vidéo"
          secondary
          onPress={() => void pick()}
          disabled={!ready || locked || picking}
        />
        <Button
          title="Prendre une photo"
          secondary
          onPress={() => void pick(true)}
          disabled={!ready || locked || picking}
        />
        <Field
          label="Lieu"
          value={draft?.location || ""}
          onChangeText={(location) => {
            void updateDraft({ location }).catch(() => {});
          }}
          maxLength={150}
          editable={ready && !locked && !picking}
        />
        <Field
          label="Hashtags"
          value={draft?.hashtags || ""}
          onChangeText={(hashtags) => {
            void updateDraft({ hashtags }).catch(() => {});
          }}
          placeholder="#football #footnation"
          maxLength={300}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          editable={ready && !locked && !picking}
        />
        {cameraDenied && <PermissionSettings />}
        {!!(publish.isError || pickError || saveError || loadError) && (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{ color: colors.danger }}
          >
            {publish.error?.message || pickError || saveError || loadError}
          </Text>
        )}
        <Text style={s.small} accessibilityLiveRegion="polite">
          {draft?.attempt
            ? "Votre publication est conservée. Réessayez pour terminer ou vérifier son envoi sans la publier deux fois."
            : saving
              ? "Enregistrement du brouillon…"
              : ready && !saveError
                ? "Brouillon conservé sur cet appareil. Vous pouvez revenir plus tard."
                : ""}
        </Text>
        {!!loadError && (
          <Button
            title="Réessayer de récupérer mon brouillon"
            secondary
            onPress={() => void restore()}
          />
        )}
        {!!(!!saveError && !locked) && (
          <Button
            title="Réessayer d’enregistrer le brouillon"
            secondary
            onPress={() => {
              if (draftRef.current)
                void saveDraft(draftRef.current).catch(() => {});
            }}
          />
        )}
        <Button
          title={draft?.attempt ? "Réessayer la publication" : "Publier"}
          busy={publish.isPending}
          disabled={
            !ready ||
            picking ||
            saving ||
            !!saveError ||
            (!draft?.content.trim() && !draft?.media)
          }
          onPress={() => {
            if (publicationLock.current || pickerLock.current) return;
            publicationLock.current = true;
            publish.mutate();
          }}
        />
        {!!(hasDraft && !locked) && (
          <Button
            title={
              discardConfirm
                ? "Confirmer la suppression du brouillon"
                : "Supprimer le brouillon"
            }
            secondary
            disabled={saving || picking}
            onPress={() =>
              discardConfirm ? void discardDraft() : setDiscardConfirm(true)
            }
          />
        )}
        <Button
          title="Revenir aux choix de création"
          secondary
          disabled={publish.isPending || picking}
          onPress={() => setEditorOpen(false)}
        />
      </AuthGate>
    </Screen>
  );
}

function CreateAction({
  title,
  subtitle,
  colors,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  colors: [string, string];
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createComposeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.createAction,
        { opacity: pressed ? 0.78 : 1 },
      ]}
    >
      <LinearIcon colors={colors}>{icon}</LinearIcon>
      <View style={styles.createActionText}>
        <Text style={styles.createActionTitle}>{title}</Text>
        <Text style={styles.createActionSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function LinearIcon({
  colors,
  children,
}: {
  colors: [string, string];
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(createComposeStyles);
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.iconBox}
    >
      {children}
    </LinearGradient>
  );
}

const createComposeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    menuScreen: {
      backgroundColor: "#06111D",
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 28,
      borderRadius: 18,
      gap: 18,
    },
    menuTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "800",
      textAlign: "center",
    },
    actionsList: { gap: 12 },
    createAction: {
      minHeight: 76,
      borderRadius: 18,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: "#102033",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.05)",
    },
    iconBox: {
      width: 48,
      height: 48,
      flexShrink: 0,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#8B5CF6",
      shadowOpacity: 0.22,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    createActionText: { flex: 1, minWidth: 0, gap: 5 },
    createActionTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 17,
      lineHeight: 22,
      fontWeight: "800",
    },
    createActionSubtitle: {
      color: "rgba(255,255,255,0.58)",
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 19,
    },
    cancelButton: {
      marginTop: 4,
      minHeight: 64,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#102033",
    },
    cancelText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 15,
      fontWeight: "800",
    },
  });
