import { jsPDF } from "jspdf";
import { cvIdentity, cvProfileUrl, type CVProfile } from "./cv";
import { cvPageLayout } from "./cvLayout";
import {
  profileQrLabel,
  profileQrMatrix,
  profileQrTheme,
  profileQrUrl,
  profileQrFallback,
} from "./profileQr";

type PDFAssets = { regular: string; bold: string; avatar?: string };
/** One A4 page, vector text and QR modules, matching the on-screen layout. */
export function renderCVPdf(profile: CVProfile, assets: PDFAssets) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
  });
  const k = pdf.internal.pageSize.getWidth() / 794;
  pdf.addFileToVFS("Inter-Regular.ttf", assets.regular);
  pdf.addFont("Inter-Regular.ttf", "Inter", "normal");
  pdf.addFileToVFS("Inter-Bold.ttf", assets.bold);
  pdf.addFont("Inter-Bold.ttf", "Inter", "bold");
  const identity = cvIdentity(profile);
  pdf.setProperties({
    title: `CV Football · ${identity.name}`,
    author: identity.name,
    creator: "FootNation",
  });
  for (let i = 0; i < 794; i += 2) {
    const t = i / 794;
    pdf.setFillColor(
      Math.round(37 + (67 - 37) * t),
      Math.round(99 + (56 - 99) * t),
      Math.round(235 + (202 - 235) * t),
    );
    pdf.rect(i * k, 0, 2.1 * k, 214 * k, "F");
  }
  if (assets.avatar) {
    pdf.setFillColor("#A7BBEF");
    pdf.circle(84 * k, 98 * k, 53 * k, "F");
    pdf.saveGraphicsState();
    pdf.circle(84 * k, 98 * k, 49 * k, null);
    pdf.clip();
    pdf.discardPath();
    try {
      pdf.addImage(assets.avatar, "JPEG", 35 * k, 49 * k, 98 * k, 98 * k);
    } catch {
      /* Optional avatar. */
    }
    pdf.restoreGraphicsState();
  }
  const code = profileQrMatrix(profile);
  if (code) {
    const theme = profileQrTheme(profile.id!);
    const q = 0.46 * k;
    const ox = 613 * k,
      oy = 20 * k;
    const box = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
      color: string,
    ) => {
      pdf.setFillColor(color);
      pdf.roundedRect(ox + x * q, oy + y * q, w * q, h * q, r * q, r * q, "F");
    };
    box(8, 24, 304, 304, 34, theme.primary);
    pdf.setDrawColor(theme.secondary);
    pdf.setLineWidth(3 * q);
    pdf.setLineDashPattern([6 * q, 3 * q], 0);
    pdf.roundedRect(
      ox + 22 * q,
      oy + 38 * q,
      276 * q,
      276 * q,
      24 * q,
      24 * q,
      "S",
    );
    pdf.setLineDashPattern([], 0);
    box(35, 61, 250, 250, 21, "#FFFFFF");
    const count = code.getModuleCount();
    const cell = 250 / (count + 8);
    pdf.setFillColor(theme.ink);
    for (let y = 0; y < count; y++)
      for (let x = 0; x < count; x++)
        if (code.isDark(y, x))
          pdf.rect(
            ox + (35 + (x + 4) * cell) * q,
            oy + (61 + (y + 4) * cell) * q,
            cell * q + 0.02,
            cell * q + 0.02,
            "F",
          );
    {
      box(134, 160, 52, 52, 3, "#FFFFFF");
      try {
        pdf.addImage(
          assets.avatar || profileQrFallback,
          assets.avatar ? "JPEG" : "PNG",
          ox + 138 * q,
          oy + 164 * q,
          44 * q,
          44 * q,
        );
      } catch {
        /* Optional avatar. */
      }
    }
    box(45, 4, 230, 39, 20, theme.secondary);
    box(45, 310, 230, 36, 18, theme.secondary);
    pdf.setFont("Inter", "bold");
    pdf.setTextColor("#FFFFFF");
    for (const [label, y, maxSize] of [
      [
        profile.username
          ? `@${profile.username.replace(/^@/, "")}`
          : identity.name,
        30,
        17,
      ],
      [profileQrLabel(profile), 334, 15],
    ] as const) {
      pdf.setFontSize(maxSize * q);
      const shrink = Math.min(1, (215 * q) / pdf.getTextWidth(label));
      pdf.setFontSize(maxSize * q * shrink);
      pdf.text(label, ox + 160 * q, oy + y * q, { align: "center" });
    }
    pdf.link(ox, oy, 320 * q, 356 * q, { url: profileQrUrl(profile) });
  }
  const layout = cvPageLayout(profile);
  for (const b of layout.boxes) {
    pdf.setFillColor(b.color);
    pdf.roundedRect(
      b.x * k,
      b.y * k,
      b.width * k,
      b.height * k,
      (b.radius || 0) * k,
      (b.radius || 0) * k,
      "F",
    );
  }
  for (const t of layout.texts) {
    pdf.setFont("Inter", t.bold ? "bold" : "normal");
    pdf.setFontSize(t.size * k);
    pdf.setTextColor(t.color);
    pdf.text(t.text, t.x * k, t.y * k);
  }
  if (cvProfileUrl(profile))
    pdf.link(32 * k, 1084 * k, 560 * k, 24 * k, { url: cvProfileUrl(profile) });
  return pdf;
}
