export type StoryFilters = {
  brightness: number;
  contrast: number;
  saturation: number;
};
export const DEFAULT_STORY_FILTERS: StoryFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
};
export const STORY_FILTER_PRESETS = [
  { name: "Original", value: DEFAULT_STORY_FILTERS },
  { name: "Vintage", value: { brightness: 90, contrast: 120, saturation: 85 } },
  {
    name: "Noir et blanc",
    value: { brightness: 100, contrast: 150, saturation: 0 },
  },
  { name: "Vif", value: { brightness: 110, contrast: 110, saturation: 130 } },
];
export function normalizeStoryFilters(value: unknown): StoryFilters {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<StoryFilters>)
      : {};
  const valid = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n)
      ? Math.max(0, Math.min(200, Math.round(n)))
      : 100;
  return {
    brightness: valid(input.brightness),
    contrast: valid(input.contrast),
    saturation: valid(input.saturation),
  };
}
export function storyFilterKeyboardValue(
  value: number,
  key: string,
): number | null {
  const next =
    key === "Home"
      ? 0
      : key === "End"
        ? 200
        : key === "ArrowRight" || key === "ArrowUp"
          ? value + 1
          : key === "ArrowLeft" || key === "ArrowDown"
            ? value - 1
            : key === "PageUp"
              ? value + 10
              : key === "PageDown"
                ? value - 10
                : null;
  return next === null ? null : Math.min(200, Math.max(0, next));
}
export function storyFilterMatrices(value: unknown) {
  const filters = normalizeStoryFilters(value);
  const brightness = filters.brightness / 100,
    contrast = filters.contrast / 100,
    offset = (1 - contrast) / 2;
  // Each primitive clamps before the next, matching brightness → contrast → saturation.
  return {
    brightness: [
      brightness,
      0,
      0,
      0,
      0,
      0,
      brightness,
      0,
      0,
      0,
      0,
      0,
      brightness,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ],
    contrast: [
      contrast,
      0,
      0,
      0,
      offset,
      0,
      contrast,
      0,
      0,
      offset,
      0,
      0,
      contrast,
      0,
      offset,
      0,
      0,
      0,
      1,
      0,
    ],
    saturation: filters.saturation / 100,
  };
}
