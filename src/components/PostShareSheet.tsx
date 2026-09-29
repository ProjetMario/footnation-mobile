import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Link as LinkIcon,
  MessageCircle,
  Search,
  Send,
  Share2,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "./ui";
import { NativeVideo } from "./Video";
import { useAuth } from "../lib/auth";
import { useConnections } from "../lib/data";
import { displayName, type Post, type Profile } from "../lib/models";
import type { MediaPlaybackMemory } from "../lib/mediaFeed";
import { supabase } from "../lib/supabase";
import {
  postShareUrl,
  profileShareUrl,
  sendProfileShare,
  sendPostShare,
  type PostShareMessage,
} from "../lib/postShare";

/** Mounted only while open: searches and playback stop when the sheet is dismissed. */
export function PostShareSheet({
  post,
  profile,
  link,
  playbackMemory,
  onClose,
  onNavigate,
}: (
  | {
      post: Post;
      profile?: never;
      link?: never;
      playbackMemory: React.RefObject<MediaPlaybackMemory>;
    }
  | { profile: Profile; post?: never; link?: never; playbackMemory?: never }
  | {
      link: { url: string; title: string; description?: string; imageUrl?: string | null; kind?: string };
      post?: never;
      profile?: never;
      playbackMemory?: never;
    }
) & {
  onClose: () => void;
  onNavigate?: () => void;
}) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const account = useRef(uid);
  account.current = uid;
  useEffect(() => {
    account.current = uid;
    return () => {
      account.current = undefined;
    };
  }, [uid]);
  const insets = useSafeAreaInsets();
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const contacts = useConnections("connections", search);
  const people = [
    ...new Map(
      (contacts.data?.pages.flat() ?? [])
        .filter((p) => p.other_profile_id !== uid && p.status === "accepted")
        .map((p) => [
          p.other_profile_id,
          {
            id: p.other_profile_id,
            full_name: p.other_full_name,
            username: p.other_username,
            avatar_url: p.other_avatar_url,
          },
        ]),
    ).values(),
  ];
  const [selected, setSelected] = useState<string[]>([]);
  const [sent, setSent] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const attempts = useRef(new Map<string, PostShareMessage>());
  const [muted, setMuted] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [externalBusy, setExternalBusy] = useState(false);
  const url = link?.url || (profile ? profileShareUrl(profile.id) : postShareUrl(post!.id));
  const shareTitle = link?.title || (profile ? "Profil FootNation" : "Publication FootNation");
  const linkKindLabel = link?.kind === "live" ? "le live" : "l’actualité";
  const linkHelpLabel = link?.kind === "live" ? "ce live" : "cette actualité";
  const linkHelpText = `Utilise les options de partage ci-dessous pour envoyer ${linkHelpLabel}.`;
  const canSendToContacts = !link;
  const close = () => {
    if (!sending.current) onClose();
  };
  const go = (path: "/network" | "/messages" | "/login") => {
    if (sending.current) return;
    close();
    onNavigate?.();
    router.push(path);
  };
  const runExternal = async (task: () => Promise<unknown>, success = "") => {
    setError("");
    setFeedback("");
    setExternalBusy(true);
    try {
      await task();
      setFeedback(success);
    } catch (e) {
      if (!(
        e &&
        typeof e === "object" &&
        "name" in e &&
        e.name === "AbortError"
      ))
        setError(
          "Ce partage n’est pas disponible. Vous pouvez copier le lien.",
        );
    } finally {
      setExternalBusy(false);
    }
  };
  const send = async () => {
    if (!uid || sending.current || !selected.length) return;
    const recipients = [...selected];
    sending.current = true;
    setBusy(true);
    setError("");
    setFeedback("");
    let completed = 0;
    try {
      for (const peer of recipients) {
        let message = attempts.current.get(peer);
        if (!message) {
          message = {
            id: randomUUID(),
            sender_id: uid,
            receiver_id: peer,
            content: url,
          };
          attempts.current.set(peer, message);
        }
        if (!canSendToContacts) throw new Error(`Ce lien se partage avec les options externes.`);
        await (profile ? sendProfileShare : sendPostShare)(
          supabase,
          profile?.id || post!.id,
          message,
          () => {
            if (account.current !== uid)
              throw new Error("Votre compte a changé. Rouvrez le partage.");
          },
        );
        completed++;
        setSent((previous) => [...previous, peer]);
        setSelected((previous) => previous.filter((id) => id !== peer));
      }
      setFeedback(
        completed === 1
          ? profile
            ? "Profil envoyé."
            : "Publication envoyée."
          : `${profile ? "Profil envoyé" : "Publication envoyée"} à ${completed} contacts.`,
      );
    } catch (e) {
      setError(
        `${completed ? `${completed} envoi${completed > 1 ? "s" : ""} effectué${completed > 1 ? "s" : ""}. ` : ""}${e instanceof Error ? e.message : "Impossible d’envoyer. Réessayez."}`,
      );
    } finally {
      sending.current = false;
      setBusy(false);
      void cache.invalidateQueries({ queryKey: ["conversations"] });
      void cache.invalidateQueries({ queryKey: ["thread"] });
    }
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View
        style={styles.overlay}
        accessibilityViewIsModal
        onAccessibilityEscape={close}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer le partage"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          style={[styles.content, { paddingTop: insets.top }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.preview}>
            {profile ? (
              <View style={{ alignItems: "center", gap: 12, padding: 16 }}>
                <Avatar
                  uri={profile.avatar_url}
                  name={displayName(profile)}
                  size={76}
                />
                <Text style={styles.previewAuthor}>{displayName(profile)}</Text>
                <Text style={styles.muted}>
                  {[profile.position || profile.primary_role, profile.club]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            ) : link ? (
              <View style={[styles.frame, !link.imageUrl && styles.textFrame]}>
                {link.imageUrl ? (
                  <Image
                    source={{ uri: link.imageUrl }}
                    contentFit="cover"
                    accessibilityLabel={link.title}
                    style={StyleSheet.absoluteFill}
                  />
                ) : null}
                <View style={styles.linkPreviewOverlay}>
                  <Text numberOfLines={1} style={styles.previewAuthor}>
                    {link.kind || "Actualité FootNation"}
                  </Text>
                  <Text numberOfLines={3} style={styles.previewText}>
                    {link.title}
                  </Text>
                  {!!link.description && (
                    <Text numberOfLines={2} style={styles.muted}>
                      {link.description}
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <>
                <View
                  style={[
                    styles.frame,
                    !post?.video_url && !post?.image_url && styles.textFrame,
                  ]}
                >
                  {post?.video_url ? (
                    <NativeVideo
                      uri={post?.video_url}
                      posterUri={post?.image_url}
                      active
                      muted={muted}
                      controls={false}
                      playbackMemory={playbackMemory}
                      contentFit="contain"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          width: "100%",
                          height: "100%",
                          aspectRatio: undefined,
                        },
                      ]}
                    />
                  ) : post?.image_url ? (
                    <Image
                      source={{ uri: post?.image_url }}
                      contentFit="contain"
                      accessibilityLabel={`Photo publiée par ${displayName(post?.author)}`}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : (
                    <>
                      <Text numberOfLines={1} style={styles.previewAuthor}>
                        {displayName(post?.author)}
                      </Text>
                      <ScrollView>
                        <Text style={styles.previewText}>
                          {post?.content || "Publication"}
                        </Text>
                      </ScrollView>
                    </>
                  )}
                </View>
                {!!post?.video_url && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      muted
                        ? "Activer le son de la vidéo"
                        : "Couper le son de la vidéo"
                    }
                    onPress={() => setMuted((v) => !v)}
                    style={styles.sound}
                  >
                    {muted ? (
                      <VolumeX color="white" size={20} />
                    ) : (
                      <Volume2 color="white" size={20} />
                    )}
                  </Pressable>
                )}
              </>
            )}
          </View>
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.handle} />
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={styles.title}>
                {link ? `Partager ${linkKindLabel}` : profile ? "Partager le profil" : "Partager la publication"}
              </Text>
              <Pressable
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Fermer le partage"
                onPress={close}
                style={styles.close}
              >
                <X size={22} color="white" />
              </Pressable>
            </View>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Search size={21} color="#A8B0BC" />
                <TextInput
                  accessibilityLabel="Rechercher un contact"
                  placeholder="Rechercher"
                  placeholderTextColor="#A8B0BC"
                  value={search}
                  onChangeText={setSearch}
                  style={styles.searchInput}
                  autoCorrect={false}
                />
              </View>
              <Pressable
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Trouver des contacts"
                onPress={() => go("/network")}
                style={styles.add}
              >
                <UserPlus size={23} color="white" />
              </Pressable>
            </View>
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {!canSendToContacts ? (
                <View style={styles.empty}>
                  <Text style={styles.muted}>
                    {linkHelpText}
                  </Text>
                </View>
              ) : !uid ? (
                <View style={styles.empty}>
                  <Text style={styles.muted}>
                    Connecte-toi pour envoyer à tes contacts.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => go("/login")}
                    style={styles.retry}
                  >
                    <Text style={styles.link}>Se connecter</Text>
                  </Pressable>
                </View>
              ) : contacts.isPending ? (
                <ActivityIndicator color="#8EAFFF" style={{ margin: 24 }} />
              ) : contacts.isError ? (
                <View style={styles.empty}>
                  <Text accessibilityRole="alert" style={styles.muted}>
                    Impossible de charger tes contacts.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void contacts.refetch()}
                    style={styles.retry}
                  >
                    <Text style={styles.link}>Réessayer</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.grid}>
                    {people.map((person) => {
                      const checked = selected.includes(person.id),
                        done = sent.includes(person.id);
                      return (
                        <Pressable
                          key={person.id}
                          accessibilityRole="checkbox"
                          accessibilityState={{
                            checked: checked || done,
                            disabled: busy || done,
                          }}
                          accessibilityLabel={`${displayName(person)}${done ? ", déjà envoyé" : ""}`}
                          disabled={busy || done}
                          onPress={() => {
                            setFeedback("");
                            setSelected((ids) =>
                              checked
                                ? ids.filter((id) => id !== person.id)
                                : [...ids, person.id],
                            );
                          }}
                          style={styles.person}
                        >
                          <View
                            style={[
                              styles.avatarRing,
                              (checked || done) && styles.selected,
                            ]}
                          >
                            <Avatar
                              uri={person.avatar_url}
                              name={displayName(person)}
                              size={68}
                            />
                            {(checked || done) && (
                              <View style={styles.check}>
                                <Check size={14} color="white" />
                              </View>
                            )}
                          </View>
                          <Text numberOfLines={2} style={styles.name}>
                            {displayName(person)}
                          </Text>
                          {done && <Text style={styles.sent}>Envoyé</Text>}
                        </Pressable>
                      );
                    })}
                  </View>
                  {!people.length && (
                    <Text style={[styles.muted, styles.empty]}>
                      {search
                        ? "Aucun contact trouvé."
                        : "Retrouve ici tes relations FootNation."}
                    </Text>
                  )}
                  {contacts.hasNextPage && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={contacts.isFetchingNextPage}
                      onPress={() => void contacts.fetchNextPage()}
                      style={styles.retry}
                    >
                      <Text style={styles.link}>
                        {contacts.isFetchingNextPage
                          ? "Chargement…"
                          : "Voir plus de contacts"}
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
            </ScrollView>
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            {!!feedback && (
              <Text accessibilityLiveRegion="polite" style={styles.feedback}>
                {feedback}
              </Text>
            )}
            {selected.length > 0 && (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void send()}
                style={styles.send}
              >
                {busy ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Send size={19} color="white" />
                )}
                <Text style={styles.sendText}>
                  {busy
                    ? "Envoi…"
                    : `Envoyer${selected.length > 1 ? ` (${selected.length})` : ""}`}
                </Text>
              </Pressable>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.shortcuts}
              contentContainerStyle={styles.shortcutContent}
            >
              <ShareShortcut
                label="WhatsApp"
                green
                disabled={busy || externalBusy}
                onPress={() =>
                  void runExternal(() =>
                    Linking.openURL(
                      `https://wa.me/?text=${encodeURIComponent(url)}`,
                    ),
                  )
                }
              >
                <MessageCircle size={28} color="white" />
              </ShareShortcut>
              <ShareShortcut
                label="Copier le lien"
                disabled={busy || externalBusy}
                onPress={() =>
                  void runExternal(async () => {
                    const copied = await Clipboard.setStringAsync(url);
                    if (!copied) throw new Error("clipboard");
                  }, "Lien copié.")
                }
              >
                <LinkIcon size={28} color="white" />
              </ShareShortcut>
              <ShareShortcut
                label="Partager dans…"
                disabled={busy || externalBusy}
                onPress={() =>
                  void runExternal(() =>
                    Share.share(
                      Platform.OS === "ios"
                        ? { url, title: shareTitle }
                        : { message: url, title: shareTitle },
                    ),
                  )
                }
              >
                <Share2 size={28} color="white" />
              </ShareShortcut>
              <ShareShortcut
                label="Messages"
                disabled={busy || externalBusy}
                onPress={() =>
                  void runExternal(() =>
                    Linking.openURL(
                      `sms:${Platform.OS === "ios" ? "&" : "?"}body=${encodeURIComponent(url)}`,
                    ),
                  )
                }
              >
                <MessageCircle size={28} color="white" fill="white" />
              </ShareShortcut>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function ShareShortcut({
  label,
  green,
  disabled,
  onPress,
  children,
}: {
  label: string;
  green?: boolean;
  disabled: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.shortcut, disabled && { opacity: 0.5 }]}
    >
      <View
        style={[styles.shortcutIcon, green && { backgroundColor: "#00CB63" }]}
      >
        {children}
      </View>
      <Text style={styles.shortcutLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#000", justifyContent: "flex-end" },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    justifyContent: "flex-end",
  },
  preview: {
    flex: 0.36,
    minHeight: 70,
    maxHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  frame: {
    width: "64%",
    maxWidth: 260,
    height: "100%",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  textFrame: {
    width: "86%",
    maxWidth: 430,
    backgroundColor: "#101D2C",
    padding: 16,
    gap: 10,
  },
  previewAuthor: {
    color: "#A8B0BC",
    fontFamily: "Inter-SemiBold",
    fontSize: 12,
  },
  previewText: {
    color: "white",
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    lineHeight: 22,
  },
  linkPreviewOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.68)",
  },
  sound: {
    position: "absolute",
    right: 16,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#292F35",
  },
  sheet: {
    flex: 0.64,
    minHeight: 0,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "#171C1F",
    overflow: "hidden",
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#919BA8",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    paddingRight: 10,
  },
  title: {
    color: "white",
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    flex: 1,
  },
  close: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 15,
    alignItems: "center",
    backgroundColor: "#292F35",
    borderRadius: 26,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 48,
    color: "white",
    fontSize: 16,
    fontFamily: "Inter-Regular",
    ...Platform.select({ web: { outlineStyle: "none" } as any }),
  },
  add: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#292F35",
  },
  list: { flex: 1, minHeight: 0 },
  listContent: { paddingHorizontal: 12, paddingBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  person: {
    width: "33.3333%",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 10,
    gap: 7,
  },
  avatarRing: {
    padding: 3,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 42,
  },
  selected: { borderColor: "#1686FF" },
  check: {
    position: "absolute",
    bottom: 1,
    right: 0,
    width: 23,
    height: 23,
    backgroundColor: "#1686FF",
    borderWidth: 2,
    borderColor: "#171C1F",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: "#F3F4F5",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter-Regular",
  },
  sent: { color: "#82CBA5", fontSize: 11 },
  muted: {
    color: "#A8B0BC",
    fontFamily: "Inter-Regular",
    fontSize: 14,
    textAlign: "center",
  },
  empty: { padding: 24, gap: 8 },
  retry: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  link: { color: "#8CBFFF", fontFamily: "Inter-SemiBold" },
  send: {
    marginHorizontal: 16,
    marginBottom: 12,
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: "#087DFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sendText: { color: "white", fontFamily: "Inter-SemiBold", fontSize: 15 },
  error: {
    color: "#FF8D96",
    paddingHorizontal: 20,
    paddingBottom: 10,
    fontFamily: "Inter-Regular",
    fontSize: 13,
  },
  feedback: {
    color: "#A6EDC7",
    paddingHorizontal: 20,
    paddingBottom: 10,
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
  },
  shortcuts: {
    flexGrow: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#353A41",
  },
  shortcutContent: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 4,
  },
  shortcut: { width: 88, alignItems: "center", gap: 9 },
  shortcutIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#292F35",
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutLabel: {
    color: "white",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter-Regular",
  },
});
