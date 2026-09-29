import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

export type LiveComment = {
  id: string;
  stream_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

export type LivePerson = {
  user_id: string;
  profile?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

type LiveInteractionSnapshot = {
  comments: LiveComment[];
  likes: number;
  viewers: number;
  liked: boolean;
  viewerPeople: LivePerson[];
  likePeople: LivePerson[];
};

const liveWindowMs = 45_000;

export function livePersonName(person: LivePerson) {
  return person.profile?.full_name || person.profile?.username || "FootLover";
}

function displayComment(comment: LiveComment) {
  const name =
    comment.profile?.full_name || comment.profile?.username || "FootLover";
  return `${name} : ${comment.body}`;
}

export function liveCommentText(comment: LiveComment) {
  return displayComment(comment);
}

async function loadLiveInteractions(
  streamId: string,
  userId?: string,
): Promise<LiveInteractionSnapshot> {
  const activeSince = new Date(Date.now() - liveWindowMs).toISOString();
  const [comments, likes, viewers, liked, viewerPeople, likePeople] = await Promise.all([
    supabase
      .from("live_stream_comments")
      .select(
        "id,stream_id,user_id,body,created_at,profile:profiles(id,full_name,username,avatar_url)",
      )
      .eq("stream_id", streamId)
      .order("created_at", { ascending: false })
      .limit(40)
      .returns<LiveComment[]>(),
    supabase
      .from("live_stream_likes")
      .select("stream_id", { count: "exact", head: true })
      .eq("stream_id", streamId),
    supabase
      .from("live_stream_viewers")
      .select("stream_id", { count: "exact", head: true })
      .eq("stream_id", streamId)
      .gt("last_seen", activeSince),
    userId
      ? supabase
          .from("live_stream_likes")
          .select("stream_id")
          .eq("stream_id", streamId)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("live_stream_viewers")
      .select("user_id,profile:profiles(id,full_name,username,avatar_url)")
      .eq("stream_id", streamId)
      .gt("last_seen", activeSince)
      .order("last_seen", { ascending: false })
      .limit(20)
      .returns<LivePerson[]>(),
    supabase
      .from("live_stream_likes")
      .select("user_id,profile:profiles(id,full_name,username,avatar_url)")
      .eq("stream_id", streamId)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<LivePerson[]>(),
  ]);
  if (comments.error) throw comments.error;
  if (likes.error) throw likes.error;
  if (viewers.error) throw viewers.error;
  if (liked.error) throw liked.error;
  if (viewerPeople.error) throw viewerPeople.error;
  if (likePeople.error) throw likePeople.error;
  return {
    comments: comments.data || [],
    likes: likes.count ?? 0,
    viewers: viewers.count ?? 0,
    liked: !!liked.data,
    viewerPeople: viewerPeople.data || [],
    likePeople: likePeople.data || [],
  };
}

export function useLiveInteractions(streamId?: string | null) {
  const uid = useAuth().session?.user.id;
  const cache = useQueryClient();
  const key = ["live-interactions", streamId, uid] as const;
  const query = useQuery({
    queryKey: key,
    enabled: !!streamId,
    queryFn: () => loadLiveInteractions(streamId!, uid),
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: 1,
  });
  const refresh = useCallback(() => {
    if (!streamId) return;
    void cache.invalidateQueries({ queryKey: ["live-interactions", streamId] });
  }, [cache, streamId]);

  useEffect(() => {
    if (!streamId || !uid) return;
    let stopped = false;
    const heartbeat = async () => {
      if (stopped) return;
      const now = new Date().toISOString();
      const updated = await supabase
        .from("live_stream_viewers")
        .update({ last_seen: now } as never)
        .eq("stream_id", streamId)
        .eq("user_id", uid)
        .select("stream_id")
        .maybeSingle();
      if (!updated.data) {
        await supabase.from("live_stream_viewers").insert({
          stream_id: streamId,
          user_id: uid,
          joined_at: now,
          last_seen: now,
        } as never);
      }
      refresh();
    };
    void heartbeat();
    const id = setInterval(() => void heartbeat(), 20_000);
    return () => {
      stopped = true;
      clearInterval(id);
      void supabase
        .from("live_stream_viewers")
        .delete()
        .eq("stream_id", streamId)
        .eq("user_id", uid);
    };
  }, [refresh, streamId, uid]);

  useEffect(() => {
    if (!streamId) return;
    const channel = supabase
      .channel(`live-interactions:${streamId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_stream_comments", filter: `stream_id=eq.${streamId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_stream_likes", filter: `stream_id=eq.${streamId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_stream_viewers", filter: `stream_id=eq.${streamId}` },
        refresh,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh, streamId]);

  const sendComment = useMutation({
    mutationFn: async (body: string) => {
      if (!streamId || !uid) throw new Error("Connecte-toi pour commenter.");
      const trimmed = body.trim();
      if (!trimmed) return;
      const result = await supabase.from("live_stream_comments").insert({
        stream_id: streamId,
        user_id: uid,
        body: trimmed,
      } as never);
      if (result.error) throw result.error;
    },
    onSuccess: refresh,
  });

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!streamId || !uid) throw new Error("Connecte-toi pour aimer ce live.");
      if (query.data?.liked) {
        const result = await supabase
          .from("live_stream_likes")
          .delete()
          .eq("stream_id", streamId)
          .eq("user_id", uid);
        if (result.error) throw result.error;
        return;
      }
      const result = await supabase.from("live_stream_likes").insert({
        stream_id: streamId,
        user_id: uid,
      } as never);
      if (result.error) throw result.error;
    },
    onMutate: async () => {
      if (!streamId) return;
      await cache.cancelQueries({ queryKey: key });
      const previous = cache.getQueryData<LiveInteractionSnapshot>(key);
      if (previous) {
        cache.setQueryData<LiveInteractionSnapshot>(key, {
          ...previous,
          liked: !previous.liked,
          likes: Math.max(0, previous.likes + (previous.liked ? -1 : 1)),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) cache.setQueryData(key, context.previous);
    },
    onSettled: refresh,
  });

  return {
    comments: query.data?.comments ?? [],
    commentLines: (query.data?.comments ?? []).map(liveCommentText),
    likes: query.data?.likes ?? 0,
    viewers: query.data?.viewers ?? 0,
    viewerPeople: query.data?.viewerPeople ?? [],
    likePeople: query.data?.likePeople ?? [],
    liked: query.data?.liked ?? false,
    isPending: query.isPending,
    error: query.error || sendComment.error || toggleLike.error,
    sendComment: (body: string) => sendComment.mutate(body),
    toggleLike: () => toggleLike.mutate(),
    refresh,
  };
}
