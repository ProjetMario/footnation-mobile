import React from "react";
import { Pressable, Text, View } from "react-native";
import { Moon, Sun, Smartphone, Check } from "lucide-react-native";
import { useTheme, type ThemePreference } from "../theme";
import { useUIStyles } from "./ui";
const choices = [
  { value: "system", title: "Automatique", Icon: Smartphone },
  { value: "light", title: "Clair", Icon: Sun },
  { value: "dark", title: "Sombre", Icon: Moon },
] as const;
export function AppearanceSettings() {
  const { colors, preference, setPreference } = useTheme();
  const s = useUIStyles();
  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.h2}>
        Apparence
      </Text>
      <Text style={s.subtitle}>
        Même passion, deux ambiances. Le mode automatique suit le thème de votre
        appareil.
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Thème de l’application"
        style={{ gap: 8 }}
      >
        {choices.map(({ value, title, Icon }) => {
          const selected = preference === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              accessibilityLabel={title}
              onPress={() => setPreference(value as ThemePreference)}
              style={({ pressed }) => [
                s.row,
                {
                  minHeight: 52,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: selected ? colors.blue : colors.border,
                  backgroundColor: selected
                    ? colors.accentSoft
                    : colors.surface,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Icon
                size={21}
                color={selected ? colors.deepBlue : colors.muted}
              />
              <Text
                style={[
                  s.text,
                  { flex: 1, fontWeight: selected ? "600" : "400" },
                ]}
              >
                {title}
              </Text>
              {!!selected && <Check size={20} color={colors.deepBlue} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
