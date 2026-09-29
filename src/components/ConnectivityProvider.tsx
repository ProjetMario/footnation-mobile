import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState, Platform } from "react-native";
import * as Network from "expo-network";
import {
  focusManager,
  onlineManager,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createConnectivityController,
  type ConnectivityStatus,
} from "../lib/connectivity";

type ConnectivityValue = {
  status: ConnectivityStatus;
  isOffline: boolean;
  checking: boolean;
  retry: () => Promise<void>;
};
const ConnectivityContext = createContext<ConnectivityValue>({
  status: "unknown",
  isOffline: false,
  checking: false,
  retry: async () => {},
});

export function ConnectivityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = useQueryClient();
  const [controller] = useState(() =>
    createConnectivityController({
      initialStatus: onlineManager.isOnline() ? "unknown" : "offline",
      read: () => Network.getNetworkStateAsync(),
      listen: (listener) => {
        const subscription = Network.addNetworkStateListener(listener);
        return () => subscription.remove();
      },
      setOnline: (online) => onlineManager.setOnline(online),
    }),
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(() => {
    onlineManager.setEventListener(() => {
      controller.start();
      return () => controller.stop();
    });
    if (Platform.OS !== "web" && AppState.currentState)
      focusManager.setFocused(AppState.currentState === "active");
    const subscription = AppState.addEventListener("change", (state) => {
      if (Platform.OS !== "web") focusManager.setFocused(state === "active");
      if (state === "active") void controller.refresh();
    });
    return () => {
      subscription.remove();
      onlineManager.setEventListener(() => undefined);
      if (Platform.OS !== "web") focusManager.setFocused(undefined);
    };
  }, [controller]);

  const retry = useCallback(async () => {
    if ((await controller.refresh()) === "online")
      await client.refetchQueries({ type: "active" }, { cancelRefetch: false });
  }, [client, controller]);

  return (
    <ConnectivityContext.Provider
      value={{
        ...snapshot,
        isOffline: snapshot.status === "offline",
        retry,
      }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}
