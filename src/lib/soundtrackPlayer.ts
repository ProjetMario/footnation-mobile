export interface SoundtrackPlayer {
  muted: boolean;
  loop: boolean;
  volume: number;
  playbackRate: number;
  readonly currentTime: number;
  readonly duration: number;
  readonly playing: boolean;
  readonly isLoaded: boolean;
  play(): Promise<void>;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
}
export type SoundtrackStatus = {
  isLoaded: boolean;
  playing: boolean;
  blocked: boolean;
  failed: boolean;
};
export const initialSoundtrackStatus: SoundtrackStatus = {
  isLoaded: false,
  playing: false,
  blocked: false,
  failed: false,
};

/** Unlike Expo Web play(), retain the browser promise and its actual outcome. */
export function createWebSoundtrackPlayer(
  audio: HTMLAudioElement,
  notify: (state: SoundtrackStatus) => void,
) {
  let disposed = false;
  let generation = 0;
  let status = { ...initialSoundtrackStatus };
  const update = (next: Partial<SoundtrackStatus>) => {
    if (!disposed) {
      status = { ...status, ...next };
      notify(status);
    }
  };
  const loaded = () => update({ isLoaded: true, failed: false });
  const playing = () =>
    update({ playing: true, blocked: false, failed: false });
  const paused = () => update({ playing: false });
  const failed = () => update({ playing: false, failed: true });
  audio.addEventListener("loadedmetadata", loaded);
  audio.addEventListener("playing", playing);
  audio.addEventListener("pause", paused);
  audio.addEventListener("error", failed);
  const player: SoundtrackPlayer = {
    get muted() {
      return audio.muted;
    },
    set muted(v) {
      audio.muted = v;
    },
    get loop() {
      return audio.loop;
    },
    set loop(v) {
      audio.loop = v;
    },
    get volume() {
      return audio.volume;
    },
    set volume(v) {
      audio.volume = v;
    },
    get playbackRate() {
      return audio.playbackRate;
    },
    set playbackRate(v) {
      audio.playbackRate = v;
    },
    get currentTime() {
      return audio.currentTime;
    },
    get duration() {
      return Number.isFinite(audio.duration) ? audio.duration : 0;
    },
    get playing() {
      return !audio.paused && !audio.ended;
    },
    get isLoaded() {
      return audio.readyState >= 1;
    },
    async play() {
      if (disposed) return;
      const request = generation;
      try {
        // Called synchronously before the first await, including from a tap.
        if (audio.error) audio.load();
        await audio.play();
        if (disposed || request !== generation) {
          audio.pause();
          return;
        }
        playing();
      } catch (error) {
        if (disposed || request !== generation) return;
        const name = (error as { name?: string })?.name;
        if (name === "AbortError") return;
        update({
          playing: false,
          blocked: name === "NotAllowedError",
          failed: name !== "NotAllowedError",
        });
      }
    },
    pause() {
      generation++;
      audio.pause();
    },
    async seekTo(seconds) {
      if (!disposed) audio.currentTime = seconds;
    },
  };
  return {
    player,
    dispose() {
      disposed = true;
      generation++;
      audio.pause();
      audio.removeEventListener("loadedmetadata", loaded);
      audio.removeEventListener("playing", playing);
      audio.removeEventListener("pause", paused);
      audio.removeEventListener("error", failed);
      audio.removeAttribute("src");
      audio.load();
      audio.remove();
    },
  };
}
