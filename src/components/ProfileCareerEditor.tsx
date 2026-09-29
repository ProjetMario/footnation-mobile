import React, { useState } from "react";
import { Modal, Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import type { Profile } from "../lib/models";
import {
  achievementDraft,
  saveProfileAchievements,
  updateAchievementList,
  type AchievementDraft,
} from "../lib/profileCareerEdit";
import { formatAchievement } from "../lib/cv";
import { ages, choices } from "../lib/careerOptions";
import { ExperienceContent } from "../screens/Experience";
import { Button, Chip, Field, Screen, useUIStyles } from "./ui";
import { ChoiceField } from "./ChoiceField";
import { ProfileAutocompleteField } from "./ProfileAutocompleteField";
export function ProfileCareerEditor({
  profile,
  mode,
  onClose,
}: {
  profile: Profile;
  mode: "career" | "achievements";
  onClose: () => void;
}) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <Screen
        title={
          mode === "career"
            ? "Parcours et expériences"
            : "Palmarès et distinctions"
        }
        back={false}
        right={<Button title="Fermer" secondary onPress={onClose} />}
      >
        {mode === "career" ? (
          <ExperienceContent />
        ) : (
          <AchievementEditor profile={profile} />
        )}
      </Screen>
    </Modal>
  );
}
function AchievementEditor({ profile }: { profile: Profile }) {
  const s = useUIStyles();
  const cache = useQueryClient();
  const { reload } = useAuth();
  const [baseline, setBaseline] = useState(profile);
  const [key, setKey] = useState<"achievements" | "individual_awards">(
    "achievements",
  );
  const [editing, setEditing] = useState<number | null | undefined>(undefined);
  const [draft, setDraft] = useState<AchievementDraft>(() =>
    achievementDraft(),
  );
  const save = useMutation({
    mutationFn: () =>
      saveProfileAchievements(
        baseline,
        key,
        updateAchievementList(baseline[key], editing ?? null, draft),
      ),
    onSuccess: (saved) => {
      setBaseline(saved);
      setEditing(undefined);
      cache.setQueriesData<Profile>({ queryKey: ["profile"] }, (old) =>
        old?.id === saved.id ? { ...old, ...saved } : old,
      );
      void cache.invalidateQueries({ queryKey: ["profile"] });
      void reload();
    },
  });
  const change = (field: keyof AchievementDraft, value: string) => {
    setDraft((v) => ({ ...v, [field]: value }));
    save.reset();
  };
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(
          [
            ["achievements", "Titres collectifs"],
            ["individual_awards", "Distinctions individuelles"],
          ] as const
        ).map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={key === value}
            disabled={save.isPending}
            onPress={() => {
              setKey(value);
              setEditing(undefined);
              save.reset();
            }}
          />
        ))}
      </View>
      {editing !== undefined ? (
        <View style={[s.card, { gap: 16 }]}>
          <Field
            label={key === "achievements" ? "Titre remporté" : "Distinction"}
            value={draft.title}
            onChangeText={(text) => change("title", text)}
            editable={!save.isPending}
            maxLength={300}
            placeholder={
              key === "achievements"
                ? "Ex. Champion départemental"
                : "Ex. Meilleur buteur"
            }
          />
          <ProfileAutocompleteField
            kind="club"
            label="Club"
            value={draft.club}
            onChange={(text) => change("club", text)}
            disabled={save.isPending}
          />
          <ChoiceField
            label="Catégorie"
            value={draft.ageCategory}
            options={choices(ages)}
            onChange={(text) => change("ageCategory", text)}
            disabled={save.isPending}
            optionalLabel="Non renseigné"
          />
          <ChoiceField
            label="Année"
            value={draft.year}
            options={choices(
              Array.from({ length: new Date().getFullYear() - 1899 }, (_, i) =>
                String(new Date().getFullYear() - i),
              ),
            )}
            onChange={(text) => change("year", text)}
            disabled={save.isPending}
            optionalLabel="Non renseigné"
          />
          {!!save.error && (
            <Text accessibilityRole="alert" style={s.small}>
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
            onPress={() => {
              setEditing(undefined);
              save.reset();
            }}
          />
        </View>
      ) : (
        <>
          <Button
            title={
              key === "achievements"
                ? "Ajouter un titre"
                : "Ajouter une distinction"
            }
            onPress={() => {
              setDraft({
                ...achievementDraft(),
                club: profile.club || "",
                year: String(new Date().getFullYear()),
              });
              setEditing(null);
            }}
          />
          {!(baseline[key] || []).length && (
            <Text style={s.small}>
              Ajoutez vos réussites et les moments marquants de votre parcours.
            </Text>
          )}
          {(baseline[key] || []).map((value, index) => (
            <View key={index} style={[s.card, { gap: 12 }]}>
              <Text style={s.text}>{formatAchievement(value)}</Text>
              <Button
                title="Modifier"
                secondary
                onPress={() => {
                  setDraft(achievementDraft(value));
                  setEditing(index);
                  save.reset();
                }}
              />
            </View>
          ))}
        </>
      )}
    </View>
  );
}
