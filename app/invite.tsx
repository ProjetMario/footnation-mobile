import React from "react";
import { useTheme } from "../src/theme";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { AuthGate } from "../src/components/AuthGate";
import {
  NetworkInvitePanel,
  useInvitePromptStyles,
} from "../src/components/NetworkInvitePrompt";
import { useAuth } from "../src/lib/auth";

export default function Invite() {
  const invitePromptStyles = useInvitePromptStyles();
  const { mode } = useTheme();
  const { session, networkInviteRequest, dismissNetworkInvite } = useAuth();
  const close = () => {
    if (networkInviteRequest) dismissNetworkInvite(networkInviteRequest.key);
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  return (
    <SafeAreaView style={invitePromptStyles.page}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <View style={invitePromptStyles.frame}>
        <AuthGate>
          {!!session && (
            <NetworkInvitePanel
              key={session.user.id}
              userId={session.user.id}
              onClose={close}
            />
          )}
        </AuthGate>
      </View>
    </SafeAreaView>
  );
}
