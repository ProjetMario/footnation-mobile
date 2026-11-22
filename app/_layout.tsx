import "../src/lib/monitoring";
import React from "react";
import {
  Redirect,
  Stack,
  useGlobalSearchParams,
  usePathname,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { ActivityIndicator, Platform, View } from "react-native";
import { FontDisplay, useFonts } from "expo-font";
import * as SystemUI from "expo-system-ui";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CallProvider } from "../src/components/CallProvider";
import { ErrorBoundary as AppErrorBoundary } from "../src/components/ErrorBoundary";
import { MonitoringRoute } from "../src/components/MonitoringRoute";
import { ConnectivityProvider } from "../src/components/ConnectivityProvider";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { createAppQueryClient } from "../src/lib/queryClient";
import { PushResponseBridge } from "../src/components/PushResponseBridge";
import { NetworkInvitePrompt } from "../src/components/NetworkInvitePrompt";
import { AnniversaryNotifications } from "../src/components/AnniversaryNotifications";
import { FirstLoginOnboarding } from "../src/components/FirstLoginOnboarding";
import { AuthProvider } from "../src/lib/auth";
import { useAuth } from "../src/lib/auth";
import { MemberAccessBoundary } from "../src/components/MemberAccessBoundary";
import { authGateReturnPath } from "../src/lib/authReturn";
import { memberAccessRoutePath } from "../src/lib/memberAccess";
import { GrowthActivityBridge } from "../src/components/GrowthActivityBridge";
import { ProfilePresenceBridge } from "../src/components/ProfilePresenceBridge";
import { LanguageProvider } from "../src/lib/i18n";
import { ThemeProvider, useTheme } from "../src/theme";
export { RouteErrorBoundary as ErrorBoundary } from "../src/components/ErrorBoundary";
export default function Layout() {
  // A full root recovery starts with a fresh cache; a screen recovery retains
  // AuthProvider so account changes continue to invalidate cached data.
  const [client] = React.useState(createAppQueryClient);
  const [fontsLoaded, fontError] = useFonts({
    "Inter-Regular": {
      uri:
        Platform.OS === "web"
          ? require("../assets/fonts/Inter-Regular.woff2")
          : require("../assets/fonts/Inter-Regular.ttf"),
      display: FontDisplay.SWAP,
    },
    "Inter-Medium": {
      uri:
        Platform.OS === "web"
          ? require("../assets/fonts/Inter-Medium.woff2")
          : require("../assets/fonts/Inter-Medium.ttf"),
      display: FontDisplay.SWAP,
    },
    "Inter-SemiBold": {
      uri:
        Platform.OS === "web"
          ? require("../assets/fonts/Inter-SemiBold.woff2")
          : require("../assets/fonts/Inter-SemiBold.ttf"),
      display: FontDisplay.SWAP,
    },
    "Inter-Bold": {
      uri:
        Platform.OS === "web"
          ? require("../assets/fonts/Inter-Bold.woff2")
          : require("../assets/fonts/Inter-Bold.ttf"),
      display: FontDisplay.SWAP,
    },
  });
  // Web can paint with a fallback font while feed/auth requests start. Keeping
  // the native gate avoids rendering an unregistered font on iOS/Android.
  if (Platform.OS !== "web" && !fontsLoaded && !fontError)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#06111D",
        }}
      >
        <ActivityIndicator
          accessibilityLabel="Chargement de FootNation"
          color="#087CFF"
        />
      </View>
    );
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <QueryClientProvider client={client}>
            <ConnectivityProvider>
              <AuthProvider>
                <MemberServices>
                  <AppErrorBoundary>
                    <ThemedRoot />
                  </AppErrorBoundary>
                </MemberServices>
              </AuthProvider>
            </ConnectivityProvider>
          </QueryClientProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
function MemberServices({ children }: { children: React.ReactNode }) {
  const { memberAccess, profile } = useAuth();
  const profileReady = !!memberAccess?.allowed && !!profile;
  return (
    <CallProvider enabled={profileReady}>
      {profileReady && <GrowthActivityBridge />}
      {profileReady && <ProfilePresenceBridge />}
      {profileReady && <PushResponseBridge />}
      {profileReady && <AnniversaryNotifications />}
      {children}
    </CallProvider>
  );
}
function ProtectedScreen({
  children,
  route,
}: {
  children: React.ReactNode;
  route: { name: string; params?: Readonly<object> };
}) {
  // The Supporters stack protects each child scene so onboarding retains its
  // exact destination and club filters instead of the parent directory route.
  if (route.name === "supporters") return <>{children}</>;
  return (
    <MemberAccessBoundary path={memberAccessRoutePath(route)}>
      {children}
    </MemberAccessBoundary>
  );
}
function ThemedRoot() {
  const { colors, mode } = useTheme();
  const { memberAccess } = useAuth();
  React.useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <MonitoringRoute />
      <OnboardingRedirect />
      <Stack
        screenLayout={ProtectedScreen}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="compose" options={{ presentation: "modal" }} />
      </Stack>
      {!!memberAccess?.allowed && <FirstLoginOnboarding />}
      {!!memberAccess?.allowed && <NetworkInvitePrompt />}
      <OfflineBanner />
    </View>
  );
}

const socialSignupPublicPaths = new Set([
  "/auth/callback",
  "/contact",
  "/help",
  "/login",
  "/onboarding",
  "/signup",
  "/social-signup",
  "/suppression-compte",
]);

function OnboardingRedirect() {
  const { session, profileStatus, loading } = useAuth();
  const pathname = usePathname();
  // This redirect lives in the root layout, outside the active child scene.
  // Local params there may omit the child's query (e.g. attendance=1).
  const params = useGlobalSearchParams();
  if (
    loading ||
    !session ||
    profileStatus !== "unverified" ||
    socialSignupPublicPaths.has(pathname)
  )
    return null;
  const next = authGateReturnPath(pathname, params);
  return (
    <Redirect
      href={{
        pathname: "/onboarding",
        params: next ? { next } : {},
      }}
    />
  );
}
