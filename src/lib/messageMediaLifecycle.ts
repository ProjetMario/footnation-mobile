/** A cancelled preparation may finish later; it must never start the microphone. */
export async function prepareVoiceRecording(ports: {
  current(): boolean;
  permission(): Promise<boolean>;
  mode(enabled: boolean): Promise<void>;
  prepare(): Promise<void>;
  record(): void;
  stop(): Promise<void>;
  discard(): void;
}) {
  let started = false;
  let prepared = false;
  let modeChanged = false;
  try {
    if (!(await ports.permission()))
      throw new Error(
        "Autorisez le microphone pour enregistrer un message vocal.",
      );
    if (!ports.current()) return false;
    modeChanged = true;
    await ports.mode(true);
    if (!ports.current()) return false;
    prepared = true;
    await ports.prepare();
    if (!ports.current()) return false;
    ports.record();
    started = true;
    return true;
  } finally {
    if (!started) {
      if (prepared) await ports.stop().catch(() => {});
      if (modeChanged) await ports.mode(false).catch(() => {});
      ports.discard();
    }
  }
}

/** Shared only by attachment viewers: newer intent cancels older pending playback. */
export function createMessagePlaybackArbiter() {
  let latest = 0;
  const listeners = new Set<() => void>();
  return {
    subscribe(stop: () => void) {
      listeners.add(stop);
      return () => {
        listeners.delete(stop);
      };
    },
    take() {
      latest += 1;
      listeners.forEach((stop) => stop());
      return latest;
    },
    current(intent: number) {
      return latest === intent;
    },
  };
}
