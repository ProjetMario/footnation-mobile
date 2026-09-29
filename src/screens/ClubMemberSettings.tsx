import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  useUIStyles,
} from "../components/ui";
import { loadClubMembership, type TeamMembership } from "../lib/clubMembership";
import { supabase } from "../lib/supabase";
export default function ClubMemberSettings({
  id,
  uid,
}: {
  id: string;
  uid: string;
}) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const [selection, setSelection] = useState<TeamMembership | null>(null);
  const query = useQuery({
    queryKey: ["club-member-settings", id, uid],
    queryFn: () => loadClubMembership(id, uid),
  });
  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );
  const mutation = useMutation({
    mutationFn: async (member: TeamMembership) => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (auth.data.user?.id !== uid)
        throw new Error("La session a changé. Rechargez cet écran.");
      const result = await supabase.rpc("leave_native_team", {
        p_club_id: id,
        p_membership_id: member.id,
        p_expected_updated_at: member.updated_at,
      });
      if (result.error) {
        if (result.error.code === "40001")
          throw new Error(
            "L’affectation a changé. Annulez puis actualisez avant de confirmer à nouveau.",
          );
        throw result.error;
      }
    },
    onSuccess: () => {
      setSelection(null);
      void cache.invalidateQueries();
      router.replace(`/club/${id}`);
    },
  });
  return (
    <>
      <Text style={s.h2}>Mes appartenances</Text>
      <Text style={s.small}>
        Quitter une équipe désactive votre affectation à cette équipe. Vos
        autres équipes et le rattachement de votre profil au club restent
        inchangés.
      </Text>
      <Button
        title="Actualiser"
        secondary
        busy={query.isFetching}
        disabled={mutation.isPending}
        onPress={() => {
          setSelection(null);
          mutation.reset();
          void query.refetch();
        }}
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data?.memberships.length && (
            <Empty title="Aucune équipe à quitter" />
          )}
          {query.data?.memberships.map((member) => (
            <View key={member.id} style={s.card}>
              <Text style={s.h2}>{member.team.name}</Text>
              <Text style={s.small}>
                {member.team.category}
                {member.is_primary ? " · Équipe principale" : ""}
              </Text>
              <Button
                secondary
                title="Quitter cette équipe"
                disabled={mutation.isPending || !!selection}
                onPress={() => {
                  mutation.reset();
                  setSelection(member);
                }}
              />
            </View>
          ))}
        </>
      )}
      {!!selection && (
        <View style={s.card}>
          <Text style={s.h2}>Quitter {selection.team.name} ?</Text>
          <Text style={s.text}>
            Vous devrez contacter un responsable pour être ajouté à nouveau à
            cette équipe.
          </Text>
          {!!mutation.error && <ErrorState error={mutation.error} />}
          <Button
            title={
              mutation.error
                ? "Réessayer la même demande"
                : "Confirmer mon départ"
            }
            busy={mutation.isPending}
            onPress={() => mutation.mutate(selection)}
          />
          <Button
            secondary
            title="Annuler"
            disabled={mutation.isPending}
            onPress={() => {
              setSelection(null);
              mutation.reset();
              void query.refetch();
            }}
          />
        </View>
      )}
    </>
  );
}
