export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";
export const lightColors = {
  blue: "#087CFF",
  deepBlue: "#0064D8",
  lightBlue: "#087CFF",
  magenta: "#FF4757",
  red: "#FF4757",
  violet: "#087CFF",
  neon: "#58A6FF",
  navy: "#101828",
  ink: "#101828",
  muted: "#667085",
  background: "#F7F9FC",
  surface: "#FFFFFF",
  surfaceRaised: "#F0F4F8",
  border: "#E5EAF0",
  accentSoft: "#EAF3FF",
  white: "#FFFFFF",
  danger: "#C52738",
  success: "#147D59",
};
export type ThemeColors = { [K in keyof typeof lightColors]: string };
export const darkColors: ThemeColors = {
  ...lightColors,
  deepBlue: "#58A6FF",
  navy: "#F7FAFF",
  ink: "#F7FAFF",
  muted: "#95A4B8",
  background: "#06111D",
  surface: "#081826",
  surfaceRaised: "#122235",
  border: "#1D2B3A",
  accentSoft: "#102F50",
  danger: "#FF7D88",
  success: "#22C77A",
};
// Non-React consumers have a predictable light fallback. UI uses useTheme.
// Never mutate these objects to switch themes: React subscribers own updates.
export const colors: ThemeColors = lightColors;
export const signature = ["#087CFF", "#087CFF"] as const;
export const themeStorageKey = "footnation:appearance:v1";
export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}
export function resolveThemeMode(
  preference: ThemePreference,
  system: string | null | undefined,
): ThemeMode {
  return preference === "system"
    ? system === "dark"
      ? "dark"
      : "light"
    : preference;
}
