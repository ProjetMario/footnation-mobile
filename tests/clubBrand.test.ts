import { describe, expect, it } from "vitest";
import {
  clubContrast,
  clubThemePalette,
  resolveClubBrand,
} from "../src/lib/clubBrand";
import { darkColors, lightColors } from "../src/theme/palette";
import {
  clubShirtColors,
  findClubEnrichment,
  parseFacilities,
} from "../src/lib/clubPublicInformation";

describe("club visual identity", () => {
  it("uses Drumettaz's public identity without losing its installations", () => {
    const club = { external_id: "526437", name: "Ent S Drumettaz Mouxy" };
    expect(clubShirtColors(club)).toEqual(["Blanc", "Rouge", "Bleu"]);
    expect(resolveClubBrand(club).accent).toBe(
      resolveClubBrand({ colors: ["rouge"] }).accent,
    );
    const facilities = parseFacilities(
      findClubEnrichment(club)?.data?.facilities,
    );
    expect(facilities.map((row) => row.name)).toEqual([
      "Siège social",
      "STADE DES FINS 1",
      "STADE DES FINS 2",
    ]);
    expect(facilities[2].additional_info).toBe("TERRAIN ANNEXE");
  });

  it("ignores neutral/unknown colors and falls back to FootNation blue", () => {
    expect(
      resolveClubBrand({ colors: ["blanc", "noir", "#cccccc", "inconnu"] })
        .accent,
    ).toBe("#0064D8");
    expect(resolveClubBrand({}).accent).toBe("#0064D8");
    expect(resolveClubBrand({ colors: ["blanc", "vert"] }).accent).not.toBe(
      "#0064D8",
    );
    expect(
      findClubEnrichment({ name: "Un club sans informations" }),
    ).toBeNull();
  });

  it.each([
    "rouge",
    "bleu",
    "vert",
    "jaune",
    "orange",
    "violet",
    "rose",
    "bordeaux",
    "turquoise",
    "menthe",
    "#ffff00",
    "#00ffff",
  ])("keeps %s readable in both themes", (color) => {
    const light = resolveClubBrand({ colors: [color] });
    const dark = resolveClubBrand({ colors: [color] }, true);
    expect(clubContrast(light.accent, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(clubContrast(light.link, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(clubContrast(dark.link, "#081826")).toBeGreaterThanOrEqual(4.5);
    expect(light.accent).toBe(dark.accent);
    for (const [base, brand] of [
      [lightColors, light],
      [darkColors, dark],
    ] as const) {
      const palette = clubThemePalette(base, brand);
      for (const background of [
        palette.surface,
        palette.surfaceRaised,
        palette.background,
        palette.accentSoft,
      ]) {
        expect(
          clubContrast(palette.deepBlue, background),
        ).toBeGreaterThanOrEqual(4.5);
        expect(clubContrast(palette.blue, background)).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    }
  });

  it("keeps club overrides local while preserving action fills and normal text", () => {
    const original = { ...darkColors };
    const brand = resolveClubBrand({ colors: ["rouge"] }, true);
    const palette = clubThemePalette(darkColors, brand);
    expect(darkColors).toEqual(original);
    expect(palette.ink).toBe(darkColors.ink);
    expect(palette.muted).toBe(darkColors.muted);
    expect(palette.deepBlue).not.toBe(brand.accent);
    expect(clubContrast(brand.accent, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
});
