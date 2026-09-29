import { expect, it, vi } from "vitest";
import {
  resolveReportContent,
  profileReportPayload,
  profileReportReasons,
} from "../src/lib/contentReport";
const id = "10000000-0000-4000-8000-000000000001";
const authorId = "20000000-0000-4000-8000-000000000002";
it.each([
  ["post", "posts", "https://www.foot-nation.com/posts/"],
  ["short", "shorts", "https://www.foot-nation.com/shorts?id="],
  ["story", "stories", "com.footnation.app://stories/"],
])("resolves %s against its readable author", async (kind, table, prefix) => {
  const read = vi.fn(async () => ({ id, user_id: authorId }));
  const content = await resolveReportContent(
    { kind, contentId: id, authorId },
    read,
  );
  expect(read).toHaveBeenCalledWith(table, id);
  expect(
    profileReportPayload("child_safety", "Menaces dans le contenu", content),
  ).toEqual({
    reason: "child_safety",
    details: `Contenu signalé : ${prefix}${id}\n\nMenaces dans le contenu`,
  });
});
it.each([
  "__proto__",
  "constructor",
  "user_reports",
  "https://evil.test",
  ["post"],
])(
  "does not query arbitrary tables or ambiguous parameters %j",
  async (kind) => {
    const read = vi.fn();
    await expect(
      resolveReportContent({ kind, contentId: id, authorId }, read),
    ).rejects.toThrow("invalide");
    expect(read).not.toHaveBeenCalled();
  },
);
it.each([
  { kind: "post", contentId: "../x" },
  { kind: "post", contentId: [id] },
  { contentId: id },
])("rejects malformed or incomplete targets %j", async (target) => {
  const read = vi.fn();
  await expect(
    resolveReportContent({ kind: undefined, ...target, authorId }, read),
  ).rejects.toThrow("invalide");
  expect(read).not.toHaveBeenCalled();
});
it.each([null, { id, user_id: id }, { id: authorId, user_id: authorId }])(
  "rejects missing or misattributed content %j",
  async (row) => {
    await expect(
      resolveReportContent(
        { kind: "post", contentId: id, authorId },
        async () => row,
      ),
    ).rejects.toThrow("plus disponible");
  },
);
it("propagates denied or failed reads rather than claiming a verified target", async () => {
  await expect(
    resolveReportContent(
      { kind: "post", contentId: id, authorId },
      async () => {
        throw new Error("Lecture refusée");
      },
    ),
  ).rejects.toThrow("refusée");
});
it("preserves a profile-only report and empty optional details", async () => {
  const read = vi.fn();
  expect(
    await resolveReportContent(
      { kind: undefined, contentId: undefined, authorId },
      read,
    ),
  ).toBeNull();
  expect(read).not.toHaveBeenCalled();
  expect(profileReportPayload("harassment", "  ", null)).toEqual({
    reason: "harassment",
    details: null,
  });
});
it("bounds the complete report including its content link", async () => {
  const content = await resolveReportContent(
    { kind: "post", contentId: id, authorId },
    async () => ({ id, user_id: authorId }),
  );
  expect(() =>
    profileReportPayload("inappropriate", "x".repeat(3000), content),
  ).toThrow("longues");
  expect(
    profileReportPayload("violence", "x".repeat(2700), content).details!.length,
  ).toBeLessThan(3000);
  expect(() => profileReportPayload("__proto__", "", null)).toThrow("motif");
  expect(profileReportReasons.child_safety).toBe("Sécurité d’un mineur");
});
