import { describe, expect, it } from "vitest";
import {
  buildInvitationMessage,
  buildInvitationUrl,
  invitationShareTarget,
  type InvitationChannel,
} from "../src/lib/invitationShare";

const user = "A1234567-89AB-4CDE-8F01-23456789ABCD";
const codeUrl = "https://www.foot-nation.com/login?mode=signup&ref=ABC123";

describe("invitation link identity", () => {
  it("prefers a normalized six-character referral code", () => {
    expect(buildInvitationUrl(user, " abc123 ")).toBe(codeUrl);
    expect(buildInvitationUrl("unused invalid fallback", "ABC123")).toBe(
      codeUrl,
    );
  });

  it("falls back to a normalized user UUID when the code is absent or invalid", () => {
    for (const code of [
      undefined,
      null,
      "",
      "ABC12",
      "ABC1234",
      "ABC123&next=bad",
      "ABC_23",
      "ébc123",
      "00000000-0000-4000-8000-000000000002",
    ]) {
      expect(buildInvitationUrl(` ${user} `, code)).toBe(
        `https://www.foot-nation.com/login?mode=signup&ref=${user.toLowerCase()}`,
      );
    }
  });

  it("does not accept a short code, query, or malformed identifier as a user UUID", () => {
    for (const id of [
      "",
      "ABC123",
      "not-a-user",
      `${user}&to=someone`,
      user.replaceAll("-", ""),
      user.replace("A", "Z"),
      null,
      undefined,
      42,
      [user],
    ]) {
      expect(() => buildInvitationUrl(id as string)).toThrow();
    }
  });
});

describe("invitation message and endpoint safety", () => {
  it("keeps the invitation link once in readable French text", () => {
    const message = buildInvitationMessage(codeUrl);
    expect(message).toContain("Rejoins-moi sur FootNation ⚽");
    expect(message).toContain("Crée ton profil gratuitement");
    expect(message.split(codeUrl)).toHaveLength(2);
    expect(message.endsWith(codeUrl)).toBe(true);
  });

  it("rejects external, altered or ambiguous invitation links for every sharing channel", () => {
    const channels: InvitationChannel[] = [
      "system",
      "whatsapp",
      "facebook",
      "instagram",
      "tiktok",
      "sms",
    ];
    for (const url of [
      "https://evil.example/login?mode=signup&ref=ABC123",
      "https://www.foot-nation.com.evil.example/login?mode=signup&ref=ABC123",
      "https://www.foot-nation.com@evil.example/login?mode=signup&ref=ABC123",
      "http://www.foot-nation.com/login?mode=signup&ref=ABC123",
      "javascript:alert(1)",
      "//www.foot-nation.com/login?mode=signup&ref=ABC123",
      "https://www.foot-nation.com/login?mode=signup&ref=abc123",
      "https://www.foot-nation.com/login?mode=signup&ref=%41BC123",
      `${codeUrl}&redirect=https://evil.example`,
      `${codeUrl}&ref=OTHER1`,
      `${codeUrl}#fragment`,
      `${codeUrl}\n`,
      `${codeUrl} `,
      codeUrl.replace("/login", "/signup"),
      null,
      undefined,
    ]) {
      expect(() => buildInvitationMessage(url as string)).toThrow();
      for (const channel of channels) {
        expect(() =>
          invitationShareTarget(channel, url as string, "ios"),
        ).toThrow();
      }
    }
  });

  it("encodes the whole WhatsApp invitation as one text parameter with no recipient", () => {
    const target = invitationShareTarget("whatsapp", codeUrl, "android");
    expect(target.kind).toBe("url");
    const endpoint = new URL(target.url);
    expect(endpoint.origin).toBe("https://wa.me");
    expect(endpoint.pathname).toBe("/");
    expect([...endpoint.searchParams.keys()]).toEqual(["text"]);
    expect(endpoint.searchParams.get("text")).toBe(
      buildInvitationMessage(codeUrl),
    );
  });

  it("shares only the canonical link through Facebook's sharer", () => {
    const target = invitationShareTarget("facebook", codeUrl, "web");
    const endpoint = new URL(target.url);
    expect(target.kind).toBe("url");
    expect(endpoint.origin).toBe("https://www.facebook.com");
    expect(endpoint.pathname).toBe("/sharer/sharer.php");
    expect([...endpoint.searchParams.keys()]).toEqual(["u"]);
    expect(endpoint.searchParams.get("u")).toBe(codeUrl);
  });

  it("uses the system sheet for Instagram and TikTok without pretending to target their composer", () => {
    for (const channel of ["system", "instagram", "tiktok"] as const) {
      for (const platform of ["ios", "android", "web"]) {
        expect(invitationShareTarget(channel, codeUrl, platform)).toEqual({
          kind: "system",
          message: buildInvitationMessage(codeUrl),
          url: codeUrl,
        });
      }
    }
  });

  it("prefills an encoded SMS draft without choosing a recipient on iOS and Android", () => {
    for (const [platform, prefix] of [
      ["ios", "sms:&body="],
      ["android", "sms:?body="],
    ]) {
      const target = invitationShareTarget("sms", codeUrl, platform);
      expect(target.kind).toBe("url");
      expect(target.url.startsWith(prefix)).toBe(true);
      expect(decodeURIComponent(target.url.slice(prefix.length))).toBe(
        buildInvitationMessage(codeUrl),
      );
      expect(target.url).not.toContain("&ref=");
      expect(target.url).not.toContain("\n");
    }
    for (const platform of ["web", "windows", "macos"]) {
      expect(invitationShareTarget("sms", codeUrl, platform).kind).toBe(
        "system",
      );
    }
  });

  it("refuses unknown channels and platform values without manufacturing an endpoint", () => {
    for (const channel of [
      "WHATSAPP",
      "mailto",
      "https://evil.example",
      "sms:?to=someone",
      null,
      undefined,
    ]) {
      expect(() =>
        invitationShareTarget(channel as InvitationChannel, codeUrl, "ios"),
      ).toThrow();
    }
    for (const platform of [
      "IOS",
      "linux",
      "android?to=someone",
      "",
      null,
      undefined,
    ]) {
      expect(() =>
        invitationShareTarget("sms", codeUrl, platform as string),
      ).toThrow();
    }
  });
});
