import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  slots: [] as any[],
  cursor: 0,
  admission: { data: { state: "eligible", allowed: true }, error: null } as any,
  session: { user: { id: "player" }, access_token: "fixture" },
  profileRead: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState(initial: any) {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = initial;
    return [
      h.slots[index],
      (value: any) => {
        h.slots[index] = value;
      },
    ];
  },
  useRef(initial: any) {
    const index = h.cursor++;
    return (h.slots[index] ||= { current: initial });
  },
  useCallback: (fn: any) => fn,
  useEffect: () => {},
}));
vi.mock("react-native", () => ({ AppState: {}, Platform: { OS: "web" } }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
  onlineManager: { isOnline: () => true },
}));
vi.mock("../src/lib/supabase", () => ({
  backendConfigured: true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: h.session } }) },
    rpc: () => ({ setHeader: async () => h.admission }),
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: h.profileRead }) }),
    }),
  },
}));
vi.mock("../src/lib/sessionStorage", () => ({ default: {} }));
vi.mock("../src/lib/storyPublicationStorage", () => ({
  storyPublicationJournal: {},
}));
vi.mock("../src/lib/postDraftStorage", () => ({ postDraftJournal: {} }));
vi.mock("../src/lib/messageOutboxStorage", () => ({
  forgetMessageOutboxForAccount: vi.fn(),
}));
vi.mock("../src/lib/experienceSaveStorage", () => ({
  forgetExperienceSaveForAccount: vi.fn(),
}));
vi.mock("../src/lib/hiddenPostStorage", () => ({
  forgetHiddenPostsForAccount: vi.fn(),
}));
vi.mock("../src/lib/accountDeletionLocalFiles", () => ({
  forgetDeletedAccountFiles: vi.fn(),
}));
vi.mock("../src/lib/pushDevice", () => ({ unregisterPushDevice: vi.fn() }));
vi.mock("../src/lib/monitoring", () => ({ reportError: vi.fn() }));
import { AuthProvider } from "../src/lib/auth";
function render() {
  h.cursor = 0;
  return AuthProvider({ children: null }).props.value;
}
beforeEach(() => {
  h.slots = [];
  h.admission = { data: { state: "eligible", allowed: true }, error: null };
  h.profileRead
    .mockReset()
    .mockResolvedValue({
      data: { id: "player", full_name: "Recette" },
      error: null,
    });
});
it("loads the profile only after a positive admission result", async () => {
  await render().reload();
  expect(render().memberAccess?.allowed).toBe(true);
  expect(render().profile?.id).toBe("player");
});
it.each([
  { data: null, error: { message: "RPC unavailable" } },
  { data: null, error: null },
  { data: { state: "parent_pending", allowed: true }, error: null },
])(
  "keeps the signed-in app usable when admission is unavailable: %j",
  async (response) => {
    h.admission = response;
    await render().reload();
    expect(render().memberAccess?.allowed).toBe(true);
    expect(render().memberAccess?.state).toBe("eligible");
    expect(render().loading).toBe(false);
    expect(render().error).toBeNull();
    expect(render().profile?.id).toBe("player");
  },
);
it("keeps previously admitted screens after an online admission failure", async () => {
  await render().reload();
  h.admission = { data: null, error: { message: "failure" } };
  await render().reload();
  expect(render().memberAccess?.allowed).toBe(true);
  expect(render().profile?.id).toBe("player");
  h.admission = { data: { state: "eligible", allowed: true }, error: null };
  await render().reload();
  expect(render().memberAccess?.allowed).toBe(true);
  expect(render().error).toBeNull();
});
it("keeps parental restrictions instead of fetching the profile", async () => {
  h.admission = {
    data: { state: "parent_pending", allowed: false },
    error: null,
  };
  await render().reload();
  expect(render().memberAccess?.state).toBe("parent_pending");
  expect(h.profileRead).not.toHaveBeenCalled();
});
