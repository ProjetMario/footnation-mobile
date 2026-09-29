import { useCallback, useRef, useState } from "react";
import type { ViewabilityConfig } from "react-native";
import { visibleMediaId } from "./mediaFeed";

export function useVisibleFeedMedia<
  T extends { id: string; video_url?: string | null },
>(
  scope: string,
  configuration?: ViewabilityConfig,
  includeSoundtracks = false,
) {
  const [selection, setSelection] = useState<{
    scope: string;
    id: string | null;
  }>({ scope, id: null });
  const viewabilityConfig = useRef(
    configuration ?? {
      viewAreaCoveragePercentThreshold: 35,
      minimumViewTime: 180,
    },
  ).current;
  const onViewableItemsChanged = useCallback(
    ({
      viewableItems,
    }: {
      viewableItems: { item: T; isViewable?: boolean }[];
    }) => {
      setSelection((previous) => {
        const id = visibleMediaId(
          viewableItems,
          previous.scope === scope ? previous.id : null,
          includeSoundtracks,
        );
        return previous.scope === scope && previous.id === id
          ? previous
          : { scope, id };
      });
    },
    [scope, includeSoundtracks],
  );
  return {
    visibleVideo: selection.scope === scope ? selection.id : null,
    viewabilityConfig,
    onViewableItemsChanged,
  };
}
