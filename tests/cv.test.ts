import { describe, it, expect } from "vitest";
import {
  cvHtml,
  cvSections,
  escapeHtml,
  formatAchievement,
} from "../src/lib/cv";
describe("CV content preservation and safe printing", () => {
  it("escapes user text instead of interpreting it as markup", () => {
    const html = cvHtml({
      full_name: '<script>alert("x")</script>',
      bio: "A & B <img src=x onerror=alert(1)>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
    expect(escapeHtml(`"'`)).toBe("&quot;&#39;");
  });
  it("retains all experiences and qualifications without truncation", () => {
    const history = Array.from({ length: 45 }, (_, i) => ({
      club: `Club ${i}`,
      position: "Gardien",
      startYear: "2000",
      endYear: "2001",
      ageCategory: "Séniors",
      level: "National",
    }));
    const profile = {
      experience_history: history,
      achievements: [{ title: "Champion", club: "Club A", year: 2025 }],
      certifications: { diploma: "BEF" },
      technical_skills: "Relance",
      characteristics: "Réactivité",
      secondary_roles: ["Entraîneur"],
    };
    const sections = cvSections(profile);
    expect(sections.find((s) => s.title === "Parcours")?.lines).toHaveLength(
      45,
    );
    const html = cvHtml(profile);
    expect(html).toContain("CV synthétique");
    for (const value of [
      "Champion",
      "BEF",
      "Relance",
      "Réactivité",
      "Entraîneur",
    ])
      expect(html).toContain(value);
  });
  it("retains academic and football training in the exported CV", () => {
    const html = cvHtml({
      education: [{ title: "Licence STAPS", year: "2024" }],
      training_history: [
        {
          title: "Centre de formation",
          year: "2020 - 2022",
          ageCategory: "U17",
          club: "National",
        },
      ],
    });
    for (const text of [
      "Licence STAPS",
      "2024",
      "Centre de formation",
      "2020 - 2022",
      "U17",
      "National",
    ])
      expect(html).toContain(text);
  });
  it("supports the existing structured and serialized distinctions", () => {
    expect(
      formatAchievement('{"title":"Champion","club":"ESTAC","year":2025}'),
    ).toBe("Champion — ESTAC 2025");
    expect(formatAchievement("Ancien capitaine")).toBe("Ancien capitaine");
    expect(formatAchievement("{malformed")).toBe("{malformed");
  });
  it("omits empty sections and falls back to the current club", () => {
    expect(cvSections({})).toEqual([]);
    expect(
      cvSections({ club: "ESTAC", position: "Gardien" }).find(
        (s) => s.title === "Parcours",
      )?.lines,
    ).toEqual(["Gardien · ESTAC"]);
  });
  it("allows an HTTPS photo but rejects active URI schemes", () => {
    expect(cvHtml({ avatar_url: "javascript:alert(1)" })).not.toContain("javascript:");
    expect(
      cvHtml({ avatar_url: 'https://example.com/avatar.png?x=" onerror="bad' }),
    ).toContain("&quot; onerror=&quot;bad");
    expect(cvHtml({ avatar_url: "https://example.com/avatar.png" })).toContain(
      'href="https://example.com/avatar.png"',
    );
  });
});

import {
  cvCharacteristics,
  cvFileName,
  cvIdentity,
  cvWordHtml,
} from "../src/lib/cv";
import { renderCVPdf } from "../src/lib/cvPdf";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const font = (name: string) =>
  readFileSync(
    new URL(`../assets/fonts/Inter-${name}.ttf`, import.meta.url),
  ).toString("base64");
const assets = { regular: font("Regular"), bold: font("Bold") };
describe("web CV parity", () => {
  it("keeps units, country labels, selected skills and individual awards readable", () => {
    const profile = {
      full_name: "Élodie Zélénić",
      height: "178 cm",
      nationality: "FR",
      skills: ["Relance", "Vision du jeu"],
      individual_awards: [{ title: "Meilleure joueuse", year: 2025 }],
    };
    expect(cvCharacteristics(profile)).toEqual([
      { label: "Taille", value: "178 cm" },
      { label: "Nationalité", value: "France" },
    ]);
    const html = cvHtml(profile);
    expect(html).toContain("Vision du jeu");
    expect(html).toContain("Meilleure joueuse");
    expect(html).not.toContain("cm cm");
  });
  it("normalizes the legacy career fields also used in the profile", () => {
    const sections = cvSections({
      experience: [
        {
          club_name: "Club Démo",
          role: "Gardien",
          start_year: 2021,
          end_year: 2023,
          age_category: "U19",
          competition: "Régional 1",
        },
      ],
    });
    expect(sections.find((s) => s.title === "Parcours")?.lines).toEqual([
      "Gardien · Club Démo · 2021 – 2023 · U19 · Régional 1",
    ]);
  });
  it("uses safe filenames and a Word-compatible escaped document", () => {
    const profile = {
      full_name: "../Élodie <script>",
      bio: "<img src=x onerror=alert(1)>",
    };
    expect(cvFileName(profile, "doc")).not.toMatch(/[<>/\\]/);
    expect(cvWordHtml(profile)).toContain(
      'xmlns:w="urn:schemas-microsoft-com:office:word"',
    );
    expect(cvWordHtml(profile)).not.toContain("<img src=x");
    expect(cvIdentity({ birthdate: "bad" }).age).toBeNull();
  });
  it("exports one A4 page while retaining the complete underlying career", () => {
    const profile = {
      id: "00000000-0000-4000-8000-000000000001",
      full_name: "Élodie Zélénić",
      position: "Milieu central",
      club: "Club Démo",
      city: "Lyon",
      department: "69 - Rhône",
      bio: "Joueuse passionnée, vision du jeu et esprit d’équipe.",
      height: 178,
      nationality: "FR",
      skills: ["Relance", "Passe longue"],
      experience_history: Array.from({ length: 40 }, (_, i) => ({
        club: `Club de démonstration ${i + 1}`,
        position: "Milieu central",
        startYear: "2018",
        endYear: "2020",
        ageCategory: "Séniors",
        level: "Régional 1",
      })),
      education: [{ title: "Licence STAPS", year: 2024 }],
      achievements: [{ title: "Championne régionale", year: 2025 }],
    };
    const pdf = renderCVPdf(profile, assets);
    expect(pdf.getNumberOfPages()).toBe(1);
    expect(
      cvSections(profile)
        .find((s) => s.title === "Parcours")
        ?.lines.at(-1),
    ).toContain("Club de démonstration 40");
    expect(pdf.output("arraybuffer").byteLength).toBeGreaterThan(10000);
    if (process.env.CV_PDF_QA_DIR) {
      mkdirSync(process.env.CV_PDF_QA_DIR, { recursive: true });
      writeFileSync(
        join(process.env.CV_PDF_QA_DIR, "cv-long.pdf"),
        Buffer.from(pdf.output("arraybuffer")),
      );
    }
  });
});
