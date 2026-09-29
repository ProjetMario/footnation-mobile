import {
  cvCharacteristics,
  cvIdentity,
  cvSections,
  type CVProfile,
} from "./cvData";
import { profileQrSvg, qrEscape } from "./profileQr";

export type CVText = {
  x: number;
  y: number;
  size: number;
  text: string;
  color: string;
  bold?: boolean;
};
export type CVBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  radius?: number;
};
export type CVLayout = { texts: CVText[]; boxes: CVBox[]; condensed: boolean };
export const CV_WIDTH = 794;
export const CV_HEIGHT = 1123;
const compact = (s: string) => s.replace(/\s+/g, " ").trim();
function widthOf(text: string, size: number) {
  // Conservative advances keep the same lines in native SVG, browser and PDF.
  return (
    [...text].reduce(
      (sum, c) =>
        sum +
        (/[MW@%]/.test(c)
          ? 0.9
          : /[ilI.,:;'!| ]/.test(c)
            ? 0.3
            : /[A-ZÉÈÀ]/.test(c)
              ? 0.72
              : 0.6),
      0,
    ) * size
  );
}
export function cvWrap(
  text: string,
  width: number,
  size: number,
  limit = Infinity,
) {
  const lines: string[] = [];
  let line = "";
  for (const word of compact(text).split(" ")) {
    if (widthOf(`${line} ${word}`.trim(), size) <= width) {
      line = `${line} ${word}`.trim();
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const char of word) {
      if (widthOf(line + char, size) > width) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
  }
  if (line) lines.push(line);
  if (lines.length > limit) {
    lines.length = limit;
    lines[limit - 1] = lines[limit - 1].replace(/.{0,3}$/, "…");
  }
  return lines;
}
/** A readable one-page selection. The complete career stays in the linked profile. */
export function cvPageLayout(profile: CVProfile): CVLayout {
  const texts: CVText[] = [];
  const boxes: CVBox[] = [];
  let condensed = false;
  const add = (
    text: string,
    x: number,
    y: number,
    size: number,
    width: number,
    max: number,
    color = "#334155",
    bold = false,
  ) => {
    if (cvWrap(text, width, size).length > max) condensed = true;
    const lines = cvWrap(text, width, size, max);
    for (const [i, value] of lines.entries())
      texts.push({ x, y: y + i * size * 1.42, size, text: value, color, bold });
    return lines.length * size * 1.42;
  };
  const identity = cvIdentity(profile);
  const hasPhoto =
    typeof profile.avatar_url === "string" &&
    /^https:\/\//.test(profile.avatar_url);
  const hx = hasPhoto ? 156 : 32;
  const hw = profile.id ? 590 - hx : 728 - hx;
  add("FOOTNATION · CV FOOTBALL", hx, 36, 9, hw, 1, "#DBEAFE", true);
  const nh = add(identity.name, hx, 76, 27, hw, 2, "#FFFFFF", true);
  let hy = 82 + nh;
  for (const line of [
    identity.role,
    identity.club,
    [identity.location, identity.age !== null ? `${identity.age} ans` : ""]
      .filter(Boolean)
      .join(" · "),
  ].filter(Boolean)) {
    hy += add(line, hx, hy, 12, hw, 1, "#E0E7FF") + 4;
  }
  const all = cvSections(profile);
  let top = 246;
  const heading = (title: string, x: number, y: number, w: number) => {
    add(title, x, y, 16, w, 1, "#17233B", true);
    boxes.push({ x, y: y + 9, width: w, height: 2, color: "#2B63ED" });
    return y + 33;
  };
  const bio = all.find((s) => s.title === "Présentation");
  if (bio) {
    top = heading("Présentation", 32, top, 730);
    top += add(bio.lines.join(" "), 32, top, 12.5, 730, 4) + 24;
  }
  const characteristics = cvCharacteristics(profile);
  if (characteristics.length) {
    top = heading("Caractéristiques", 32, top, 730);
    for (const [index, item] of characteristics.entries()) {
      const x = 32 + index * 186;
      boxes.push({
        x,
        y: top - 8,
        width: 172,
        height: 61,
        radius: 10,
        color: "#F3F6FB",
      });
      add(item.label, x + 12, top + 11, 10, 148, 1, "#64748B");
      add(item.value, x + 12, top + 32, 13, 148, 1, "#17233B", true);
    }
    top += 84;
  }
  const contact =
    all
      .find((s) => s.title === "Informations")
      ?.lines.filter((l) => /^(E-mail|Téléphone) : /.test(l)) || [];
  const groups = [
    all.filter((s) =>
      [
        "Parcours",
        "Compétences techniques",
        "Points forts",
        "Autres rôles",
      ].includes(s.title),
    ),
    [
      ...all.filter(
        (s) =>
          ![
            "Présentation",
            "Informations",
            "Parcours",
            "Compétences techniques",
            "Points forts",
            "Autres rôles",
          ].includes(s.title),
      ),
      ...(contact.length ? [{ title: "Contact", lines: contact }] : []),
    ],
  ];
  for (const [column, sections] of groups.entries()) {
    let y = top;
    const x = column === 0 ? 32 : 418;
    // Bound dense profiles by section, leaving readable typography and a QR link.
    const available = 1060 - top;
    const sectionBudget = available / Math.max(sections.length, 1);
    for (const section of sections) {
      const start = y;
      y = heading(section.title, x, y, 344);
      const maxLines = Math.max(1, Math.floor((sectionBudget - 80) / 22.75));
      let remaining = maxLines;
      let shown = 0;
      for (const line of section.lines) {
        if (remaining < 1) break;
        const lines = cvWrap(line, 336, 12.5);
        const count = Math.min(
          remaining,
          lines.length,
          section.title === "Parcours" ? 3 : maxLines,
        );
        y += add(line, x, y, 12.5, 336, count) + 5;
        remaining -= count;
        shown++;
      }
      if (shown < section.lines.length) {
        condensed = true;
        y +=
          add(
            `+ ${section.lines.length - shown} autre(s) sur le profil`,
            x,
            y,
            9,
            336,
            1,
            "#2563EB",
          ) + 5;
      }
      y = Math.max(y + 22, start + 68);
    }
  }
  boxes.push({ x: 32, y: 1080, width: 730, height: 1, color: "#DCE4EF" });
  add(
    condensed
      ? "CV synthétique · Parcours complet via le QR code"
      : "Scannez le QR code pour découvrir le profil FootNation",
    32,
    1102,
    9,
    575,
    1,
    "#64748B",
  );
  add("FOOTNATION · 1 / 1", 652, 1102, 8, 120, 1, "#64748B", true);
  return { texts, boxes, condensed };
}
export function cvPageSvg(
  profile: CVProfile,
  avatar = profile.avatar_url || "",
) {
  const layout = cvPageLayout(profile);
  const hasPhoto =
    typeof avatar === "string" &&
    /^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(avatar);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123"><defs><linearGradient id="cvHero" x1="0" y1="0" x2="1" y2=".4"><stop stop-color="#2563EB"/><stop offset="1" stop-color="#4338CA"/></linearGradient><clipPath id="cvAvatar"><circle cx="84" cy="98" r="49"/></clipPath></defs><rect width="794" height="1123" fill="#fff"/><path d="M0 0H794V214H0Z" fill="url(#cvHero)"/>${hasPhoto ? `<circle cx="84" cy="98" r="53" fill="#FFFFFF" fill-opacity=".4"/><image x="35" y="49" width="98" height="98" clip-path="url(#cvAvatar)" preserveAspectRatio="xMidYMid slice" href="${qrEscape(avatar)}"/>` : ""}${
    profile.id
      ? `<g transform="translate(613 20) scale(.46)">${profileQrSvg(
          profile,
          avatar,
        )
          .replace(/<svg[^>]*>/, "")
          .replace(/<\/svg>$/, "")}</g>`
      : ""
  }${layout.boxes.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${b.radius || 0}" fill="${b.color}"/>`).join("")}${layout.texts.map((t) => `<text x="${t.x}" y="${t.y}" font-family="Arial,sans-serif" font-size="${t.size}" font-weight="${t.bold ? 700 : 400}" fill="${t.color}">${qrEscape(t.text)}</text>`).join("")}</svg>`;
}
