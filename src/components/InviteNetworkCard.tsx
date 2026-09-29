import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowRight,
  Copy,
  MessageCircle,
  MessageSquareText,
  Music2,
  Phone,
  Share2,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import { useTranslation } from "../lib/i18n";

export type InviteShareChannel =
  "system" | "whatsapp" | "facebook" | "instagram" | "tiktok" | "sms";

export type InviteNetworkCardProps = {
  invitationUrl: string;
  onClose: () => void;
  onCopy: () => void;
  onShare: (channel: InviteShareChannel) => void;
  feedback?: string;
  busy?: boolean;
};

const channels: {
  channel: InviteShareChannel;
  label: string;
  color: string;
}[] = [
  { channel: "whatsapp", label: "WhatsApp", color: "#25D366" },
  { channel: "facebook", label: "Facebook", color: "#1877F2" },
  { channel: "instagram", label: "Instagram", color: "#B62F88" },
  { channel: "tiktok", label: "TikTok", color: "#040817" },
  { channel: "sms", label: "SMS", color: "#20AEEA" },
  { channel: "system", label: "Autre", color: "#EEF0F4" },
];

function ChannelIcon({ channel }: { channel: InviteShareChannel }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  if (channel === "facebook") {
    return (
      <Svg width={25} height={25} viewBox="0 0 24 24">
        <Path
          fill="#FFFFFF"
          d="M14.2 22v-8.8h3l.5-3.6h-3.5V7.3c0-1 .3-1.8 1.8-1.8h1.9V2.3A24 24 0 0 0 15.1 2c-2.8 0-4.7 1.7-4.7 4.9v2.7H7.2v3.6h3.2V22z"
        />
      </Svg>
    );
  }
  if (channel === "instagram") {
    return (
      <Svg width={25} height={25} viewBox="0 0 24 24" fill="none">
        <Rect
          x={3}
          y={3}
          width={18}
          height={18}
          rx={5}
          stroke="#FFFFFF"
          strokeWidth={2}
        />
        <Circle cx={12} cy={12} r={4.2} stroke="#FFFFFF" strokeWidth={2} />
        <Circle cx={17.4} cy={6.6} r={1.2} fill="#FFFFFF" />
      </Svg>
    );
  }
  if (channel === "whatsapp") {
    return (
      <View style={styles.whatsappGlyph}>
        <MessageCircle size={27} color="#FFFFFF" strokeWidth={1.8} />
        <View style={styles.phoneGlyph}>
          <Phone size={12} color="#FFFFFF" strokeWidth={2.3} />
        </View>
      </View>
    );
  }
  if (channel === "tiktok")
    return <Music2 size={25} color="#FFFFFF" strokeWidth={2.2} />;
  if (channel === "sms")
    return <MessageSquareText size={25} color="#FFFFFF" strokeWidth={1.9} />;
  return <Share2 size={24} color={colors.ink} strokeWidth={1.9} />;
}

