import { useState } from "react";
import { Platform, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, useUIStyles } from "./ui";
import { calendarDate, validCalendarDate } from "../lib/calendarDate";
import type { CalendarDayProps } from "./CalendarDayField";
export function CalendarDayField({
  label,
  value,
  onChange,
  disabled,
}: CalendarDayProps) {
  const s = useUIStyles();

  const [open, setOpen] = useState(false);
  const date = validCalendarDate(value)
    ? new Date(`${value}T12:00:00`)
    : new Date();
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <Button
        secondary
        title={value || "Choisir une date"}
        disabled={disabled}
        onPress={() => setOpen(true)}
      />
      {!!(open && !disabled) && (
        <DateTimePicker
          value={date}
          mode="date"
          locale="fr-FR"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onDismiss={() => setOpen(false)}
          onValueChange={(_, selected) => {
            onChange(calendarDate(selected));
            if (Platform.OS === "android") setOpen(false);
          }}
        />
      )}
      {!!(open && !disabled && Platform.OS === "ios") && (
        <Button
          title="Valider la date"
          onPress={() => {
            onChange(calendarDate(date));
            setOpen(false);
          }}
        />
      )}
      {!!value && (
        <Button
          secondary
          title="Effacer la date"
          disabled={disabled}
          onPress={() => {
            onChange("");
            setOpen(false);
          }}
        />
      )}
    </View>
  );
}
