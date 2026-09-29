import React, { useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useTheme } from "../theme";
import { latestAllowedBirthdate } from "../lib/calendarDate";
import { useUIStyles } from "./ui";

export type BirthdateProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minAge?: number;
  label?: string;
};

function partsFromIso(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? {
        day: value.slice(8, 10),
        month: value.slice(5, 7),
        year: value.slice(0, 4),
      }
    : { day: "", month: "", year: "" };
}

function digits(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function validParts(day: string, month: string, year: string, minAge: number) {
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return null;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return null;
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() + 1 !== Number(month) ||
    date.getDate() !== Number(day)
  )
    return null;
  if (iso < "1900-01-01" || iso > latestAllowedBirthdate(new Date(), minAge))
    return null;
  return iso;
}

export function BirthdateField({
  value,
  onChange,
  disabled,
  minAge = 13,
  label = "Date de naissance",
}: BirthdateProps) {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  const [parts, setParts] = useState(partsFromIso(value));
  const lastValue = useRef(value);

  useEffect(() => {
    // The parent echoes "" while a part is incomplete. Keep that local draft;
    // only a new value loaded or reset by the parent replaces all three parts.
    if (value === lastValue.current) return;
    lastValue.current = value;
    setParts(partsFromIso(value));
  }, [value]);

  function update(next: Partial<typeof parts>) {
    const merged = { ...parts, ...next };
    setParts(merged);
    const nextValue =
      validParts(merged.day, merged.month, merged.year, minAge) || "";
    lastValue.current = nextValue;
    onChange(nextValue);
  }

  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TextInput
          accessibilityLabel="Jour de naissance"
          placeholder="JJ"
          placeholderTextColor={colors.muted}
          value={parts.day}
          onChangeText={(text) => update({ day: digits(text, 2) })}
          editable={!disabled}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={2}
          selectionColor={colors.blue}
          keyboardAppearance={mode}
          style={[s.input, { flex: 1, minWidth: 0, textAlign: "center" }]}
        />
        <TextInput
          accessibilityLabel="Mois de naissance"
          placeholder="MM"
          placeholderTextColor={colors.muted}
          value={parts.month}
          onChangeText={(text) => update({ month: digits(text, 2) })}
          editable={!disabled}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={2}
          selectionColor={colors.blue}
          keyboardAppearance={mode}
          style={[s.input, { flex: 1, minWidth: 0, textAlign: "center" }]}
        />
        <TextInput
          accessibilityLabel="Année de naissance"
          placeholder="AAAA"
          placeholderTextColor={colors.muted}
          value={parts.year}
          onChangeText={(text) => update({ year: digits(text, 4) })}
          editable={!disabled}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={4}
          selectionColor={colors.blue}
          keyboardAppearance={mode}
          style={[s.input, { flex: 1.45, minWidth: 0, textAlign: "center" }]}
        />
      </View>
    </View>
  );
}
