import { expect, it } from "vitest";
import { applyBlockIntent } from "../src/lib/blockIntent";
it("recovers a committed block after a lost response without reversing it", async () => {
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
      throw new Error("Unexpected unblock");
    },
  };
  await applyBlockIntent(repo, true, null);
  await applyBlockIntent(repo, true, null);
  expect(inserts).toBe(1);
});
it("refuses to remove a replacement block created elsewhere", async () => {
  const repo = {
    read: async () => ({ id: "replacement" }),
    insert: async () => {},
    remove: async () => {
      throw new Error("Must not delete");
    },
  };
  await expect(applyBlockIntent(repo, false, "original")).rejects.toThrow(
    "a changé",
  );
});
it("treats an already removed block as success and detects denied removal", async () => {
  await applyBlockIntent(
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
    applyBlockIntent(
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
