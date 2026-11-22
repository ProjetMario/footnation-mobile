import React, { useState } from "react";
import { Text, View } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, requireBackend } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { discussionPath, discussionRoot, discussionCategories, getDiscussion, discussionWriter, type DiscussionReply } from "../lib/clubDiscussions";
import { ClubDiscussions, DiscussionComposer, DiscussionMessage } from "../components/ClubDiscussions";
import { AuthGate } from "../components/AuthGate";
import { Button, Empty, ErrorState, Loading, Screen, useUIStyles } from "../components/ui";
import { communityReturnLocale, communityInterfaceLocale } from "../lib/communityLanguage";
import { discussionUi } from "../lib/discussionUi";
import { readClub } from '../lib/readClub';
import { communityCopy } from "../../shared/seo/community-copy.mjs";

const moderationActionLabels: Record<string, string> = {
  hide: "Masqué", restore: "Rétabli", lock: "Verrouillé", unlock: "Déverrouillé", pin: "Épinglé", unpin: "Désépinglé",
};

function useDiscussionClub(id: string) {
  return useQuery({ queryKey: ["discussion-club", id], queryFn: async () => {
    const club = await readClub(id, 'id,name,slug,type');
    return club?.type === 'five_center' ? null : club;
  } });
}

export function DiscussionsDirectory() {
  const { profile } = useAuth();
  return <Screen title="Discussions"><ClubDiscussions />
    {profile?.is_admin && <Button title="Signalements à modérer" secondary onPress={() => router.push("/discussions/moderation" as any)} />}
  </Screen>;
}

export function ClubDiscussionsScreen() {
  const { id, communityLocale } = useLocalSearchParams<{ id: string; communityLocale?: string }>(); const result = useDiscussionClub(id);
  const t = (text: string) => discussionUi(communityLocale, text);
  return <Screen title={t("Discussions du club")}>{result.isPending ? <Loading /> : result.isError ?
    <ErrorState error={result.error} retry={() => void result.refetch()} /> : !result.data ? <Empty title={t("Club introuvable")} /> :
    <ClubDiscussions clubId={result.data.id} clubSlug={result.data.slug} clubName={result.data.name} />}</Screen>;
}

export function NewClubDiscussionScreen() {
  const { id, communityLocale } = useLocalSearchParams<{ id: string; communityLocale?: string }>(); const result = useDiscussionClub(id);
  const copy = communityCopy(communityInterfaceLocale(communityLocale));
  const t = (text: string) => discussionUi(communityLocale, text);
  const { session } = useAuth(); const cache = useQueryClient(); const s = useUIStyles();
  return <Screen title={copy.create}><AuthGate allowIncomplete={false}>
    {result.isPending ? <Loading /> : result.isError ? <ErrorState error={result.error} retry={() => void result.refetch()} /> :
      !result.data ? <Empty title={t("Club introuvable")} /> : session && <>
        <Text style={s.h2}>{result.data.name}</Text>
        <DiscussionComposer key={`${session.user.id}-${result.data.id}`} userId={session.user.id} clubId={result.data.id}
          onSaved={topicId => { void cache.invalidateQueries({ queryKey: ["club-discussions"] });
            router.replace(communityReturnLocale(`${discussionRoot(result.data!.slug || result.data!.id)}/${topicId}`, communityLocale) as any); }} />
      </>}
  </AuthGate></Screen>;
}

