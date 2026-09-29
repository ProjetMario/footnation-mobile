import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAccountSessionStorage,
  authStorageKey,
  type StorageLock,
} from "../src/lib/accountSessionStorage";
import { createAccountDeletionJournal } from "../src/lib/accountDeletionJournal";

const mocks = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    getSession: vi.fn(),
    invoke: vi.fn(),
    backing: {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: async (key: string) => {
        values.delete(key);
      },
    },
  };
});
vi.mock("../src/lib/supabase", () => ({
  requireBackend: () => {},
  supabase: {
    auth: { getSession: mocks.getSession },
    functions: { invoke: mocks.invoke },
  },
}));
vi.mock("../src/lib/sessionStorage", async () => {
  const { createAccountSessionStorage } =
    await import("../src/lib/accountSessionStorage");
  return { default: createAccountSessionStorage(mocks.backing) };
});
import {
  deleteOwnAccount,
  checkAccountDeletionReceipt,
  inspectAccountDeletion,
  listAccountDeletionReceipts,
} from "../src/lib/accountDeletion";

const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const op = "33333333-3333-4333-8333-333333333333";
const session = (id: string) =>
  JSON.stringify({ user: { id }, access_token: `token-${id}` });
beforeEach(() => {
  mocks.values.clear();
  vi.clearAllMocks();
  mocks.getSession.mockImplementation(async () => ({
    data: { session: { user: { id: a }, access_token: "token-A" } },
    error: null,
  }));
  mocks.invoke.mockImplementation(async () => ({
    data: { deleted: true },
    error: null,
  }));
});

describe("deletion client account binding", () => {
  it("preserves Apple legacy revocation instructions through a restart and receipt check", async () => {
    mocks.invoke.mockResolvedValue({
      data: { deleted: true, appleRevocationRequired: true },
      error: null,
    });
    const receipt = await deleteOwnAccount(a, "SUPPRIMER");
    expect(receipt.appleRevocationRequired).toBe(true);
    expect(
      (await listAccountDeletionReceipts(a))[0].appleRevocationRequired,
    ).toBe(true);
    await checkAccountDeletionReceipt(receipt);
    expect(
      (await listAccountDeletionReceipts(a))[0].appleRevocationRequired,
    ).toBe(true);
  });
  it("refuses malformed Apple receipt flags", async () => {
    mocks.invoke.mockResolvedValue({
      data: { deleted: true, appleRevocationRequired: "true" },
      error: null,
    });
    await expect(deleteOwnAccount(a, "SUPPRIMER")).rejects.toThrow("confirmée");
    expect((await listAccountDeletionReceipts(a))[0].completed).toBe(false);
  });
  it("pins the captured token even if B becomes current when functions.invoke starts", async () => {
    mocks.invoke.mockImplementation(async (_name, options) => {
      mocks.getSession.mockResolvedValue({
        data: { session: { user: { id: b }, access_token: "token-B" } },
        error: null,
      });
      expect(options.headers.Authorization).toBe("Bearer token-A");
      expect(options.body).not.toHaveProperty("userId");
      return { data: { deleted: true }, error: null };
    });
    await deleteOwnAccount(a, "SUPPRIMER");
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
  it("rejects a changed account before sending a destructive request", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: b }, access_token: "token-B" } },
      error: null,
    });
    await expect(deleteOwnAccount(a, "SUPPRIMER")).rejects.toThrow(
      "session a changé",
    );
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("also pins inspection requests to the account shown on screen", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        ready: true,
        recentlyAuthenticated: true,
        subscriptionCount: 0,
        checkoutCount: 0,
      },
      error: null,
    });
    await inspectAccountDeletion(a);
    expect(mocks.invoke.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer token-A",
    );
  });
  it("can check a receipt without a session, with a status-only body", async () => {
    mocks.getSession.mockRejectedValue(new Error("Auth account is gone"));
    expect(
      await checkAccountDeletionReceipt({
        userId: a,
        operationId: op,
        createdAt: Date.now(),
        completed: false,
      }),
    ).toBe(true);
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.invoke.mock.calls[0][1]).toEqual({
      body: { action: "status", operationId: op },
      headers: { Authorization: "Bearer receipt-check" },
    });
  });
});

