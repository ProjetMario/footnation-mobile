import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { backendConfigured, supabase } from "../lib/supabase";
import {
  createGrowthActivityRecorder,
  type GrowthPlatform,
} from "../lib/growthMetrics";

// Optional product measurement must never delay sign-in or block application use.
// No background heartbeat: one authenticated presence record per UTC day/platform.
export function GrowthActivityBridge() {
  const { session, profile, profileStatus } = useAuth();
  const userId = session?.user.id;
  const ready = profileStatus === "ready" && profile?.id === userId;
  useEffect(() => {
    const platform = Platform.OS;
    if (
      !backendConfigured ||
      !userId ||
      !ready ||
      !["ios", "android", "web"].includes(platform)
    )
      return;
    const recorder = createGrowthActivityRecorder(async (actorId, os) => {
      const result = await supabase.rpc("record_native_app_activity", {
        p_actor_id: actorId,
        p_platform: os,
      });
      return !result.error && result.data === true;
    });
    let disposed = false;
    const record = () => {
      const visible =
        platform === "web"
          ? typeof document !== "undefined" &&
            document.visibilityState === "visible"
          : AppState.currentState === "active";
      void recorder.attempt({
        userId,
        platform: platform as GrowthPlatform,
        now: Date.now(),
        enabled: !disposed && visible && onlineManager.isOnline(),
      });
    };
    record();
    const subscription = AppState.addEventListener("change", record);
    const unsubscribe = onlineManager.subscribe(record);
    // Keeps a foreground session spanning midnight measurable, with no repeated RPC.
    const interval = setInterval(record, 60_000);
    if (platform === "web" && typeof document !== "undefined")
      document.addEventListener("visibilitychange", record);
    return () => {
      disposed = true;
      recorder.reset();
      clearInterval(interval);
      subscription.remove();
      unsubscribe();
      if (platform === "web" && typeof document !== "undefined")
        document.removeEventListener("visibilitychange", record);
    };
  }, [userId, ready]);
  return null;
}
