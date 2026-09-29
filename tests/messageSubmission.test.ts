import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { onlineManager } from "@tanstack/react-query";
import { createAppQueryClient } from "../src/lib/queryClient";
import { createMessageOutbox } from "../src/lib/messageOutbox";
import {
  messageSendStep,
  persistMessageBeforeSend,
} from "../src/lib/messageSubmission";
import { createProContent } from "../src/lib/proContentSave";

vi.mock("../src/lib/monitoring", () => ({ reportError: vi.fn() }));
const message = {
  id: "00000000-0000-4000-8000-000000000001",
  sender_id: "00000000-0000-4000-8000-000000000002",
  receiver_id: "00000000-0000-4000-8000-000000000003",
  content: "Brouillon synthétique ⚽",
};
let wasOnline = true;
beforeEach(() => {
  wasOnline = onlineManager.isOnline();
});
afterEach(() => {
  onlineManager.setOnline(wasOnline);
});
function fixture() {
  const values = new Map<string, string>();
  const store = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
  return { store, outbox: createMessageOutbox(store) };
}

it("persists before the real offline MutationCache guard and restores after restart", async () => {
  onlineManager.setOnline(false);
  const client = createAppQueryClient();
  const { store, outbox } = fixture();
  const transport = vi.fn(async (_value: typeof message) => {});
  const persisted = vi.fn();
  const mutation = client.getMutationCache().build(client, {
    mutationFn: transport,
    gcTime: 0,
  });
  try {
    await expect(
      persistMessageBeforeSend(message, {
        assertCurrent: () => {},
        save: (value) => outbox.save(value),
        persisted,
        send: (value) => mutation.execute(value),
      }),
    ).rejects.toThrow("hors ligne");
    expect(transport).not.toHaveBeenCalled();
    expect(persisted).toHaveBeenCalledWith(message);
    const restarted = createMessageOutbox(store);
    expect(
      await restarted.load(message.sender_id, message.receiver_id),
    ).toEqual(message);
    // Local abandonment does not go through a network mutation.
    await restarted.remove(message);
    expect(
      await restarted.load(message.sender_id, message.receiver_id),
    ).toBeNull();
    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    expect(transport).not.toHaveBeenCalled();
  } finally {
    client.clear();
  }
});

it("does not claim persistence or start a mutation when local storage rejects", async () => {
  const { store } = fixture();
  const outbox = createMessageOutbox({
    ...store,
    setItem: async () => {
      throw new Error("Storage unavailable");
    },
  });
  const persisted = vi.fn(),
    send = vi.fn(async () => {});
  await expect(
    persistMessageBeforeSend(message, {
      assertCurrent: () => {},
      save: (value) => outbox.save(value),
      persisted,
      send,
    }),
  ).rejects.toThrow("Storage unavailable");
  expect(persisted).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

it.each(["account", "conversation", "unmount"])(
  "keeps A's durable proposal but refuses dispatch after %s changes while saving",
  async (changed) => {
    const { store, outbox } = fixture();
    const current = {
      uid: message.sender_id,
      peer: message.receiver_id,
      mounted: true,
    };
    const send = vi.fn(async () => {});
    await expect(
      persistMessageBeforeSend(message, {
        assertCurrent: (snapshot) => {
          if (
            !current.mounted ||
            current.uid !== snapshot.sender_id ||
            current.peer !== snapshot.receiver_id
          )
            throw new Error("Context changed");
        },
        save: async (value) => {
          await outbox.save(value);
          if (changed === "account") current.uid = message.receiver_id;
          else if (changed === "conversation") current.peer = message.id;
          else current.mounted = false;
        },
        persisted: () => {},
        send,
      }),
    ).rejects.toThrow("Context changed");
    expect(send).not.toHaveBeenCalled();
    expect(
      await createMessageOutbox(store).load(
        message.sender_id,
        message.receiver_id,
      ),
    ).toEqual(message);
    expect(
      await outbox.load(message.receiver_id, message.sender_id),
    ).toBeNull();
  },
);

it("rejects an obsolete context before any local write", async () => {
  const save = vi.fn(async () => {}),
    persisted = vi.fn(),
    send = vi.fn(async () => {});
  await expect(
    persistMessageBeforeSend(message, {
      assertCurrent: () => {
        throw new Error("Old account");
      },
      save,
      persisted,
      send,
    }),
  ).rejects.toThrow("Old account");
  expect(save).not.toHaveBeenCalled();
  expect(persisted).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

it("uses the saved immutable content when the caller edits its original object", async () => {
  const { outbox } = fixture();
  const original = { ...message };
  const send = vi.fn(async () => {});
  await persistMessageBeforeSend(original, {
    assertCurrent: () => {},
    save: async (value) => {
      original.content = "Changed";
      await outbox.save(value);
    },
    persisted: () => {},
    send,
  });
  expect(send).toHaveBeenCalledWith(message);
  expect(await outbox.load(message.sender_id, message.receiver_id)).toEqual(
    message,
  );
});

it("stops after connectivity is lost during a direct permission read without resuming an insert", async () => {
  onlineManager.setOnline(true);
  const insert = vi.fn(async () => {});
  const read = async () => {
    await messageSendStep(
      message,
      () => {},
      async () => {
        onlineManager.setOnline(false);
        return true;
      },
    );
    await insert();
  };
  await expect(read()).rejects.toThrow("hors ligne");
  onlineManager.setOnline(true);
  await Promise.resolve();
  expect(insert).not.toHaveBeenCalled();
});

it("refuses a direct send step when already offline or when its account changes during the read", async () => {
  onlineManager.setOnline(false);
  const operation = vi.fn(async () => true);
  await expect(messageSendStep(message, () => {}, operation)).rejects.toThrow(
    "hors ligne",
  );
  expect(operation).not.toHaveBeenCalled();
  onlineManager.setOnline(true);
  let current = true;
  await expect(
    messageSendStep(
      message,
      () => {
        if (!current) throw new Error("Account changed");
      },
      async () => {
        current = false;
        return true;
      },
    ),
  ).rejects.toThrow("Account changed");
});

it("retains the journal and local media on an ambiguous send, then reconciles the same ID without a duplicate", async () => {
  onlineManager.setOnline(true);
  const { store, outbox } = fixture();
  let committed: typeof message | null = null;
  const removeLocalMedia = vi.fn();
  const insert = vi.fn(async () => {
    committed = message;
    onlineManager.setOnline(false);
  });
  const send = async () => {
    await createProContent(
      {
        read: () =>
          messageSendStep(
            message,
            () => {},
            async () => committed,
          ),
        insert: () => messageSendStep(message, () => {}, insert),
      },
      message,
    );
    await outbox.remove(message);
    removeLocalMedia();
  };
  const dependencies = {
    assertCurrent: () => {},
    save: (value: typeof message) => outbox.save(value),
    persisted: () => {},
    send,
  };
  await expect(persistMessageBeforeSend(message, dependencies)).rejects.toThrow(
    "hors ligne",
  );
  expect(
    await createMessageOutbox(store).load(
      message.sender_id,
      message.receiver_id,
    ),
  ).toEqual(message);
  expect(removeLocalMedia).not.toHaveBeenCalled();
  onlineManager.setOnline(true);
  expect(insert).toHaveBeenCalledTimes(1);
  await persistMessageBeforeSend(message, dependencies);
  expect(insert).toHaveBeenCalledTimes(1);
  expect(removeLocalMedia).toHaveBeenCalledTimes(1);
  expect(await outbox.load(message.sender_id, message.receiver_id)).toBeNull();
});
