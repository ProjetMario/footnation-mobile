import { afterEach, describe, expect, it, vi } from "vitest";
import {
  onlineManager,
  QueryObserver,
  type QueryClient,
} from "@tanstack/react-query";
import { createAppQueryClient } from "../src/lib/queryClient";
import {
  assertOnline,
  createConnectivityController,
  networkStatus,
  OfflineError,
  type NetworkSnapshot,
} from "../src/lib/connectivity";

vi.mock("../src/lib/monitoring", () => ({ reportError: vi.fn() }));

const clients: QueryClient[] = [];
function setupClient() {
  const client = createAppQueryClient();
  clients.push(client);
  client.mount();
  return client;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}
function setup(read = vi.fn(async (): Promise<NetworkSnapshot> => ({}))) {
  let event!: (state: NetworkSnapshot) => void;
  const remove = vi.fn();
  const setOnline = vi.fn();
  const controller = createConnectivityController({
    read,
    listen: (listener) => {
      event = listener;
      return remove;
    },
    setOnline,
  });
  return {
    controller,
    setOnline,
    read,
    remove,
    getListener: () => event,
    event: (value: NetworkSnapshot) => event(value),
  };
}

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.unmount();
    client.clear();
  }
  vi.useRealTimers();
  onlineManager.setOnline(true);
});

describe("application query client offline behavior", () => {
  it("rejects an offline write without running it automatically after reconnect", async () => {
    const client = setupClient();
    const write = vi.fn(async () => "saved");
    onlineManager.setOnline(false);
    const mutation = client
      .getMutationCache()
      .build(client, { mutationFn: write });
    await expect(mutation.execute(undefined)).rejects.toThrow(OfflineError);
    expect(mutation.state.isPaused).toBe(false);
    expect(write).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
    await settle();
    expect(write).not.toHaveBeenCalled();

    const explicitRetry = client
      .getMutationCache()
      .build(client, { mutationFn: write });
    await expect(explicitRetry.execute(undefined)).resolves.toBe("saved");
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("does not retry an in-flight write that fails during a network loss", async () => {
    const client = setupClient();
    const write = vi.fn(async () => {
      onlineManager.setOnline(false);
      throw new Error("Connection interrupted");
    });
    const mutation = client
      .getMutationCache()
      .build(client, { mutationFn: write });
    await expect(mutation.execute(undefined)).rejects.toThrow(
      "Connection interrupted",
    );
    onlineManager.setOnline(true);
    await settle();
    expect(write).toHaveBeenCalledTimes(1);
    expect(mutation.state.isPaused).toBe(false);
  });

  it("keeps cached content visible while reads are paused, then refreshes it", async () => {
    const client = setupClient();
    client.setQueryData(["offline-fixture"], "cached content");
    onlineManager.setOnline(false);
    const read = vi.fn(async () => "fresh content");
    const observer = new QueryObserver(client, {
      queryKey: ["offline-fixture"],
      queryFn: read,
      staleTime: 0,
    });
    const unsubscribe = observer.subscribe(() => {});
    expect(observer.getCurrentResult().data).toBe("cached content");
    expect(observer.getCurrentResult().fetchStatus).toBe("paused");
    expect(read).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toBe("fresh content"),
    );
    expect(read).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe("connectivity state", () => {
  it("distinguishes missing reachability from an explicit connection failure", () => {
    expect(networkStatus({})).toBe("unknown");
    expect(networkStatus({ isConnected: true })).toBe("online");
    expect(
      networkStatus({ isConnected: true, isInternetReachable: false }),
    ).toBe("offline");
    expect(
      networkStatus({ isConnected: false, isInternetReachable: true }),
    ).toBe("offline");
  });

  it("keeps startup optimistic when the platform cannot report network status", async () => {
    const { controller, setOnline } = setup(
      vi.fn(async () => {
        throw new Error("unavailable");
      }),
    );
    controller.start();
    await settle();
    expect(controller.getSnapshot()).toEqual({
      status: "unknown",
      checking: false,
    });
    expect(setOnline).not.toHaveBeenCalled();
    controller.stop();
  });

  it("can preserve a known offline state when the provider is remounted", async () => {
    const controller = createConnectivityController({
      initialStatus: "offline",
      read: async () => ({}),
      listen: () => () => {},
      setOnline: vi.fn(),
    });
    expect(controller.getSnapshot().status).toBe("offline");
    controller.start();
    await settle();
    expect(controller.getSnapshot().status).toBe("offline");
    controller.stop();
  });

  it("does not replace a fresh offline event with an older startup snapshot", async () => {
    const initial = deferred<NetworkSnapshot>();
    const { controller, event, setOnline } = setup(
      vi.fn(() => initial.promise),
    );
    controller.start();
    event({ isConnected: false });
    initial.resolve({ isConnected: true });
    await settle();
    expect(controller.getSnapshot()).toEqual({
      status: "offline",
      checking: false,
    });
    expect(setOnline).toHaveBeenCalledExactlyOnceWith(false);
    controller.stop();
  });

  it("preserves the last confirmed state when a retry fails or returns unknown", async () => {
    const read = vi
      .fn<() => Promise<NetworkSnapshot>>()
      .mockResolvedValueOnce({ isConnected: false })
      .mockRejectedValueOnce(new Error("native failure"))
      .mockResolvedValueOnce({});
    const { controller } = setup(read);
    controller.start();
    await settle();
    expect(await controller.refresh()).toBe("offline");
    expect(await controller.refresh()).toBe("offline");
    expect(controller.getSnapshot().checking).toBe(false);
    controller.stop();
  });

  it("ignores stale reads and detached listeners after a restart", async () => {
    const initial = deferred<NetworkSnapshot>();
    const { controller, event, getListener, remove, setOnline } = setup(
      vi
        .fn<() => Promise<NetworkSnapshot>>()
        .mockReturnValueOnce(initial.promise)
        .mockResolvedValueOnce({ isConnected: true }),
    );
    controller.start();
    const oldListener = getListener();
    controller.stop();
    event({ isConnected: false });
    expect(setOnline).not.toHaveBeenCalled();
    controller.start();
    await settle();
    oldListener({ isConnected: false });
    initial.resolve({ isConnected: false });
    await settle();
    expect(controller.getSnapshot()).toEqual({
      status: "online",
      checking: false,
    });
    expect(remove).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it("uses the newest manual retry when several snapshots resolve out of order", async () => {
    const older = deferred<NetworkSnapshot>();
    const { controller } = setup(
      vi
        .fn<() => Promise<NetworkSnapshot>>()
        .mockReturnValueOnce(older.promise)
        .mockResolvedValueOnce({ isInternetReachable: false }),
    );
    controller.start();
    expect(await controller.refresh()).toBe("offline");
    older.resolve({ isConnected: true });
    await settle();
    expect(controller.getSnapshot().status).toBe("offline");
    controller.stop();
  });

  it("releases the retry indicator if the native network reading never returns", async () => {
    vi.useFakeTimers();
    const { controller } = setup(
      vi.fn(() => new Promise<NetworkSnapshot>(() => {})),
    );
    controller.start();
    expect(controller.getSnapshot().checking).toBe(true);
    await vi.advanceTimersByTimeAsync(8000);
    expect(controller.getSnapshot()).toEqual({
      status: "unknown",
      checking: false,
    });
    controller.stop();
  });

  it("rejects a known offline action with a recoverable French error", () => {
    onlineManager.setOnline(false);
    expect(assertOnline).toThrow(OfflineError);
    onlineManager.setOnline(true);
    expect(assertOnline).not.toThrow();
  });
});
