import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ enabled: true }));
vi.mock("expo-router", () => ({
  Stack: "stack",
  router: { replace: vi.fn() },
}));
vi.mock("../src/components/ui", () => ({
  Button: "button",
  Empty: "empty",
  Screen: "screen",
}));
vi.mock("../src/components/MemberAccessBoundary", () => ({
  MemberAccessBoundary: "member-boundary",
}));
vi.mock("../src/lib/supportersConfig", () => ({
  get SUPPORTERS_ENABLED() {
    return state.enabled;
  },
}));
import SupportersLayout from "../app/supporters/_layout";

beforeEach(() => {
  state.enabled = true;
});
const clubId = "93000000-0000-4000-8000-000000000001";
const groupId = "94000000-0000-4000-8000-000000000001";

// Expo passes child scene names to the nested stack: protecting only the root
// scene named "supporters" would lose new/[id] during onboarding.
it.each([
  [{ name: "index", params: { clubId } }, `/supporters?clubId=${clubId}`],
  [
    { name: "new", params: { clubId, city: "Lyon" } },
    `/supporters/new?clubId=${clubId}&city=Lyon`,
  ],
  [{ name: "[id]", params: { id: groupId } }, `/supporters/${groupId}`],
  [{ name: "[id]", params: { id: "../help" } }, "/supporters"],
])("protects the actual child destination %j", (route, expected) => {
  const stack = SupportersLayout();
  const boundary = stack.props.screenLayout({
    children: "protected content",
    route,
  });
  expect(boundary.type).toBe("member-boundary");
  expect(boundary.props).toEqual({
    path: expected,
    children: "protected content",
  });
});

it("does not mount any supporter scene while disabled", () => {
  state.enabled = false;
  expect(SupportersLayout().type).toBe("screen");
});
