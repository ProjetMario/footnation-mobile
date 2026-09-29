import React, { useState } from "react";
import { Keyboard, Platform, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, useUIStyles } from "./ui";
import { useTheme } from "../theme";
export function DateField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { colors, mode: themeMode } = useTheme();
  const s = useUIStyles();

  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const parsed = new Date(value);
  const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <Button
        title={
          value ? date.toLocaleString("fr-FR") : "Choisir la date et l’heure"
        }
        accessibilityLabel={`${label} : ${value ? date.toLocaleString("fr-FR") : "Choisir la date et l’heure"}`}
        secondary
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setMode("date");
        }}
      />
      {!!(mode && !disabled) && (
        <DateTimePicker
          value={date}
          mode={mode}
          is24Hour
          locale="fr-FR"
          themeVariant={themeMode}
          textColor={colors.ink}
          accentColor={colors.blue}
          accessibilityLabel={`${label} : ${mode === "date" ? "date" : "heure"}`}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onDismiss={() => setMode(null)}
          onValueChange={(_event, selected) => {
            onChange(selected.toISOString());
            if (Platform.OS === "android")
              setMode(mode === "date" ? "time" : null);
          }}
        />
      )}
      {!!(mode && Platform.OS === "ios") && (
        <Button
          title={mode === "date" ? "Choisir l’heure" : "Valider"}
          disabled={disabled}
          onPress={() => {
            if (!value) onChange(date.toISOString());
            setMode(mode === "date" ? "time" : null);
          }}
        />
      )}
      {!!value && (
        <Button
          title="Effacer la date"
          accessibilityLabel={`Effacer ${label.toLocaleLowerCase("fr-FR")}`}
          disabled={disabled}
          secondary
          onPress={() => {
            onChange("");
            setMode(null);
          }}
        />
      )}
    </View>
  );
}
