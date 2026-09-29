import { expect, it, vi } from "vitest";
import {
  handleCleanupRequest,
  runAttachmentCleanup,
  type CleanupJob,
  type CleanupPorts,
} from "../../supabase/functions/message-attachment-cleanup/worker";
const path =
  "00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/40000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001.pdf";
const job: CleanupJob = { path, object_id: "object", claim_id: "claim" };
function setup(jobs = [job]): CleanupPorts {
  return {
    claim: vi.fn(async () => jobs),
    remove: vi.fn(async () => {}),
    finish: vi.fn(async () => {}),
  };
}
it("removes only paths claimed by the database and confirms Storage API success", async () => {
  const ports = setup();
  await expect(runAttachmentCleanup(ports)).resolves.toEqual({
    processed: 1,
    deleted: 1,
    failed: 0,
  });
  expect(ports.remove).toHaveBeenCalledWith(path, expect.any(AbortSignal));
  expect(ports.finish).toHaveBeenCalledWith(job, true);
});
it("does no work for an empty claim", async () => {
  const ports = setup([]);
  await runAttachmentCleanup(ports);
  expect(ports.remove).not.toHaveBeenCalled();
});
it("refuses malformed or escaping paths before any Storage request", async () => {
  const invalid = { ...job, path: "../another-bucket/private.pdf" };
  const ports = setup([invalid]);
  await runAttachmentCleanup(ports);
  expect(ports.remove).not.toHaveBeenCalled();
  expect(ports.finish).toHaveBeenCalledWith(invalid, false);
});
it("keeps a failed object retryable without undoing other successful deletions", async () => {
  const second = { ...job, claim_id: "second" };
  const ports = setup([job, second]);
  vi.mocked(ports.remove).mockRejectedValueOnce(
    new Error("private provider details"),
  );
  await expect(runAttachmentCleanup(ports)).resolves.toEqual({
    processed: 2,
    deleted: 1,
    failed: 1,
  });
  expect(ports.finish).toHaveBeenCalledWith(job, false);
  expect(ports.finish).toHaveBeenCalledWith(second, true);
});
it("limits deletion requests to three in flight", async () => {
  const ports = setup(Array.from({ length: 8 }, () => job));
  let running = 0,
    peak = 0;
  vi.mocked(ports.remove).mockImplementation(async () => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 1));
    running -= 1;
  });
  await runAttachmentCleanup(ports);
  expect(peak).toBe(3);
});
it("rejects an oversized claimed batch", async () => {
  const ports = setup(Array.from({ length: 51 }, () => job));
  await expect(runAttachmentCleanup(ports)).rejects.toThrow("limit");
  expect(ports.remove).not.toHaveBeenCalled();
});
it("aborts a stalled deletion and records a retry", async () => {
  vi.useFakeTimers();
  try {
    const ports = setup();
    vi.mocked(ports.remove).mockImplementation(
      (_path, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new Error("timed out")),
            { once: true },
          );
        }),
    );
    const run = runAttachmentCleanup(ports);
    await vi.advanceTimersByTimeAsync(10001);
    await run;
    expect(ports.finish).toHaveBeenCalledWith(job, false);
  } finally {
    vi.useRealTimers();
  }
});
it("stays closed without server enablement and the dedicated secret", async () => {
  const ports = setup();
  const secret = "synthetic-cleanup-secret-at-least-32-characters";
  const request = (token: string) =>
    new Request("https://local.invalid", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  expect(
    (
      await handleCleanupRequest(request(secret), ports, {
        enabled: false,
        secret,
      })
    ).status,
  ).toBe(503);
  expect(
    (
      await handleCleanupRequest(request("wrong"), ports, {
        enabled: true,
        secret,
      })
    ).status,
  ).toBe(401);
  expect(ports.claim).not.toHaveBeenCalled();
});
it("ignores requested destinations and never returns private paths or errors", async () => {
  const ports = setup();
  const secret = "synthetic-cleanup-secret-at-least-32-characters";
  const request = () =>
    new Request("https://local.invalid", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ bucket: "other", path: "private-secret" }),
    });
  const response = await handleCleanupRequest(request(), ports, {
    enabled: true,
    secret,
  });
  expect(await response.json()).toEqual({
    processed: 1,
    deleted: 1,
    failed: 0,
  });
  expect(ports.remove).toHaveBeenCalledWith(path, expect.any(AbortSignal));
  vi.mocked(ports.claim).mockRejectedValueOnce(new Error("PRIVATE ERROR"));
  const failure = await handleCleanupRequest(request(), ports, {
    enabled: true,
    secret,
  });
  expect(await failure.text()).toBe(
    '{"error":"Cleanup processing unavailable"}',
  );
});
it("leaves an uncertain acknowledgement for the claim timeout retry", async () => {
  const ports = setup();
  vi.mocked(ports.finish).mockRejectedValueOnce(new Error("database offline"));
  await expect(runAttachmentCleanup(ports)).rejects.toThrow("acknowledgement");
  expect(ports.remove).toHaveBeenCalledTimes(1);
});
