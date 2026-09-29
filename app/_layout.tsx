import "../src/lib/monitoring";
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { ActivityIndicator, View } from "react-native";
import { useFonts } from "expo-font";
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
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
  });
  if (!fontsLoaded && !fontError)
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
  const { memberAccess } = useAuth();
  return (
    <CallProvider enabled={!!memberAccess?.allowed}>
      {!!memberAccess?.allowed && <GrowthActivityBridge />}
      {!!memberAccess?.allowed && <ProfilePresenceBridge />}
      {!!memberAccess?.allowed && <PushResponseBridge />}
      {!!memberAccess?.allowed && <AnniversaryNotifications />}
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
