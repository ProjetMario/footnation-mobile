import React, { useState } from "react";
import { Platform, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, useUIStyles } from "./ui";
import {
  calendarDate,
  frenchCalendarDate,
  latestAllowedBirthdateDate,
  validBirthdate,
} from "../lib/calendarDate";
import type { BirthdateProps } from "./BirthdateField";
export function BirthdateField({
  value,
  onChange,
  disabled,
  minAge = 13,
  label = "Date de naissance",
}: BirthdateProps) {
  const s = useUIStyles();

  const [open, setOpen] = useState(false);
  const maximumDate = latestAllowedBirthdateDate(new Date(), minAge);
  const date =
    validBirthdate(value) && new Date(`${value}T12:00:00`) <= maximumDate
      ? new Date(`${value}T12:00:00`)
      : latestAllowedBirthdateDate(new Date(), Math.max(minAge, 18));
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <Button
        secondary
        title={
          value ? frenchCalendarDate(value) : "Choisir une date de naissance"
        }
        disabled={disabled}
        onPress={() => setOpen(true)}
      />
      {!!open && (
        <DateTimePicker
          value={date}
          maximumDate={maximumDate}
          mode="date"
          locale="fr-FR"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onDismiss={() => setOpen(false)}
          onValueChange={(_, selected) => {
            if (selected) onChange(calendarDate(selected));
            if (Platform.OS === "android") setOpen(false);
          }}
        />
      )}
      {!!(open && Platform.OS === "ios") && (
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
