import React, { useEffect, useRef, useState } from "react";
import { Linking, Pressable, Share, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { Link, router, useLocalSearchParams } from "expo-router";
import { PostTranslation } from "./PostTranslation";
import { communityReturnLocale, discussionLanguage, communityInterfaceLocale, communityDirection } from "../lib/communityLanguage";
import { discussionUi } from "../lib/discussionUi";
import { communityCopy } from "../../shared/seo/community-copy.mjs";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, MessageCircle, Pin, Lock } from "lucide-react-native";
import { useAuth } from "../lib/auth";
import { useTheme } from "../theme";
import { Avatar, Button, Empty, ErrorState, Field, Loading, SearchField, useUIStyles } from "./ui";
import { NativeVideo } from "./Video";
import {
  discussionCategories, discussionRoot, discussionPath, discussionMediaUrl,
  listDiscussions, discussionWriter,
  type DiscussionTopic, type DiscussionReply, type DiscussionFilters, type DiscussionCategory,
  type DiscussionSort, type DiscussionAttachment, type DiscussionMedia,
} from "../lib/clubDiscussions";

// Enable only after the media edge endpoint and its cleanup worker are deployed.
const discussionMediaEnabled = process.env.EXPO_PUBLIC_DISCUSSION_MEDIA_ENABLED === 'true';

export function DiscussionChoices({ values, value, onChange, disabled = false }: {
  values: Record<string, string>; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {Object.entries(values).map(([key, label]) => <Pressable key={key} accessibilityRole="button"
      accessibilityLabel={label} accessibilityState={{ selected: value === key, disabled }} disabled={disabled}
      onPress={() => onChange(key)} style={{ paddingHorizontal: 13, paddingVertical: 11, borderRadius: 20,
        backgroundColor: value === key ? colors.blue : colors.surfaceRaised }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: value === key ? "#fff" : colors.ink }}>{label}</Text>
    </Pressable>)}
  </View>;
}

export function DiscussionAttachmentView({ media }: { media: DiscussionMedia }) {
  const [playing, setPlaying] = useState(false);
  const uri = discussionMediaUrl(media.id);
  return media.mime_type.startsWith("video/") ? <View style={{ gap: 8 }}>
    {playing ? <NativeVideo uri={uri} active controls style={{ height: 270, borderRadius: 16 }} /> :
      <Button title="Lire la vidéo jointe" secondary onPress={() => setPlaying(true)} />}
  </View> : <Image source={{ uri }} cachePolicy="none" accessibilityLabel="Image jointe à la discussion" contentFit="contain"
    style={{ width: "100%", height: 280, borderRadius: 16 }} />;
}

/** User text stays text. Only explicit http(s) links are made interactive. */
export function DiscussionText({ text }: { text: string }) {
  const s = useUIStyles();
  const { colors } = useTheme();
  return <Text selectable style={[s.text, { lineHeight: 23, writingDirection: "auto" }]}>{text.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) =>
    /^https?:\/\//.test(part) ? <Text key={index} accessibilityRole="link" style={{ color: colors.blue }}
      onPress={() => void Linking.openURL(part).catch(() => {})}>{part}</Text> : part)}</Text>;
}

function DiscussionByline({ item }: { item: DiscussionTopic | DiscussionReply }) {
  const s = useUIStyles();
  const { communityLocale } = useLocalSearchParams<{ communityLocale?: string }>();
  const t = (text: string) => discussionUi(communityLocale, text);
  return <View style={[s.row, { gap: 8 }]}>
    <Avatar uri={item.author?.avatar_url} name={item.author?.name || t("Membre")} size={28} />
    <Text style={[s.small, { flex: 1 }]}>{item.author?.name || t("Compte supprimé")} · {new Date(item.created_at).toLocaleDateString(discussionLanguage(communityLocale) || "fr-FR")}</Text>
  </View>;
}

