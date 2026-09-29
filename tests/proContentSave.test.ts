import { expect, it } from "vitest";
import {
  createProContent,
  proContentIdentity,
} from "../src/lib/proContentSave";
it("assigns the required publication author and media uploader", () => {
  expect(proContentIdentity("posts", "owner")).toEqual({ author_id: "owner" });
  expect(proContentIdentity("media", "owner")).toEqual({
    uploader_id: "owner",
  });
  expect(proContentIdentity("matches", "owner")).toEqual({});
});
it("recovers a committed insert after a lost response without duplicating it", async () => {
  let saved: Record<string, unknown> | null = null,
    inserts = 0;
  const row = {
    id: "stable",
    page_id: "page",
    author_id: "owner",
    content: "Score final",
  };
  const repository = {
    read: async () => saved,
    insert: async (value: Record<string, unknown>) => {
      saved = value;
      inserts++;
      throw new Error("Response lost");
    },
  };
  await expect(createProContent(repository, row)).rejects.toThrow(
    "Response lost",
  );
  await createProContent(repository, row);
  expect(inserts).toBe(1);
  expect(saved).toEqual(row);
});
it("does not silently accept changed content under an existing creation id", async () => {
  let inserts = 0;
  await expect(
    createProContent(
      {
        read: async () => ({ id: "stable", content: "Original" }),
        insert: async () => {
          inserts++;
        },
      },
      { id: "stable", content: "Changed" },
    ),
  ).rejects.toThrow("autre contenu");
  expect(inserts).toBe(0);
});
it("recognizes equivalent server timestamps while comparing media arrays", async () => {
  const repository = {
    read: async () => ({
      id: "stable",
      event_date: "2026-09-08T14:30:00+00:00",
      media_urls: ["https://example.com/a.jpg"],
    }),
    insert: async () => {
      throw new Error("Duplicate insert");
    },
  };
  await createProContent(repository, {
    id: "stable",
    event_date: "2026-09-08T14:30:00.000Z",
    media_urls: ["https://example.com/a.jpg"],
  });
  await expect(
    createProContent(repository, {
      id: "stable",
      event_date: "2026-09-08T14:30:00.000Z",
      media_urls: [],
    }),
  ).rejects.toThrow();
});
it("cannot attach a recovered club message to a different reply", async () => {
  const saved = {
    id: "stable",
    group_id: "club",
    content: "Merci",
    reply_to_id: "first",
  };
  const repository = {
    read: async () => saved,
    insert: async () => {
      throw new Error("Unexpected insert");
    },
  };
  await createProContent(repository, saved);
  await expect(
    createProContent(repository, { ...saved, reply_to_id: "second" }),
  ).rejects.toThrow("autre contenu");
  await expect(
    createProContent(repository, { ...saved, reply_to_id: null }),
  ).rejects.toThrow("autre contenu");
});

it("recovers club publication and convocation timestamps serialized by PostgreSQL", async () => {
  const row = {
    id: "club-record",
    club_id: "club",
    meeting_date: "2026-09-08T14:30:00.000Z",
    published_at: "2026-09-08T14:30:00.000Z",
    description: "Consignes",
  };
  await createProContent(
    {
      read: async () => ({
        ...row,
        meeting_date: "2026-09-08T14:30:00+00:00",
        published_at: "2026-09-08T14:30:00+00:00",
      }),
      insert: async () => {
        throw new Error("Duplicate club record");
      },
    },
    row,
  );
});

it("recovers the exact message recipient and content after an uncertain send", async () => {
  const row = {
    id: "message",
    sender_id: "me",
    receiver_id: "peer",
    content: "Bonjour",
  };
  let saved: Record<string, unknown> | null = null;
  let inserts = 0;
  const repository = {
    read: async () => saved,
    insert: async () => {
      saved = row;
      inserts++;
      throw new Error("Connection lost");
    },
  };
  await expect(createProContent(repository, row)).rejects.toThrow(
    "Connection lost",
  );
  await createProContent(repository, row);
  expect(inserts).toBe(1);
  await expect(
    createProContent(repository, { ...row, receiver_id: "other" }),
  ).rejects.toThrow("autre contenu");
  await expect(
    createProContent(repository, { ...row, content: "Changed" }),
  ).rejects.toThrow("autre contenu");
  expect(inserts).toBe(1);
});
