import { useEffect } from "react";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { useAuth } from "../lib/auth";
import { supportRpc } from "../lib/support";

/** A lease for this foreground app session only, never a permanent online flag. */
export function ProfilePresenceBridge() {
  const uid = useAuth().session?.user.id;
  useEffect(() => {
    if (!uid) return;
    const sessionId = randomUUID();
    let disposed = false;
    let sending = false;
    let sentActive = false;
    const publish = async () => {
      if (sending) return;
      const active =
        !disposed && focusManager.isFocused() && onlineManager.isOnline();
      if (!active && !sentActive) return;
      sending = true;
      try {
        await supportRpc(uid, "set_profile_presence", {
          p_session_id: sessionId,
          p_active: active,
        });
        sentActive = active;
      } catch {
        /* Unknown or offline presence never creates a visible green dot. */
      } finally {
        sending = false;
        if (
          active &&
          sentActive &&
          (disposed || !focusManager.isFocused() || !onlineManager.isOnline())
        )
          void publish();
      }
    };
    void publish();
    const timer = setInterval(() => void publish(), 25000);
    const removeFocus = focusManager.subscribe(() => void publish());
    const removeOnline = onlineManager.subscribe(() => void publish());
    return () => {
      disposed = true;
      clearInterval(timer);
      removeFocus();
      removeOnline();
      void publish();
    };
  }, [uid]);
  return null;
}
