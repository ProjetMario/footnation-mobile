import { afterEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  session: { user: { id: "account-a" }, access_token: "token-a" },
  rpc: vi.fn(), writerRpc: vi.fn(), createClient: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({ requireBackend: () => {}, supabase: {
  rpc: fixture.rpc, auth: { getSession: async () => ({ data: { session: fixture.session }, error: null }) },
} }));
vi.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => {
  fixture.createClient(...args); return { rpc: fixture.writerRpc };
} }));
vi.mock("../src/lib/readAsset", () => ({ readAsset: async () => new Uint8Array([1, 2, 3]).buffer }));
import { listDiscussions, getDiscussion, discussionWriter } from "../src/lib/clubDiscussions";

afterEach(() => {
  vi.clearAllMocks(); vi.unstubAllGlobals();
  fixture.session = { user: { id: "account-a" }, access_token: "token-a" };
});
it("global public listing normalizes only filters and paginates without requiring a club membership", async () => {
  fixture.rpc.mockReturnValue({abortSignal: () => Promise.resolve({ data: { items: [], total: 0, has_more: false }, error: null })});
  await listDiscussions({ country: " fr ", language: " EN ", query: " match ", sort: "popular" }, 20);
  expect(fixture.rpc).toHaveBeenCalledWith("get_club_discussions", expect.objectContaining({ p_club_id: null,
    p_country: "FR", p_language: "en", p_query: "match", p_sort: "popular", p_limit: 20, p_offset: 20 }));
});
it("a failed or malformed read is an error, never an empty forum", async () => {
  fixture.rpc.mockReturnValueOnce({abortSignal: () => Promise.resolve({ data: null, error: { code: "P0001", message: "Unavailable" } })});
  await expect(listDiscussions({})).rejects.toMatchObject({ message: "Unavailable" });
  fixture.rpc.mockReturnValueOnce({abortSignal: () => Promise.resolve({ data: {}, error: null })});
  await expect(getDiscussion("topic-id")).rejects.toThrow("indisponible");
});
it("aborts a stalled public listing and reports an error instead of an empty forum", async () => {
  vi.useFakeTimers();
  try {
    fixture.rpc.mockReturnValueOnce({abortSignal: (signal: AbortSignal) => new Promise(resolve => {
      signal.addEventListener('abort', () => resolve({data:null,error:{message:'aborted'}}));
    })});
    const pending=listDiscussions({});
    const assertion=expect(pending).rejects.toThrow('indisponibles');
    await vi.advanceTimersByTimeAsync(20000);
    await assertion;
  } finally {vi.useRealTimers();}
});
it("freezes the bearer identity and rejects writes after switching account", async () => {
  const writer = await discussionWriter("account-a");
  const options = fixture.createClient.mock.calls[0][2];
  expect(await options.accessToken()).toBe("token-a");
  fixture.session = { user: { id: "account-b" }, access_token: "token-b" };
  expect(await options.accessToken()).toBe("token-a");
  await expect(writer.rpc("publish_club_discussion", { p_id: "id" })).rejects.toThrow("session a changé");
  expect(fixture.writerRpc).not.toHaveBeenCalled();
});
it("uploads immutable attachment IDs and makes definitive format failures correctable", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ error: "Format incompatible" }, { status: 415 }));
  vi.stubGlobal("fetch", fetch);
  const writer = await discussionWriter("account-a");
  await expect(writer.upload({ id: "stable-upload-id", uri: "blob:fixture", mime: "image/png", name: "image.png" })).rejects.toMatchObject({ code: "22023" });
  expect(fetch.mock.calls[0][1].headers).toMatchObject({ "x-upload-id": "stable-upload-id", authorization: "Bearer token-a" });
});
it("does not navigate or report success into a different account after an in-flight write", async () => {
  const writer = await discussionWriter("account-a");
  fixture.writerRpc.mockImplementationOnce(async () => {
    fixture.session = { user: { id: "account-b" }, access_token: "token-b" };
    return { data: "published-topic", error: null };
  });
  await expect(writer.rpc("publish_club_discussion", {})).rejects.toThrow("session a changé");
});
it("does not label ambiguous upload failures as a definite rejection", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Envoi interrompu" }, { status: 503 })));
  const writer = await discussionWriter("account-a");
  try { await writer.upload({ id: "same-id", uri: "blob:fixture", mime: "video/mp4", name: "video.mp4" }); throw new Error("expected failure"); }
  catch (error) { expect(error).toMatchObject({ message: "Envoi interrompu" }); expect((error as { code?: string }).code).toBeUndefined(); }
});
