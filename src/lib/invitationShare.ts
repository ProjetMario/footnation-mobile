import { normalizeReferral } from "./referral";

export type InvitationChannel =
  "system" | "whatsapp" | "facebook" | "instagram" | "tiktok" | "sms";

export type InvitationShareTarget =
  | { kind: "url"; url: string }
  | { kind: "system"; message: string; url: string };

// Keep the public website's registration route, which also accepts UUID referrals.
const invitationPrefix = "https://www.foot-nation.com/login?mode=signup&ref=";
const userIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const platforms = new Set(["ios", "android", "web", "windows", "macos"]);

export function buildInvitationUrl(
  userId: string,
  referralCode?: string | null,
): string {
  const code = normalizeReferral(referralCode);
  if (code?.length === 6) return `${invitationPrefix}${code}`;
  const user = normalizeReferral(userId);
  if (!user || !userIdPattern.test(user)) {
    throw new Error("Impossible de créer votre lien d’invitation.");
  }
  return `${invitationPrefix}${user}`;
}

function requireInvitationUrl(url: string): string {
  if (typeof url !== "string" || !url.startsWith(invitationPrefix)) {
    throw new Error("Le lien d’invitation est invalide.");
  }
  const reference = url.slice(invitationPrefix.length);
  const normalized = normalizeReferral(reference);
  if (!normalized || reference !== normalized) {
    throw new Error("Le lien d’invitation est invalide.");
  }
  return url;
}

export function buildInvitationMessage(url: string): string {
  const invitationUrl = requireInvitationUrl(url);
  return `Rejoins-moi sur FootNation ⚽\nCrée ton profil gratuitement et partage ta passion du football !\n\n${invitationUrl}`;
}

/** Describe a user-initiated share without opening an app or sending anything. */
export function invitationShareTarget(
  channel: InvitationChannel,
  url: string,
  platform: string,
): InvitationShareTarget {
  if (!platforms.has(platform)) {
    throw new Error("Cette plateforme de partage n’est pas prise en charge.");
  }
  const message = buildInvitationMessage(url);
  switch (channel) {
    case "whatsapp":
      return {
        kind: "url",
        url: `https://wa.me/?text=${encodeURIComponent(message)}`,
      };
    case "facebook":
      return {
        kind: "url",
        url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      };
    case "sms":
      if (platform === "ios" || platform === "android") {
        const separator = platform === "ios" ? "&" : "?";
        return {
          kind: "url",
          url: `sms:${separator}body=${encodeURIComponent(message)}`,
        };
      }
      return { kind: "system", message, url };
    case "system":
    case "instagram":
    case "tiktok":
      // Neither network offers a universal URL to prefill a text invitation.
      return { kind: "system", message, url };
    default:
      throw new Error("Ce canal de partage n’est pas pris en charge.");
  }
}
