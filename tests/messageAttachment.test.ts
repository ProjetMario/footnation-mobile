import { describe, it, expect } from "vitest";
import {
  makeAttachment,
  normalizeAttachment,
  MAX_MESSAGE_FILE_BYTES,
  type LocalMessageFile,
} from "../src/lib/messageAttachment";
import {
  createMessageOutbox,
  type MessageProposal,
} from "../src/lib/messageOutbox";
const sender = "11111111-1111-4111-8111-111111111111",
  receiver = "22222222-2222-4222-8222-222222222222",
  id = "33333333-3333-4333-8333-333333333333",
  fileId = "44444444-4444-4444-8444-444444444444";
const file: LocalMessageFile = {
  uri: "file:///private/draft.pdf",
  name: "Mon CV.pdf",
  mime: "application/pdf",
  size: 4000,
  kind: "file",
  duration: null,
};
const attachment = makeAttachment(file, sender, receiver, id, fileId);
const validate = (value: unknown) =>
  normalizeAttachment(value, sender, receiver, id);
describe("private message attachment contract", () => {
  it("binds each object to sender, recipient and idempotent message identity", () => {
    expect(attachment.path).toBe(`${sender}/${receiver}/${id}/${fileId}.pdf`);
    expect(() =>
      normalizeAttachment(attachment, receiver, sender, id),
    ).toThrow();
    expect(() =>
      normalizeAttachment(attachment, sender, receiver, fileId),
    ).toThrow();
  });
  it.each([
    "../secret.pdf",
    `${sender}/${receiver}/${id}/../../secret.pdf`,
    `https://public.example/file.pdf`,
    `${sender}/${receiver}/${id}/${fileId}.exe`,
    `${sender}/${receiver}/${id}/not-a-uuid.pdf`,
  ])("rejects an untrusted path %s", (path) =>
    expect(() => validate({ ...attachment, path })).toThrow(),
  );
  it.each([0, -1, MAX_MESSAGE_FILE_BYTES + 1, 1.5, Infinity, NaN])(
    "rejects size %s",
    (size) => expect(() => validate({ ...attachment, size })).toThrow(),
  );
  it("refuses executable MIME and misleading audio duration", () => {
    expect(() =>
      makeAttachment(
        { ...file, mime: "text/html" },
        sender,
        receiver,
        id,
        fileId,
      ),
    ).toThrow();
    expect(() =>
      makeAttachment(
        { ...file, kind: "voice", duration: 10 },
        sender,
        receiver,
        id,
        fileId,
      ),
    ).toThrow();
    expect(() =>
      makeAttachment(
        { ...file, mime: "audio/mp4", kind: "voice", duration: 121 },
        sender,
        receiver,
        id,
        fileId,
      ),
    ).toThrow();
    expect(
      makeAttachment(
        { ...file, mime: "audio/mp4", kind: "voice", duration: 119.5 },
        sender,
        receiver,
        id,
        fileId,
      ).duration,
    ).toBe(119.5);
  });
  it("normalizes JSONB key order and excludes local URIs", () => {
    expect(
      JSON.stringify(
        validate(Object.fromEntries(Object.entries(attachment).reverse())),
      ),
    ).toBe(JSON.stringify(attachment));
    expect(attachment).not.toHaveProperty("uri");
  });
  it("rejects control characters and oversized names", () => {
    expect(() => validate({ ...attachment, name: "bad\nfile.pdf" })).toThrow();
    expect(() => validate({ ...attachment, name: "a".repeat(121) })).toThrow();
  });
});
describe("attachment retry outbox", () => {
  const setup = () => {
    const rows = new Map<string, string>();
    return createMessageOutbox({
      getItem: async (key) => rows.get(key) || null,
      setItem: async (key, value) => {
        rows.set(key, value);
      },
      removeItem: async (key) => {
        rows.delete(key);
      },
    });
  };
  const proposal: MessageProposal = {
    id,
    sender_id: sender,
    receiver_id: receiver,
    content: "Mon CV",
    attachment,
    localAttachmentUri: file.uri,
  };
  it("retains the same upload path across a lost response and reopening", async () => {
    const box = setup();
    await box.save(proposal);
    await box.save(proposal);
    expect(await box.load(sender, receiver)).toEqual(proposal);
    expect(await box.load(receiver, sender)).toBeNull();
  });
  it("refuses replacing an uncertain file under the same message", async () => {
    const box = setup();
    await box.save(proposal);
    await expect(
      box.save({ ...proposal, attachment: { ...attachment, size: 5000 } }),
    ).rejects.toThrow();
    expect(await box.load(sender, receiver)).toEqual(proposal);
  });
  it("keeps legacy text proposals compatible", async () => {
    const box = setup();
    const text = {
      id,
      sender_id: sender,
      receiver_id: receiver,
      content: "Bonjour",
    };
    await box.save(text);
    expect(await box.load(sender, receiver)).toEqual(text);
  });
  it("refuses public URLs masquerading as durable local drafts", () => {
    const box = setup();
    expect(() =>
      box.save({
        ...proposal,
        localAttachmentUri: "https://example.test/private",
      }),
    ).toThrow();
  });
});
