import React from "react";
import { Platform, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Chip, useUIStyles } from "./ui";
import { useTheme } from "../theme";
import {
  normalizeStoryFilters,
  storyFilterKeyboardValue,
  STORY_FILTER_PRESETS,
  type StoryFilters,
} from "../lib/storyFilters";
export function StoryFilterEditor({
  value,
  onChange,
  disabled,
}: {
  value: StoryFilters;
  onChange(value: StoryFilters): void;
  disabled: boolean;
}) {
  const s = useUIStyles(),
    { colors } = useTheme();
  return (
    <View style={s.card}>
      <Text style={s.h2}>Personnaliser la photo</Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {STORY_FILTER_PRESETS.map((preset) => (
          <Chip
            key={preset.name}
            label={preset.name}
            selected={Object.keys(value).every(
              (key) =>
                value[key as keyof StoryFilters] ===
                preset.value[key as keyof StoryFilters],
            )}
            disabled={disabled}
            onPress={() => onChange({ ...preset.value })}
          />
        ))}
      </View>
      {(
        [
          ["brightness", "Luminosité"],
          ["contrast", "Contraste"],
          ["saturation", "Saturation"],
        ] as const
      ).map(([key, label]) => (
        <View key={key}>
          <Text style={s.text}>
            {label} · {value[key]} %
          </Text>
          <Slider
            accessibilityLabel={label}
            aria-valuemin={0}
            aria-valuemax={200}
            aria-valuenow={value[key]}
            aria-valuetext={`${value[key]} %`}
            tabIndex={disabled ? -1 : 0}
            {...(Platform.OS === "web"
              ? {
                  onKeyDown: (event: {
                    key: string;
                    preventDefault(): void;
                  }) => {
                    if (disabled) return;
                    const next = storyFilterKeyboardValue(
                      value[key],
                      event.key,
                    );
                    if (next !== null) {
                      event.preventDefault();
                      onChange({ ...value, [key]: next });
                    }
                  },
                }
              : {})}
            accessibilityValue={{
              min: 0,
              max: 200,
              now: value[key],
              text: `${value[key]} %`,
            }}
            minimumValue={0}
            maximumValue={200}
            step={1}
            value={value[key]}
            disabled={disabled}
            minimumTrackTintColor={colors.deepBlue}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.deepBlue}
            style={{ minHeight: 44 }}
            onValueChange={(number) =>
              onChange(normalizeStoryFilters({ ...value, [key]: number }))
            }
          />
        </View>
      ))}
    </View>
  );
}
