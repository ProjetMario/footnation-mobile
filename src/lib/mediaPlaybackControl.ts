/** Owns one player's requests; a pending Web play can be cancelled by pause. */
export function createMediaPlaybackControl(port: {
  play(): void | Promise<void>;
  pause(): void;
  playing(): boolean;
  onError(error: unknown): void;
}) {
  let pending = false;
  let generation = 0;
  return {
    play() {
      if (pending) return;
      const request = ++generation;
      try {
        if (port.playing()) return;
        pending = true;
        const result = port.play();
        if (!result) {
          pending = false;
          return;
        }
        void result
          .catch((error: unknown) => {
            // HTMLMediaElement rejects play when pause/unmount interrupts it.
            // Do not turn this normal cancellation into a broken-video screen.
            if (
              request === generation &&
              !(error instanceof Error && error.name === "AbortError")
            )
              port.onError(error);
          })
          .finally(() => {
            if (request === generation) pending = false;
          });
      } catch (error) {
        pending = false;
        port.onError(error);
      }
    },
    pause(options: { reportFailure?: boolean } = {}) {
      generation++;
      pending = false;
      try {
        port.pause();
      } catch (error) {
        if (options.reportFailure !== false) port.onError(error);
      }
    },
  };
}
