import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { notifyStoryExpired } from "../lib/notificationEvents";

export function AnniversaryNotifications() {
  const { session } = useAuth();
  const cache = useQueryClient();
  const lastRun = useRef<string | null>(null);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) {
      lastRun.current = null;
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const key = `${uid}:${today}`;
    if (lastRun.current === key) return;
    lastRun.current = key;
    void supabase
      .rpc("enqueue_native_anniversary_notifications", { p_today: today })
      .then((result) => {
        if (!result.error && (result.data || 0) > 0) {
          void cache.invalidateQueries({ queryKey: ["notifications", uid] });
          void cache.invalidateQueries({
            queryKey: ["notifications", uid, "unread-count"],
          });
        }
      });
    void supabase
      .from("stories")
      .select("id,expires_at")
      .eq("user_id", uid)
      .lt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(10)
      .then(async (result) => {
        if (result.error) return;
        let created = 0;
        for (const story of result.data || [])
          created += await notifyStoryExpired({ ownerId: uid, storyId: story.id });
        if (created > 0) {
          void cache.invalidateQueries({ queryKey: ["notifications", uid] });
          void cache.invalidateQueries({
            queryKey: ["notifications", uid, "unread-count"],
          });
        }
      });
  }, [cache, session?.user.id]);

  return null;
}
