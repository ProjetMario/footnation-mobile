import { describe, expect, it, vi } from "vitest";
import {
  ensureMessageUpload,
  isOwnedMessageDraft,
  messageObjectMatches,
} from "../src/lib/messageAttachmentUpload";
import type { MessageAttachment } from "../src/lib/messageAttachment";

const attachment: MessageAttachment = {
  version: 1,
  path: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444.pdf",
  kind: "file",
  name: "CV.pdf",
  size: 4,
  mime: "application/pdf",
  duration: null,
};
const present = {
  data: { size: 4, contentType: "application/pdf" },
  error: null,
};
const absent = { data: null, error: { statusCode: "404" } };
function setup() {
  return {
    requireUser: vi.fn(async () => {}),
    info: vi.fn<() => Promise<{ data: unknown; error: unknown }>>(
      async () => absent,
    ),
    bytes: vi.fn(async () => new ArrayBuffer(4)),
    upload: vi.fn<(_bytes: ArrayBuffer) => Promise<{ error: unknown }>>(
      async () => ({
        error: null,
      }),
    ),
  };
}
describe("private attachment upload reconciliation", () => {
  it("accepts the installed camelized Storage v2 and legacy metadata shapes", () => {
    expect(messageObjectMatches(present.data, attachment)).toBe(true);
    expect(
      messageObjectMatches(
        { metadata: { size: "4", mimetype: "application/pdf" } },
        attachment,
      ),
    ).toBe(true);
    expect(
      messageObjectMatches(
        { size: 4, content_type: "application/pdf" },
        attachment,
      ),
    ).toBe(true);
    expect(messageObjectMatches({ size: 4 }, attachment)).toBe(false);
    expect(
      messageObjectMatches({ size: 4, contentType: "text/html" }, attachment),
    ).toBe(false);
  });
  it("resumes a confirmed object even when the OS has lost the local copy", async () => {
    const ports = setup();
    ports.info.mockResolvedValue(present);
    ports.bytes.mockRejectedValue(new Error("Local file evicted"));
    await ensureMessageUpload(attachment, ports);
    expect(ports.bytes).not.toHaveBeenCalled();
    expect(ports.upload).not.toHaveBeenCalled();
  });
  it.each([
    { status: 503 },
    { statusCode: "403" },
    new Error("Network failed"),
  ])("never treats a failed lookup as an absent object: %o", async (error) => {
    const ports = setup();
    ports.info.mockResolvedValue({ data: null, error });
    await expect(ensureMessageUpload(attachment, ports)).rejects.toThrow(
      "vérifier",
    );
    expect(ports.upload).not.toHaveBeenCalled();
    expect(ports.bytes).not.toHaveBeenCalled();
  });
  it.each([{ status: 404 }, { code: "NoSuchKey" }])(
    "uploads only a confirmed missing object: %o",
    async (error) => {
      const ports = setup();
      ports.info.mockResolvedValue({ data: null, error });
      await ensureMessageUpload(attachment, ports);
      expect(ports.upload).toHaveBeenCalledOnce();
      expect(ports.upload.mock.calls[0][0]).toHaveProperty("byteLength", 4);
    },
  );
  it("rejects conflicting remote metadata without replacing it", async () => {
    const ports = setup();
    ports.info.mockResolvedValue({
      data: { size: 4, contentType: "video/mp4" },
      error: null,
    });
    await expect(ensureMessageUpload(attachment, ports)).rejects.toThrow(
      "correspond",
    );
    expect(ports.upload).not.toHaveBeenCalled();
  });
  it("verifies a lost upload response before confirming the proposal", async () => {
    const ports = setup();
    ports.info.mockResolvedValueOnce(absent).mockResolvedValueOnce(present);
    ports.upload.mockResolvedValue({ error: new Error("Response lost") });
    await ensureMessageUpload(attachment, ports);
    expect(ports.upload).toHaveBeenCalledOnce();
    expect(ports.info).toHaveBeenCalledTimes(2);
  });
  it("leaves an ambiguous upload retryable when confirmation cannot be read", async () => {
    const ports = setup();
    ports.upload.mockResolvedValue({ error: new Error("Response lost") });
    await expect(ensureMessageUpload(attachment, ports)).rejects.toThrow(
      "pas confirmé",
    );
    expect(ports.upload).toHaveBeenCalledOnce();
  });
  it.each([2, 3, 4])(
    "stops on an identity change at asynchronous boundary %s",
    async (boundary) => {
      const ports = setup();
      let checks = 0;
      ports.requireUser.mockImplementation(async () => {
        if (++checks === boundary) throw new Error("Session changed");
      });
      await expect(ensureMessageUpload(attachment, ports)).rejects.toThrow(
        "Session changed",
      );
      expect(ports.upload).toHaveBeenCalledTimes(boundary === 4 ? 1 : 0);
    },
  );
  it("rejects local byte changes before upload", async () => {
    const ports = setup();
    ports.bytes.mockResolvedValue(new ArrayBuffer(3));
    await expect(ensureMessageUpload(attachment, ports)).rejects.toThrow(
      "changé",
    );
    expect(ports.upload).not.toHaveBeenCalled();
  });
});
describe("owned local draft paths", () => {
  const dir =
    "file:///documents/message-drafts/11111111-1111-4111-8111-111111111111";
  const name = "44444444-4444-4444-8444-444444444444.pdf";
  it("accepts only an immediate UUID file inside that account directory", () => {
    expect(isOwnedMessageDraft(dir, `${dir}/${name}`)).toBe(true);
    expect(isOwnedMessageDraft(`${dir}/`, `${dir}/${name}`)).toBe(true);
    for (const suffix of [
      `../${name}`,
      `%2e%2e/${name}`,
      `x/${name}`,
      `${name}/..`,
      `${name}?path=x`,
      "arbitrary.pdf",
    ]) {
      expect(isOwnedMessageDraft(dir, `${dir}/${suffix}`)).toBe(false);
    }
    expect(isOwnedMessageDraft(dir, `${dir}2/${name}`)).toBe(false);
    expect(
      isOwnedMessageDraft(
        dir,
        `${dir}/${name}`.replace(
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
        ),
      ),
    ).toBe(false);
  });
});