export function DiscussionCard({ topic }: { topic: DiscussionTopic }) {
  const { communityLocale } = useLocalSearchParams<{ communityLocale?: string }>();
  const copy = communityCopy(communityInterfaceLocale(communityLocale));
  const t = (text: string) => discussionUi(communityLocale, text);
  const s = useUIStyles(); const { colors } = useTheme();
  return <View style={[s.card, { gap: 12, padding: 18 }]} testID="discussion-card">
    <View style={[s.row, { flexWrap: "wrap", gap: 7 }]}>
      <Text style={[s.small, { color: colors.blue, fontWeight: "700" }]}>{topic.club_name}</Text>
      <Text style={s.small}>· {t(discussionCategories[topic.category] || "Discussion")}</Text>
      {topic.is_pinned && <Pin size={14} color={colors.blue} accessibilityLabel={t("Épinglé")} />}
      {topic.is_locked && <Lock size={14} color={colors.muted} accessibilityLabel={t("Verrouillé")} />}
    </View>
    <Link href={communityReturnLocale(discussionPath(topic), communityLocale) as any} asChild><Pressable accessibilityRole="link">
      <Text style={[s.h2, { fontSize: 18 }]}>{topic.title}</Text>
      <Text numberOfLines={2} style={[s.text, { marginTop: 6, color: colors.muted }]}>{topic.content}</Text>
    </Pressable></Link>
    <DiscussionByline item={topic} />
    <View style={[s.row, { gap: 18 }]}><Text style={s.small}>↑ {topic.score} {copy.votes}</Text>
      <Text style={s.small}>{topic.replies_count} {copy.replies}</Text>
      {!!topic.media && <Text style={s.small}>{topic.media.mime_type.startsWith("video/") ? "Vidéo" : "Image"}</Text>}
    </View>
  </View>;
}

export function ClubDiscussions({ clubId, clubSlug, clubName, preview = false }: {
  clubId?: string; clubSlug?: string; clubName?: string; preview?: boolean;
}) {
  const s = useUIStyles(); const { colors } = useTheme(); const { session } = useAuth();
  const { communityLocale } = useLocalSearchParams<{ communityLocale?: string }>();
  const copy = communityCopy(communityInterfaceLocale(communityLocale));
  const t = (text: string) => discussionUi(communityLocale, text);
  const [query, setQuery] = useState(""); const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState(""); const [sort, setSort] = useState<DiscussionSort>("recent");
  const [country, setCountry] = useState(""); const [language, setLanguage] = useState("");
  useEffect(() => { const timer = setTimeout(() => setDebounced(query), 300); return () => clearTimeout(timer); }, [query]);
  const filters: DiscussionFilters = { clubId, query: debounced, category, sort, country, language };
  const result = useInfiniteQuery({
    queryKey: ["club-discussions", session?.user.id || "anonymous", filters, preview], initialPageParam: 0,
    staleTime: 0, refetchInterval: 30000, retry: false,
    queryFn: ({ pageParam }) => listDiscussions(filters, pageParam, preview ? 3 : 20),
    getNextPageParam: (last, all) => last.has_more ? all.reduce((sum, page) => sum + page.items.length, 0) : undefined,
  });
  const root = clubId ? discussionRoot(clubSlug || clubId) : "/discussions";
  return <View style={{ gap: 16, padding: preview ? 16 : 0, direction: communityDirection(communityLocale) }} testID="club-discussions">
    <View style={[s.row, { gap: 12 }]}><View style={{ backgroundColor: colors.accentSoft, padding: 11, borderRadius: 15 }}>
      <MessageCircle size={22} color={colors.blue} /></View><View style={{ flex: 1 }}>
      <Text style={s.h2}>{clubName ? `${copy.discussions} · ${clubName}` : copy.discussions}</Text>
      <Text style={s.small}>{preview ? t("Le club se vit aussi entre vous.") : t("Partagez, débattez et échangez avec la communauté.")}</Text>
    </View></View>
    <Button title={clubId ? `+ ${copy.create}` : t("Choisir un club pour créer un sujet")} onPress={() =>
      router.push(communityReturnLocale(clubId ? `${root}/new` : "/clubs", communityLocale) as any)} />
    {!preview && <>
      <SearchField value={query} onChangeText={setQuery} placeholder={t("Rechercher dans les discussions")} />
      <DiscussionChoices values={{ recent: t("Récents"), popular: t("Populaires · 7 jours"), best: t("Les mieux notés") }} value={sort} onChange={(value) => setSort(value as DiscussionSort)} />
      <DiscussionChoices values={{ "": t("Tout"), ...Object.fromEntries(Object.entries(discussionCategories).map(([key, label]) => [key, t(label)])) }} value={category} onChange={setCategory} />
      {!clubId && <View style={[s.row, { alignItems: "flex-start", gap: 12 }]}>
        <View style={{ flex: 1 }}><Field label={t("Pays du club (FR, ES…)")} value={country} maxLength={2} autoCapitalize="characters" onChangeText={setCountry} /></View>
        <View style={{ flex: 1 }}><Field label={t("Langue du sujet (fr, en, sr-Latn…)")} value={language} maxLength={35} autoCapitalize="none" onChangeText={setLanguage} /></View>
      </View>}
    </>}
    {result.isPending ? <Loading /> : result.isError ? <ErrorState error={result.error} retry={() => void result.refetch()} /> :
      !result.data.pages[0].total ? <Empty title={query || category || country || language ? t("Aucun sujet trouvé") : copy.empty}
        description={t("Une question, un débrief de match ou une idée pour le club ? La communauté vous attend.")} /> :
      result.data.pages.flatMap(page => page.items).map(topic => <DiscussionCard key={topic.id} topic={topic} />)}
    {preview ? <Button title={copy.discussions} secondary onPress={() => router.push(communityReturnLocale(root, communityLocale) as any)} /> :
      result.hasNextPage && <Button title={t("Charger plus de sujets")} secondary busy={result.isFetchingNextPage} onPress={() => void result.fetchNextPage()} />}
    {!preview && !!clubId && <Button title={t("Explorer toutes les discussions")} secondary onPress={() => router.push(communityReturnLocale("/discussions", communityLocale) as any)} />}
  </View>;
}

