import { expect, it } from "vitest";
import { createMessageOutbox } from "../src/lib/messageOutbox";
const row = {
  id: "00000000-0000-0000-0000-000000000001",
  sender_id: "00000000-0000-0000-0000-000000000002",
  receiver_id: "00000000-0000-0000-0000-000000000003",
  content: "Bonjour",
};
function fixture() {
  const map = new Map<string, string>();
  return {
    map,
    storage: {
      getItem: async (key: string) => map.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        map.set(key, value);
      },
      removeItem: async (key: string) => {
        map.delete(key);
      },
    },
  };
}
it("restores the same proposal after recreating the outbox without sending anything", async () => {
  const { storage } = fixture();
  await createMessageOutbox(storage).save(row);
  expect(
    await createMessageOutbox(storage).load(row.sender_id, row.receiver_id),
  ).toEqual(row);
});
it("isolates proposals by account and recipient", async () => {
  const outbox = createMessageOutbox(fixture().storage);
  await outbox.save(row);
  expect(await outbox.load(row.receiver_id, row.sender_id)).toBeNull();
  expect(await outbox.load(row.sender_id, row.id)).toBeNull();
});
it("snapshots the send identity before asynchronous storage work starts", async () => {
  const outbox = createMessageOutbox(fixture().storage);
  const mutable = { ...row };
  const pending = outbox.save(mutable);
  mutable.id = row.receiver_id;
  mutable.content = "Changed after clicking send";
  await pending;
  expect(await outbox.load(row.sender_id, row.receiver_id)).toEqual(row);
});
it("restores only the message transport fields from local storage", async () => {
  const { storage } = fixture();
  await storage.setItem(
    `footnation.outbox.${row.sender_id}.${row.receiver_id}`,
    JSON.stringify({
      ...row,
      read_at: "2026-01-01",
      is_admin: true,
      created_at: "2020-01-01",
    }),
  );
  expect(
    await createMessageOutbox(storage).load(row.sender_id, row.receiver_id),
  ).toEqual(row);
});
it("prevents concurrent replacement and a stale acknowledgement removing a newer proposal", async () => {
  const outbox = createMessageOutbox(fixture().storage);
  const next = { ...row, id: "00000000-0000-0000-0000-000000000004" };
  const results = await Promise.allSettled([
    outbox.save(row),
    outbox.save(next),
  ]);
  expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
  await outbox.remove(row);
  await outbox.save(next);
  await outbox.remove(row);
  expect(await outbox.load(row.sender_id, row.receiver_id)).toEqual(next);
});
it("propagates a failed durable write before an envoi can proceed", async () => {
  const { storage } = fixture();
  const outbox = createMessageOutbox({
    ...storage,
    setItem: async () => {
      throw new Error("Storage unavailable");
    },
  });
  await expect(outbox.save(row)).rejects.toThrow("Storage unavailable");
});
it("rejects corrupt or foreign content without disclosing the message", async () => {
  const { storage } = fixture();
  const outbox = createMessageOutbox(storage);
  await outbox.save(row);
  const bad = createMessageOutbox({
    ...storage,
    getItem: async () => JSON.stringify({ ...row, sender_id: row.receiver_id }),
  });
  await expect(bad.load(row.sender_id, row.receiver_id)).rejects.toThrow(
    "Impossible de récupérer",
  );
});

it("lists pending first messages and retains both recipients on concurrent saves", async () => {
  const outbox = createMessageOutbox(fixture().storage);
  const next = {
    ...row,
    id: "00000000-0000-0000-0000-000000000004",
    receiver_id: "00000000-0000-0000-0000-000000000005",
  };
  await Promise.all([outbox.save(row), outbox.save(next)]);
  expect(await outbox.list(row.sender_id)).toEqual([row, next]);
  expect(await outbox.list(row.receiver_id)).toEqual([]);
  await outbox.remove(row);
  expect(await outbox.list(row.sender_id)).toEqual([next]);
});
it("ignores an index entry left by an interrupted save and registers legacy proposals on reopening", async () => {
  const { storage } = fixture();
  await storage.setItem(
    `footnation.outbox-index.${row.sender_id}`,
    JSON.stringify([row.receiver_id]),
  );
  const outbox = createMessageOutbox(storage);
  expect(await outbox.list(row.sender_id)).toEqual([]);
  await storage.removeItem(`footnation.outbox-index.${row.sender_id}`);
  await storage.setItem(
    `footnation.outbox.${row.sender_id}.${row.receiver_id}`,
    JSON.stringify(row),
  );
  await outbox.load(row.sender_id, row.receiver_id);
  expect(await outbox.list(row.sender_id)).toEqual([row]);
});
it("forgets only the deleted account and refuses late saves or acknowledgement rewrites", async () => {
  const { storage, map } = fixture();
  const outbox = createMessageOutbox(storage);
  const other = {
    ...row,
    sender_id: row.receiver_id,
    receiver_id: row.sender_id,
  };
  await outbox.save(row);
  await outbox.save(other);
  await outbox.forgetAccount(row.sender_id);
  await expect(outbox.save(row)).rejects.toThrow("supprimé");
  await outbox.remove(row);
  expect(await outbox.load(row.sender_id, row.receiver_id)).toBeNull();
  expect(await outbox.list(row.sender_id)).toEqual([]);
  expect(await outbox.load(other.sender_id, other.receiver_id)).toEqual(other);
  expect(
    [...map.keys()].some(
      (key) =>
        key.startsWith(`footnation.outbox.${row.sender_id}.`) ||
        key === `footnation.outbox-index.${row.sender_id}`,
    ),
  ).toBe(false);
});
it("waits for a write already in flight before removing all of that account's indexed proposals", async () => {
  const { storage, map } = fixture();
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((done) => {
    entered = done;
  });
  const outbox = createMessageOutbox({
    ...storage,
    setItem: async (key, value) => {
      if (key === `footnation.outbox.${row.sender_id}.${row.receiver_id}`) {
        entered();
        await new Promise<void>((done) => {
          release = done;
        });
      }
      await storage.setItem(key, value);
    },
  });
  const saving = outbox.save(row);
  await started;
  const deleting = outbox.forgetAccount(row.sender_id);
  release();
  await Promise.all([saving, deleting]);
  expect(map.size).toBe(0);
});
