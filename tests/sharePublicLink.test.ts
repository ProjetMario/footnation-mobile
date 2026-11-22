import { describe, expect, it, vi } from "vitest";
import { sharePublicLink } from "../src/lib/sharePublicLink";
const url = "https://www.foot-nation.com/shorts?shortId=fixture";
describe("public link sharing across browsers and native", () => {
  it("accepts a successful web share with no native result object", async () => {
    const copy = vi.fn();
    expect(
      await sharePublicLink(url, {
        platform: "web",
        share: async () => {},
        copy,
      }),
    ).toBe("shared");
    expect(copy).not.toHaveBeenCalled();
  });
  it("copies the canonical URL when a browser lacks Web Share", async () => {
    const copy = vi.fn().mockResolvedValue(true);
    expect(
      await sharePublicLink(url, {
        platform: "web",
        share: async () => {
          throw new Error("Unsupported");
        },
        copy,
      }),
    ).toBe("copied");
    expect(copy).toHaveBeenCalledWith(url);
  });
  it("treats browser and native cancellation as neutral without copying", async () => {
    const copy = vi.fn();
    expect(
      await sharePublicLink(url, {
        platform: "web",
        share: async () => {
          throw new DOMException("Cancelled", "AbortError");
        },
        copy,
      }),
    ).toBe("dismissed");
    expect(
      await sharePublicLink(url, {
        platform: "ios",
        share: async () => ({ action: "dismissedAction" }),
        copy,
      }),
    ).toBe("dismissed");
    expect(copy).not.toHaveBeenCalled();
  });
  it("does not pretend to copy if permissions are denied or alter native failures", async () => {
    const share = async () => {
      throw new Error("Unsupported");
    };
    await expect(
      sharePublicLink(url, { platform: "web", share, copy: async () => false }),
    ).rejects.toThrow("Unsupported");
    const copy = vi.fn();
    await expect(
      sharePublicLink(url, { platform: "ios", share, copy }),
    ).rejects.toThrow("Unsupported");
    expect(copy).not.toHaveBeenCalled();
  });
});