export function DiscussionComposer({ userId, clubId, topicId, parentId, initial, onSaved, onCancel }: {
  userId: string; clubId?: string; topicId?: string; parentId?: string;
  initial?: DiscussionTopic | DiscussionReply; onSaved: (id: string) => void; onCancel?: () => void;
}) {
  const s = useUIStyles(); const topic = !!clubId;
  const { communityLocale } = useLocalSearchParams<{ communityLocale?: string }>();
  const locale = communityInterfaceLocale(communityLocale);
  const copy = communityCopy(locale);
  const t = (text: string) => discussionUi(communityLocale, text);
  const [title, setTitle] = useState(initial && "title" in initial ? initial.title : "");
  const [content, setContent] = useState(initial?.content || "");
  const [category, setCategory] = useState<DiscussionCategory>(initial && "category" in initial ? initial.category : "other");
  const [language, setLanguage] = useState(initial && "language" in initial ? initial.language : discussionLanguage(communityLocale) || locale);
  const [asset, setAsset] = useState<DiscussionAttachment | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [frozen, setFrozen] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<{ id: string; title: string; content: string; category: string; language: string; asset: DiscussionAttachment | null } | null>(null);
  async function pick() {
    setError("");
    try {
      const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: false, quality: 1 });
      if (selected.canceled) return;
      const item = selected.assets[0]; const mime = item.mimeType || "";
      if (!["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(mime)) throw new Error("Choisissez une image JPEG, PNG, WebP ou une vidéo MP4.");
      if ((item.fileSize || 0) > (mime === "video/mp4" ? 50 : 10) * 1024 * 1024) throw new Error("Le fichier dépasse la limite autorisée.");
      setAsset({ id: randomUUID(), uri: item.uri, mime, name: item.fileName || (mime === "video/mp4" ? "Vidéo" : "Image") });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "La pièce jointe n’a pas pu être sélectionnée."); }
  }
  async function submit() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      if (!attempt.current) {
        if (topic && (title.trim().length < 5 || title.trim().length > 180)) throw new Error(t("Le titre doit contenir entre 5 et 180 caractères."));
        if (content.trim().length < (topic ? 20 : 1)) throw new Error(topic ? t("Développez votre sujet en 20 caractères minimum.") : t("Ajoutez un message à votre réponse."));
        const normalizedLanguage = discussionLanguage(language);
        if (!normalizedLanguage) throw new Error(t("Code de langue invalide : fr, en, sr-Latn, tpi…"));
        attempt.current = { id: initial?.id || randomUUID(), title: title.trim(), content: content.trim(), category, language: normalizedLanguage, asset };
        setFrozen(true);
      }
      const draft = attempt.current;
      const writer = await discussionWriter(userId);
      const mediaId = draft.asset ? await writer.upload(draft.asset) : null;
      const name = initial ? (topic ? "edit_club_discussion" : "edit_club_discussion_reply") :
        (topic ? "publish_club_discussion" : "publish_club_discussion_reply");
      const params: Record<string, unknown> = { p_id: draft.id, p_content: draft.content };
      if (topic) Object.assign(params, { p_title: draft.title, p_category: draft.category });
      if (!initial) Object.assign(params, topic ? { p_club_id: clubId, p_language: draft.language, p_media_id: mediaId } :
        { p_topic_id: topicId, p_parent_id: parentId || null, p_media_id: mediaId });
      const id = await writer.rpc<string>(name, params);
      if (id !== draft.id) throw new Error(t("La publication n’a pas pu être confirmée. Réessayez cet envoi."));
      setContent(""); setTitle(""); setAsset(null); attempt.current = null; setFrozen(false);
      onSaved(id);
    } catch (reason) {
      // A definite server rejection rolled back its transaction. Allow corrections;
      // a lost response keeps the exact UUID and payload for an idempotent retry.
      if (["22023", "42501", "P0001", "P0002"].includes((reason as { code?: string })?.code || "")) {
        attempt.current = null; setFrozen(false);
      }
      setError(reason instanceof Error ? reason.message : (reason as { message?: string })?.message || t("L’envoi n’a pas abouti. Votre brouillon est conservé."));
    }
    finally { pending.current = false; setBusy(false); }
  }
  return <View style={[s.card, { gap: 14, padding: 18, direction: communityDirection(communityLocale) }]} testID="discussion-composer">
    <Text style={s.h2}>{initial ? t("Modifier") : topic ? copy.create : copy.reply}</Text>
    {topic && <><Field label={t("Titre du sujet")} value={title} onChangeText={setTitle} maxLength={180} editable={!frozen} />
      <DiscussionChoices values={Object.fromEntries(Object.entries(discussionCategories).map(([key, label]) => [key, t(label)]))} value={category} onChange={value => setCategory(value as DiscussionCategory)} disabled={frozen} /></>}
    <Field label={topic ? t("Votre message") : t("Votre réponse")} multiline value={content} onChangeText={setContent} maxLength={topic ? 10000 : 5000} editable={!frozen} />
    {topic && !initial && <Field label={`${copy.language} (fr, en, sr-Latn…)`} value={language} onChangeText={setLanguage} autoCapitalize="none" maxLength={35} editable={!frozen} />}
    {!initial && discussionMediaEnabled && <>{asset ? <View style={{ gap: 10 }}><Text style={s.text}>{asset.name}</Text>
      {asset.mime.startsWith("image/") && <Image source={{ uri: asset.uri }} contentFit="contain" style={{ height: 180, width: "100%" }} />}
      <Button title="Retirer la pièce jointe" secondary disabled={frozen} onPress={() => setAsset(null)} /></View> :
      <Button title="Joindre une image ou une vidéo" secondary disabled={frozen} onPress={() => void pick()} />}
      <Text style={s.small}>Une image (10 Mo maximum) ou une vidéo MP4 H.264 (50 Mo maximum).</Text></>}
    <Text style={s.small}>{t("Restez respectueux, protégez les informations personnelles et partagez uniquement des médias que vous avez le droit de publier.")}</Text>
    {!!error && <Text accessibilityRole="alert" style={s.text}>{error}{frozen ? t(" Votre envoi est conservé : réessayez pour confirmer sa publication sans créer de doublon.") : ""}</Text>}
    <Button title={frozen && error ? t("Réessayer le même envoi") : initial ? t("Enregistrer") : topic ? t("Publier le sujet") : t("Publier la réponse")} busy={busy} onPress={() => void submit()} />
    {onCancel && !frozen && <Button title={t("Annuler")} secondary onPress={onCancel} />}
  </View>;
}

