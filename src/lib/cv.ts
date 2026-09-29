import { cvPageSvg, cvPageLayout } from "./cvLayout";
import {
  profileQrMatrix,
  profileQrTheme,
  profileQrLabel,
  qrEscape,
} from "./profileQr";
export * from "./cvData";
import { cvIdentity, cvProfileUrl, escapeHtml, type CVProfile } from "./cvData";
// The exact same A4 artwork is used for preview, native printing and PDF export.
export function cvHtml(profile: CVProfile): string {
  return `<!doctype html><html lang="fr"><head><meta charset="UTF-8"><title>${escapeHtml(cvIdentity(profile).name)} · CV Football</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;width:210mm;height:297mm;background:#fff}svg{display:block;width:210mm;height:297mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${cvPageSvg(profile)}</body></html>`;
}
// Word receives regular HTML rather than an SVG-only document, retaining editing.
export function cvWordHtml(profile: CVProfile) {
  const layout = cvPageLayout(profile);
  const id = cvIdentity(profile);
  const code = profileQrMatrix(profile);
  const theme = profileQrTheme(profile.id || "");
  const content = layout.texts.filter((t) => t.y > 214 && t.y < 1080);
  return `<!doctype html><html lang="fr" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="UTF-8"><title>${escapeHtml(id.name)}</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;font-size:9pt;color:#17233B}h1{font-size:22pt;margin:8px 0}p{margin:0 0 5px;line-height:1.35}td{vertical-align:top;padding:10px}table{border-collapse:collapse;width:100%;table-layout:fixed}h2{font-size:12pt;border-bottom:1pt solid #2563EB;margin:12px 0 8px}</style></head><body><table style="background:#2563EB;color:white"><tr><td style="width:72%"><p>FOOTNATION · CV FOOTBALL</p><h1>${escapeHtml(id.name)}</h1><p>${escapeHtml([id.role, id.club, id.location, id.age !== null ? `${id.age} ans` : ""].filter(Boolean).join(" · "))}</p></td><td style="text-align:center;background:${theme.secondary}">${code ? `<p>${escapeHtml(profile.username ? `@${profile.username}` : id.name)}</p><img src="${qrEscape(code.createDataURL(3, 12))}" width="105" height="105" alt="QR code du profil"/><p>${escapeHtml(profileQrLabel(profile))}</p>` : ""}</td></tr></table><table><tr><td>${content
    .filter((t) => t.x < 400)
    .map((t) =>
      t.bold && t.size === 16
        ? `<h2>${escapeHtml(t.text)}</h2>`
        : `<p>${escapeHtml(t.text)}</p>`,
    )
    .join("")}</td><td>${content
    .filter((t) => t.x >= 400)
    .map((t) =>
      t.bold && t.size === 16
        ? `<h2>${escapeHtml(t.text)}</h2>`
        : `<p>${escapeHtml(t.text)}</p>`,
    )
    .join(
      "",
    )}</td></tr></table><p style="font-size:8pt">CV sur une page · Profil complet : ${escapeHtml(cvProfileUrl(profile))}</p></body></html>`;
}
