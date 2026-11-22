/** A feed may prepare one successor only after the visible video has started. */
export function nextPreloadVideo(
  keys: readonly string[],
  active: string | null,
  playing: string | null,
  conserveData: boolean,
): string | null {
  if (conserveData || !active || active !== playing) return null;
  const index = keys.indexOf(active);
  return index >= 0 ? (keys[index + 1] ?? null) : null;
}

/** Retain decoded buffers through FlatList's brief empty viewability intervals. */
export function preparedVideoWindow(
  keys: readonly string[],
  active: string | null,
  playing: string | null,
  conserveData: boolean,
  previous: readonly string[],
): string[] {
  if (!active) return conserveData ? [] : previous.filter(key => keys.includes(key)).slice(0, 2);
  if (!keys.includes(active)) return [];
  const next = nextPreloadVideo(keys, active, playing, conserveData);
  // A brief pause of an already prepared window must not reload its successor.
  // Only actual playback can initially add a new successor to this window.
  const retained = !conserveData && previous[0] === active &&
    previous[1] === keys[keys.indexOf(active) + 1] ? previous[1] : null;
  const successor = next || retained;
  return successor ? [active, successor] : [active];
}

export type MediaNetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

export function conserveVideoData(network?: MediaNetworkInformation): boolean {
  return (
    !!network?.saveData ||
    network?.effectiveType === "slow-2g" ||
    network?.effectiveType === "2g"
  );
}

export function browserMediaNetwork(): MediaNetworkInformation | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: MediaNetworkInformation })
    .connection;
}
