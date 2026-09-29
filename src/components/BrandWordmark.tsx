import React, { useEffect, useId, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Text } from "react-native-svg";

const CleanGradient = React.forwardRef<
  LinearGradient,
  React.ComponentProps<typeof LinearGradient> & { collapsable?: boolean }
>(({ collapsable: _collapsable, ...props }, ref) => (
  <LinearGradient ref={ref} {...props} />
));
const AnimatedGradient = Animated.createAnimatedComponent(CleanGradient);
export function useBrandMotion() {
  const motion = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    const configure = (reduced: boolean) => {
      if (!active) return;
      animation?.stop();
      motion.setValue(0);
      if (!reduced) {
        animation = Animated.loop(
          Animated.sequence([
            Animated.timing(motion, {
              toValue: 1,
              duration: 3800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: false,
              isInteraction: false,
            }),
            Animated.timing(motion, {
              toValue: 0,
              duration: 3800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: false,
              isInteraction: false,
            }),
          ]),
        );
        animation.start();
      }
    };
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(configure)
      .catch(() => configure(true));
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      configure,
    );
    return () => {
      active = false;
      animation?.stop();
      subscription.remove();
    };
  }, [motion]);
  return motion;
}
export function BrandWordmark({ motion }: { motion: Animated.Value }) {
  const gradientId = `footnation${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <View
      accessible
      accessibilityLabel="FootNation"
      style={{ width: 154, height: 30, flexShrink: 1 }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 174 34">
        <Defs>
          <AnimatedGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={motion.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 10],
            })}
            y1="0%"
            x2={motion.interpolate({
              inputRange: [0, 1],
              outputRange: [145, 157],
            })}
            y2="0%"
          >
            <Stop offset="0%" stopColor="#0066FF" />
            <Stop offset="28%" stopColor="#344CFF" />
            <Stop offset="48%" stopColor="#8B20FF" />
            <Stop offset="68%" stopColor="#F000AC" />
            <Stop offset="84%" stopColor="#FF1744" />
            <Stop offset="100%" stopColor="#FF1E32" />
          </AnimatedGradient>
        </Defs>
        <Text
          x="0"
          y="26"
          fontFamily="Inter-Bold"
          fontSize="26"
          fontWeight="800"
          letterSpacing="-0.8"
          fill={`url(#${gradientId})`}
        >
          FOOTNATION
        </Text>
      </Svg>
    </View>
  );
}
