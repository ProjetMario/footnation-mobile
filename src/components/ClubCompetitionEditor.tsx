import { useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Chip, ErrorState, Field, useUIStyles } from "./ui";
import { CalendarDayField } from "./CalendarDayField";
import {
  competitionFields,
  competitionPayload,
  competitionTypes,
} from "../lib/competitionForm";
import { createProContent } from "../lib/proContentSave";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
export function ClubCompetitionEditor({
  clubId,
  initial,
  close,
}: {
  clubId: string;
  initial: Record<string, any>;
  close: () => void;
}) {
  const s = useUIStyles();

  const { session } = useAuth();
  const cache = useQueryClient();
  const [baseline] = useState(initial);
  const [creationId] = useState(randomUUID);
  const [confirm, setConfirm] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      competitionFields.map((key) => [
        key,
        initial[key] ?? (key === "type" ? "championship" : ""),
      ]),
    ),
  );
  const save = useMutation({
    mutationFn: async (remove: boolean) => {
      const user = await supabase.auth.getUser();
      if (user.error) throw user.error;
      if (!user.data.user || user.data.user.id !== session?.user.id)
        throw new Error("La session a changé.");
      const access = await supabase.rpc("is_fff_club_admin", {
        p_club_id: clubId,
      });
      if (access.error) throw access.error;
      if (access.data !== true)
        throw new Error("Administration du club requise.");
      if (baseline.id) {
        let q = remove
          ? supabase.from("club_competitions").delete()
          : supabase
              .from("club_competitions")
              .update(competitionPayload(values));
        q = q.eq("id", baseline.id).eq("club_id", clubId);
        for (const key of competitionFields)
          q =
            baseline[key] == null ? q.is(key, null) : q.eq(key, baseline[key]);
        const r = await q.select("id").maybeSingle();
        if (r.error) throw r.error;
        if (!r.data)
          throw new Error(
            "Cette compétition a changé ou n’est plus accessible. Fermez ce formulaire et actualisez avant de réessayer.",
          );
      } else {
        const row = {
          id: creationId,
          club_id: clubId,
          ...competitionPayload(values),
        };
        await createProContent(
          {
            read: async (id) => {
              const r = await supabase
                .from("club_competitions")
                .select("*")
                .eq("id", id)
                .eq("club_id", clubId)
                .maybeSingle();
              if (r.error) throw r.error;
              return r.data;
            },
            insert: async (row) => {
              const r = await supabase.from("club_competitions").insert(row);
              if (r.error) throw r.error;
            },
          },
          row,
        );
      }
    },
    onSuccess: () => {
      void cache.invalidateQueries({
        queryKey: ["club-native-competitions", clubId],
      });
      void cache.invalidateQueries({
        queryKey: ["club-native-standings", clubId],
      });
      close();
    },
  });
  return (
    <View style={{ gap: 14 }}>
      <Text style={s.h2}>
        {baseline.id ? "Modifier la compétition" : "Nouvelle compétition"}
      </Text>
      {(
        [
          ["name", "Nom"],
          ["category", "Catégorie"],
          ["season", "Saison"],
          ["level", "Niveau"],
          ["external_url", "Site de la compétition"],
        ] as const
      ).map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={values[key]}
          editable={!save.isPending}
          autoCapitalize={key === "external_url" ? "none" : "sentences"}
          onChangeText={(value) =>
            setValues((previous) => ({ ...previous, [key]: value }))
          }
        />
      ))}
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries(competitionTypes).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={values.type === key}
            disabled={save.isPending}
            onPress={() =>
              setValues((previous) => ({ ...previous, type: key }))
            }
          />
        ))}
      </View>
      <CalendarDayField
        label="Début"
        value={values.start_date}
        disabled={save.isPending}
        onChange={(value) =>
          setValues((previous) => ({ ...previous, start_date: value }))
        }
      />
      <CalendarDayField
        label="Fin"
        value={values.end_date}
        disabled={save.isPending}
        onChange={(value) =>
          setValues((previous) => ({ ...previous, end_date: value }))
        }
      />
      {!!save.error && <ErrorState error={save.error} />}
      <Button
        title="Enregistrer"
        busy={save.isPending}
        onPress={() => save.mutate(false)}
      />
      <Button
        title="Fermer le formulaire"
        secondary
        disabled={save.isPending}
        onPress={close}
      />
      {!!baseline.id &&
        (confirm ? (
          <>
            <Text style={s.text}>
              Supprimer cette compétition et toutes les lignes de son classement
              ?
            </Text>
            <Button
              title="Confirmer la suppression"
              busy={save.isPending}
              onPress={() => save.mutate(true)}
            />
            <Button
              title="Annuler la suppression"
              secondary
              disabled={save.isPending}
              onPress={() => setConfirm(false)}
            />
          </>
        ) : (
          <Button
            title="Supprimer la compétition"
            secondary
            disabled={save.isPending}
            onPress={() => setConfirm(true)}
          />
        ))}
    </View>
  );
}
