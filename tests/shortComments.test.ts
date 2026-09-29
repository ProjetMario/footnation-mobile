import { describe, expect, it, vi } from "vitest";
import { publishShortComment } from "../src/lib/shortComments";

function backend({
  user = "me",
  profile = true,
  failure = null as unknown,
} = {}) {
  const insert = vi.fn().mockResolvedValue({ error: failure });
  const from = vi.fn((table: string) =>
    table === "profiles"
      ? {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: profile ? { id: user } : null,
                error: null,
              }),
            }),
          }),
        }
      : { insert },
  );
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: user } } },
        error: null,
      }),
    },
    from,
  };
  return {
    client: client as unknown as Parameters<typeof publishShortComment>[0],
    insert,
    from,
  };
}
const input = { shortId: "video", userId: "me", content: " Bien joué ! " };
describe("short comments", () => {
  it("uses the authenticated author and trims the comment", async () => {
    const b = backend();
    await publishShortComment(b.client, input);
    expect(b.insert).toHaveBeenCalledExactlyOnceWith({
      short_id: "video",
      user_id: "me",
      content: "Bien joué !",
    });
  });
  it("refuses to publish a stale account's draft after an account change", async () => {
    const b = backend({ user: "other" });
    await expect(publishShortComment(b.client, input)).rejects.toThrow(
      "session a changé",
    );
    expect(b.from).not.toHaveBeenCalled();
  });
  it("offers profile completion before a foreign-key failure", async () => {
    const b = backend({ profile: false });
    await expect(publishShortComment(b.client, input)).rejects.toThrow(
      "Enregistrez votre profil",
    );
    expect(b.insert).not.toHaveBeenCalled();
  });
  it.each([" ", "x".repeat(3001), "connard"])(
    "validates content before sending",
    async (content) => {
      const b = backend();
      await expect(
        publishShortComment(b.client, { ...input, content }),
      ).rejects.toThrow();
      expect(b.from).not.toHaveBeenCalled();
    },
  );
  it("preserves an error response as a failure without exposing raw database details", async () => {
    const b = backend({ failure: { message: "sensitive backend detail" } });
    await expect(publishShortComment(b.client, input)).rejects.toThrow(
      "n’a pas été envoyé",
    );
  });
});
