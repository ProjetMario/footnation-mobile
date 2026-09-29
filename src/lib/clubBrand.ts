import { clubShirtColors } from "./clubPublicInformation";
import { darkColors, lightColors, type ThemeColors } from "../theme/palette";

const namedColors: Record<string, string> = {
  menthe: "#167566",
  rouge: "#CB3043",
  red: "#CB3043",
  bleu: "#1261CA",
  blue: "#1261CA",
  vert: "#15734F",
  green: "#15734F",
  jaune: "#A26708",
  yellow: "#A26708",
  orange: "#B45118",
  violet: "#7644B4",
  purple: "#7644B4",
  rose: "#B93072",
  pink: "#B93072",
  bordeaux: "#92283E",
  grenat: "#92283E",
  marine: "#22488D",
  turquoise: "#087B80",
};

export function mixClubColor(hex: string, target: string, amount: number) {
  const channels = [1, 3, 5].map((i) =>
    Math.round(
      parseInt(hex.slice(i, i + 2), 16) * (1 - amount) +
        parseInt(target.slice(i, i + 2), 16) * amount,
    ),
  );
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function clubContrast(a: string, b: string) {
  const luminance = (hex: string) =>
    [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

export function resolveClubBrand(club: Record<string, any>, dark = false) {
  let accent = "#0064D8";
  for (const label of clubShirtColors(club)) {
    const value = label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const named = value
      .split(/[^a-z]+/)
      .map((word) => namedColors[word])
      .find(Boolean);
    const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
    const rgb = hex
      ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      : [];
    if (named || (hex && Math.max(...rgb) - Math.min(...rgb) > 24)) {
      accent = named || hex!;
      break;
    }
  }
  // White labels remain readable even for bright imported club colors.
  while (clubContrast(accent, "#FFFFFF") < 4.5)
    accent = mixClubColor(accent, "#000000", 0.1);
  const soft = mixClubColor(
    accent,
    dark ? "#111D2A" : "#FFFFFF",
    dark ? 0.82 : 0.94,
  );
  const colors = dark ? darkColors : lightColors;
  const surfaces = [
    colors.surface,
    colors.surfaceRaised,
    colors.background,
    soft,
  ];
  let link = dark ? mixClubColor(accent, "#FFFFFF", 0.6) : accent;
  while (surfaces.some((surface) => clubContrast(link, surface) < 4.5))
    link = mixClubColor(link, dark ? "#FFFFFF" : "#000000", 0.05);
  return {
    accent,
    link,
    soft,
    hero: mixClubColor(accent, "#08121E", 0.75),
    heroEnd: "#08121E",
  };
}

/** Club text tokens follow the appearance; action fills keep the separate accent. */
export function clubThemePalette(
  colors: ThemeColors,
  brand: ReturnType<typeof resolveClubBrand>,
): ThemeColors {
  return {
    ...colors,
    blue: brand.link,
    deepBlue: brand.link,
    lightBlue: brand.link,
    violet: brand.link,
    accentSoft: brand.soft,
  };
}
