import React, { useState } from "react";
import { Switch, Text, View } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Chip,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { ChoiceField } from "../components/ChoiceField";
import {
  ages,
  levels,
  positions,
  choices,
  benefits,
} from "../lib/careerOptions";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
const fields = [
  "target_competition_level",
  "target_level",
  "target_position",
  "target_experience",
  "target_age_category",
  "desired_salary",
];
export default function CareerPreferences() {
  return (
    <Screen title="Mes objectifs">
      <AuthGate>
        <Load />
      </AuthGate>
    </Screen>
  );
}
function Load() {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ["native-career-preferences", session!.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,target_competition_level,target_level,target_position,target_experience,target_age_category,desired_salary,desired_benefits,is_open_premium,is_premium",
        )
        .eq("id", session!.user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  return query.isPending ? (
    <Loading />
  ) : query.error ? (
    <ErrorState error={query.error} />
  ) : (
    <Form profile={query.data} />
  );
}
function Form({ profile }: { profile: any }) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((key) => [key, String(profile[key] ?? "")])),
  );
  const [selected, setSelected] = useState<string[]>(
    profile.desired_benefits || [],
  );
  const [open, setOpen] = useState(!!profile.is_open_premium);
  const [success, setSuccess] = useState(false);
  const save = useMutation({
    mutationFn: async () => {
      const current = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", profile.id)
        .single();
      if (current.error) throw current.error;
      const salary = values.desired_salary
        ? Number(values.desired_salary)
        : null;
      if (salary !== null && (!Number.isFinite(salary) || salary < 0))
        throw new Error("Rémunération invalide.");
      const payload: Record<string, any> = {
        ...values,
        desired_salary: salary,
        desired_benefits: selected,
      };
      if (current.data.is_premium) payload.is_open_premium = open;
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", profile.id)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      setSuccess(true);
      void cache.invalidateQueries({
        queryKey: ["native-career-preferences", profile.id],
      });
      void cache.invalidateQueries({ queryKey: ["profile", profile.id] });
    },
  });
  return (
    <>
      <Text style={s.h2}>Quel est ton objectif ?</Text>
      <Text style={s.subtitle}>
        Ces informations serviront au recrutement des clubs, agents et
        entreprises.
      </Text>
      <ChoiceField
        label="Type de club"
        value={values.target_competition_level}
        options={[
          { value: "professional", label: "Professionnel" },
          { value: "amateur", label: "Amateur" },
        ]}
        onChange={(value) =>
          setValues((previous) => ({
            ...previous,
            target_competition_level: value,
          }))
        }
      />
      {(
        [
          ["target_level", "Niveau souhaité", levels],
          ["target_position", "Poste recherché", positions],
          [
            "target_experience",
            "Expérience",
            ["Débutant", "Amateur", "Semi-pro", "Professionnel"],
          ],
          ["target_age_category", "Catégorie d’âge", ages],
        ] as const
      ).map(([key, label, options]) => (
        <ChoiceField
          key={key}
          label={label}
          value={values[key]}
          options={choices([...options])}
          onChange={(value) =>
            setValues((previous) => ({ ...previous, [key]: value }))
          }
        />
      ))}
      <Field
        label="Rémunération souhaitée (€)"
        keyboardType="number-pad"
        value={values.desired_salary}
        onChangeText={(value) =>
          setValues((previous) => ({ ...previous, desired_salary: value }))
        }
      />
      <Text style={s.label}>Avantages souhaités</Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries(benefits).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={selected.includes(key)}
            onPress={() =>
              setSelected((previous) =>
                previous.includes(key)
                  ? previous.filter((v) => v !== key)
                  : [...previous, key],
              )
            }
          />
        ))}
      </View>
      {!!profile.is_premium && (
        <View style={s.between}>
          <Text style={s.text}>Activer le profil OPEN</Text>
          <Switch
            accessibilityLabel="Activer le profil OPEN"
            value={open}
            onValueChange={setOpen}
          />
        </View>
      )}
      {!!save.error && <ErrorState error={save.error} />}
      {!!success && (
        <Text accessibilityRole="alert" style={s.text}>
          Préférences enregistrées.
        </Text>
      )}
      <Button
        title="Enregistrer les préférences"
        busy={save.isPending}
        onPress={() => {
          setSuccess(false);
          save.mutate();
        }}
      />
    </>
  );
}
