import React, { useEffect, useId, useRef } from "react";
import { Image } from "expo-image";
import Svg, {
  Defs,
  Filter,
  FeColorMatrix,
  Image as SvgImage,
} from "react-native-svg";
import { View, type ImageStyle, type StyleProp } from "react-native";
import {
  normalizeStoryFilters,
  storyFilterMatrices,
} from "../lib/storyFilters";

export function FilteredStoryImage({
  uri,
  filters,
  style,
  fit = "contain",
  onLoad,
  onError,
}: {
  uri: string;
  filters?: unknown;
  style: StyleProp<ImageStyle>;
  fit?: "contain" | "cover";
  onLoad?(): void;
  onError?(): void;
}) {
  const normalized = normalizeStoryFilters(filters);
  const filterId = `story${useId().replace(/[^a-z0-9]/gi, "")}`;
  const hasFilter = Object.values(normalized).some((value) => value !== 100);
  const matrices = storyFilterMatrices(normalized);
  const loaded = useRef(false);
  const callback = useRef({ onLoad, onError });
  callback.current = { onLoad, onError };
  useEffect(() => {
    loaded.current = false;
    // SVG native images expose onLoad; use a bounded fallback when decoding fails.
    const timer = setTimeout(() => {
      if (!loaded.current) callback.current.onError?.();
    }, 20000);
    return () => clearTimeout(timer);
  }, [uri, hasFilter]);
  const complete = () => {
    loaded.current = true;
    callback.current.onLoad?.();
  };
  if (!hasFilter)
    return (
      <Image
        source={{ uri }}
        style={style}
        contentFit={fit}
        onLoad={complete}
        onError={() => callback.current.onError?.()}
      />
    );
  return (
    <View
      style={[style, { overflow: "hidden" }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Photo de la story avec ses réglages"
    >
      <Svg width="100%" height="100%" aria-hidden>
        <Defs>
          <Filter id={filterId}>
            <FeColorMatrix
              type="matrix"
              values={matrices.brightness}
              in="SourceGraphic"
              result="bright"
            />
            <FeColorMatrix
              type="matrix"
              values={matrices.contrast}
              in="bright"
              result="contrast"
            />
            <FeColorMatrix
              type="saturate"
              values={matrices.saturation}
              in="contrast"
            />
          </Filter>
        </Defs>
        <SvgImage
          href={{ uri }}
          width="100%"
          height="100%"
          preserveAspectRatio={
            fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"
          }
          filter={`url(#${filterId})`}
          onLoad={complete}
        />
      </Svg>
    </View>
  );
}