describe("durable deletion journal", () => {
  it("keeps the same receipt when two independent browser tabs prepare it together", async () => {
    const queues = new Map<string, Promise<unknown>>();
    const withLock: StorageLock = (key, operation) => {
      const next = (queues.get(key) || Promise.resolve())
        .catch(() => {})
        .then(operation);
      queues.set(key, next);
      return next;
    };
    const tabA = createAccountSessionStorage(mocks.backing, { withLock });
    const tabB = createAccountSessionStorage(mocks.backing, { withLock });
    const journalA = createAccountDeletionJournal(
      tabA,
      () => op,
      Date.now,
      (operation) => tabA.runExclusive("account-deletion-journal", operation),
    );
    const journalB = createAccountDeletionJournal(
      tabB,
      () => "44444444-4444-4444-8444-444444444444",
      Date.now,
      (operation) => tabB.runExclusive("account-deletion-journal", operation),
    );
    const [first, second] = await Promise.all([
      journalA.prepare(a),
      journalB.prepare(a),
    ]);
    expect(first.operationId).toBe(op);
    expect(second.operationId).toBe(op);
    expect(await journalB.list(a)).toEqual([first]);
  });
  it("reuses a pending operation after remount/restart and does not store credentials", async () => {
    const first = createAccountDeletionJournal(mocks.backing, () => op);
    const before = await first.prepare(a);
    const restarted = createAccountDeletionJournal(
      mocks.backing,
      () => "44444444-4444-4444-8444-444444444444",
    );
    expect(await restarted.prepare(a)).toEqual(before);
    expect(await restarted.list()).toEqual([before]);
    expect([...mocks.values.values()].join()).not.toContain("token");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("keeps accounts separate and serializes double preparation", async () => {
    const random = vi
      .fn()
      .mockReturnValueOnce(op)
      .mockReturnValueOnce("44444444-4444-4444-8444-444444444444");
    const journal = createAccountDeletionJournal(mocks.backing, random);
    const [one, two] = await Promise.all([
      journal.prepare(a),
      journal.prepare(a),
    ]);
    expect(one.operationId).toBe(two.operationId);
    expect(random).toHaveBeenCalledTimes(1);
    await journal.prepare(b);
    expect(await journal.list(b)).toHaveLength(1);
    expect((await journal.list(b))[0].userId).toBe(b);
  });
  it("persists before network execution and expires local receipts after 24 hours", async () => {
    const time = { now: 10_000 };
    const journal = createAccountDeletionJournal(
      mocks.backing,
      () => op,
      () => time.now,
    );
    await journal.prepare(a);
    time.now += 86_400_001;
    expect(await journal.list()).toEqual([]);
  });
});

describe("atomic local session cleanup", () => {
  it("rejects a late A refresh from another instance after B signed in", async () => {
    let tail: Promise<unknown> = Promise.resolve();
    const withLock: StorageLock = (_key, operation) => {
      const next = tail.catch(() => {}).then(operation);
      tail = next;
      return next;
    };
    const tabA = createAccountSessionStorage(mocks.backing, { withLock });
    const tabB = createAccountSessionStorage(mocks.backing, { withLock });
    await tabA.setItem(authStorageKey, session(a));
    await tabA.removeAccountSession(a);
    await tabB.setItem(authStorageKey, session(b));
    const reloaded = createAccountSessionStorage(mocks.backing, { withLock });
    await expect(reloaded.setItem(authStorageKey, session(a))).rejects.toThrow(
      "compte supprimé",
    );
    expect(await tabB.getItem(authStorageKey)).toBe(session(b));
  });
  it("serializes separate browser storage instances with their shared lock", async () => {
    let tail: Promise<unknown> = Promise.resolve();
    const withLock: StorageLock = (_key, operation) => {
      const next = tail.catch(() => {}).then(operation);
      tail = next;
      return next;
    };
    const tabA = createAccountSessionStorage(mocks.backing, { withLock });
    const tabB = createAccountSessionStorage(mocks.backing, { withLock });
    await tabA.setItem(authStorageKey, session(a));
    const removal = tabA.removeAccountSession(a);
    const signInB = tabB.setItem(authStorageKey, session(b));
    await Promise.all([removal, signInB]);
    expect(await tabB.getItem(authStorageKey)).toBe(session(b));
  });
  it("does not remove any web session when cross-tab locking is unavailable", async () => {
    const storage = createAccountSessionStorage(mocks.backing, {
      canRemoveAccount: () => false,
    });
    await storage.setItem(authStorageKey, session(b));
    await expect(storage.removeAccountSession(a)).rejects.toThrow(
      "fermeture sécurisée",
    );
    expect(await storage.getItem(authStorageKey)).toBe(session(b));
  });
  it("does not remove B when a late deletion of A completes", async () => {
    const storage = createAccountSessionStorage(mocks.backing);
    await storage.setItem(authStorageKey, session(b));
    expect(await storage.removeAccountSession(a)).toBe("other");
    expect(await storage.getItem(authStorageKey)).toBe(session(b));
  });
  it("preserves a B sign-in queued during the removal of A", async () => {
    const storage = createAccountSessionStorage(mocks.backing);
    await storage.setItem(authStorageKey, session(a));
    const removing = storage.removeAccountSession(a);
    const nextSignIn = storage.setItem(authStorageKey, session(b));
    expect(await removing).toBe("removed");
    await nextSignIn;
    expect(await storage.getItem(authStorageKey)).toBe(session(b));
  });
  it("rejects a stale refresh trying to restore the deleted account", async () => {
    const storage = createAccountSessionStorage(mocks.backing);
    await storage.setItem(authStorageKey, session(a));
    await storage.removeAccountSession(a);
    await expect(storage.setItem(authStorageKey, session(a))).rejects.toThrow(
      "compte supprimé",
    );
    await storage.setItem(authStorageKey, session(b));
    expect(await storage.getItem(authStorageKey)).toBe(session(b));
  });
});
