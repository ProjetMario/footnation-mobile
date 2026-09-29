import { describe, expect, it, vi } from "vitest";
import { guardedAccountCheckout } from "../../supabase/functions/_shared/account-deletion-checkout";

function services() {
  return {
    begin: vi.fn(async () => "intent-123"),
    create: vi.fn(async () => ({
      id: "cs_test",
      url: "https://checkout.test",
    })),
    finish: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
  };
}
describe("checkout/delete account exclusion", () => {
  it("does not create any checkout when deletion owns the account lease", async () => {
    const s = services();
    s.begin.mockRejectedValue(new Error("deletion running"));
    await expect(guardedAccountCheckout(s)).rejects.toThrow();
    expect(s.create).not.toHaveBeenCalled();
  });
  it("uses the intent as the Stripe idempotency key and records the ID before releasing the URL", async () => {
    const s = services();
    expect(await guardedAccountCheckout(s)).toEqual({
      id: "cs_test",
      url: "https://checkout.test",
    });
    expect(s.create).toHaveBeenCalledWith("intent-123");
    expect(s.finish).toHaveBeenCalledWith("intent-123", "cs_test");
  });
  it("keeps deletion blocked if recording a created checkout fails", async () => {
    const s = services();
    s.finish.mockRejectedValue(new Error("db unavailable"));
    await expect(guardedAccountCheckout(s)).rejects.toThrow();
    expect(s.abort).not.toHaveBeenCalled();
  });
  it.each([undefined, 500, 409])(
    "never assumes an ambiguous creation failed (%s)",
    async (statusCode) => {
      const s = services();
      s.create.mockRejectedValue({ statusCode });
      await expect(guardedAccountCheckout(s)).rejects.toThrow();
      expect(s.abort).not.toHaveBeenCalled();
    },
  );
  it("releases a definitively rejected request without a checkout", async () => {
    const s = services();
    s.create.mockRejectedValue({ statusCode: 400 });
    await expect(guardedAccountCheckout(s)).rejects.toThrow();
    expect(s.abort).toHaveBeenCalledWith("intent-123");
  });
});
