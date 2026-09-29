import { useSyncExternalStore } from "react";

type ScrollChromeState = {
  compact: boolean;
};

let state: ScrollChromeState = { compact: false };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setScrollChromeCompact(compact: boolean) {
  if (state.compact === compact) return;
  state = { compact };
  emit();
}

export function useScrollChrome() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}
