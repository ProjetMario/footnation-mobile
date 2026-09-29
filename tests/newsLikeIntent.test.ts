import { expect, it } from "vitest";
import { applyNewsLikeIntent } from "../src/lib/newsLikeIntent";
it("recovers a committed like after a lost response without reversing it", async () => {
  let row: { id: string } | null = null;
  let inserts = 0;
  const repo = {
    read: async () => row,
    insert: async () => {
      row = { id: "saved" };
      inserts++;
      throw new Error("Lost response");
    },
    remove: async () => {
      throw new Error("Unexpected unlike");
    },
  };
  await applyNewsLikeIntent(repo, true, null);
  await applyNewsLikeIntent(repo, true, null);
  expect(inserts).toBe(1);
});
it("refuses to remove a replacement like created elsewhere", async () => {
  const repo = {
    read: async () => ({ id: "replacement" }),
    insert: async () => {},
    remove: async () => {
      throw new Error("Must not delete");
    },
  };
  await expect(applyNewsLikeIntent(repo, false, "original")).rejects.toThrow(
    "a changé",
  );
});
it("treats an already removed like as success and detects denied removal", async () => {
  await applyNewsLikeIntent(
    {
      read: async () => null,
      insert: async () => {},
      remove: async () => {
        throw new Error("Unexpected delete");
      },
    },
    false,
    "old",
  );
  await expect(
    applyNewsLikeIntent(
      {
        read: async () => ({ id: "old" }),
        insert: async () => {},
        remove: async () => false,
      },
      false,
      "old",
    ),
  ).rejects.toThrow("n’a pas pu être retiré");
});