/** Flatten the reply tree without recursive rendering; missing parents remain readable on later pages. */
export function discussionReplyOrder(replies: DiscussionReply[]): Array<{ reply: DiscussionReply; depth: number; missingParent: boolean }> {
  const byId = new Map(replies.map(reply => [reply.id, reply]));
  const children = new Map<string, DiscussionReply[]>();
  for (const reply of replies) {
    const key = reply.parent_id && byId.has(reply.parent_id) && reply.parent_id !== reply.id ? reply.parent_id : "";
    children.set(key, [...(children.get(key) || []), reply]);
  }
  const ordered: Array<{ reply: DiscussionReply; depth: number; missingParent: boolean }> = []; const seen = new Set<string>();
  const stack = [...(children.get("") || [])].reverse().map(reply => ({ reply, depth: 0 }));
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current.reply.id)) continue;
    seen.add(current.reply.id);
    ordered.push({ ...current, missingParent: !!current.reply.parent_id && !byId.has(current.reply.parent_id) });
    stack.push(...[...(children.get(current.reply.id) || [])].reverse().map(reply => ({ reply, depth: current.depth + 1 })));
  }
  for (const reply of replies) if (!seen.has(reply.id)) ordered.push({ reply, depth: 0, missingParent: true });
  return ordered;
}

export function ClubDiscussionScreen() {
  const { topicId, communityLocale } = useLocalSearchParams<{ id: string; topicId: string; communityLocale?: string }>();
  const copy = communityCopy(communityInterfaceLocale(communityLocale));
  const t = (text: string) => discussionUi(communityLocale, text);
  const { session } = useAuth(); const cache = useQueryClient(); const s = useUIStyles();
  const result = useInfiniteQuery({ queryKey: ["club-discussion", topicId, session?.user.id || "anonymous"], initialPageParam: 0,
    staleTime: 0, refetchInterval: 30000, retry: false,
    queryFn: ({ pageParam }) => getDiscussion(topicId, pageParam),
    getNextPageParam: (last, all) => last.has_more ? all.reduce((sum, page) => sum + page.replies.length, 0) : undefined,
  });
  const topic = result.data?.pages[0].topic;
  const refresh = () => { void cache.invalidateQueries({ queryKey: ["club-discussion", topicId] }); void cache.invalidateQueries({ queryKey: ["club-discussions"] }); };
  const replies = discussionReplyOrder(result.data?.pages.flatMap(page => page.replies) || []);
  return <Screen title="Discussion">{result.isPending ? <Loading /> : result.isError ?
    <ErrorState error={result.error} retry={() => void result.refetch()} /> : !topic ?
      <Empty title={t("Sujet indisponible")} description={t("Ce sujet n’existe pas ou a été masqué par la modération.")} /> : <>
      <Link href={communityReturnLocale(discussionRoot(topic.club_slug || topic.club_id), communityLocale) as any} asChild><Text style={s.small}>← {copy.discussions} · {topic.club_name}</Text></Link>
      <Text style={s.small}>{t(discussionCategories[topic.category])}{topic.is_pinned ? ` · ${t("Épinglé")}` : ""}{topic.is_locked ? ` · ${t("Verrouillé")}` : ""}</Text>
      <Text accessibilityRole="header" style={s.title}>{topic.title}</Text>
      <DiscussionMessage topic={topic} onRefresh={refresh} />
      <Text style={s.h2}>{topic.replies_count} {copy.replies}</Text>
      {!topic.is_locked && !topic.deleted ? <AuthGate allowIncomplete={false}>
        {!!session && <DiscussionComposer key={`main-${session.user.id}-${topic.id}`} userId={session.user.id} topicId={topic.id} onSaved={refresh} />}
      </AuthGate> : <Text style={s.small}>{t("Ce sujet n’accepte plus de nouvelles réponses.")}</Text>}
      {replies.map(({ reply, depth, missingParent }) => <View key={reply.id} style={{ marginLeft: Math.min(depth, 3) * 12, gap: 6 }}>
        {missingParent && <Text style={s.small}>{t("En réponse à un commentaire précédent.")}</Text>}
        <DiscussionMessage topic={topic} reply={reply} onRefresh={refresh} />
      </View>)}
      {result.hasNextPage && <Button title={t("Charger plus de réponses")} busy={result.isFetchingNextPage} secondary onPress={() => void result.fetchNextPage()} />}
    </>}</Screen>;
}

