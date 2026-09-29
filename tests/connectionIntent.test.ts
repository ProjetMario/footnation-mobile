import { expect, it, vi } from "vitest";
import {
  connectionIntent,
  selectConnection,
  rejectConnectionIntent,
  removeConnectionIntent,
} from "../src/lib/connectionIntent";
const incoming = {
  id: "one",
  user_id: "peer",
  connected_user_id: "me",
  status: "pending",
};
it("creates a missing invitation and recovers an already sent request", () => {
  expect(connectionIntent(null, null, "me", "peer")).toBe("create");
  expect(
    connectionIntent(
      null,
      { ...incoming, user_id: "me", connected_user_id: "peer" },
      "me",
      "peer",
    ),
  ).toBe("done");
});
it("accepts only the same incoming invitation and recognizes a completed acceptance", () => {
  expect(connectionIntent(incoming, incoming, "me", "peer")).toBe("accept");
  expect(
    connectionIntent(
      incoming,
      { ...incoming, status: "accepted" },
      "me",
      "peer",
    ),
  ).toBe("done");
});
it("does not accept a replaced, removed or rejected invitation", () => {
  for (const row of [
    null,
    { ...incoming, id: "new" },
    { ...incoming, status: "rejected" },
  ])
    expect(() => connectionIntent(incoming, row, "me", "peer")).toThrow();
});
it("does not turn a stale send action into acceptance of an incoming invitation", () => {
  expect(() => connectionIntent(null, incoming, "me", "peer")).toThrow();
  expect(() =>
    connectionIntent(null, { ...incoming, status: "rejected" }, "me", "peer"),
  ).toThrow();
});
it("rejects rows for another account or recipient", () => {
  expect(() => connectionIntent(null, incoming, "someone", "peer")).toThrow();
});

it("removes exactly the confirmed relationship snapshot", async () => {
  const remove = vi.fn().mockResolvedValue(true);
  await removeConnectionIntent(
    { read: async () => incoming, remove },
    incoming,
    "me",
    "peer",
  );
  expect(remove).toHaveBeenCalledExactlyOnceWith(incoming);
});
it("recovers an already removed relationship without another write", async () => {
  const remove = vi.fn();
  await removeConnectionIntent(
    { read: async () => null, remove },
    incoming,
    "me",
    "peer",
  );
  expect(remove).not.toHaveBeenCalled();
});
it("does not remove a replaced or newly accepted invitation", async () => {
  for (const current of [
    { ...incoming, id: "new" },
    { ...incoming, status: "accepted" },
  ]) {
    const remove = vi.fn();
    await expect(
      removeConnectionIntent(
        { read: async () => current, remove },
        incoming,
        "me",
        "peer",
      ),
    ).rejects.toThrow("changé");
    expect(remove).not.toHaveBeenCalled();
  }
});
it("recovers a lost deletion response only when the relationship is gone", async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce(incoming)
    .mockResolvedValueOnce(null);
  await removeConnectionIntent(
    {
      read,
      remove: async () => {
        throw new Error("network");
      },
    },
    incoming,
    "me",
    "peer",
  );
  expect(read).toHaveBeenCalledTimes(2);
});
it("refuses a concurrent state change after a conditional delete matched no row", async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce(incoming)
    .mockResolvedValueOnce({ ...incoming, status: "accepted" });
  await expect(
    removeConnectionIntent(
      { read, remove: async () => false },
      incoming,
      "me",
      "peer",
    ),
  ).rejects.toThrow("changé");
});
it("keeps failed deletions retryable and rejects a different account", async () => {
  await expect(
    removeConnectionIntent(
      { read: async () => incoming, remove: async () => false },
      incoming,
      "me",
      "peer",
    ),
  ).rejects.toThrow("pas été confirmé");
  const remove = vi.fn();
  await expect(
    removeConnectionIntent(
      { read: async () => null, remove },
      incoming,
      "other",
      "peer",
    ),
  ).rejects.toThrow("autre relation");
  expect(remove).not.toHaveBeenCalled();
});

it("selects an accepted reciprocal relation regardless of row order", () => {
  const outgoing = {
    ...incoming,
    id: "two",
    user_id: "me",
    connected_user_id: "peer",
    status: "accepted",
  };
  for (const rows of [
    [incoming, outgoing],
    [outgoing, incoming],
  ])
    expect(selectConnection(rows, "me", "peer")).toEqual(outgoing);
});
it("prioritizes an incoming invitation over a crossed outgoing request", () => {
  const outgoing = {
    ...incoming,
    id: "two",
    user_id: "me",
    connected_user_id: "peer",
  };
  expect(selectConnection([outgoing, incoming], "me", "peer")).toEqual(
    incoming,
  );
});
it("selects reciprocal accepted rows deterministically and ignores other peers", () => {
  const accepted = { ...incoming, status: "accepted" };
  expect(
    selectConnection([{ ...accepted, id: "two" }, accepted], "me", "peer"),
  ).toEqual(accepted);
  expect(selectConnection([accepted], "other", "peer")).toBeNull();
  expect(selectConnection([], "me", "peer")).toBeNull();
});

it("rejects the same incoming pending invitation", async () => {
  const reject = vi.fn().mockResolvedValue(true);
  await rejectConnectionIntent(
    { read: async () => incoming, reject },
    incoming,
    "me",
    "peer",
  );
  expect(reject).toHaveBeenCalledOnce();
});
it("recognizes a rejection after a lost server response", async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce(incoming)
    .mockResolvedValueOnce({ ...incoming, status: "rejected" });
  await rejectConnectionIntent(
    {
      read,
      reject: async () => {
        throw new Error("network");
      },
    },
    incoming,
    "me",
    "peer",
  );
});
it("does not repeat an already recorded rejection", async () => {
  const reject = vi.fn();
  await rejectConnectionIntent(
    { read: async () => ({ ...incoming, status: "rejected" }), reject },
    incoming,
    "me",
    "peer",
  );
  expect(reject).not.toHaveBeenCalled();
});
it("does not reject a removed, replaced or accepted invitation", async () => {
  for (const row of [
    null,
    { ...incoming, id: "new" },
    { ...incoming, status: "accepted" },
  ]) {
    const reject = vi.fn();
    await expect(
      rejectConnectionIntent(
        { read: async () => row, reject },
        incoming,
        "me",
        "peer",
      ),
    ).rejects.toThrow("changé");
    expect(reject).not.toHaveBeenCalled();
  }
});
it("rejects a sender action and preserves retryable write failures", async () => {
  const reject = vi.fn();
  await expect(
    rejectConnectionIntent(
      { read: async () => incoming, reject },
      incoming,
      "peer",
      "me",
    ),
  ).rejects.toThrow("destinataire");
  expect(reject).not.toHaveBeenCalled();
  await expect(
    rejectConnectionIntent(
      { read: async () => incoming, reject: async () => false },
      incoming,
      "me",
      "peer",
    ),
  ).rejects.toThrow("pas été confirmé");
});
