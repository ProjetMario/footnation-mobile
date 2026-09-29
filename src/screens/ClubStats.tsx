import { loadClubMatchTotals } from "../lib/clubMatchTotals";
import React from "react";
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, Loading, useUIStyles } from "../components/ui";
import { supabase } from "../lib/supabase";
import { requireClubAdmin } from "../lib/clubAccess";
export default function ClubStats({ id }: { id: string }) {
  const s = useUIStyles();

  const query = useQuery({
    queryKey: ["club-native-stats", id],
    queryFn: async () => {
      const totals = await loadClubMatchTotals(id, () => requireClubAdmin(id));
      const members = await supabase
        .from("club_players")
        .select("id", { head: true, count: "exact" })
        .eq("club_id", id)
        .eq("is_active", true);
      if (members.error) throw members.error;
      return [
        ["Matchs avec score", totals.scored],
        ["Victoires", totals.wins],
        ["Nuls", totals.draws],
        ["Défaites", totals.losses],
        ["Buts marqués", totals.goalsFor],
        ["Buts encaissés", totals.goalsAgainst],
        ["Joueurs actifs", members.count ?? 0],
      ] as [string, number][];
    },
  });
  return query.isPending ? (
    <Loading />
  ) : query.error ? (
    <ErrorState error={query.error} retry={() => void query.refetch()} />
  ) : (
    <>
      <Text style={s.h2}>Performances du club</Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {query.data.map(([label, value]) => (
          <View style={[s.card, { minWidth: 140, flexGrow: 1 }]} key={label}>
            <Text style={s.h2}>{value}</Text>
            <Text style={s.subtitle}>{label}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
