import { afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  platform: { OS: "web" },
  makeRedirectUri: vi.fn(() => "com.footnation.app://auth/callback"),
}));
vi.mock("react-native", () => ({ Platform: mock.platform }));
vi.mock("expo-auth-session", () => ({ makeRedirectUri: mock.makeRedirectUri }));
import { authRedirectUri } from "../src/lib/authRedirectUri";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  mock.platform.OS = "web";
});
describe("authentication callback destinations", () => {
  it("keeps OAuth and email recovery on the deployed /app mount and current origin", () => {
    vi.stubGlobal("window", {
      location: { origin: "https://www.foot-nation.com" },
    });
    vi.stubEnv("EXPO_PUBLIC_WEB_BASE_PATH", "/app");
    expect(authRedirectUri()).toBe(
      "https://www.foot-nation.com/app/auth/callback",
    );
    const recovery = new URL(
      authRedirectUri({ recovery: "1", next: "/messages" }),
    );
    expect(recovery.pathname).toBe("/app/auth/callback");
    expect(recovery.searchParams.get("next")).toBe("/messages");
    expect(recovery.searchParams.get("recovery")).toBe("1");
    expect(mock.makeRedirectUri).not.toHaveBeenCalled();
  });
  it("supports standalone Expo web development without a mount", () => {
    vi.stubGlobal("window", { location: { origin: "http://localhost:8082" } });
    vi.stubEnv("EXPO_PUBLIC_WEB_BASE_PATH", "");
    expect(authRedirectUri()).toBe("http://localhost:8082/auth/callback");
  });
  it("rejects an unexpected mount instead of redirecting credentials elsewhere", () => {
    vi.stubGlobal("window", {
      location: { origin: "https://www.foot-nation.com" },
    });
    vi.stubEnv("EXPO_PUBLIC_WEB_BASE_PATH", "//another.example");
    expect(() => authRedirectUri()).toThrow("invalide");
  });
  it.each(["ios", "android"])(
    "retains %s app schemes and parameters",
    (platform) => {
      mock.platform.OS = platform;
      vi.stubEnv("EXPO_PUBLIC_WEB_BASE_PATH", "/app");
      expect(authRedirectUri({ recovery: "1" })).toBe(
        "com.footnation.app://auth/callback",
      );
      expect(mock.makeRedirectUri).toHaveBeenCalledWith({
        scheme: "com.footnation.app",
        path: "auth/callback",
        queryParams: { recovery: "1" },
      });
    },
  );
});
