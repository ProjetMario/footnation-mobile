import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useTheme } from "../theme";

export function CompactForm({ children }: { children: React.ReactNode }) {
  return <View style={styles.form}>{children}</View>;
}

export function FormDetails({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <View style={{ gap: 14 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [
          styles.disclosure,
          {
            borderColor: focused ? colors.blue : colors.border,
            backgroundColor:
              hovered || pressed ? colors.accentSoft : colors.surface,
          },
        ]}
      >
        <Text style={[styles.label, { color: colors.ink }]}>{title}</Text>
        <ChevronDown
          size={18}
          color={colors.muted}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {open && <View style={{ gap: 14 }}>{children}</View>}
    </View>
  );
}
const styles = StyleSheet.create({
  form: { width: "100%", maxWidth: 520, alignSelf: "center", gap: 16 },
  disclosure: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: { fontFamily: "Inter-Medium", fontSize: 14, lineHeight: 20, flex: 1 },
});
