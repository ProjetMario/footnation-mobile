import React, { useCallback } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Button, ErrorState, Loading, useUIStyles } from "../components/ui";
import { loadClubMembership } from "../lib/clubMembership";
import { loadClubMatchTotals } from "../lib/clubMatchTotals";
export default function ClubMemberStats({
  id,
  uid,
}: {
  id: string;
  uid: string;
}) {
  const s = useUIStyles();

  const query = useQuery({
    queryKey: ["club-member-stats", id, uid],
    queryFn: () =>
      loadClubMatchTotals(id, async () => {
        const access = await loadClubMembership(id, uid);
        if (!access.allowed)
          throw new Error("Vous n’avez plus accès à cet espace membre.");
      }),
  });
  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );
  const totals = query.data;
  return (
    <>
      <Text style={s.h2}>Statistiques du club</Text>
      <Text style={s.small}>
        Toutes catégories et saisons confondues, sur les matchs terminés
        enregistrés dans FootNation.
      </Text>
      <Button
        title="Actualiser"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : totals ? (
        <>
          <View style={[s.row, { flexWrap: "wrap" }]}>
            {(
              [
                ["Matchs terminés", totals.finished],
                ["Matchs avec score exploitable", totals.scored],
                ["Victoires", totals.wins],
                ["Nuls", totals.draws],
                ["Défaites", totals.losses],
                ["Buts marqués", totals.goalsFor],
                ["Buts encaissés", totals.goalsAgainst],
              ] as [string, number][]
            ).map(([label, value]) => (
              <View
                key={label}
                style={[s.card, { minWidth: 140, flexGrow: 1 }]}
              >
                <Text style={s.h2}>{value}</Text>
                <Text style={s.subtitle}>{label}</Text>
              </View>
            ))}
          </View>
          {totals.missing > 0 ? (
            <Text style={s.small}>
              {totals.missing} match(s) terminé(s) avec score ou
              domicile/extérieur incomplet : exclus du bilan des résultats et
              des buts.
            </Text>
          ) : null}
        </>
      ) : null}
    </>
  );
}
