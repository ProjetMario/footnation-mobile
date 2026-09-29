import { useSyncExternalStore } from "react";
let muted = true;
const listeners = new Set<() => void>();
const activators = new Set<() => void>();
export function registerSoundActivation(activate: () => void) {
  activators.add(activate);
  return () => {
    activators.delete(activate);
  };
}
export function setMediaMuted(value: boolean) {
  muted = value;
  // Begin play in the button gesture itself, before React effects/async work.
  if (!value) for (const activate of activators) activate();
  for (const notify of listeners) notify();
}
export function useMediaSound() {
  return [
    useSyncExternalStore(
      (notify) => {
        listeners.add(notify);
        return () => {
          listeners.delete(notify);
        };
      },
      () => muted,
      () => true,
    ),
    setMediaMuted,
  ] as const;
}
