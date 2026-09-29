import { AppState } from "react-native";
import { randomUUID } from "expo-crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { CallAction, CallBackend, CallMode, CallRecord } from "./calls";

const client = supabase;

function backendError(error: { message: string; code?: string }): Error {
  if (/busy/i.test(error.message))
    return new Error("Votre contact est déjà en appel. Réessayez plus tard.");
  if (/rate|too many/i.test(error.message))
    return new Error(
      "Trop de tentatives d’appel. Patientez avant de réessayer.",
    );
  if (
    /not allowed|forbidden|unauthorized|not authorized/i.test(error.message)
  ) {
    return new Error(
      "Cet appel n’est pas autorisé. Vérifiez que vous êtes toujours connectés sur FootNation.",
    );
  }
  if (/expired/i.test(error.message))
    return new Error("L’appel a expiré. Relancez un appel.");
  if (error.code === "PGRST202" || error.code === "42P01") {
    return new Error(
      "Le service d’appels n’est pas encore activé sur le serveur.",
    );
  }
  return new Error(
    "Le service d’appels est indisponible. Vérifiez votre connexion et réessayez.",
  );
}

export const callBackend: CallBackend = {
  async getIceServers(peerId) {
    const { data, error } = await supabase.functions.invoke("call-ice-config", {
      body: { peerId },
    });
    if (error || !data?.iceServers?.length) {
      throw new Error(
        "Le service d’appels est indisponible ou son relais réseau n’est pas encore configuré.",
      );
    }
    return data.iceServers;
  },
  async getPeer(peerId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .eq("id", peerId)
      .single();
    if (error || !data) throw new Error("Profil indisponible");
    return {
      id: peerId,
      name: data.full_name || data.username || "Votre contact",
      avatarUrl: data.avatar_url,
    };
  },
  async create(id, peerId, mode, offer) {
    const { data, error } = await client.rpc("create_call", {
      p_call_id: id,
      p_callee_id: peerId,
      p_mode: mode,
      p_offer: offer,
    });
    if (error || !data) throw backendError(error ?? { message: "Unavailable" });
    return data as CallRecord;
  },
  async respond(id, action, answer) {
    const { data, error } = await client.rpc("respond_to_call", {
      p_call_id: id,
      p_action: action,
      ...(answer ? { p_answer: answer } : {}),
    });
    if (error || !data) throw backendError(error ?? { message: "Unavailable" });
    return data as CallRecord;
  },
};

export function watchCalls(
  userId: string,
  getActiveId: () => string | null,
  onCall: (record: CallRecord) => Promise<void>,
) {
  let stopped = false;
  let polling = false;
  let subscribed = false;
  const deliver = (record: CallRecord) => {
    if (!stopped) void onCall(record);
  };
  const channel = client
    .channel(`calls:${userId}:${randomUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "call_sessions",
        filter: `caller_id=eq.${userId}`,
      },
      (payload) => {
        if ("id" in payload.new) deliver(payload.new as CallRecord);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "call_sessions",
        filter: `callee_id=eq.${userId}`,
      },
      (payload) => {
        if ("id" in payload.new) deliver(payload.new as CallRecord);
      },
    )
    .subscribe((status) => {
      subscribed = status === "SUBSCRIBED";
      if (subscribed) void poll();
    });

  const poll = async () => {
    if (polling || stopped) return;
    polling = true;
    try {
      const activeId = getActiveId();
      const query = client.from("call_sessions").select("*");
      const { data } = await (
        activeId
          ? query.eq("id", activeId)
          : query
              .eq("callee_id", userId)
              .eq("status", "ringing")
              .gt("expires_at", new Date().toISOString())
      )
        .order("created_at", { ascending: false })
        .limit(1);
      data?.forEach(deliver);
    } finally {
      polling = false;
    }
  };
  void poll();
  const interval = setInterval(() => {
    if (!subscribed || getActiveId()) void poll();
  }, 3000);
  const appSubscription = AppState.addEventListener("change", (state) => {
    if (state === "active") void poll();
  });
  return () => {
    stopped = true;
    clearInterval(interval);
    appSubscription.remove();
    void client.removeChannel(channel);
  };
}
