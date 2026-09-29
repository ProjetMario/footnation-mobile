import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useTheme } from "../theme";
import type { Profile } from "../lib/models";
import {
  type EditableProfileField,
  inlineProfileValues,
  saveInlineProfile,
} from "../lib/profileInlineEdit";
import { roleOptions, departmentOptions } from "../lib/networkOptions";
import {
  genderOptions,
  levelOptions,
  businessSectorOptions,
  institutionTypeOptions,
  institutionLevelOptions,
  positionOptions,
  technicalSkillSuggestions,
  competenceSuggestions,
  characteristicSuggestions,
} from "../lib/profileOptions";
import { Button, Chip, Field, useUIStyles } from "./ui";
import { ProfileAutocompleteField } from "./ProfileAutocompleteField";
import { BirthdateField } from "./BirthdateField";
import { countryOptions, proClubOptions } from "../lib/profileSelectionOptions";
import { highestLevelDraft, saveHighestLevel } from "../lib/profileCareerEdit";
import { ages, choices as careerChoices } from "../lib/careerOptions";
import { ChoiceField } from "./ChoiceField";
const choices: Record<string, { value: string; label: string }[]> = {
  primary_role: roleOptions,
  favorite_pro_club: proClubOptions,
  skills: competenceSuggestions.map((value) => ({ value, label: value })),
  secondary_roles: roleOptions,
  position: positionOptions,
  secondary_positions: positionOptions,
  country: countryOptions,
  nationality: countryOptions,
  department: departmentOptions,
  gender: genderOptions,
  highest_level: levelOptions.map((value) => ({ value, label: value })),
  business_sector: businessSectorOptions,
  institution_type: institutionTypeOptions,
  institution_level: institutionLevelOptions,
  strong_foot: ["Droit", "Gauche", "Les deux"].map((value) => ({
    value,
    label: value,
  })),
};
export function InlineProfileEditor({
  profile,
  field,
  onClose,
}: {
  profile: Profile;
  field: EditableProfileField;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const s = useUIStyles();
  const { reload } = useAuth();
  const cache = useQueryClient();
  const [values, setValues] = useState(() =>
    field.label === "Plus haut niveau"
      ? { highest_level: highestLevelDraft(profile).level }
      : inlineProfileValues(profile, field),
  );
  const [highest, setHighest] = useState(() => highestLevelDraft(profile));
  const isHighest = field.label === "Plus haut niveau";
  const save = useMutation({
    mutationFn: () =>
      isHighest
        ? saveHighestLevel(profile, { ...highest, level: values.highest_level })
        : saveInlineProfile(profile, field, values),
    onSuccess: async (saved) => {
      cache.setQueriesData<Profile>({ queryKey: ["profile"] }, (old) =>
        old?.id === saved.id ? { ...old, ...saved } : old,
      );
      void cache.invalidateQueries({ queryKey: ["profile"] });
      void cache.invalidateQueries({
        queryKey: ["native-experience", profile.id],
      });
      void cache.invalidateQueries({ queryKey: ["explore-featured-v2"] });
      void reload();
      onClose();
    },
  });
  const change = (key: string, value: string) => {
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (key === "city") delete next.department;
      return next;
    });
    save.reset();
  };
  const suggestions =
    field.keys[0] === "technical_skills"
      ? technicalSkillSuggestions
      : field.keys[0] === "characteristics"
        ? characteristicSuggestions
        : [];
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!save.isPending) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          backgroundColor: "rgba(4,13,25,0.55)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 520,
            alignSelf: "center",
            maxHeight: "85%",
            backgroundColor: colors.surface,
            borderRadius: 24,
            padding: 20,
            gap: 18,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text accessibilityRole="header" style={s.h2}>
              Modifier · {field.label}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer l’édition"
              disabled={save.isPending}
              onPress={onClose}
              style={{ padding: 10 }}
            >
              <X size={22} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16 }}
          >
            {field.keys.map((key) =>
              key === "birthdate" ? (
                <BirthdateField
                  key={key}
                  label="Date de naissance"
                  value={values[key]}
                  disabled={save.isPending}
                  minAge={13}
                  onChange={(value) => change(key, value)}
                />
              ) : ["city", "club", "favorite_amateur_club"].includes(key) ? (
                <ProfileAutocompleteField
                  key={key}
                  kind={key === "city" ? "city" : "club"}
                  label={field.label}
                  value={values[key]}
                  disabled={save.isPending}
                  country={profile.country}
                  onChange={(text) => change(key, text)}
                  onSelect={(item) => {
                    if (key === "city" && item.department)
                      setValues((v) => ({
                        ...v,
                        department: item.department!,
                      }));
                  }}
                />
              ) : choices[key] ? (
                <ChoiceField
                  key={key}
                  label={field.label}
                  value={values[key]}
                  options={choices[key]}
                  multiple={field.array}
                  allowCustom={key === "skills"}
                  optionalLabel="Non renseigné"
                  disabled={save.isPending}
                  onChange={(value) => {
                    setValues((v) => ({ ...v, [key]: value }));
                    save.reset();
                  }}
                />
              ) : (
                <Field
                  key={key}
                  label={
                    key === "first_name"
                      ? "Prénom"
                      : key === "last_name"
                        ? "Nom de famille"
                        : field.label
                  }
                  value={values[key]}
                  onChangeText={(value) => {
                    setValues((v) => ({ ...v, [key]: value }));
                    save.reset();
                  }}
                  editable={!save.isPending}
                  multiline={field.multiline || field.array}
                  maxLength={field.multiline ? 2000 : 200}
                  autoCapitalize={key === "username" ? "none" : "sentences"}
                  keyboardType={
                    key === "height" || key === "weight"
                      ? "decimal-pad"
                      : "default"
                  }
                />
              ),
            )}
            {isHighest && (
              <View style={{ gap: 16 }}>
                <ProfileAutocompleteField
                  kind="club"
                  label="Club où ce niveau a été atteint"
                  value={highest.club}
                  disabled={save.isPending}
                  onChange={(club) => {
                    setHighest((v) => ({ ...v, club, clubId: undefined }));
                    save.reset();
                  }}
                  onSelect={(item) =>
                    setHighest((v) => ({
                      ...v,
                      club: item.name,
                      clubId: item.id,
                    }))
                  }
                />
                <ChoiceField
                  label="Catégorie"
                  value={highest.category}
                  options={careerChoices(ages)}
                  optional={false}
                  disabled={save.isPending}
                  onChange={(category) => {
                    setHighest((v) => ({ ...v, category }));
                    save.reset();
                  }}
                />
                <ChoiceField
                  label="Année"
                  value={highest.year}
                  options={careerChoices(
                    Array.from(
                      { length: new Date().getFullYear() - 1899 },
                      (_, i) => String(new Date().getFullYear() - i),
                    ),
                  )}
                  optional={false}
                  disabled={save.isPending}
                  onChange={(year) => {
                    setHighest((v) => ({ ...v, year }));
                    save.reset();
                  }}
                />
              </View>
            )}
            {!!values.department && field.keys[0] === "city" && (
              <Text style={s.small}>
                Département associé : {values.department}
              </Text>
            )}
            {!!suggestions.length && (
              <View style={{ gap: 8 }}>
                <Text style={s.small}>Suggestions</Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                >
                  {suggestions.map((text) => {
                    const key = field.keys[0];
                    const items = values[key]
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean);
                    return (
                      <Chip
                        key={text}
                        label={text}
                        selected={items.includes(text)}
                        onPress={() => {
                          if (!save.isPending)
                            change(
                              key,
                              (items.includes(text)
                                ? items.filter((v) => v !== text)
                                : [...items, text]
                              ).join(", "),
                            );
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            )}
            {field.array && !choices[field.keys[0]] && (
              <Text style={s.small}>Séparez les éléments par une virgule.</Text>
            )}
            {(field.keys[0] === "height" || field.keys[0] === "weight") && (
              <Text style={s.small}>
                {field.keys[0] === "height"
                  ? "Taille en centimètres."
                  : "Poids en kilogrammes."}
              </Text>
            )}
            {!!save.error && (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {save.error.message}
              </Text>
            )}
            <Button
              title="Enregistrer"
              busy={save.isPending}
              onPress={() => save.mutate()}
            />
            <Button
              title="Annuler"
              secondary
              disabled={save.isPending}
              onPress={onClose}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
