import { describe, it, expect, vi } from "vitest";
import { applyReferral, normalizeReferral } from "../src/lib/referral";
const user = "00000000-0000-4000-8000-000000000001";
function repository() {
  return {
    current: vi.fn(async () => null as string | null),
    resolve: vi.fn(
      async () => "00000000-0000-4000-8000-000000000002" as string | null,
    ),
    assignIfEmpty: vi.fn(async () => true),
  };
}
describe("signup referral attribution", () => {
  it("accepts source codes and UUID links but rejects arbitrary query values", () => {
    expect(normalizeReferral(" ab12cd ")).toBe("AB12CD");
    expect(normalizeReferral(user)).toBe(user);
    for (const value of [
      null,
      ["ABC123"],
      "",
      "bad",
      "https://example.com",
      "ABC123&x=1",
    ])
      expect(normalizeReferral(value)).toBeNull();
  });
  it("preserves an existing sponsor", async () => {
    const repo = repository();
    repo.current.mockResolvedValue("existing");
    expect(await applyReferral(repo, user, "ABC123")).toBe("already-assigned");
    expect(repo.resolve).not.toHaveBeenCalled();
    expect(repo.assignIfEmpty).not.toHaveBeenCalled();
  });
  it("rejects self referral and unknown codes without writing", async () => {
    for (const value of [user, null]) {
      const repo = repository();
      repo.resolve.mockResolvedValue(value);
      expect(await applyReferral(repo, user, "ABC123")).toBe("invalid");
      expect(repo.assignIfEmpty).not.toHaveBeenCalled();
    }
  });
  it("does not overwrite a sponsor assigned concurrently", async () => {
    const repo = repository();
    repo.assignIfEmpty.mockResolvedValue(false);
    expect(await applyReferral(repo, user, "ABC123")).toBe("already-assigned");
  });
  it("reports success only after persistence and allows errors to be retried", async () => {
    const repo = repository();
    repo.assignIfEmpty.mockRejectedValueOnce(new Error("offline"));
    await expect(applyReferral(repo, user, "ABC123")).rejects.toThrow(
      "offline",
    );
    expect(await applyReferral(repo, user, "ABC123")).toBe("assigned");
  });
});
