import { describe, expect, it } from "vitest";
import {
  darkColors,
  lightColors,
  parseThemePreference,
  resolveThemeMode,
} from "../src/theme/palette";
function luminance(hex: string) {
  const channels = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
}
describe("appearance preferences", () => {
  it("follows system changes only when automatic is selected", () => {
    expect(resolveThemeMode("system", "dark")).toBe("dark");
    expect(resolveThemeMode("system", "light")).toBe("light");
    expect(resolveThemeMode("light", "dark")).toBe("light");
    expect(resolveThemeMode("dark", "light")).toBe("dark");
  });
  it("uses a readable light fallback for unavailable system appearance", () => {
    expect(resolveThemeMode("system", null)).toBe("light");
    expect(resolveThemeMode("system", undefined)).toBe("light");
  });
  it("recovers from invalid local preferences without corrupting the theme", () => {
    for (const value of [null, undefined, "", {}, "neon", '"dark"'])
      expect(parseThemePreference(value)).toBe("system");
    for (const value of ["light", "dark", "system"])
      expect(parseThemePreference(value)).toBe(value);
  });
});
describe.each([
  ["light", lightColors],
  ["dark", darkColors],
] as const)("%s palette accessibility", (_name, colors) => {
  it("keeps body text, metadata and links readable on all normal surfaces", () => {
    for (const foreground of [colors.ink, colors.muted, colors.deepBlue])
      for (const background of [
        colors.background,
        colors.surface,
        colors.surfaceRaised,
      ])
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
  it("keeps readable foregrounds for primary actions", () => {
    expect(contrast(colors.white, "#0064D8")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.ink, colors.accentSoft)).toBeGreaterThanOrEqual(4.5);
  });
});
