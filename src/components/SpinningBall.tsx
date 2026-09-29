import React, { useEffect, useId, useState } from "react";
import { AccessibilityInfo, AppState, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Path,
  Image as SvgImage,
  Rect,
  RadialGradient,
  Stop,
} from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type DerivedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import {
  BALL_FRAME_COUNT,
  createBallGeometry,
  projectBallSeams,
} from "../lib/ballGeometry";
import {
  BALL_NATIONS,
  BALL_GLOBE_TURNS,
  BALL_ROTATION_DURATION,
  BALL_STRIPS,
  BALL_TEXTURE_STRIPS,
  ballStageIndex,
  ballResumeTurn,
  ballTextureOffset,
} from "../lib/ballNations";
import { BALL_FLAG_ASSETS } from "./ballFlagAssets";
import { EarthGlobe } from "./EarthGlobe";

const ballSeams = createBallGeometry().seams;
const initialSeams = projectBallSeams(0, ballSeams);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedImage = Animated.createAnimatedComponent(SvgImage);

function FlagStrip({
  turn,
  index,
  source,
  clipId,
}: {
  turn: DerivedValue<number>;
  index: number;
  source: number;
  clipId: string;
}) {
  const strip = BALL_STRIPS[index];
  const width = strip.width * BALL_TEXTURE_STRIPS;
  const first = useAnimatedProps(() => ({
    x: strip.x - ballTextureOffset(turn.value, strip.longitude) * width,
  }));
  const second = useAnimatedProps(() => ({
    x: strip.x + (1 - ballTextureOffset(turn.value, strip.longitude)) * width,
  }));
  return (
    <G clipPath={`url(#${clipId})`}>
      <AnimatedImage
        href={source}
        x={strip.x - strip.longitude * width}
        y={2}
        width={width}
        height={92}
        preserveAspectRatio="none"
        animatedProps={first}
      />
      <AnimatedImage
        href={source}
        x={strip.x + (1 - strip.longitude) * width}
        y={2}
        width={width}
        height={92}
        preserveAspectRatio="none"
        animatedProps={second}
      />
    </G>
  );
}

function BallSeams({ seams }: { seams: DerivedValue<string> }) {
  const animatedProps = useAnimatedProps(() => ({ d: seams.value }));
  return (
    <AnimatedPath
      d={initialSeams}
      animatedProps={animatedProps}
      fill="none"
      stroke="#183051"
      strokeWidth={0.55}
      strokeOpacity={0.32}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function SpinningBall({ size = 32 }: { size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const turn = useSharedValue(0);
  const [nation, setNation] = useState(-1);
  // 30 geometric frames / second at this duration; native timing stays on the UI thread.
  const textureTurn = useDerivedValue(
    () => Math.floor(turn.value * BALL_FRAME_COUNT) / BALL_FRAME_COUNT,
  );
  const seams = useDerivedValue(() =>
    turn.value < BALL_GLOBE_TURNS
      ? ""
      : projectBallSeams(textureTurn.value, ballSeams),
  );
  // One React update per revolution; geometric movement stays on the UI thread.
  useAnimatedReaction(
    () => ballStageIndex(turn.value),
    (next, previous) => {
      if (next !== previous) scheduleOnRN(setNation, next);
    },
  );

  useEffect(() => {
    let mounted = true;
    let active =
      AppState.currentState !== "background" &&
      AppState.currentState !== "inactive";
    // Do not start moving until the asynchronous system preference is known.
    let reduceMotion = true;
    let motionChanged = false;
    function updateAnimation() {
      cancelAnimation(turn);
      if (!mounted || !active || reduceMotion) return;
      const cycle = BALL_NATIONS.length;
      const end = BALL_GLOBE_TURNS + cycle;
      const phase = ballResumeTurn(turn.value);
      turn.value = phase;
      // Finish the current sequence before looping. Background/reduced-motion
      // pauses retain both the country and its longitude, without skipping turns.
      turn.value = withSequence(
        ReduceMotion.Never,
        withTiming(end, {
          duration: (end - phase) * BALL_ROTATION_DURATION,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        }),
        withTiming(BALL_GLOBE_TURNS, {
          duration: 0,
          reduceMotion: ReduceMotion.Never,
        }),
        withRepeat(
          withTiming(end, {
            duration: cycle * BALL_ROTATION_DURATION,
            easing: Easing.linear,
            reduceMotion: ReduceMotion.Never,
          }),
          -1,
          false,
          undefined,
          ReduceMotion.Never,
        ),
      );
    }
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        motionChanged = true;
        reduceMotion = value;
        updateAnimation();
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!mounted || motionChanged) return;
        reduceMotion = value;
        updateAnimation();
      })
      .catch(() => {
        // A failed preference read leaves the decorative globe still.
      });
    const app = AppState.addEventListener("change", (state) => {
      const nextActive = state === "active";
      if (active === nextActive) return;
      active = nextActive;
      updateAnimation();
    });
    return () => {
      mounted = false;
      motion.remove();
      app.remove();
      cancelAnimation(turn);
    };
  }, [turn]);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.ball, { width: size, height: size }]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          {BALL_STRIPS.map((strip, index) => (
            <ClipPath key={index} id={`${id}-strip-${index}`}>
              <Rect
                x={strip.x - 0.025}
                y={2}
                width={strip.width + 0.05}
                height={92}
              />
            </ClipPath>
          ))}
          <ClipPath id={`${id}-clip`}>
            <Circle cx={50} cy={48} r={46} />
          </ClipPath>
          <RadialGradient
            id={`${id}-shadow`}
            cx="50%"
            cy="50%"
            rx="50%"
            ry="50%"
          >
            <Stop offset="0" stopColor="#15203A" stopOpacity={0.34} />
            <Stop offset="1" stopColor="#15203A" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient
            id={`${id}-shade`}
            cx="32%"
            cy="25%"
            rx="76%"
            ry="76%"
          >
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.28} />
            <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity={0.02} />
            <Stop offset="0.69" stopColor="#172C4C" stopOpacity={0.09} />
            <Stop offset="0.9" stopColor="#0A1932" stopOpacity={0.42} />
            <Stop offset="1" stopColor="#081428" stopOpacity={0.65} />
          </RadialGradient>
          <RadialGradient
            id={`${id}-light`}
            cx="50%"
            cy="50%"
            rx="50%"
            ry="50%"
          >
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.36} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={50} cy={96} rx={34} ry={4} fill={`url(#${id}-shadow)`} />
        <Circle cx={50} cy={48} r={46} fill="#F6F9FE" />
        <G clipPath={`url(#${id}-clip)`}>
          {nation < 0 ? (
            <EarthGlobe turn={textureTurn} id={id} />
          ) : (
            <>
              {BALL_STRIPS.map((_, index) => (
                <FlagStrip
                  key={index}
                  turn={textureTurn}
                  index={index}
                  source={BALL_FLAG_ASSETS[nation]}
                  clipId={`${id}-strip-${index}`}
                />
              ))}
              <BallSeams seams={seams} />
            </>
          )}
          <Circle cx={50} cy={48} r={46} fill={`url(#${id}-shade)`} />
          <Ellipse cx={33} cy={26} rx={25} ry={20} fill={`url(#${id}-light)`} />
        </G>
        <Circle
          cx={50}
          cy={48}
          r={45.7}
          fill="none"
          stroke="#153050"
          strokeOpacity={0.22}
          strokeWidth={0.6}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ ball: { flexShrink: 0 } });
