import { describe, expect, it } from "vitest";
import { cvHtml } from "../src/lib/cv";
import {
  profileQrFallback,
  profileQrSvg,
  profileQrUrl,
} from "../src/lib/profileQr";

const profile = {
  id: "00000000-0000-4000-8000-000000000001",
  username: "demo",
};
describe("personalized profile QR", () => {
  it("uses the bundled Bosnia logo without an avatar, also in the printed CV", () => {
    expect(profileQrFallback).toMatch(/^data:image\/png;base64,/);
    for (const avatar_url of [null, "", "javascript:alert(1)"]) {
      expect(profileQrSvg({ ...profile, avatar_url })).toContain(
        `href="${profileQrFallback}"`,
      );
      expect(cvHtml({ ...profile, avatar_url })).toContain(
        `href="${profileQrFallback}"`,
      );
    }
  });
  it("preserves an uploaded photo and escapes text and URL attributes", () => {
    const svg = profileQrSvg({
      ...profile,
      username: '<img onerror="x">',
      avatar_url: 'https://example.com/photo?name="test"',
    });
    expect(svg).toContain(
      'href="https://example.com/photo?name=&quot;test&quot;"',
    );
    expect(svg).not.toContain(profileQrFallback);
    expect(svg).not.toContain("<img");
    expect(svg).toContain("&lt;img onerror=&quot;x&quot;&gt;");
  });
  it("does not manufacture a destination for a missing profile", () => {
    expect(profileQrUrl({})).toBe("");
    expect(profileQrSvg({})).toBe("");
    expect(profileQrUrl(profile)).toBe(
      `https://www.foot-nation.com/qr/${profile.id}`,
    );
  });
});
