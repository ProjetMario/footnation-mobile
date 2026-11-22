import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";

export const studioColors = {
  background: "#090D16",
  panel: "#131B2B",
  raised: "#1C273A",
  line: "#2A3548",
  text: "#F5F7FC",
  muted: "#9CAAC1",
  blue: "#2684FF",
  cyan: "#8EE7ED",
  danger: "#FFA7B4",
};
export function StudioButton({
  label,
  icon: Icon,
  onPress,
  disabled,
  busy,
  secondary,
  compact,
  danger,
}: {
  label: string;
  icon?: LucideIcon;
  onPress(): void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  compact?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        p.button,
        compact && { minHeight: 42, paddingHorizontal: 14 },
        secondary && p.secondary,
        danger && { borderColor: "#73394B" },
        { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={studioColors.text} size="small" />
      ) : (
        Icon && (
          <Icon
            size={compact ? 17 : 20}
            color={danger ? studioColors.danger : studioColors.text}
          />
        )
      )}
      <Text style={[p.buttonLabel, danger && { color: studioColors.danger }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function StudioChip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress(): void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        p.chip,
        selected && p.chipSelected,
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[p.chipLabel, selected && { color: "#FFFFFF" }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function StudioField({
  label,
  ...props
}: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 8, flex: 1 }}>
      {!!label && <Text style={p.label}>{label}</Text>}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={studioColors.muted}
        selectionColor={studioColors.blue}
        {...props}
        style={[
          p.input,
          props.multiline && { minHeight: 90, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function StudioNumber({
  label,
  value,
  onChange,
  min = 0,
  max = 600,
}: {
  label: string;
  value: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(String(Math.round(value * 100) / 100));
  useEffect(() => setText(String(Math.round(value * 100) / 100)), [value]);
  function commit() {
    const next = Number(text.replace(",", "."));
    if (!text.trim() || !Number.isFinite(next)) {
      setText(String(value));
      return;
    }
    const clamped = Math.max(Math.min(min, max), Math.min(max, next));
    setText(String(Math.round(clamped * 100) / 100));
    if (clamped !== value) onChange(clamped);
  }
  return (
    <StudioField
      label={label}
      value={text}
      keyboardType="decimal-pad"
      onChangeText={setText}
      onBlur={commit}
      onSubmitEditing={commit}
    />
  );
}
export function StudioSection({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={p.section}>
      <View style={{ gap: 5 }}>
        <Text style={p.sectionTitle}>{title}</Text>
        {!!detail && <Text style={p.note}>{detail}</Text>}
      </View>
      {children}
    </View>
  );
}
export const p = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 17,
    paddingHorizontal: 22,
    paddingVertical: 10,
    backgroundColor: studioColors.blue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
  secondary: {
    backgroundColor: studioColors.raised,
    borderColor: studioColors.line,
  },
  buttonLabel: {
    color: studioColors.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  chip: {
    borderRadius: 99,
    paddingHorizontal: 15,
    paddingVertical: 11,
    backgroundColor: studioColors.panel,
    borderWidth: 1,
    borderColor: studioColors.line,
    minHeight: 42,
    justifyContent: "center",
  },
  chipSelected: { backgroundColor: "#174888", borderColor: studioColors.blue },
  chipLabel: { fontSize: 13, fontWeight: "700", color: studioColors.muted },
  label: { color: studioColors.muted, fontWeight: "700", fontSize: 12 },
  input: {
    color: studioColors.text,
    backgroundColor: studioColors.background,
    borderWidth: 1,
    borderColor: studioColors.line,
    borderRadius: 13,
    padding: 13,
    fontSize: 15,
    minHeight: 46,
  },
  section: {
    backgroundColor: studioColors.panel,
    borderRadius: 22,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: studioColors.line,
  },
  sectionTitle: { color: studioColors.text, fontSize: 17, fontWeight: "800" },
  note: { color: studioColors.muted, fontSize: 13, lineHeight: 19 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
});
