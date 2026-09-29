import { onlineManager } from "@tanstack/react-query";

export type ConnectivityStatus = "unknown" | "online" | "offline";
export type ConnectivitySnapshot = {
  status: ConnectivityStatus;
  checking: boolean;
};
export type NetworkSnapshot = {
  isConnected?: boolean;
  isInternetReachable?: boolean;
};

export function networkStatus(state: NetworkSnapshot): ConnectivityStatus {
  if (state.isConnected === false || state.isInternetReachable === false)
    return "offline";
  if (state.isInternetReachable === true || state.isConnected === true)
    return "online";
  return "unknown";
}

export class OfflineError extends Error {
  constructor() {
    super("Vous êtes hors ligne. Retrouvez une connexion, puis réessayez.");
    this.name = "OfflineError";
  }
}

// Pair this guard with mutations.networkMode = "always" and retry = false.
// Otherwise React Query would pause an offline mutation and execute it later.
export function assertOnline() {
  if (!onlineManager.isOnline()) throw new OfflineError();
}

export function createConnectivityController(deps: {
  initialStatus?: ConnectivityStatus;
  read: () => Promise<NetworkSnapshot>;
  listen: (listener: (state: NetworkSnapshot) => void) => () => void;
  setOnline: (online: boolean) => void;
}) {
  let snapshot: ConnectivitySnapshot = {
    status: deps.initialStatus ?? "unknown",
    checking: false,
  };
  let active = false;
  let lifecycle = 0;
  let revision = 0;
  let requestId = 0;
  let removeListener: (() => void) | undefined;
  const subscribers = new Set<() => void>();

  function publish(next: ConnectivitySnapshot) {
    if (next.status === snapshot.status && next.checking === snapshot.checking)
      return;
    snapshot = next;
    for (const listener of subscribers) listener();
  }

  function accept(state: NetworkSnapshot) {
    const status = networkStatus(state);
    // An unavailable native reading is not evidence of lost connectivity.
    if (status === "unknown") return;
    deps.setOnline(status === "online");
    publish({ ...snapshot, status });
  }

  async function refresh(): Promise<ConnectivityStatus> {
    if (!active) return snapshot.status;
    const ownRequest = ++requestId;
    const ownRevision = revision;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    publish({ ...snapshot, checking: true });
    try {
      const state = await Promise.race([
        deps.read(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Network state timeout")),
            8000,
          );
        }),
      ]);
      // A native event is newer than an in-flight snapshot, including the
      // initial getNetworkStateAsync call at startup.
      if (active && ownRequest === requestId && ownRevision === revision)
        accept(state);
    } catch {
      // Keep the last known state when the native API is temporarily absent.
    } finally {
      clearTimeout(timeout);
      if (active && ownRequest === requestId)
        publish({ ...snapshot, checking: false });
    }
    return snapshot.status;
  }

  function stop() {
    active = false;
    lifecycle++;
    revision++;
    requestId++;
    removeListener?.();
    removeListener = undefined;
    publish({ ...snapshot, checking: false });
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
    start() {
      if (active) return;
      active = true;
      const ownLifecycle = ++lifecycle;
      revision++;
      try {
        removeListener = deps.listen((state) => {
          if (!active || ownLifecycle !== lifecycle) return;
          revision++;
          accept(state);
        });
      } catch {
        // Initial/manual reads can still work without event support.
      }
      void refresh();
    },
    stop,
    refresh,
  };
}