export function DiscussionModerationScreen() {
  const { session, profile } = useAuth(); const s = useUIStyles(); const cache = useQueryClient();
  const [history, setHistory] = useState(false);
  const [actions, setActions] = useState(false);
  const reports = useInfiniteQuery({ queryKey: ["club-discussion-reports", session?.user.id, history, actions], enabled: !!session && profile?.is_admin === true,
    initialPageParam: 0, queryFn: async ({ pageParam }) => {
      const writer = await discussionWriter(session!.user.id);
      return writer.rpc<{ items: any[]; total: number; has_more: boolean }>(actions ? "get_club_discussion_moderation_history" : "get_club_discussion_reports",
        { p_offset: pageParam, p_limit: 50, ...(actions ? {} : { p_include_reviewed: history }) });
    }, getNextPageParam: (last, all) => last.has_more ? all.reduce((sum, page) => sum + page.items.length, 0) : undefined,
  });
  const action = useMutation({ mutationFn: async ({ topicId, replyId, hide }: { topicId: string; replyId: string | null; hide: boolean }) => {
    const writer = await discussionWriter(session!.user.id);
    await writer.rpc("moderate_club_discussion", { p_topic_id: topicId, p_reply_id: replyId, p_action: hide ? "hide" : "restore", p_reason: "Signalement examiné par la modération" });
  }, onSuccess: () => { void cache.invalidateQueries({ queryKey: ["club-discussion-reports"] }); void cache.invalidateQueries({ queryKey: ["club-discussion"] }); void cache.invalidateQueries({ queryKey: ["club-discussions"] }); } });
  return <Screen title="Modération des discussions"><AuthGate allowIncomplete={false}>
    {profile?.is_admin === true && <>
      <Button title={history && !actions ? "Voir les signalements en attente" : "Afficher aussi les signalements traités"} secondary onPress={() => { setHistory(actions ? true : !history); setActions(false); }} />
      <Button title={actions ? "Revenir aux signalements" : "Historique des actions de modération"} secondary onPress={() => setActions(!actions)} />
    </>}
    {profile?.is_admin !== true ? <Empty title="Accès réservé à la modération FootNation" /> : reports.isPending ? <Loading /> : reports.isError ?
      <ErrorState error={reports.error} retry={() => void reports.refetch()} /> : <>
      {!reports.data.pages[0]?.total && <Empty title={actions ? "Aucune action de modération" : history ? "Aucun signalement" : "Aucun signalement en attente"} />}
      {reports.data.pages.flatMap(page => page.items).map(report => <View key={report.id} style={[s.card, { gap: 12, padding: 18 }]}>
        <Text style={s.h2}>{report.topic?.title || "Sujet signalé"}</Text><Text style={s.small}>{report.reason}{report.action ? ` · ${moderationActionLabels[report.action] || "Action de modération"}` : report.reviewed_at ? " · Traité" : " · En attente"}</Text>
        <Text style={s.text}>{report.reply?.content || report.topic?.content}</Text>
        {!!report.details && <Text style={s.text}>Signalement : {report.details}</Text>}
        {!!report.topic && <Link href={discussionPath(report.topic) as any} asChild><Text style={s.small}>Ouvrir le sujet</Text></Link>}
        <Button title="Masquer le contenu signalé" busy={action.isPending} onPress={() => action.mutate({ topicId: report.topic_id, replyId: report.reply_id, hide: true })} />
        <Button title="Conserver ou rétablir le contenu" secondary disabled={action.isPending} onPress={() => action.mutate({ topicId: report.topic_id, replyId: report.reply_id, hide: false })} />
      </View>)}
      {reports.hasNextPage && <Button title="Plus de signalements" secondary busy={reports.isFetchingNextPage} onPress={() => void reports.fetchNextPage()} />}
    </>}{action.isError && <ErrorState error={action.error} />}
  </AuthGate></Screen>;
}
