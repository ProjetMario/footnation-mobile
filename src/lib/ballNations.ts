// One country for each complete turn, in the requested order. UK uses Union Jack.
export const BALL_NATIONS = [
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
] as const;

export const BALL_GLOBE_TURNS = 3;

export function ballNationIndex(turn: number) {
  "worklet";
  return (
    ((Math.floor(turn) % BALL_NATIONS.length) + BALL_NATIONS.length) %
    BALL_NATIONS.length
  );
}

/** The globe is an introduction, not an extra country in the repeating cycle. */
export function ballStageIndex(turn: number) {
  "worklet";
  return turn < BALL_GLOBE_TURNS
    ? -1
    : ballNationIndex(turn - BALL_GLOBE_TURNS);
}

export function ballResumeTurn(turn: number) {
  "worklet";
  if (turn < BALL_GLOBE_TURNS) return Math.max(0, turn);
  return BALL_GLOBE_TURNS + ((turn - BALL_GLOBE_TURNS) % BALL_NATIONS.length);
}

export const BALL_ROTATION_DURATION = 14_000;
export const BALL_TEXTURE_STRIPS = 32;

// Equal longitude strips narrow towards the silhouette, wrapping the image
// around a sphere instead of spinning a flat flag. The flag repeats on the back.
export const BALL_STRIPS = Array.from(
  { length: BALL_TEXTURE_STRIPS },
  (_, index) => {
    const left = -Math.PI / 2 + (index * Math.PI) / BALL_TEXTURE_STRIPS;
    const right = left + Math.PI / BALL_TEXTURE_STRIPS;
    const x = 50 + 46 * Math.sin(left);
    return {
      x,
      width: 50 + 46 * Math.sin(right) - x,
      longitude: index / BALL_TEXTURE_STRIPS,
    };
  },
);

export function ballTextureOffset(turn: number, longitude: number) {
  "worklet";
  return (((longitude - 2 * turn) % 1) + 1) % 1;
}
