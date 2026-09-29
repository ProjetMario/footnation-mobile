import qrcode from "qrcode-generator";
import fallbackLogo from "../../assets/brand/qr-logo.json";
export const profileQrFallback = fallbackLogo;

export type QRProfile = {
  id?: string;
  username?: string | null;
  full_name?: string | null;
  primary_role?: string | null;
  account_type?: string | null;
  avatar_url?: string | null;
};
export const qrEscape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function profileQrUrl(profile: QRProfile) {
  return profile.id
    ? `https://www.foot-nation.com/qr/${encodeURIComponent(profile.id)}`
    : "";
}
function hslHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
// Matches the web QRCodeCard's stable profile-based palette exactly.
export function profileQrTheme(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash % 360);
  return {
    primary: hslHex(hue, 75, 45),
    secondary: hslHex((hue + 40) % 360, 75, 55),
    ink: hslHex(hue, 80, 25),
  };
}
export function profileQrLabel(profile: QRProfile) {
  return (
    (
      {
        personal: "Joueur",
        club: "Club",
        business: "Entreprise",
        institution: "Institution",
      } as Record<string, string>
    )[profile.account_type || ""] ||
    profile.primary_role ||
    "Joueur"
  );
}
export function profileQrMatrix(profile: QRProfile) {
  const value = profileQrUrl(profile);
  if (!value) return null;
  const code = qrcode(0, "H");
  code.addData(value);
  code.make();
  return code;
}
export function profileQrSvg(
  profile: QRProfile,
  photo = profile.avatar_url || "",
) {
  const code = profileQrMatrix(profile);
  if (!code) return "";
  const theme = profileQrTheme(profile.id!);
  const count = code.getModuleCount();
  const total = count + 8; // Four intact quiet modules on all sides.
  let modules = "";
  for (let y = 0; y < count; y++)
    for (let x = 0; x < count; x++)
      if (code.isDark(y, x)) modules += `M${x + 4} ${y + 4}h1v1h-1z`;
  const alias = profile.username
    ? `@${profile.username.replace(/^@/, "")}`
    : profile.full_name || "FootNation";
  const label = profileQrLabel(profile);
  const aliasSize = Math.max(
    9,
    Math.min(17, (245 / Math.max(1, alias.length)) * 1.6),
  );
  const labelSize = Math.max(
    9,
    Math.min(15, (240 / Math.max(1, label.length)) * 1.6),
  );
  const safePhoto = /^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(
    photo,
  )
    ? photo
    : fallbackLogo;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="360" viewBox="0 0 320 360"><defs><linearGradient id="qrBall" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${theme.primary}"/><stop offset="1" stop-color="${theme.secondary}"/></linearGradient><clipPath id="ballClip"><circle cx="160" cy="178" r="146"/></clipPath></defs><circle cx="160" cy="178" r="150" fill="url(#qrBall)"/><g clip-path="url(#ballClip)" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="7"><path d="M160 32c34 34 51 78 51 146s-17 112-51 146M160 32c-34 34-51 78-51 146s17 112 51 146"/><path d="M22 134c36 22 82 32 138 32s102-10 138-32M22 222c36-22 82-32 138-32s102 10 138 32"/><path d="M64 72c18 24 32 50 42 79M256 72c-18 24-32 50-42 79M64 284c18-24 32-50 42-79M256 284c-18-24-32-50-42-79"/></g><circle cx="160" cy="178" r="126" fill="#fff"/><circle cx="160" cy="178" r="137" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="4" stroke-dasharray="8 5"/><g transform="translate(40 58) scale(${240 / total})"><path d="${modules}" fill="${theme.ink}"/></g>${safePhoto ? `<circle cx="160" cy="178" r="28" fill="#fff"/><clipPath id="photoClip"><circle cx="160" cy="178" r="22"/></clipPath><image x="138" y="156" width="44" height="44" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)" href="${qrEscape(safePhoto)}"/>` : ""}<rect x="53" y="4" width="214" height="39" rx="20" fill="${theme.secondary}" stroke="#fff" stroke-width="3"/><text x="160" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="${aliasSize}" fill="#fff">${qrEscape(alias)}</text><rect x="70" y="316" width="180" height="36" rx="18" fill="${theme.secondary}"/><text x="160" y="340" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="${labelSize}" fill="#fff">${qrEscape(label)}</text></svg>`;
}
