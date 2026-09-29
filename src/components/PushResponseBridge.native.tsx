import React, { useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useAuth } from "../lib/auth";
import { pushDeviceAvailable, refreshPushDevice } from "../lib/pushDevice";
import {
  createPushResponseController,
  resolvePushResponse,
} from "../lib/pushResponse";
import { supabase } from "../lib/supabase";

if (pushDeviceAvailable) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export function PushResponseBridge() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const controller = useMemo(
    () =>
      createPushResponseController({
        currentUserId: () => currentUser.current,
        lastResponseId: () =>
          Notifications.getLastNotificationResponse()?.notification.request
            .identifier,
        clear: () => Notifications.clearLastNotificationResponse(),
        navigate: (path) => router.push(path),
        resolve: (expectedUserId, data) =>
          resolvePushResponse(expectedUserId, data, {
            authenticatedUserId: async () => {
              const auth = await supabase.auth.getUser();
              if (auth.error) throw auth.error;
              return auth.data.user?.id || null;
            },
            notificationLink: async (notificationId, receiverId) => {
              const result = await supabase
                .from("notifications")
                .select("link")
                .eq("id", notificationId)
                .eq("receiver_id", receiverId)
                .maybeSingle();
              if (result.error) throw result.error;
              return result.data?.link;
            },
          }),
      }),
    [],
  );

  useEffect(() => {
    if (!pushDeviceAvailable) return;
    const handle = (value: Notifications.NotificationResponse | null) => {
      if (
        !value ||
        value.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
      )
        return;
      void controller
        .handle({
          id: value.notification.request.identifier,
          data: value.notification.request.content.data,
        })
        .catch(() => {
          /* Keep the OS response for the next foreground retry. */
        });
    };
    const refresh = (force = false) => {
      if (userId)
        void refreshPushDevice(userId, force).catch(() => {
          // Offline/auth failures retain the durable journal; retry next foreground.
        });
    };
    refresh();
    void handle(Notifications.getLastNotificationResponse());
    const response = Notifications.addNotificationResponseReceivedListener(
      (value) => void handle(value),
    );
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
        void handle(Notifications.getLastNotificationResponse());
      }
    });
    const token = Notifications.addPushTokenListener(() => refresh(true));
    return () => {
      controller.invalidate();
      response.remove();
      appState.remove();
      token.remove();
    };
  }, [controller, userId]);

  return null;
}
