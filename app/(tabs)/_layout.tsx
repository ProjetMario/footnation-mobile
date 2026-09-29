import { useTranslation } from "../../src/lib/i18n";
import React, { useRef } from "react";
import { Tabs } from "expo-router/js-tabs";
import { View } from "react-native";
import { BlurTargetView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FloatingTabBar,
  floatingBarSpace,
  useKeyboardVisible,
} from "../../src/components/FloatingTabBar";
import { useTheme } from "../../src/theme";

export default function Layout() {
  const t = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const targets = useRef<Record<string, React.RefObject<View | null>>>({});
  const targetFor = (key: string) =>
    (targets.current[key] ??= React.createRef<View>());
  return (
    <Tabs
      initialRouteName="index"
      backBehavior="history"
      tabBar={(props) => (
        <FloatingTabBar
          {...props}
          keyboardVisible={keyboardVisible}
          blurTarget={targetFor(props.state.routes[props.state.index].key)}
        />
      )}
      screenLayout={({ children, route }) => (
        <BlurTargetView
          ref={targetFor(route.key)}
          style={{
            flex: 1,
            paddingBottom:
              // Other tab roots use Screen, which already consumes bottom safe area.
              route.name === "index" ||
              route.name === "shorts" ||
              keyboardVisible
                ? 0
                : floatingBarSpace(insets.bottom) - insets.bottom,
          }}
        >
          {children}
        </BlurTargetView>
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: { position: "absolute" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("nav.home") }} />
      <Tabs.Screen name="shorts" options={{ title: t("nav.shorts") }} />
      <Tabs.Screen
        name="messages"
        options={{ title: t("nav.messages"), href: null }}
      />
      <Tabs.Screen name="search" options={{ title: t("common.search") }} />
      <Tabs.Screen name="my-profile" options={{ title: t("nav.myProfile") }} />
      <Tabs.Screen name="network" options={{ href: null }} />
      <Tabs.Screen name="opportunities" options={{ href: null }} />
      <Tabs.Screen name="clubs" options={{ href: null }} />
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}
