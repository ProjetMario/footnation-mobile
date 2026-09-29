import React, { memo, useEffect, useId, useRef, useState } from "react";
import { AccessibilityInfo, AppState, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Image as SvgImage,
  Path,
} from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const BALL = require("../../assets/brand/app-icon.png");
const HEART =
  "M50 89C44 84 9 62 9 35C9 11 38 7 50 27C62 7 91 11 91 35C91 62 56 84 50 89Z";
const DURATION = 1850;
// Three staggered waves give a dense burst without mounting thousands of views.
const PARTICLES = Array.from({ length: 84 }, (_, i) => ({
  angle: i * 2.399963,
  distance: 0.45 + ((i * 37) % 53) / 100,
  size: i % 7 === 0 ? 5 : 17 + ((i * 11) % 19),
  delay: Math.floor(i / 28) * 150 + ((i * 17) % 90),
  duration: 1080 + ((i * 19) % 310),
  turn: ((i * 53) % 160) - 80,
  ball: i % 4 === 0,
  spark: i % 7 === 0,
  color: ["#FF477E", "#FFFFFF", "#63C6FF", "#FFD568"][i % 4],
}));

const HeartBall = memo(function HeartBall({
  size,
  round = false,
}: {
  size: number;
  round?: boolean;
}) {
  const id = `like-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id={id}>
          {round ? <Circle cx={50} cy={50} r={44} /> : <Path d={HEART} />}
        </ClipPath>
      </Defs>
      {round ? (
        <Circle cx={50} cy={50} r={44} fill="#FFFFFF" />
      ) : (
        <Path d={HEART} fill="#FF477E" />
      )}
      <SvgImage
        href={BALL}
        x={-3}
        y={-1}
        width={106}
        height={103}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${id})`}
      />
      {round ? (
        <Circle
          cx={50}
          cy={50}
          r={44}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={3}
        />
      ) : (
        <Path d={HEART} fill="none" stroke="#FFFFFF" strokeWidth={4} />
      )}
    </Svg>
  );
});

function Particle({
  spec,
  progress,
  width,
  height,
}: {
  spec: (typeof PARTICLES)[number];
  progress: SharedValue<number>;
  width: number;
  height: number;
}) {
  const animated = useAnimatedStyle(() => {
    const p = Math.min(
      1,
      Math.max(0, (progress.value * DURATION - spec.delay) / spec.duration),
    );
    const spread = 1 - (1 - p) ** 3;
    return {
      opacity: p <= 0 ? 0 : Math.min(1, p * 12) * Math.max(0, (1 - p) * 3),
      transform: [
        {
          translateX:
            Math.cos(spec.angle) * width * 0.52 * spec.distance * spread,
        },
        {
          translateY:
            Math.sin(spec.angle) *
              Math.min(height * 0.34, 230) *
              spec.distance *
              spread -
            p * 105,
        },
        { rotate: `${spec.turn * spread}deg` },
        { scale: 0.45 + Math.sin(p * Math.PI) * 0.8 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.particle,
        { left: width / 2 - spec.size / 2, top: height * 0.44 - spec.size / 2 },
        animated,
      ]}
    >
      {spec.spark ? (
        <View
          style={{
            width: spec.size,
            height: spec.size,
            borderRadius: 3,
            backgroundColor: spec.color,
          }}
        />
      ) : (
        <HeartBall size={spec.size} round={spec.ball} />
      )}
    </Animated.View>
  );
}

function CenterHeart({
  progress,
  reduced,
}: {
  progress: SharedValue<number>;
  reduced: boolean;
}) {
  const animated = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1, transform: [{ scale: 0.6 }] };
    const p = progress.value;
    const scale =
      p < 0.13
        ? 0.25 + (p / 0.13) * 0.95
        : p < 0.23
          ? 1.2 - ((p - 0.13) / 0.1) * 0.2
          : 1;
    return {
      opacity:
        Math.min(1, p * 20) * Math.max(0, 1 - Math.max(0, p - 0.52) / 0.22),
      transform: [
        { scale },
        { rotate: `${Math.sin(p * Math.PI * 2) * -8}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.hero, animated]}>
      <HeartBall size={110} />
    </Animated.View>
  );
}

/** Decorative only: never intercepts touches, changes a reaction or starts media. */
export function LikeBurst({
  sequence,
  active = true,
}: {
  sequence: number;
  active?: boolean;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [visible, setVisible] = useState(false);
  const lastSequence = useRef(sequence);
  const progress = useSharedValue(0);
  useEffect(() => {
    let mounted = true;
    let preferenceChanged = false;
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        preferenceChanged = true;
        setReduced(value);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted && !preferenceChanged) setReduced(value);
      })
      .catch(() => {
        if (mounted) setReduced(true);
      });
    const app = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        cancelAnimation(progress);
        setVisible(false);
      }
    });
    return () => {
      mounted = false;
      listener.remove();
      app.remove();
    };
  }, [progress]);
  useEffect(() => {
    if (reduced === null) return;
    if (!active || sequence <= 0 || lastSequence.current === sequence) {
      if (!active) lastSequence.current = sequence;
      setVisible(false);
      return;
    }
    lastSequence.current = sequence;
    setVisible(true);
    progress.value = 0;
    if (!reduced)
      progress.value = withTiming(1, {
        duration: DURATION,
        easing: Easing.linear,
      });
    const timeout = setTimeout(
      () => setVisible(false),
      reduced ? 550 : DURATION,
    );
    return () => {
      clearTimeout(timeout);
      cancelAnimation(progress);
    };
  }, [sequence, active, reduced, progress]);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((previous) =>
          previous.width === width && previous.height === height
            ? previous
            : { width, height },
        );
      }}
      style={styles.overlay}
    >
      {visible && size.width > 0 && (
        <>
          {!reduced &&
            PARTICLES.map((spec, i) => (
              <Particle
                key={i}
                spec={spec}
                progress={progress}
                width={size.width}
                height={size.height}
              />
            ))}
          <View
            style={[
              styles.center,
              { left: size.width / 2 - 55, top: size.height * 0.44 - 55 },
            ]}
          >
            <CenterHeart progress={progress} reduced={!!reduced} />
          </View>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 30, overflow: "hidden" },
  particle: { position: "absolute" },
  center: { position: "absolute", width: 110, height: 110 },
  hero: {
    shadowColor: "#FF477E",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
  },
});
