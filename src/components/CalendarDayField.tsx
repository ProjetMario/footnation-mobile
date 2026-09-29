import { useRef } from "react";
import { Text, View } from "react-native";
import { Button, useUIStyles } from "./ui";
import {
  calendarDate,
  relativeCalendarDate,
  validCalendarDate,
} from "../lib/calendarDate";
export type CalendarDayProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};
export function CalendarDayField({
  label,
  value,
  onChange,
  disabled,
}: CalendarDayProps) {
  const s = useUIStyles();
  const inputRef = useRef<HTMLInputElement>(null);
  const displayDate = validCalendarDate(value)
    ? new Date(`${value}T12:00:00`).toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Choisir une date";
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <input
        ref={inputRef}
        aria-label={label}
        type="date"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          width: 1,
          height: 1,
        }}
      />
      <Button
        secondary
        title={displayDate}
        disabled={disabled}
        accessibilityLabel={`${label} : ${displayDate}`}
        onPress={() => {
          const input = inputRef.current;
          if (!input) return;
          input.focus();
          try {
            if (input.showPicker) input.showPicker();
            else input.click();
          } catch {
            input.click();
          }
        }}
      />
      <View style={s.row}>
        <Button
          secondary
          title="Hier"
          disabled={disabled}
          onPress={() => onChange(relativeCalendarDate(-1))}
        />
        <Button
          secondary
          title="Aujourd’hui"
          disabled={disabled}
          onPress={() => onChange(calendarDate(new Date()))}
        />
        <Button
          secondary
          title="Demain"
          disabled={disabled}
          onPress={() => onChange(relativeCalendarDate(1))}
        />
      </View>
    </View>
  );
}