export function DiscussionActions({ topic, reply, onReply, onEdit }: {
  topic: DiscussionTopic; reply?: DiscussionReply; onReply?: () => void; onEdit?: () => void;
}) {
  const item = reply || topic; const s = useUIStyles(); const { colors } = useTheme();
  const { communityLocale } = useLocalSearchParams<{ communityLocale?: string }>();
  const t = (text: string) => discussionUi(communityLocale, text);
  const { session } = useAuth(); const cache = useQueryClient();
  const [menu, setMenu] = useState(false); const [confirm, setConfirm] = useState(false);
  const [report, setReport] = useState(false); const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState(""); const [notice, setNotice] = useState("");
  const [voteState, setVoteState] = useState<"ready" | "uncertain" | "checking">("ready");
  const operation = useRef(false);
  async function reconcileVote() {
    setVoteState("checking");
    try {
      await cache.refetchQueries({ queryKey: ["club-discussion", topic.id], type: "active" }, { throwOnError: true });
      await cache.invalidateQueries({ queryKey: ["club-discussions"] });
      setVoteState("ready"); setNotice(t("L’état du vote a été actualisé."));
    } catch { setVoteState("uncertain"); }
  }
  const action = useMutation({
    mutationFn: async ({ name, params }: { name: string; params: Record<string, unknown> }) => {
      if (!session) throw new Error(t("Connectez-vous pour participer."));
      const writer = await discussionWriter(session.user.id); return writer.rpc(name, params);
    },
    onSuccess: async (_, variables) => {
      setConfirm(false); setReport(false);
      setNotice(variables.name === "report_club_discussion" ? t("Signalement transmis à la modération.") : "");
      await Promise.all([cache.invalidateQueries({ queryKey: ["club-discussion"] }), cache.invalidateQueries({ queryKey: ["club-discussions"] })]);
    },
    onError: async (_, variables) => {
      // Votes toggle: after a lost response, read their committed state before
      // offering another action. Retrying the toggle blindly would cancel it.
      if (variables.name === "vote_club_discussion") await reconcileVote();
    },
    onSettled: () => { operation.current = false; },
  });
  const run = (name: string, params: Record<string, unknown>) => {
    if (!session) { router.push({ pathname: "/login", params: { next: communityReturnLocale(discussionPath(topic), communityLocale) } }); return; }
    if (!operation.current && !action.isPending && (name !== "vote_club_discussion" || voteState === "ready")) {
      operation.current = true; setNotice(""); action.mutate({ name, params });
    }
  };
  const base = { p_topic_id: topic.id, p_reply_id: reply?.id || null };
  const moderate = (value: string) => run("moderate_club_discussion", { ...base, p_action: value, p_reason: details.trim() || null });
  return <View style={{ gap: 10 }}>
    <View style={[s.row, { gap: 5, flexWrap: "wrap" }]}>
      {([1, -1] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={value === 1 ? t("Vote positif") : t("Vote négatif")}
        accessibilityState={{ selected: item.my_vote === value, disabled: item.deleted || action.isPending || voteState !== "ready" }} disabled={item.deleted || action.isPending || voteState !== "ready"}
        onPress={() => run("vote_club_discussion", { ...base, p_value: value })}
        style={{ padding: 11, borderRadius: 12, backgroundColor: item.my_vote === value ? colors.accentSoft : colors.surfaceRaised }}>
        {value === 1 ? <ArrowUp size={19} color={colors.blue} /> : <ArrowDown size={19} color={colors.muted} />}
      </Pressable>)}
      <Text style={[s.text, { minWidth: 25, textAlign: "center" }]}>{item.score}</Text>
      {onReply && !topic.is_locked && !topic.deleted && !item.deleted && <Button title={t("Répondre")} secondary onPress={onReply} />}
      {!reply && !item.deleted && <Button title={topic.following ? t("Ne plus suivre") : t("Suivre le sujet")} secondary disabled={action.isPending}
        onPress={() => run("follow_club_discussion", { p_topic_id: topic.id, p_follow: !topic.following })} />}
      <Button title={t("Options")} secondary onPress={() => setMenu(!menu)} />
    </View>
    {menu && <View style={{ gap: 10 }}>
      <Button title={t("Partager")} secondary onPress={() => void Share.share({ message: `${topic.title}\nhttps://www.foot-nation.com${communityReturnLocale(discussionPath(topic), communityLocale)}` }).catch(() => setNotice(t("Le partage n’a pas pu être ouvert.")))} />
      {item.can_edit && !item.deleted && !!onEdit && <Button title={t("Modifier")} secondary onPress={onEdit} />}
      {session?.user.id === item.author?.id && !item.deleted && <Button title={t("Supprimer")} secondary onPress={() => setConfirm(true)} />}
      {!item.deleted && <Button title={t("Signaler")} secondary onPress={() => setReport(!report)} />}
      {item.can_moderate && <>
        <Text style={s.small}>Modération FootNation</Text>
        <Field label="Motif de modération" value={details} onChangeText={setDetails} maxLength={2000} />
        <Button title="Masquer ce contenu" secondary disabled={action.isPending || details.trim().length < 3} onPress={() => moderate("hide")} />
        {!reply && <><Button title={topic.is_locked ? "Déverrouiller" : "Verrouiller"} secondary disabled={action.isPending || details.trim().length < 3} onPress={() => moderate(topic.is_locked ? "unlock" : "lock")} />
          <Button title={topic.is_pinned ? "Désépingler" : "Épingler"} secondary disabled={action.isPending || details.trim().length < 3} onPress={() => moderate(topic.is_pinned ? "unpin" : "pin")} /></>}
      </>}
    </View>}
    {confirm && <View style={{ gap: 10 }}><Text style={s.text}>{t("Supprimer votre contenu ? Les réponses des autres membres resteront visibles.")}</Text>
      <Button title={t("Confirmer la suppression")} busy={action.isPending} onPress={() => run(reply ? "remove_club_discussion_reply" : "remove_club_discussion", { p_id: item.id })} />
      <Button title={t("Annuler")} secondary onPress={() => setConfirm(false)} /></View>}
    {report && <View style={{ gap: 10 }}><Text style={s.h2}>{t("Signaler à FootNation")}</Text>
      <DiscussionChoices values={{ spam: "Spam", harassment: t("Harcèlement"), violence: t("Violence"), inappropriate: t("Inapproprié"), child_safety: t("Protection des mineurs"), other: t("Autre") }} value={reason} onChange={setReason} />
      <Field label={t("Précisions (facultatif)")} value={details} onChangeText={setDetails} maxLength={2000} multiline />
      <Button title={t("Envoyer le signalement")} busy={action.isPending} onPress={() => run("report_club_discussion", { ...base, p_reason: reason, p_details: details || null })} /></View>}
    {action.isError && <ErrorState error={action.error} />}
    {voteState !== "ready" && <><Text style={s.small}>{t("Le résultat du vote doit être vérifié avant de voter à nouveau.")}</Text>
      <Button title={t("Actualiser le vote")} secondary busy={voteState === "checking"} onPress={() => void reconcileVote()} /></>}
    {!!notice && <Text accessibilityRole="alert" style={s.small}>{notice}</Text>}
  </View>;
}

