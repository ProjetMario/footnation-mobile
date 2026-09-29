import { useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Chip, ErrorState, Field, useUIStyles } from "./ui";
import {
  standingFields,
  standingLabels,
  standingPayload,
} from "../lib/standingForm";
import { createProContent } from "../lib/proContentSave";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
export function ClubStandingEditor({
  clubId,
  competitionId,
  initial,
  close,
}: {
  clubId: string;
  competitionId: string;
  initial: Record<string, any>;
  close: () => void;
}) {
  const s = useUIStyles();

  const { session } = useAuth();
  const cache = useQueryClient();
  const [baseline] = useState(initial);
  const [creationId] = useState(randomUUID);
  const [ownTeam, setOwnTeam] = useState(initial.is_own_team === true);
  const [confirm, setConfirm] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      standingFields.map((key) => [
        key,
        initial[key] == null ? "" : String(initial[key]),
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
      const competition = await supabase
        .from("club_competitions")
        .select("id")
        .eq("id", competitionId)
        .eq("club_id", clubId)
        .maybeSingle();
      if (competition.error) throw competition.error;
      if (!competition.data)
        throw new Error("Compétition introuvable pour ce club.");
      if (baseline.id) {
        let q = remove
          ? supabase.from("club_competition_standings").delete()
          : supabase.from("club_competition_standings").update({
              ...standingPayload(values, ownTeam),
              updated_at: new Date().toISOString(),
            });
        q = q.eq("id", baseline.id).eq("competition_id", competitionId);
        for (const key of standingFields)
          q =
            baseline[key] == null ? q.is(key, null) : q.eq(key, baseline[key]);
        const r = await q.select("id").maybeSingle();
        if (r.error) throw r.error;
        if (!r.data)
          throw new Error(
            "Cette ligne a changé ou n’est plus accessible. Fermez ce formulaire et actualisez avant de réessayer.",
          );
      } else {
        const row = {
          id: creationId,
          competition_id: competitionId,
          ...standingPayload(values, ownTeam),
        };
        await createProContent(
          {
            read: async (id) => {
              const r = await supabase
                .from("club_competition_standings")
                .select("*")
                .eq("id", id)
                .eq("competition_id", competitionId)
                .maybeSingle();
              if (r.error) throw r.error;
              return r.data;
            },
            insert: async (row) => {
              const r = await supabase
                .from("club_competition_standings")
                .insert(row);
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
        {baseline.id
          ? "Modifier l’équipe au classement"
          : "Ajouter une équipe au classement"}
      </Text>
      {Object.entries(standingLabels).map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={values[key]}
          editable={!save.isPending}
          keyboardType={
            key === "team_name" ? "default" : "numbers-and-punctuation"
          }
          onChangeText={(value) =>
            setValues((previous) => ({ ...previous, [key]: value }))
          }
        />
      ))}
      <Text style={s.small}>
        Laissez vide une statistique inconnue. Les points peuvent inclure une
        pénalité.
      </Text>
      <Chip
        label="Notre équipe"
        selected={ownTeam}
        disabled={save.isPending}
        onPress={() => setOwnTeam(!ownTeam)}
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
            <Text style={s.text}>Retirer cette équipe du classement ?</Text>
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
            title="Retirer du classement"
            secondary
            disabled={save.isPending}
            onPress={() => setConfirm(true)}
          />
        ))}
    </View>
  );
}
