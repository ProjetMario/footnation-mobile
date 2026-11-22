// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  os: "ios",
  auth: {} as any,
  modal: {} as any,
  onboardingSeen: false,
  push: vi.fn(),
  replace: vi.fn(),
  dismissInvitation: vi.fn(),
  dismissOnboarding: vi.fn(),
}));
vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  const view = ({ children }: any) => createElement("div", {}, children);
  return {
    Platform: {
      get OS() {
        return state.os;
      },
    },
    Keyboard: { dismiss: vi.fn() },
    StyleSheet: { create: (styles: any) => styles },
    View: view,
    Text: view,
    ScrollView: view,
    Pressable: ({ children, onPress, disabled }: any) =>
      createElement("button", { onClick: onPress, disabled }, children),
  };
});
vi.mock("../src/components/SafeAreaModal", () => ({
  SafeAreaModal: (props: any) => {
    state.modal = props;
    return props.visible ? props.children : null;
  },
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children,
}));
vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));
vi.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: any) => children,
}));
vi.mock("expo-router", () => ({
  usePathname: () => "/my-profile",
  router: { push: state.push, replace: state.replace },
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ isPending: false, data: [] }),
}));
vi.mock("../src/lib/supabase", () => ({ supabase: {} }));
vi.mock("../src/lib/auth", () => ({ useAuth: () => state.auth }));
vi.mock("../src/components/CallProvider", () => ({
  useCalls: () => ({ busy: false }),
}));
vi.mock("../src/lib/i18n", () => ({
  useTranslation: () => (key: string) => key,
}));
vi.mock("../src/theme", () => ({
  colors: {},
  signature: ["blue", "red"],
  useTheme: () => ({ colors: {} }),
  useThemedStyles: (fn: any) => fn({}),
}));
vi.mock("../src/lib/useInvitationActions", () => ({
  useInvitationActions: () => ({}),
}));
vi.mock("../src/lib/invitationShare", () => ({
  buildInvitationUrl: () => "https://example.test/invite",
}));
vi.mock("../src/components/InviteNetworkCard", () => ({
  InviteNetworkCard: () => null,
}));
vi.mock("lucide-react-native", () =>
  Object.fromEntries(
    [
      "Bell",
      "Briefcase",
      "PlaySquare",
      "Sparkles",
      "UserRound",
      "Users",
      "X",
    ].map((name) => [name, () => null]),
  ),
);
vi.mock("../src/lib/useActivationPrompts", () => ({
  useActivationPrompts: (userId: string) => ({
    userId,
    ready: true,
    onboardingSeen: state.onboardingSeen,
  }),
  activationPrompts: { dismissOnboarding: state.dismissOnboarding },
}));
import { NetworkInvitePrompt } from "../src/components/NetworkInvitePrompt";
import { FirstLoginOnboarding } from "../src/components/FirstLoginOnboarding";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.os = "ios";
  state.onboardingSeen = false;
  state.modal = {};
  state.auth = {
    session: { user: { id: "a" } },
    profile: {
      id: "a",
      username: "alex_test",
      first_name: "Alex",
      last_name: "Test",
      full_name: "Alex Test",
    },
    profileStatus: "ready",
    loading: false,
    error: null,
    networkInviteRequest: { key: "login-a", userId: "a" },
    dismissNetworkInvite: state.dismissInvitation,
  };
  state.dismissOnboarding.mockImplementation(() => {
    if (state.onboardingSeen) return false;
    state.onboardingSeen = true;
    return true;
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
});
const render = (Component: React.ComponentType) =>
  act(() => root.render(React.createElement(Component)));

it("keeps the iOS invitation pending until native dismissal, preventing an overlapping welcome", async () => {
  await render(NetworkInvitePrompt);
  expect(state.modal.visible).toBe(true);
  await act(() => state.modal.onRequestClose());
  expect(state.modal.visible).toBe(false);
  expect(state.dismissInvitation).not.toHaveBeenCalled();
  expect(state.auth.networkInviteRequest.key).toBe("login-a");
  await act(() => state.modal.onDismiss());
  expect(state.dismissInvitation).toHaveBeenCalledExactlyOnceWith("login-a");
});

it.each(["android", "web"])(
  "does not wait for an iOS-only callback on %s",
  async (os) => {
    state.os = os;
    await render(NetworkInvitePrompt);
    await act(() => state.modal.onRequestClose());
    expect(state.dismissInvitation).toHaveBeenCalledExactlyOnceWith("login-a");
  },
);

it("dismissing welcome keeps the current profile instead of navigating under a closing modal", async () => {
  state.auth.networkInviteRequest = null;
  await render(FirstLoginOnboarding);
  expect(state.modal.visible).toBe(true);
  await act(() => state.modal.onRequestClose());
  expect(state.dismissOnboarding).toHaveBeenCalledExactlyOnceWith("a");
  await act(() => state.modal.onDismiss());
  expect(state.push).not.toHaveBeenCalled();
  expect(state.replace).not.toHaveBeenCalled();
});

it.each([false, true])(
  "defers a welcome destination until iOS dismissal and ignores a changed account=%s",
  async (changedAccount) => {
    state.auth.networkInviteRequest = null;
    await render(FirstLoginOnboarding);
    const button = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent === "onboarding.completeProfile",
    )!;
    await act(() => button.click());
    expect(state.push).not.toHaveBeenCalled();
    if (changedAccount) state.auth.session.user.id = "b";
    await render(FirstLoginOnboarding);
    await act(() => state.modal.onDismiss());
    if (changedAccount) expect(state.push).not.toHaveBeenCalled();
    else expect(state.push).toHaveBeenCalledExactlyOnceWith("/settings");
    await act(() => state.modal.onDismiss());
    expect(state.push).toHaveBeenCalledTimes(changedAccount ? 0 : 1);
  },
);
