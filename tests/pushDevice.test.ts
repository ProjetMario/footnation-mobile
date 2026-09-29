import { beforeEach, afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  userId: "00000000-0000-4000-8000-000000000001",
  enabled: true,
  granted: true,
  renew: true,
  expoToken: "ExpoPushToken[synthetic_native]",
  rpc: vi.fn(),
  prompt: vi.fn(),
  token: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-constants", () => ({
  default: {
    executionEnvironment: "standalone",
    expoConfig: {
      extra: { eas: { projectId: "20000000-0000-4000-8000-000000000001" } },
    },
  },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));
vi.mock("expo-crypto", () => ({
  randomUUID: () => "30000000-0000-4000-8000-000000000002",
}));
vi.mock("expo-notifications", () => ({
  getPermissionsAsync: async () => ({
    granted: state.granted,
    canAskAgain: true,
  }),
  requestPermissionsAsync: state.prompt,
  getExpoPushTokenAsync: state.token,
  IosAuthorizationStatus: { PROVISIONAL: 3 },
}));
vi.mock("../src/lib/sessionStorage.native", () => ({
  default: {
    getItem: async (key: string) => state.storage.get(key) || null,
    setItem: async (key: string, value: string) => {
      state.storage.set(key, value);
    },
    removeItem: async (key: string) => {
      state.storage.delete(key);
    },
  },
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            user: { id: state.userId },
            access_token: "synthetic-auth",
          },
        },
      }),
      getUser: async () => ({ data: { user: { id: state.userId } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { push_notifications: state.enabled },
          }),
        }),
      }),
    }),
    rpc: (name: string, args: Record<string, unknown>) => ({
      setHeader: async () => {
        state.rpc(name, args);
        return {
          data:
            name === "register_native_push_device"
              ? args.p_lease_id
              : name === "renew_native_push_device"
                ? state.renew
                : true,
        };
      },
    }),
  },
}));
const recordKey = "footnation-native-push-v1";
const record = {
  installationId: "10000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000001",
  projectId: "20000000-0000-4000-8000-000000000001",
  leaseId: "30000000-0000-4000-8000-000000000001",
  token: "ExpoPushToken[synthetic_native]",
  platform: "ios",
  phase: "active",
  confirmedAt: 1,
};
function stored(overrides = {}) {
  state.storage.set(recordKey, JSON.stringify({ ...record, ...overrides }));
  state.storage.set("footnation-native-push-device", record.installationId);
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("EXPO_PUBLIC_NATIVE_PUSH_ENABLED", "true");
  state.storage.clear();
  state.userId = record.userId;
  state.enabled = true;
  state.granted = true;
  state.renew = true;
  state.expoToken = record.token;
  state.token.mockImplementation(async () => ({ data: state.expoToken }));
});
afterEach(() => vi.unstubAllEnvs());

it("does not enroll a device or request permission during automatic maintenance", async () => {
  const { refreshPushDevice } = await import("../src/lib/pushDevice.native");
  await refreshPushDevice(record.userId);
  expect(state.rpc).not.toHaveBeenCalled();
  expect(state.prompt).not.toHaveBeenCalled();
  expect(state.token).not.toHaveBeenCalled();
});
it("renews an active lease without revoking it or showing a permission prompt", async () => {
  stored();
  const { refreshPushDevice } = await import("../src/lib/pushDevice.native");
  await refreshPushDevice(record.userId);
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
    "renew_native_push_device",
    { p_installation_id: record.installationId, p_lease_id: record.leaseId },
  );
  expect(JSON.parse(state.storage.get(recordKey)!).leaseId).toBe(
    record.leaseId,
  );
  expect(JSON.parse(state.storage.get(recordKey)!).confirmedAt).toBeGreaterThan(
    1,
  );
  expect(state.prompt).not.toHaveBeenCalled();
});
it("does not re-enroll a device while its account preference is disabled", async () => {
  stored();
  state.enabled = false;
  const { refreshPushDevice } = await import("../src/lib/pushDevice.native");
  await refreshPushDevice(record.userId, true);
  expect(state.rpc).not.toHaveBeenCalled();
  expect(state.token).not.toHaveBeenCalled();
  expect(JSON.parse(state.storage.get(recordKey)!)).toEqual(record);
});
it("revokes a device when OS permission was removed, without prompting", async () => {
  stored();
  state.granted = false;
  const { refreshPushDevice } = await import("../src/lib/pushDevice.native");
  await refreshPushDevice(record.userId);
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
    "revoke_native_push_device",
    { p_installation_id: record.installationId, p_lease_id: record.leaseId },
  );
  expect(state.storage.has(recordKey)).toBe(false);
  expect(state.prompt).not.toHaveBeenCalled();
});
it("retries the same pending operation after a lost confirmation", async () => {
  stored({ phase: "pending" });
  const { refreshPushDevice } = await import("../src/lib/pushDevice.native");
  await refreshPushDevice(record.userId);
  expect(state.rpc.mock.calls.map(([name]) => name)).toEqual([
    "register_native_push_device",
  ]);
  expect(state.rpc.mock.calls[0][1].p_lease_id).toBe(record.leaseId);
});
it("only finishes a durable revocation and never registers during it", async () => {
  stored({ phase: "revoking" });
  const { refreshPushDevice } = await import("../src/lib/pushDevice.native");
  await refreshPushDevice(record.userId, true);
  expect(state.rpc.mock.calls.map(([name]) => name)).toEqual([
    "revoke_native_push_device",
  ]);
  expect(state.storage.has(recordKey)).toBe(false);
});
it("checks a rotated token even if the current lease is recent", async () => {
  stored({ confirmedAt: Date.now() });
  state.expoToken = "ExpoPushToken[rotated_synthetic]";
  const { refreshPushDevice } = await import("../src/lib/pushDevice.native");
  await refreshPushDevice(record.userId, true);
  expect(state.rpc.mock.calls.map(([name]) => name)).toEqual([
    "revoke_native_push_device",
    "register_native_push_device",
  ]);
  expect(JSON.parse(state.storage.get(recordKey)!).token).toBe(state.expoToken);
});
it("ignores unchanged tokens instead of rotating leases repeatedly", async () => {
  stored({ confirmedAt: Date.now() });
  const { refreshPushDevice } = await import("../src/lib/pushDevice.native");
  await refreshPushDevice(record.userId, true);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("does not overwrite another account's journal", async () => {
  stored();
  state.userId = "00000000-0000-4000-8000-000000000002";
  const { refreshPushDevice } = await import("../src/lib/pushDevice.native");
  await expect(refreshPushDevice(state.userId)).rejects.toThrow("autre compte");
  expect(JSON.parse(state.storage.get(recordKey)!)).toEqual(record);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("enforces the build flag even when called directly", async () => {
  vi.stubEnv("EXPO_PUBLIC_NATIVE_PUSH_ENABLED", "false");
  stored();
  const { refreshPushDevice } = await import("../src/lib/pushDevice.native");
  await expect(refreshPushDevice(record.userId)).rejects.toThrow("disponibles");
  expect(state.rpc).not.toHaveBeenCalled();
});
