import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "expo-crypto";
import { requireBackend, supabase } from "./supabase";
import type { LiveRtcBackend, LiveRtcPeer, LiveRtcStream } from "./liveRtc";

function failure(error: unknown): Error {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  if (
    /capacity|full|limit.*viewer|too many viewers|huit spectateurs|8 spectateurs/i.test(
      message,
    )
  )
    return new Error(
      "Ce live accueille déjà 8 spectateurs. Réessayez un peu plus tard.",
    );
  if (
    (code === "23503" && /live_streams_broadcaster_id_fkey/.test(message)) ||
    (code === "42501" &&
      /Complétez votre profil pour lancer un live/i.test(message))
  )
    return Object.assign(
      new Error("Votre profil doit être complété avant de lancer un live."),
      { code: "PROFILE_REQUIRED" },
    );
  if (/Un live est déjà en cours/i.test(message))
    return new Error(
      "Un live est déjà en cours avec ce compte. Arrêtez-le avant d’en lancer un autre.",
    );
  if (/Vous regardez déjà ce live/i.test(message))
    return new Error(
      "Ce compte regarde déjà ce live sur un autre écran. Fermez-le puis réessayez.",
    );
  if (["PGRST202", "42P01"].includes(code))
    return new Error(
      "Le service de diffusion vidéo n’est pas encore disponible. Réessayez dans un instant.",
    );
  if (code === "42501" || /not authorized|forbidden|not allowed/i.test(message))
    return new Error(
      "Ce live n’est pas accessible avec ce compte. Vérifiez votre connexion.",
    );
  if (/ended|expired|not active/i.test(message))
    return new Error("Ce live est terminé.");
  return new Error(
    "La connexion au live a échoué. Vérifiez votre réseau puis réessayez.",
  );
}
const streamFields =
  "id,transport,broadcaster_id,status,started_at,ended_at,expires_at";
const peerFields = "id,stream_id,viewer_id,status,offer,answer,expires_at";

async function request<T>(
  run: (signal: AbortSignal) => PromiseLike<T>,
): Promise<T> {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      abort.abort();
      reject(
        new Error(
          "Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.",
        ),
      );
    }, 15_000);
  });
  try {
    return await Promise.race([Promise.resolve(run(abort.signal)), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Explicit client injection also lets integration tests use isolated accounts. */
export function liveRtcBackendForClient(
  client: SupabaseClient,
): LiveRtcBackend {
  async function rpc<T>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    const result = await request((signal) =>
      client.rpc(name, args).abortSignal(signal),
    );
    if (result.error || !result.data) throw failure(result.error);
    return result.data as T;
  }
  return {
    start: (input) =>
      rpc<LiveRtcStream>("start_live_stream", {
        p_stream_id: input.id,
        p_title: input.title,
        p_match_id: input.matchId || null,
        p_club_id: input.clubId || null,
        p_home_team: input.homeTeam || null,
        p_away_team: input.awayTeam || null,
      }),
    stream: async (id) => {
      const result = await request((signal) =>
        client
          .from("live_streams")
          .select(streamFields)
          .eq("id", id)
          .abortSignal(signal)
          .maybeSingle(),
      );
      if (result.error) throw failure(result.error);
      return result.data as LiveRtcStream | null;
    },
    manage: (id, action) =>
      rpc<LiveRtcStream>("manage_live_stream", {
        p_stream_id: id,
        p_action: action,
      }),
    ice: async (streamId) => {
      const result = await request((signal) =>
        client.functions.invoke("live-ice-config", {
          body: { streamId },
          signal,
        }),
      );
      if (
        result.error ||
        !Array.isArray(result.data?.iceServers) ||
        !result.data.iceServers.length
      )
        throw new Error(
          "Le relais vidéo du live est indisponible. Réessayez dans un instant.",
        );
      return result.data.iceServers;
    },
    peers: async (streamId) => {
      const result = await request((signal) =>
        client
          .from("live_stream_peers")
          .select(peerFields)
          .eq("stream_id", streamId)
          .neq("status", "ended")
          .order("created_at")
          .limit(8)
          .abortSignal(signal),
      );
      if (result.error) throw failure(result.error);
      return (result.data || []) as LiveRtcPeer[];
    },
    peer: async (id) => {
      const result = await request((signal) =>
        client
          .from("live_stream_peers")
          .select(peerFields)
          .eq("id", id)
          .abortSignal(signal)
          .maybeSingle(),
      );
      if (result.error) throw failure(result.error);
      return result.data as LiveRtcPeer | null;
    },
    join: (streamId, id, offer) =>
      rpc<LiveRtcPeer>("join_live_stream", {
        p_stream_id: streamId,
        p_peer_id: id,
        p_offer: offer,
      }),
    respond: (id, action, answer) =>
      rpc<LiveRtcPeer>("respond_live_stream_peer", {
        p_peer_id: id,
        p_action: action,
        ...(answer ? { p_answer: answer } : {}),
      }),
    watch: (streamId, refresh) => {
      const channel = client
        .channel(`live-rtc:${streamId}:${randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "live_stream_peers",
            filter: `stream_id=eq.${streamId}`,
          },
          refresh,
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "live_streams",
            filter: `id=eq.${streamId}`,
          },
          refresh,
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") refresh();
        });
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}

/** Fresh tokens may rotate, but a session can never migrate to another user. */
export async function createLiveRtcBackend(
  userId: string,
): Promise<LiveRtcBackend> {
  requireBackend();
  const token = async () => {
    const result = await supabase.auth.getSession();
    if (result.error || result.data.session?.user.id !== userId)
      throw new Error(
        "Votre session a changé. Reconnectez-vous pour accéder au live.",
      );
    return result.data.session.access_token;
  };
  await token();
  const client = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: token,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  return liveRtcBackendForClient(client);
}
