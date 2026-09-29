import React from "react";
import { Circle, Defs, Path, LinearGradient, Stop } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  type DerivedValue,
} from "react-native-reanimated";
import { EARTH_LAND, projectEarthLand } from "../lib/earthGeometry";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const initialLand = projectEarthLand(0, EARTH_LAND);

export function EarthGlobe({
  turn,
  id,
}: {
  turn: DerivedValue<number>;
  id: string;
}) {
  const land = useAnimatedProps(() => ({
    d: projectEarthLand(turn.value, EARTH_LAND),
  }));
  return (
    <>
      <Defs>
        <LinearGradient id={`${id}-ocean`} x1="0%" y1="15%" x2="100%" y2="80%">
          <Stop offset="0" stopColor="#007BFF" />
          <Stop offset="0.38" stopColor="#304AFF" />
          <Stop offset="0.63" stopColor="#B400FF" />
          <Stop offset="0.82" stopColor="#FF008F" />
          <Stop offset="1" stopColor="#FF193C" />
        </LinearGradient>
        <LinearGradient id={`${id}-land`} x1="0%" y1="0%" x2="100%" y2="85%">
          <Stop offset="0" stopColor="#B7E8FF" />
          <Stop offset="0.45" stopColor="#D9C6FF" />
          <Stop offset="1" stopColor="#FFC4D9" />
        </LinearGradient>
      </Defs>
      <Circle cx={50} cy={48} r={46} fill={`url(#${id}-ocean)`} />
      <AnimatedPath
        d={initialLand}
        animatedProps={land}
        fill={`url(#${id}-land)`}
        fillRule="evenodd"
      />
      <Circle
        cx={50}
        cy={48}
        r={45.5}
        fill="none"
        stroke="#C9D7FF"
        strokeOpacity={0.5}
        strokeWidth={1}
      />
    </>
  );
}
