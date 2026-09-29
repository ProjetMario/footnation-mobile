import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useTheme } from "../theme";
import { useUIStyles } from "./ui";

function pad(value: number) {
  return String(value).padStart(2, "0");
}
function validDate(value: Date) {
  return Number.isFinite(value.getTime());
}
function dateFromValue(value: string) {
  const date = new Date(value);
  return value && validDate(date) ? date : new Date();
}
function toIso(date: Date) {
  return validDate(date) ? date.toISOString() : "";
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function monthTitle(date: Date) {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}
function shortDate(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function timeText(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const leading = (first.getDay() + 6) % 7;
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: total }, (_, index) => index + 1),
  ];
}
function withDay(base: Date, month: Date, day: number) {
  return new Date(
    month.getFullYear(),
    month.getMonth(),
    day,
    base.getHours(),
    base.getMinutes(),
    0,
    0,
  );
}
function withTime(base: Date, value: string) {
  if (!/^\d{1,2}:\d{2}$/.test(value)) return base;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return base;
  const next = new Date(base);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

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
  const { colors } = useTheme();
  const s = useUIStyles();
  const selected = dateFromValue(value);
  const [month, setMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  const days = useMemo(() => monthDays(month), [month]);

  return (
    <View style={[styles.card, { borderColor: colors.border }]}> 
      <View style={styles.summaryRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.summaryPills}>
          <Text style={styles.pill}>{shortDate(selected)}</Text>
          <TextInput
            accessibilityLabel={`${label} heure`}
            value={timeText(selected)}
            editable={!disabled}
            keyboardType="numbers-and-punctuation"
            onChangeText={(text) => onChange(toIso(withTime(selected, text)))}
            style={[styles.pill, styles.timeInput]}
          />
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.monthRow}>
        <Text style={styles.month}>{monthTitle(month)}</Text>
        <View style={styles.arrows}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mois précédent"
            disabled={disabled}
            onPress={() =>
              setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={30} color="#FF3046" strokeWidth={3} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mois suivant"
            disabled={disabled}
            onPress={() =>
              setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={30} color="#FF3046" strokeWidth={3} />
          </Pressable>
        </View>
      </View>
      <View style={styles.weekRow}>
        {['LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.', 'DIM.'].map((day) => (
          <Text key={day} style={styles.weekday}>{day}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((day, index) => {
          const date = day ? withDay(selected, month, day) : null;
          const active = !!date && sameDay(date, selected);
          return (
            <Pressable
              key={`${index}-${day || 'empty'}`}
              accessibilityRole={day ? "button" : undefined}
              accessibilityLabel={day ? `Choisir le ${day}` : undefined}
              disabled={!day || disabled}
              onPress={() => date && onChange(toIso(date))}
              style={[styles.dayCell, active && styles.dayActive]}
            >
              <Text style={[styles.dayText, active && styles.dayTextActive]}>{day || ''}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={s.small}>Sélectionne le jour dans le calendrier puis ajuste l’heure.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 18,
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    backgroundColor: "#FFFFFF",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  label: { fontSize: 22, fontWeight: "700", color: "#050505" },
  summaryPills: { flexDirection: "row", gap: 10, alignItems: "center" },
  pill: {
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: "#E9E9EB",
    paddingHorizontal: 18,
    paddingVertical: 9,
    fontSize: 20,
    color: "#050505",
  },
  timeInput: { minWidth: 102, textAlign: "center", paddingVertical: 7 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#C9C9C9" },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  month: { fontSize: 25, fontWeight: "800", color: "#050505", textTransform: "capitalize" },
  arrows: { flexDirection: "row", alignItems: "center", gap: 24 },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", color: "#8C8D91", fontSize: 14, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1.1, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  dayActive: { backgroundColor: "#FF3046" },
  dayText: { fontSize: 24, color: "#050505" },
  dayTextActive: { color: "#FFFFFF", fontWeight: "800" },
});
