import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ArrowRight, ChevronDown, type LucideIcon } from "lucide-react-native";
import { useTheme } from "../theme";

export type OpportunityTone = "blue" | "violet" | "green" | "rose";
const tones = {
  blue: ["#0960DC", "#83B5FF", "#F0F6FF", "#10243B"],
  violet: ["#7338CE", "#BEA0FF", "#F6F2FF", "#211D38"],
  green: ["#08765F", "#65D6B9", "#EEF9F5", "#102C2B"],
  rose: ["#B82560", "#FFA0C1", "#FFF2F6", "#321D30"],
};
export function useOpportunityTone(tone: OpportunityTone) {
  const { mode } = useTheme();
  const values = tones[tone];
  return {
    accent: values[mode === "dark" ? 1 : 0],
    tint: values[mode === "dark" ? 3 : 2],
  };
}
export function OpportunityIntro({
  title,
  description,
  tone,
  Icon,
  children,
}: {
  title: string;
  description: string;
  tone: OpportunityTone;
  Icon: LucideIcon;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const { accent, tint } = useOpportunityTone(tone);
  return (
    <View
      style={[
        opportunityUI.intro,
        { backgroundColor: tint, borderColor: colors.border },
      ]}
    >
      <View style={opportunityUI.row}>
        <View style={[opportunityUI.icon, { backgroundColor: colors.surface }]}>
          <Icon size={23} color={accent} />
        </View>
        <Text
          accessibilityRole="header"
          style={[opportunityUI.introTitle, { color: colors.ink }]}
        >
          {title}
        </Text>
      </View>
      <Text style={[opportunityUI.description, { color: colors.muted }]}>
        {description}
      </Text>
      {children}
    </View>
  );
}
export function OpportunityAction({
  title,
  onPress,
  tone = "blue",
  primary = false,
  disabled = false,
  busy = false,
  selected,
  expanded,
  Icon = ArrowRight,
}: {
  title: string;
  onPress: () => void;
  tone?: OpportunityTone;
  primary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  selected?: boolean;
  expanded?: boolean;
  Icon?: LucideIcon;
}) {
  const { colors } = useTheme();
  const { accent, tint } = useOpportunityTone(tone);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{
        disabled: disabled || busy,
        busy,
        selected,
        expanded,
      }}
      disabled={disabled || busy}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        opportunityUI.action,
        {
          backgroundColor: primary
            ? accent
            : hovered || selected
              ? tint
              : colors.surface,
          borderColor: focused
            ? colors.ink
            : selected || primary || hovered
              ? accent
              : colors.border,
          opacity: disabled || busy ? 0.55 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={[
          opportunityUI.actionText,
          { color: primary ? colors.background : accent },
        ]}
      >
        {title}
      </Text>
      {busy ? (
        <ActivityIndicator color={primary ? colors.background : accent} />
      ) : (
        <Icon size={17} color={primary ? colors.background : accent} />
      )}
    </Pressable>
  );
}
export function OpportunityCard({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        opportunityUI.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {children}
    </View>
  );
}
export function OpportunityBadge({
  label,
  tone = "blue",
}: {
  label: string;
  tone?: OpportunityTone;
}) {
  const { accent, tint } = useOpportunityTone(tone);
  return (
    <View style={[opportunityUI.badge, { backgroundColor: tint }]}>
      <Text style={{ color: accent, fontWeight: "700", fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}
export function OpportunityMessage({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <OpportunityAction
        title={open ? "Masquer le message" : "Voir le message"}
        tone="rose"
        Icon={ChevronDown}
        expanded={open}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <Text style={[opportunityUI.description, { color: colors.ink }]}>
          {message}
        </Text>
      )}
    </View>
  );
}
export function opportunityDate(value?: string | null) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString("fr-FR")
    : null;
}
export const opportunityUI = StyleSheet.create({
  intro: { borderRadius: 24, padding: 20, gap: 14, borderWidth: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  icon: { padding: 11, borderRadius: 15 },
  introTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    flex: 1,
    minWidth: 140,
  },
  title: { fontSize: 19, lineHeight: 26, fontWeight: "800" },
  description: { fontSize: 14, lineHeight: 22 },
  card: { borderRadius: 22, borderWidth: 1, padding: 20, gap: 14 },
  action: {
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  actionText: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
});
