import React, { useEffect } from "react";
import { Keyboard, Modal, StyleSheet, View } from "react-native";
import { usePathname } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../lib/auth";
import { buildInvitationUrl } from "../lib/invitationShare";
import { canPresentNetworkInvite } from "../lib/networkInvite";
import {
  activationPrompts,
  useActivationPrompts,
} from "../lib/useActivationPrompts";
import { invitationPromptReady } from "../lib/activationPrompts";
import { useInvitationActions } from "../lib/useInvitationActions";
import { InviteNetworkCard } from "./InviteNetworkCard";
import { useCalls } from "./CallProvider";
import { colors, useThemedStyles, type ThemeColors } from "../theme";

export function NetworkInvitePanel({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const invitationUrl = buildInvitationUrl(userId);
  const { copy, share, busy, feedback } = useInvitationActions(invitationUrl);
  return (
    <InviteNetworkCard
      invitationUrl={invitationUrl}
      onClose={onClose}
      onCopy={() => void copy()}
      onShare={(channel) => void share(channel)}
      busy={busy}
      feedback={feedback}
    />
  );
}

export function NetworkInvitePrompt() {
  const {
    session,
    profile,
    profileStatus,
    loading,
    error,
    networkInviteRequest,
    dismissNetworkInvite,
  } = useAuth();
  const pathname = usePathname();
  const calls = useCalls();
  const promptState = useActivationPrompts(session?.user.id || null);
  const visible =
    invitationPromptReady(promptState, session?.user.id) &&
    canPresentNetworkInvite({
      request: networkInviteRequest,
      userId: session?.user.id,
      profile,
      profileStatus,
      loading,
      error,
      pathname,
      callBusy: calls.busy,
    });
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);
  if (!visible || !networkInviteRequest) return null;
  const close = () => {
    activationPrompts.dismissInvitation(networkInviteRequest.userId);
    dismissNetworkInvite(networkInviteRequest.key);
  };
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <StatusBar style="light" />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.panel}>
          <NetworkInvitePanel
            key={networkInviteRequest.key}
            userId={networkInviteRequest.userId}
            onClose={close}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const createInvitePromptStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    frame: {
      width: "100%",
      maxWidth: 520,
      maxHeight: "100%",
      backgroundColor: colors.surface,
      borderRadius: 26,
      overflow: "hidden",
    },
    page: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 12,
      alignItems: "center",
      justifyContent: "center",
    },
  });
export const invitePromptStyles = createInvitePromptStyles(colors);
export function useInvitePromptStyles() {
  return useThemedStyles(createInvitePromptStyles);
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(9,12,22,0.64)",
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  panel: { width: "100%", maxWidth: 520, maxHeight: "100%" },
});
