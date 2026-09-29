import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, usePathname } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { onboardingTeamPath } from "../lib/memberTeamPresentation";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  activationPrompts,
  useActivationPrompts,
} from "../lib/useActivationPrompts";
import { isActivationLanding } from "../lib/activationPrompts";
import { hasInviteReadyProfile } from "../lib/networkInvite";
import { useCalls } from "./CallProvider";
import {
  Bell,
  Briefcase,
  PlaySquare,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../lib/auth";
import { useTranslation } from "../lib/i18n";
import {
  signature,
  useTheme,
  useThemedStyles,
  type ThemeColors,
} from "../theme";

export function FirstLoginOnboarding() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    session,
    profile,
    profileStatus,
    loading,
    error,
    networkInviteRequest,
  } = useAuth();
  const t = useTranslation();
  const uid = session?.user.id || null;
  const state = useActivationPrompts(uid);
  const pathname = usePathname();
  const calls = useCalls();
  const visible =
    !!uid &&
    state.userId === uid &&
    state.ready &&
    !state.onboardingSeen &&
    !loading &&
    !error &&
    !networkInviteRequest &&
    !calls.busy &&
    profileStatus === "ready" &&
    profile?.id === uid &&
    hasInviteReadyProfile(profile) &&
    isActivationLanding(pathname);

  const teams = useQuery({
    queryKey: ["onboarding-member-teams", uid],
    enabled: visible,
    queryFn: async () => {
      const result = await supabase
        .from("team_members")
        .select("status,is_primary,team:teams!inner(id,club_id)")
        .eq("profile_id", uid!)
        .eq("is_active", true)
        .order("is_primary", { ascending: false })
        .order("id");
      if (result.error) throw result.error;
      return result.data as unknown as Parameters<typeof onboardingTeamPath>[0];
    },
  });

  if (!uid) return null;

  const close = (destination?: string) => {
    if (!activationPrompts.dismissOnboarding(uid)) return;
    if (destination) router.push(destination);
    else router.replace("/");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={() => void close()}
    >
      <SafeAreaView style={styles.overlay}>
        <ScrollView
          accessibilityViewIsModal
          style={styles.card}
          contentContainerStyle={styles.cardContent}
        >
          <LinearGradient
            colors={signature}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.badge}
          >
            <Sparkles size={18} color={colors.white} />
            <Text style={styles.badgeText}>{t("onboarding.badge")}</Text>
          </LinearGradient>

          <Text accessibilityRole="header" style={styles.title}>
            {profile?.first_name
              ? t("onboarding.namedTitle", { name: profile.first_name })
              : t("onboarding.defaultTitle")}
          </Text>
          <Text style={styles.description}>{t("onboarding.description")}</Text>

          <View style={styles.steps}>
            <Step
              icon={<Users size={20} color={colors.blue} />}
              title={t("onboarding.teamTitle")}
              text={t("onboarding.teamText")}
            />
            <Step
              icon={<UserRound size={20} color={colors.blue} />}
              title={t("onboarding.profileTitle")}
              text={t("onboarding.profileText")}
            />
            <Step
              icon={<PlaySquare size={20} color={colors.blue} />}
              title={t("onboarding.publishTitle")}
              text={t("onboarding.publishText")}
            />
            <Step
              icon={<Briefcase size={20} color={colors.blue} />}
              title={t("onboarding.opportunitiesTitle")}
              text={t("onboarding.opportunitiesText")}
            />
            <Step
              icon={<Users size={20} color={colors.blue} />}
              title={t("onboarding.matchingTitle")}
              text={t("onboarding.matchingText")}
            />
            <Step
              icon={<Bell size={20} color={colors.blue} />}
              title={t("onboarding.inviteTitle")}
              text={t("onboarding.inviteText")}
            />
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("onboarding.teamTitle")}
              disabled={teams.isPending}
              accessibilityState={{
                disabled: teams.isPending,
                busy: teams.isPending,
              }}
              onPress={() =>
                void close(
                  teams.data ? onboardingTeamPath(teams.data) : "/member/teams",
                )
              }
              style={({ pressed }) => [
                styles.primaryButton,
                { opacity: teams.isPending ? 0.55 : pressed ? 0.78 : 1 },
              ]}
            >
              <Text style={styles.primaryText}>
                {t("onboarding.teamTitle")}
              </Text>
            </Pressable>
            <View style={styles.secondaryRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("onboarding.completeProfile")}
                onPress={() => void close("/settings")}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Text style={styles.secondaryText}>
                  {t("onboarding.completeProfile")}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.later")}
                onPress={() => void close()}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Text style={styles.secondaryText}>{t("common.later")}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Step({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.step}>
      <View style={styles.stepIcon}>{icon}</View>
      <View style={styles.stepText}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{text}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      padding: 18,
      backgroundColor: "rgba(2,6,23,0.72)",
    },
    card: {
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",
      borderRadius: 30,
      maxHeight: "100%",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardContent: { padding: 22, gap: 16 },
    badge: {
      alignSelf: "flex-start",
      minHeight: 36,
      borderRadius: 18,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    badgeText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 13,
      fontWeight: "900",
    },
    title: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "900",
    },
    description: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 16,
      lineHeight: 23,
    },
    steps: { gap: 10 },
    step: {
      minHeight: 62,
      borderRadius: 18,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surfaceRaised,
    },
    stepIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
    },
    stepText: { flex: 1, minWidth: 0, gap: 2 },
    stepTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "900",
    },
    stepDescription: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 13,
      lineHeight: 18,
    },
    actions: { gap: 10, paddingTop: 2 },
    primaryButton: {
      minHeight: 52,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.blue,
    },
    primaryText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 16,
      fontWeight: "900",
    },
    secondaryRow: { flexDirection: "row", gap: 10 },
    secondaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    secondaryText: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 15,
      fontWeight: "800",
    },
  });
