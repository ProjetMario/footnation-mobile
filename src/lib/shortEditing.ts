import { musicLibrary } from "../data/shortMusicLibrary";
export type ShortClip = { start: number; duration: number };
export type ShortPlayback = {
  seconds: number;
  duration: number;
  playing: boolean;
  ready: boolean;
  rate: number;
};
export function shortClip(
  startValue: string,
  endValue: string,
  mediaDuration: number,
): ShortClip | null {
  if (!Number.isFinite(mediaDuration) || mediaDuration <= 0) {
    if (!startValue.trim() || startValue === "0") {
      if (!endValue.trim()) return null;
    }
    throw new Error(
      "Attendez le chargement de la durée de la vidéo pour choisir un extrait.",
    );
  }
  const start = startValue.trim() ? Number(startValue.replace(",", ".")) : 0;
  const end = endValue.trim()
    ? Number(endValue.replace(",", "."))
    : mediaDuration;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start ||
    end > mediaDuration + 0.01 ||
    end - start < 0.1
  )
    throw new Error(
      "Choisissez un début et une fin dans la vidéo, avec un extrait d’au moins 0,1 seconde.",
    );
  if (start === 0 && Math.abs(end - mediaDuration) < 0.01) return null;
  return { start, duration: Math.min(end, mediaDuration) - start };
}
export function playbackClip(
  value: ShortClip | null | undefined,
  mediaDuration: number,
): { start: number; end: number } | null {
  if (
    !value ||
    !Number.isFinite(value.start) ||
    value.start < 0 ||
    !Number.isFinite(value.duration) ||
    value.duration <= 0 ||
    !Number.isFinite(mediaDuration) ||
    mediaDuration <= 0
  )
    return null;
  const start = Math.min(value.start, Math.max(0, mediaDuration - 0.1));
  const end = Math.min(mediaDuration, value.start + value.duration);
  return end > start ? { start, end } : null;
}
export function clipPosition(
  seconds: number,
  clip: { start: number; end: number } | null,
) {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  return clip && (safe < clip.start || safe >= clip.end) ? clip.start : safe;
}
export function shortGoals(
  input: readonly number[],
  clip: ShortClip | null,
  mediaDuration: number,
) {
  if (!Number.isFinite(mediaDuration) || mediaDuration <= 0) {
    if (!input.length) return [];
    throw new Error("Attendez le chargement de la vidéo pour placer les buts.");
  }
  const start = clip?.start ?? 0,
    end = clip ? clip.start + clip.duration : mediaDuration;
  if (
    input.length > 50 ||
    input.some((n) => !Number.isFinite(n) || n < start || n >= end || n > 86400)
  )
    throw new Error(
      "Les repères doivent se trouver dans l’extrait (50 maximum).",
    );
  return [...new Set(input)].sort((a, b) => a - b);
}
export function musicFields(id: string | null) {
  const track = id ? musicLibrary.find((value) => value.id === id) : null;
  if (id && !track) throw new Error("Choisissez une musique du catalogue.");
  return {
    music: track?.title ?? null,
    artist: track?.artist ?? null,
    music_url: track?.audioUrl ?? null,
  };
}
export function soundtrackPosition(
  videoSeconds: number,
  clipStart: number,
  audioDuration: number,
) {
  const elapsed = Math.max(
    0,
    (Number.isFinite(videoSeconds) ? videoSeconds : 0) -
      (Number.isFinite(clipStart) && clipStart >= 0 ? clipStart : 0),
  );
  return Number.isFinite(audioDuration) && audioDuration > 0
    ? elapsed % audioDuration
    : elapsed;
}
/** Serial seeks and generation checks prevent an old async seek from restarting audio. */
export function createShortAudioSync() {
  let generation = 0,
    running = false;
  let latest: { target: number; play: boolean } | null = null;
  return {
    stop(pause: () => void) {
      generation++;
      latest = null;
      pause();
    },
    async sync(
      value: { target: number; play: boolean },
      port: {
        time(): number;
        seek(n: number): Promise<void>;
        play(): void | Promise<void>;
        pause(): void;
      },
    ) {
      latest = value;
      if (!value.play) {
        generation++;
        port.pause();
      }
      if (running) return;
      running = true;
      try {
        while (latest) {
          const next = latest;
          latest = null;
          const epoch = generation;
          if (!next.play) port.pause();
          if (Math.abs(port.time() - next.target) > 0.4)
            await port.seek(next.target);
          if (epoch !== generation) continue;
          if (next.play && !latest) await port.play();
        }
      } finally {
        running = false;
      }
    },
  };
}
export function missingGoalColumn(error: unknown) {
  const row = error as { code?: string; message?: string } | null;
  return (
    !!row &&
    (row.code === "42703" || row.code === "PGRST204") &&
    /goal_timestamps/i.test(row.message || "")
  );
}
