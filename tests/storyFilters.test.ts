import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORY_FILTERS,
  normalizeStoryFilters,
  STORY_FILTER_PRESETS,
  storyFilterMatrices,
  storyFilterKeyboardValue,
} from "../src/lib/storyFilters";
const apply = (matrix: number[], pixel: number[]) =>
  [0, 1, 2, 3].map((row) =>
    Math.max(
      0,
      Math.min(
        1,
        matrix
          .slice(row * 5, row * 5 + 4)
          .reduce((sum, v, col) => sum + v * pixel[col], matrix[row * 5 + 4]),
      ),
    ),
  );
describe("Story filter rendering contract", () => {
  it("lets the keyboard adjust the full range without escaping its bounds", () => {
    expect(storyFilterKeyboardValue(100, "ArrowRight")).toBe(101);
    expect(storyFilterKeyboardValue(0, "ArrowLeft")).toBe(0);
    expect(storyFilterKeyboardValue(200, "PageUp")).toBe(200);
    expect(storyFilterKeyboardValue(100, "Home")).toBe(0);
    expect(storyFilterKeyboardValue(100, "End")).toBe(200);
    expect(storyFilterKeyboardValue(100, "Tab")).toBeNull();
  });
  it("keeps old stories without filters unchanged", () => {
    expect(normalizeStoryFilters(null)).toEqual(DEFAULT_STORY_FILTERS);
    expect(normalizeStoryFilters([])).toEqual(DEFAULT_STORY_FILTERS);
    const matrix = storyFilterMatrices(undefined);
    expect(apply(matrix.brightness, [0.2, 0.5, 0.8, 1])).toEqual([
      0.2, 0.5, 0.8, 1,
    ]);
    expect(apply(matrix.contrast, [0.2, 0.5, 0.8, 1])).toEqual([
      0.2, 0.5, 0.8, 1,
    ]);
    expect(matrix.saturation).toBe(1);
  });
  it("bounds corrupt or malicious JSON while preserving valid zero", () => {
    expect(
      normalizeStoryFilters({
        brightness: -1,
        contrast: Infinity,
        saturation: 0,
      }),
    ).toEqual({ brightness: 0, contrast: 100, saturation: 0 });
    expect(
      normalizeStoryFilters({
        brightness: 2000,
        contrast: "0",
        saturation: 125.6,
      }),
    ).toEqual({ brightness: 200, contrast: 100, saturation: 126 });
  });
  it("keeps transparency independent of brightness and contrast", () => {
    const m = storyFilterMatrices({
      brightness: 0,
      contrast: 0,
      saturation: 200,
    });
    expect(apply(m.brightness, [0.4, 0.5, 0.6, 0.25])).toEqual([0, 0, 0, 0.25]);
    expect(apply(m.contrast, [0.4, 0.5, 0.6, 0.25])).toEqual([
      0.5, 0.5, 0.5, 0.25,
    ]);
  });
  it("applies contrast around the middle gray and clamps each operation", () => {
    const m = storyFilterMatrices({
      brightness: 200,
      contrast: 150,
      saturation: 100,
    });
    expect(apply(m.contrast, apply(m.brightness, [0.5, 0.25, 0, 1]))).toEqual([
      1, 0.5, 0, 1,
    ]);
  });
  it("preserves the four existing site presets", () => {
    expect(STORY_FILTER_PRESETS.map((x) => x.value)).toEqual([
      { brightness: 100, contrast: 100, saturation: 100 },
      { brightness: 90, contrast: 120, saturation: 85 },
      { brightness: 100, contrast: 150, saturation: 0 },
      { brightness: 110, contrast: 110, saturation: 130 },
    ]);
  });
});
