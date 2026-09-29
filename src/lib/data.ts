import { AppState } from "react-native";
import { clubSearchFilter, type ClubSearchType } from "./clubSearch";
import { isSuspended } from "./validation";
import { profileSearchFilter } from "./profileSearch";
import { useEffect, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase, requireBackend } from "./supabase";
import { useAuth } from "./auth";
import type { Post, Profile, Club, Opportunity, Message } from "./models";
import { opportunityKindFilter, type OpportunityKind } from "./opportunityKind";
import { repostBackendMissing, type RepostFeedEntry } from "./postReposts";

export function useDebounced(value: string) {
  const [v, set] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => set(value.trim()), 300);
    return () => clearTimeout(t);
  }, [value]);
  return v;
}
export function searchPattern(value: string) {
  return `%${value.replace(/[%_\\]/g, "\\$&")}%`;
}
export function useProfile(id?: string) {
  const uid = useAuth().session?.user.id;
  return useQuery({
    queryKey: ["profile", id, uid],
    enabled: !!id,
    queryFn: async () => {
      requireBackend();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}
export function usePosts(
  mode: "all" | "network" = "all",
  authorId?: string,
  media: "all" | "video" = "all",
) {
  const pageSize = 10;
  const { session } = useAuth();
  const uid = session?.user.id;
  return useInfiniteQuery({
    queryKey: ["posts", uid, mode, authorId, media, pageSize],
    initialPageParam: 0,
    staleTime: 60_000,
    enabled: !!uid,
    queryFn: async ({ pageParam }) => {
      requireBackend();
      const feed = await supabase.rpc("get_repost_feed", {
        p_mode: mode,
        p_author_id: authorId || null,
        p_media: media,
        p_offset: pageParam * pageSize,
        p_limit: pageSize,
      });
      if (!feed.error) {
        const entries = feed.data as RepostFeedEntry[];
        if (!entries.length) return [] as Post[];
        const posts = await supabase
          .from("posts")
          .select(
            "*,author:profiles!posts_user_id_fkey(id,full_name,username,avatar_url,position,club),post_comments(count),post_reactions(id,user_id,reaction_type)",
          )
          .in(
            "id",
            entries.map((entry) => entry.post_id),
          );
        if (posts.error) throw posts.error;
        const byId = new Map(
          (posts.data as Post[]).map((post) => [post.id, post]),
        );
        return entries.flatMap((entry) => {
          const post = byId.get(entry.post_id);
          if (!post) return [];
          return [
            {
              ...post,
              repost:
                entry.reposted_by && entry.reposted_at
                  ? {
                      userId: entry.reposted_by,
                      name: entry.reposted_name || "Membre FootNation",
                      createdAt: entry.reposted_at,
                    }
                  : undefined,
            },
          ];
        });
      }
      // Keep the current feed usable while the additive migration is being activated.
      // A network/permission error must not silently bypass the new feed's checks.
      if (!repostBackendMissing(feed.error)) throw feed.error;
      const blocked = await supabase
        .from("user_blocks")
        .select("blocker_id,blocked_id")
        .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
      if (blocked.error) throw blocked.error;
      const blockedIds = (blocked.data || []).map((b) =>
        b.blocker_id === uid ? b.blocked_id : b.blocker_id,
      );
      let query = supabase
        .from("posts")
        .select(
          "*,author:profiles!posts_user_id_fkey(id,full_name,username,avatar_url,position,club),post_comments(count),post_reactions(id,user_id,reaction_type)",
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam * pageSize, pageParam * pageSize + pageSize - 1);
      if (authorId) query = query.eq("user_id", authorId);
      if (media === "video")
        query = query.not("video_url", "is", null).neq("video_url", "");
      if (mode === "network") {
        const { data, error } = await supabase
          .from("connections")
          .select("user_id,connected_user_id")
          .eq("status", "accepted")
          .or(`user_id.eq.${uid},connected_user_id.eq.${uid}`);
        if (error) throw error;
        query = query.in("user_id", [
          uid,
          ...(data || []).map((x) =>
            x.user_id === uid ? x.connected_user_id : x.user_id,
          ),
        ]);
      }
      if (blockedIds.length)
        query = query.not("user_id", "in", `(${blockedIds.join(",")})`);
      const { data, error } = await query;
      if (error) throw error;
      return data as Post[];
    },
    getNextPageParam: (last, _pages, lastParam) =>
      last.length === pageSize ? lastParam + 1 : undefined,
  });
}
export function useClubs(
  search: string,
  department: string,
  type: ClubSearchType = "all",
  exactType?: "five_center",
) {
  const term = useDebounced(search);
  return useInfiniteQuery({
    queryKey: ["clubs", term, department, type, exactType || null],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      requireBackend();
      let q = supabase
        .from("fff_clubs")
        .select(
          "id,name,short_name,city,department_code,department_name,logo_url,type",
          { count: "exact" },
        )
        .order("name")
        .order("id")
        .range(pageParam * 30, pageParam * 30 + 29);
      const filter = clubSearchFilter(term, type);
      if (filter) q = q.or(filter);
      if (department) q = q.eq("department_code", department);
      if (exactType) q = q.eq("type", exactType);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data as Club[], count: count || 0 };
    },
    getNextPageParam: (last, _pages, p) =>
      last.rows.length === 30 ? p + 1 : undefined,
  });
}
export function useOpportunities(
  search: string,
  type: string,
  profile = "",
  department = "",
  kind: OpportunityKind = "",
) {
  const term = useDebounced(search);
  const { session } = useAuth();
  return useInfiniteQuery({
    queryKey: [
      "opportunities",
      session?.user.id,
      term,
      type,
      profile,
      department,
      kind,
    ],
    enabled: !!session,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      requireBackend();
      let q = supabase
        .from("opportunities")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam * 20, pageParam * 20 + 19);
      if (term) q = q.ilike("title", searchPattern(term));
      if (type) q = q.eq("opportunity_type", type);
      if (profile) q = q.eq("target_profile_type", profile);
      if (department) q = q.eq("location_department", department);
      const listingKind = opportunityKindFilter(kind);
      if (listingKind) q = q.eq("listing_kind", listingKind);
      const { data, error } = await q;
      if (error) throw error;
      return data as Opportunity[];
    },
    getNextPageParam: (last, _pages, p) =>
      last.length === 20 ? p + 1 : undefined,
  });
}
export function usePeople(search: string, role = "", department = "") {
  const term = useDebounced(search);
  const { session } = useAuth();
  return useInfiniteQuery({
    queryKey: ["people", session?.user.id, term, role, department],
    enabled: !!session,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("profiles")
        .select(
          "id,full_name,username,avatar_url,city,club,position,primary_role,bio,is_suspended,suspended_until",
        )
        .neq("id", session!.user.id)
        .order("full_name")
        .order("id")
        .range(pageParam * 20, pageParam * 20 + 19);
      if (term) q = q.or(profileSearchFilter(term));
      if (role) q = q.eq("primary_role", role);
      if (department) q = q.eq("department", department);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as Profile[];
      const ids = rows.map((row) => row.id);
      if (!ids.length) return { rows, hasMore: false };
      const uid = session!.user.id;
      const blocks = await supabase
        .from("user_blocks")
        .select("blocker_id,blocked_id")
        .or(
          `and(blocker_id.eq.${uid},blocked_id.in.(${ids.join(",")})),and(blocked_id.eq.${uid},blocker_id.in.(${ids.join(",")}))`,
        );
      if (blocks.error) throw blocks.error;
      const blocked = new Set(
        blocks.data.map((row) =>
          row.blocker_id === uid ? row.blocked_id : row.blocker_id,
        ),
      );
      return {
        rows: rows.filter((row) => !blocked.has(row.id) && !isSuspended(row)),
        hasMore: rows.length === 20,
      };
    },
    getNextPageParam: (last, _pages, p) => (last.hasMore ? p + 1 : undefined),
  });
}
export function useConnections(type = "connections", search = "") {
  const term = useDebounced(search);
  const { session } = useAuth();
  return useInfiniteQuery({
    queryKey: ["connections", session?.user.id, type, term],
    enabled: !!session,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("get_profile_connections", {
        requested_user: session!.user.id,
        connection_type: type,
        page_limit: 30,
        page_offset: pageParam,
        search_term: term || null,
      });
      if (error) throw error;
      return (data || []) as {
        connection_id: string;
        created_at: string;
        other_profile_id: string;
        other_full_name: string;
        other_username: string;
        other_avatar_url: string;
        other_position: string;
        other_club: string;
        status: string;
      }[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
}
function useMessageUpdates(id: string | undefined, peer?: string) {
  const cache = useQueryClient();
  useEffect(() => {
    if (!id) return;
    let disposed = false;
    const refresh = () => {
      if (disposed) return;
      void cache.invalidateQueries({ queryKey: ["conversations", id] });
      void cache.invalidateQueries({
        queryKey: peer ? ["thread", id, peer] : ["thread", id],
      });
    };
    const channel = supabase.channel(
      `native-message-updates-${id}-${peer || "inbox"}`,
    );
    for (const field of ["sender_id", "receiver_id"]) {
      for (const event of ["INSERT", "UPDATE"] as const) {
        channel.on(
          "postgres_changes",
          {
            event,
            schema: "public",
            table: "messages",
            filter: `${field}=eq.${id}`,
          },
          (payload) => {
            const row = payload.new;
            if (!("sender_id" in row) || !("receiver_id" in row)) return;
            if (row.sender_id !== id && row.receiver_id !== id) return;
            if (peer && row.sender_id !== peer && row.receiver_id !== peer)
              return;
            refresh();
          },
        );
      }
    }
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") refresh();
    });
    const activity = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      disposed = true;
      activity.remove();
      void supabase.removeChannel(channel);
    };
  }, [cache, id, peer]);
}
export function useConversations(search = "", unreadOnly = false) {
  const { session } = useAuth();
  const id = session?.user.id;
  useMessageUpdates(id);
  const term = useDebounced(search);
  return useInfiniteQuery({
    queryKey: ["conversations", id, term, unreadOnly],
    enabled: !!id,
    initialPageParam: 0,
    refetchInterval: 15000,
    queryFn: async ({ pageParam }) => {
      let { data, error } = await supabase.rpc(
        "get_native_conversations_filtered",
        {
          search_term: term,
          page_offset: pageParam,
          unread_only: unreadOnly,
        },
      );
      if (error && ["PGRST202", "42883"].includes(error.code)) {
        if (unreadOnly)
          throw new Error(
            "Le filtre Non lues n’est pas encore disponible. Choisissez Tous pour retrouver vos messages.",
          );
        ({ data, error } = await supabase.rpc("get_native_conversations", {
          search_term: term,
          page_offset: pageParam,
        }));
      }
      if (error) throw error;
      return (data || []) as (Message & { unread_count: number })[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
}
export function useThread(peer: string) {
  const { session } = useAuth();
  const id = session?.user.id;
  useMessageUpdates(id, peer);
  return useInfiniteQuery({
    queryKey: ["thread", id, peer],
    enabled: !!id && !!peer,
    initialPageParam: 0,
    refetchInterval: 10000,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${id},receiver_id.eq.${peer}),and(sender_id.eq.${peer},receiver_id.eq.${id})`,
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam * 40, pageParam * 40 + 39);
      if (error) throw error;
      return data as Message[];
    },
    getNextPageParam: (last, _pages, p) =>
      last.length === 40 ? p + 1 : undefined,
  });
}
