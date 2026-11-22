import React, { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Building2, Check, Globe2, Map, MapPin } from "lucide-react-native";
import { useTheme } from "../theme";
import { useUIStyles } from "./ui";
import { ChoiceField } from "./ChoiceField";
import { ProfileAutocompleteField } from "./ProfileAutocompleteField";
import type { GoalValues } from "../lib/careerGoals";
import {
  careerCountryOptions,
  careerDepartmentOptions,
  careerRegionOptions,
  inferCareerZoneKind,
  selectCareerArea,
  type CareerZoneKind,
} from "../lib/careerZones";

const kinds = [
  { key: "city", label: "Ville", Icon: Building2 },
  { key: "department", label: "Département", Icon: MapPin },
  { key: "region", label: "Région", Icon: Map },
  { key: "country", label: "Pays", Icon: Globe2 },
] as const;

export function CareerZoneField({
  value,
  onChange,
}: {
  value: GoalValues;
  onChange: (next: GoalValues) => void;
}) {
  const { colors } = useTheme();
  const s = useUIStyles();
  const [kind, setKind] = useState<CareerZoneKind>(() =>
    inferCareerZoneKind(value),
  );
  const [selectedKind, setSelectedKind] = useState<CareerZoneKind>(() =>
    inferCareerZoneKind(value),
  );
  const selected = selectedKind === kind ? value.zone : "";
  return (
    <View style={{ gap: 14 }}>
      <Text style={s.label}>Quelle zone recherchez-vous ? (facultatif)</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {kinds.map(({ key, label, Icon }) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: key === kind }}
            {...(Platform.OS === "web" ? { "aria-pressed": key === kind } : {})}
            onPress={() => setKind(key)}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: key === kind ? colors.blue : colors.border,
              backgroundColor:
                key === kind ? colors.accentSoft : colors.surface,
              borderRadius: 14,
              paddingHorizontal: 12,
              minHeight: 46,
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon
              size={17}
              color={key === kind ? colors.deepBlue : colors.muted}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: key === kind ? colors.deepBlue : colors.ink,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {kind === "city" ? (
        <ProfileAutocompleteField
          kind="city"
          label="Ville recherchée"
          value={selected}
          maxLength={200}
          onChange={(zone) => {
            setSelectedKind("city");
            onChange({ ...value, ...selectCareerArea(zone) });
          }}
          onSelect={(item) => {
            setSelectedKind("city");
            onChange({
              ...value,
              zone: item.name,
              zoneCity: item.name,
              zoneDepartment: item.department || "",
            });
          }}
        />
      ) : (
        <ChoiceField
          label={
            kind === "department"
              ? "Département français"
              : kind === "region"
                ? "Région française"
                : "Pays recherché"
          }
          value={selected}
          options={
            kind === "department"
              ? careerDepartmentOptions
              : kind === "region"
                ? careerRegionOptions
                : careerCountryOptions
          }
          optionalLabel="Aucune préférence"
          onChange={(zone) => {
            setSelectedKind(kind);
            onChange({ ...value, ...selectCareerArea(zone) });
          }}
        />
      )}
      <Text style={s.small}>
        {kind === "city"
          ? "Recherchez une ville par son nom ou son code postal."
          : kind === "country"
            ? "Tous les pays et territoires, de A à Z. Utilisez la recherche pour les retrouver rapidement."
            : "France métropolitaine et outre-mer. Recherchez par nom" +
              (kind === "department" ? " ou numéro." : ".")}
      </Text>
      {!!value.zone && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.accentSoft,
          }}
        >
          <Check size={17} color={colors.deepBlue} />
          <Text style={[s.small, { flex: 1, color: colors.deepBlue }]}>
            Zone retenue :{" "}
            {[value.zoneCity || value.zone, value.zoneDepartment]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Effacer la zone recherchée"
            onPress={() => onChange({ ...value, ...selectCareerArea("") })}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ color: colors.deepBlue, fontSize: 12 }}>
              Effacer
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