export function InviteNetworkCard({
  invitationUrl,
  onClose,
  onCopy,
  onShare,
  feedback,
  busy = false,
}: InviteNetworkCardProps) {
  const { colors, mode } = useTheme();
  const t = useTranslation();
  const styles = useThemedStyles(createStyles);
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const cardWidth = measuredWidth ?? Math.min(520, Math.max(240, width - 32));
  const columns = cardWidth < 340 || fontScale > 1.2 ? 2 : 3;
  const tileWidth = Math.max(
    0,
    (cardWidth - 44 - (columns - 1) * 10) / columns,
  );
  const unavailable = busy || !invitationUrl;

  return (
    <View
      accessibilityViewIsModal
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      style={styles.card}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        indicatorStyle={mode === "dark" ? "white" : "black"}
      >
        <LinearGradient
          colors={["#213DF2", "#162892", "#080D40"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.eyebrowRow}>
            <Sparkles size={15} color="#E8FBFF" strokeWidth={2} />
            <Text style={styles.eyebrow}>{t("invite.eyebrow")}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("invite.close")}
            onPress={onClose}
            style={({ pressed }) => [
              styles.close,
              { opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <X size={23} color="#FFFFFF" strokeWidth={1.8} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            {t("invite.title")}
          </Text>
          <Text style={styles.description}>{t("invite.description1")}</Text>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.linkSection}>
            <Text style={styles.sectionLabel}>{t("invite.linkSection")}</Text>
            <View style={styles.linkCard}>
              <Text
                selectable
                accessibilityLabel={`${t("invite.linkSection")} : ${invitationUrl}`}
                style={styles.linkText}
              >
                {invitationUrl}
              </Text>
            </View>
            <View style={styles.primaryActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("invite.copyAccessibility")}
                accessibilityState={{ disabled: unavailable, busy }}
                disabled={unavailable}
                onPress={onCopy}
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.copyButton,
                  { opacity: unavailable ? 0.5 : pressed ? 0.7 : 1 },
                ]}
              >
                <Copy size={18} color={colors.deepBlue} strokeWidth={1.9} />
                <Text style={styles.copyLabel}>{t("invite.copyLabel")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("invite.shareAccessibility")}
                accessibilityState={{ disabled: unavailable, busy }}
                disabled={unavailable}
                onPress={() => onShare("system")}
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.shareButton,
                  { opacity: unavailable ? 0.5 : pressed ? 0.7 : 1 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Share2 size={18} color="#FFFFFF" strokeWidth={1.9} />
                )}
                <Text style={styles.shareLabel}>{t("invite.shareLabel")}</Text>
              </Pressable>
            </View>
            <View style={styles.benefits}>
              <View style={styles.benefit}>
                <Trophy size={17} color="#F59E0B" strokeWidth={2} />
                <Text style={styles.benefitText}>
                  {t("invite.profileBenefit")}
                </Text>
              </View>
              <View style={styles.benefit}>
                <Users size={17} color={colors.deepBlue} strokeWidth={1.9} />
                <Text style={styles.benefitText}>
                  {t("invite.signupBenefit")}
                </Text>
              </View>
            </View>
          </View>

          {!!feedback && (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.feedback}
            >
              {feedback}
            </Text>
          )}

          <View style={styles.shareSection}>
            <Text style={styles.sectionLabel}>{t("invite.shareSection")}</Text>
            <View style={styles.channelGrid}>
              {channels.map(({ channel, label, color }) => (
                <Pressable
                  key={channel}
                  accessibilityRole="button"
                  accessibilityLabel={
                    channel === "system"
                      ? t("invite.otherOptions")
                      : t("invite.shareWithChannel", { channel: label })
                  }
                  accessibilityState={{ disabled: unavailable, busy }}
                  accessibilityHint={
                    channel === "instagram" || channel === "tiktok"
                      ? `${t("invite.shareLabel")} : ${label}`
                      : undefined
                  }
                  disabled={unavailable}
                  onPress={() => onShare(channel)}
                  style={({ pressed }) => [
                    styles.channelButton,
                    {
                      width: tileWidth,
                      backgroundColor:
                        channel === "system" ? colors.surfaceRaised : color,
                      borderWidth: channel === "system" ? 1 : 0,
                      opacity: unavailable ? 0.5 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  {channel === "instagram" && (
                    <LinearGradient
                      colors={["#733BC5", "#B62F88", "#C05324"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                  )}
                  <View
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                    style={styles.channelIcon}
                  >
                    <ChannelIcon channel={channel} />
                  </View>
                  <Text
                    style={[
                      styles.channelLabel,
                      channel === "system" && styles.otherChannelLabel,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.shareHint}>{t("invite.shareHint")}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.continueButton,
              { opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={styles.continueLabel}>{t("invite.continue")}</Text>
            <ArrowRight size={20} color={colors.muted} strokeWidth={2} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      width: "100%",
      maxWidth: 560,
      maxHeight: "100%",
      alignSelf: "center",
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: colors.surface,
    },
    scroll: { flexShrink: 1 },
    scrollContent: { paddingBottom: 10 },
    hero: { paddingHorizontal: 24, paddingTop: 25, paddingBottom: 31, gap: 18 },
    eyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginRight: 32,
      alignSelf: "flex-start",
      flexShrink: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(84,214,255,0.46)",
      backgroundColor: "rgba(20,158,220,0.38)",
    },
    eyebrow: {
      color: "#E8FBFF",
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "800",
      letterSpacing: 1,
      flexShrink: 1,
    },
    close: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 22,
    },
    title: {
      color: "#FFFFFF",
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "800",
      letterSpacing: -0.7,
    },
    body: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 14, gap: 22 },
    heroDescription: { gap: 5 },
    description: { color: "#DCE4FF", fontSize: 18, lineHeight: 27 },
    benefits: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 4 },
    benefit: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      flexGrow: 1,
      flexShrink: 1,
    },
    benefitText: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 21,
      flexShrink: 1,
    },
    sectionLabel: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "800",
      letterSpacing: 1.1,
    },
    linkSection: { gap: 10, borderRadius: 22, backgroundColor: colors.surfaceRaised, padding: 18, borderWidth: 1, borderColor: colors.border },
    linkCard: {
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.blue,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    linkText: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 22,
      flexShrink: 1,
    },
    primaryActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    primaryButton: {
      flex: 1,
      minWidth: 110,
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      paddingVertical: 13,
      gap: 8,
      borderRadius: 26,
    },
    copyButton: {
      borderWidth: 2,
      borderColor: "#C9DFFF",
      backgroundColor: colors.surfaceRaised,
    },
    shareButton: { backgroundColor: "#2F5FF2" },
    copyLabel: {
      color: colors.deepBlue,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
      flexShrink: 1,
    },
    shareLabel: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
      flexShrink: 1,
    },
    feedback: { color: colors.ink, fontSize: 13, lineHeight: 20 },
    shareSection: { gap: 12 },
    channelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    channelButton: {
      minHeight: 82,
      minWidth: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 15,
      borderColor: colors.border,
      overflow: "hidden",
      paddingHorizontal: 5,
      paddingVertical: 12,
      gap: 8,
    },
    channelIcon: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    channelLabel: {
      color: "#FFFFFF",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
      textAlign: "center",
      maxWidth: "100%",
    },
    otherChannelLabel: { color: colors.ink },
    shareHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    whatsappGlyph: {
      width: 27,
      height: 27,
      alignItems: "center",
      justifyContent: "center",
    },
    phoneGlyph: { position: "absolute", top: 6, left: 7 },
    continueButton: {
      minHeight: 56,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: colors.border,
    },
    continueLabel: {
      color: colors.muted,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: "600",
      textAlign: "center",
    },
  });