export function DiscussionMessage({ topic, reply, onRefresh }: { topic: DiscussionTopic; reply?: DiscussionReply; onRefresh: () => void }) {
  const { communityLocale } = useLocalSearchParams<{ communityLocale?: string }>();
  const item = reply || topic; const s = useUIStyles(); const { session } = useAuth();
  const t = (text: string) => discussionUi(communityLocale, text);
  const [editing, setEditing] = useState(false); const [responding, setResponding] = useState(false);
  const done = () => { setEditing(false); setResponding(false); onRefresh(); };
  return <View style={[s.card, { gap: 14, padding: 18, direction: communityDirection(communityLocale) }]}>
    {editing && session ? <DiscussionComposer key={`edit-${item.id}-${session.user.id}`} userId={session.user.id} initial={item}
      clubId={reply ? undefined : topic.club_id} topicId={topic.id} onSaved={done} onCancel={() => setEditing(false)} /> : <>
      <DiscussionByline item={item} />
      {item.deleted ? <Text style={s.small}>{t("Ce contenu a été retiré.")}</Text> : <><DiscussionText text={item.content} />
        <PostTranslation text={item.content} targetLanguage={discussionLanguage(communityLocale) || undefined} sourceLanguage={reply ? undefined : topic.language} autoDetectUnknown communityUiLanguage={communityLocale} />
        {!!item.media && <DiscussionAttachmentView media={item.media} />}</>}
      <DiscussionActions topic={topic} reply={reply} onEdit={() => setEditing(true)} onReply={reply ? () => {
        if (!session) router.push({ pathname: "/login", params: { next: communityReturnLocale(discussionPath(topic), communityLocale) } }); else setResponding(!responding);
      } : undefined} />
      {responding && session && !topic.is_locked && !topic.deleted && <DiscussionComposer key={`reply-${item.id}-${session.user.id}`} userId={session.user.id}
        topicId={topic.id} parentId={reply?.id} onSaved={done} onCancel={() => setResponding(false)} />}
    </>}
  </View>;
}
