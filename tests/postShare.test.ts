import { describe, expect, it } from "vitest";
import {
  postShareUrl,
  profileShareUrl,
  sendProfileShare,
  sendPostShare,
  type PostShareMessage,
} from "../src/lib/postShare";
const sender = "00000000-0000-4000-8000-000000000001";
const receiver = "00000000-0000-4000-8000-000000000002";
const post = "10000000-0000-4000-8000-000000000001";
const message: PostShareMessage = {
  id: "20000000-0000-4000-8000-000000000001",
  sender_id: sender,
  receiver_id: receiver,
  content: postShareUrl(post),
};

function backend() {
  const state = {
    user: sender,
    accepted: true,
    blocked: false,
    suspended: false,
    postExists: true,
    failRead: false,
    loseResponse: false,
    failInsert: false,
  };
  const messages: PostShareMessage[] = [];
  const requests: {
    table: string;
    filters: [string, unknown][];
    authorization: string;
  }[] = [];
  let afterRead = () => {};
  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session: { user: { id: state.user }, access_token: "test-token" },
        },
        error: null,
      }),
      getUser: async (token: string) => {
        expect(token).toBe("test-token");
        return { data: { user: { id: state.user } }, error: null };
      },
    },
    from(table: string) {
      let insert: PostShareMessage | null = null;
      const filters: [string, unknown][] = [];
      const q = {
        select: () => q,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return q;
        },
        or: (value: string) => {
          filters.push(["or", value]);
          return q;
        },
        limit: () => q,
        maybeSingle: () => q,
        insert: (row: PostShareMessage) => {
          insert = row;
          return q;
        },
        async setHeader(name: string, authorization: string) {
          expect(name).toBe("Authorization");
          expect(authorization).toBe("Bearer test-token");
          requests.push({ table, filters, authorization });
          if (insert) {
            if (state.failInsert) return { error: { code: "42501" } };
            messages.push({ ...insert });
            if (state.loseResponse) {
              state.loseResponse = false;
              return { error: { code: "network" } };
            }
            return { error: null };
          }
          afterRead();
          return {
            error: state.failRead ? { code: "network" } : null,
            data:
              table === "messages"
                ? (messages.find((m) => m.id === message.id) ?? null)
                : table === "connections"
                  ? state.accepted
                    ? [{ id: "relation" }]
                    : []
                  : table === "profiles"
                    ? {
                        id: receiver,
                        is_admin: false,
                        is_suspended: state.suspended,
                        suspended_until: null,
                      }
                    : table === "user_blocks"
                      ? state.blocked
                        ? [{ id: "block" }]
                        : []
                      : table === "posts"
                        ? state.postExists
                          ? { id: post }
                          : null
                        : null,
          };
        },
      };
      return q;
    },
  };
  return {
    state,
    messages,
    requests,
    client: client as unknown as Parameters<typeof sendPostShare>[0],
    onRead: (fn: () => void) => {
      afterRead = fn;
    },
  };
}

describe("sharing a post in a private conversation", () => {
  it("sends the canonical link and checks both connection/block orientations", async () => {
    const b = backend();
    await sendPostShare(b.client, post, message, () => {});
    expect(b.messages).toEqual([message]);
    expect(
      b.requests.find((r) => r.table === "connections")?.filters,
    ).toContainEqual(["status", "accepted"]);
    expect(
      b.requests.find((r) => r.table === "user_blocks")?.filters,
    ).toContainEqual([
      "or",
      `and(blocker_id.eq.${sender},blocked_id.eq.${receiver}),and(blocker_id.eq.${receiver},blocked_id.eq.${sender})`,
    ]);
  });
  it.each(["blocked", "suspended", "failRead", "failInsert"] as const)(
    "does not send when %s",
    async (reason) => {
      const b = backend();
      b.state[reason] = true;
      await expect(
        sendPostShare(b.client, post, message, () => {}),
      ).rejects.toThrow();
      expect(b.messages).toEqual([]);
    },
  );
  it.each(["accepted", "postExists"] as const)(
    "does not send if %s is no longer true",
    async (reason) => {
      const b = backend();
      b.state[reason] = false;
      await expect(
        sendPostShare(b.client, post, message, () => {}),
      ).rejects.toThrow();
      expect(b.messages).toEqual([]);
    },
  );
  it("reconciles a lost response without sending the link twice", async () => {
    const b = backend();
    b.state.loseResponse = true;
    await expect(
      sendPostShare(b.client, post, message, () => {}),
    ).rejects.toThrow();
    await sendPostShare(b.client, post, message, () => {});
    expect(b.messages).toEqual([message]);
  });
  it("stops if the user signs out or closes the flow during verification", async () => {
    const b = backend();
    let current = true;
    b.onRead(() => {
      current = false;
    });
    await expect(
      sendPostShare(b.client, post, message, () => {
        if (!current) throw new Error("closed");
      }),
    ).rejects.toThrow("closed");
    expect(b.messages).toEqual([]);
  });
  it("rejects an old account's selection", async () => {
    const b = backend();
    b.state.user = receiver;
    await expect(
      sendPostShare(b.client, post, message, () => {}),
    ).rejects.toThrow();
    expect(b.requests).toEqual([]);
  });
  it("does not send arbitrary content or malformed post links", async () => {
    const b = backend();
    expect(() => postShareUrl("../settings")).toThrow();
    await expect(
      sendPostShare(
        b.client,
        post,
        { ...message, content: "different" },
        () => {},
      ),
    ).rejects.toThrow();
    expect(b.requests).toEqual([]);
  });
});

describe("sharing a profile through the publication share sheet", () => {
  const shareMessage = { ...message, content: profileShareUrl(receiver) };
  it("sends the canonical profile link and reconciles retries", async () => {
    const b = backend();
    b.state.loseResponse = true;
    await expect(
      sendProfileShare(b.client, receiver, shareMessage, () => {}),
    ).rejects.toThrow();
    await sendProfileShare(b.client, receiver, shareMessage, () => {});
    expect(b.messages).toEqual([shareMessage]);
    expect(b.requests.some((r) => r.table === "posts")).toBe(false);
  });
  it.each(["blocked", "suspended", "failRead", "failInsert"] as const)(
    "denies profile sending when %s",
    async (reason) => {
      const b = backend();
      b.state[reason] = true;
      await expect(
        sendProfileShare(b.client, receiver, shareMessage, () => {}),
      ).rejects.toThrow();
      expect(b.messages).toEqual([]);
    },
  );
  it("does not permit arbitrary links or self messaging", async () => {
    const b = backend();
    expect(() => profileShareUrl("../settings")).toThrow();
    await expect(
      sendProfileShare(b.client, receiver, message, () => {}),
    ).rejects.toThrow();
    await expect(
      sendProfileShare(
        b.client,
        receiver,
        { ...shareMessage, receiver_id: sender },
        () => {},
      ),
    ).rejects.toThrow();
    expect(b.requests).toEqual([]);
  });
});
