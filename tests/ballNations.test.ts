import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BALL_NATIONS,
  BALL_STRIPS,
  BALL_TEXTURE_STRIPS,
  ballNationIndex,
  ballTextureOffset,
  BALL_GLOBE_TURNS,
  ballStageIndex,
  ballResumeTurn,
} from "../src/lib/ballNations";

describe("Home football country sequence", () => {
  it("starts with exactly three Earth revolutions, then France and the original flag order", () => {
    expect(BALL_GLOBE_TURNS).toBe(3);
    for (const turn of [0, 0.5, 1, 1.99, 2, 2.99999])
      expect(ballStageIndex(turn)).toBe(-1);
    for (let cycle = 0; cycle < 3; cycle++) {
      BALL_NATIONS.forEach((_, index) => {
        for (const phase of [0, 0.5, 0.99999])
          expect(ballStageIndex(3 + cycle * 19 + index + phase)).toBe(index);
      });
    }
  });

  it("resumes the globe without resetting its three turns and never replays the intro during flag loops", () => {
    for (const turn of [0.27, 1.45, 2.99, 3, 6.79, 21.99])
      expect(ballResumeTurn(turn)).toBeCloseTo(turn);
    expect(ballResumeTurn(22)).toBe(3);
    expect(ballStageIndex(ballResumeTurn(22))).toBe(0);
    expect(ballResumeTurn(41.3)).toBeCloseTo(3.3);
  });
  it("shows each requested flag for one entire turn, then loops to France", () => {
    expect(BALL_NATIONS).toEqual([
      "fr",
      "ba",
      "dz",
      "eu",
      "us",
      "cn",
      "au",
      "br",
      "ar",
      "gb",
      "jp",
      "de",
      "tr",
      "pt",
      "ma",
      "qa",
      "it",
      "sa",
      "hr",
    ]);
    for (let cycle = 0; cycle < 3; cycle++) {
      BALL_NATIONS.forEach((_, index) => {
        for (const phase of [0, 0.25, 0.75, 0.99999])
          expect(ballNationIndex(cycle * 19 + index + phase)).toBe(index);
      });
    }
    expect(ballNationIndex(19)).toBe(0);
  });

  it("bundles the 19 distinct, valid PNGs in exactly the rendering order", () => {
    const assets = readFileSync(
      new URL("../src/components/ballFlagAssets.ts", import.meta.url),
      "utf8",
    );
    expect(
      [...assets.matchAll(/flags\/([a-z]+)\.png/g)].map((match) => match[1]),
    ).toEqual(BALL_NATIONS);
    const flags = BALL_NATIONS.map((code) =>
      readFileSync(
        new URL(`../assets/brand/flags/${code}.png`, import.meta.url),
      ),
    );
    for (const flag of flags)
      expect(flag.subarray(1, 4).toString()).toBe("PNG");
    expect(new Set(flags.map((flag) => flag.toString("base64"))).size).toBe(19);
  });

  it("covers the complete silhouette without gaps and narrows at the horizon", () => {
    expect(BALL_STRIPS[0].x).toBeCloseTo(4);
    const last = BALL_STRIPS.at(-1)!;
    expect(last.x + last.width).toBeCloseTo(96);
    BALL_STRIPS.forEach((strip, index) => {
      expect(strip.width).toBeGreaterThan(0);
      if (index)
        expect(strip.x).toBeCloseTo(
          BALL_STRIPS[index - 1].x + BALL_STRIPS[index - 1].width,
        );
    });
    expect(BALL_STRIPS[0].width).toBeLessThan(
      BALL_STRIPS[BALL_TEXTURE_STRIPS / 2].width,
    );
  });

  it("preserves the exact texture position on pause/resume and on a full turn", () => {
    for (const strip of BALL_STRIPS) {
      for (const turn of [0, 0.123, 3.89, 18.99]) {
        const offset = ballTextureOffset(turn, strip.longitude);
        expect(offset).toBeGreaterThanOrEqual(0);
        expect(offset).toBeLessThan(1);
        expect(ballTextureOffset(turn + 1, strip.longitude)).toBeCloseTo(
          offset,
          10,
        );
      }
    }
  });
});
