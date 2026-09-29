import { ClubStandingEditor } from "../components/ClubStandingEditor";
import { ClubCompetitionEditor } from "../components/ClubCompetitionEditor";
import { useAuth } from "../lib/auth";
import { useState } from "react";
import { Text, View } from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  SearchField,
  useUIStyles,
} from "../components/ui";
import { ExternalLinkButton } from "../components/ExternalLinkButton";
import { supabase } from "../lib/supabase";
import { useDebounced } from "../lib/data";
const types: Record<string, string> = {
  championship: "Championnat",
  cup: "Coupe",
  friendly: "Amical",
  tournament: "Tournoi",
};
const dateLabel = (value: string) => value.split("-").reverse().join("/");
export default function ClubCompetitions({ id }: { id: string }) {
  const s = useUIStyles();

  const { session } = useAuth();
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const permission = useQuery({
    queryKey: ["club-competition-edit-access", id, session?.user.id],
    queryFn: async () => {
      const r = await supabase.rpc("is_fff_club_admin", { p_club_id: id });
      if (r.error) throw r.error;
      return r.data === true;
    },
  });
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const [selected, setSelected] = useState<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["club-native-competitions", id, term],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("club_competitions")
        .select(
          "id,name,type,category,season,level,start_date,end_date,external_url,standings:club_competition_standings(count)",
          { count: "exact" },
        )
        .eq("club_id", id)
        .order("season", { ascending: false, nullsFirst: false })
        .order("name")
        .order("id");
      if (term) {
        const value = JSON.stringify(`%${term.replace(/[%_\\]/g, "\\$&")}%`);
        q = q.or(`name.ilike.${value},category.ilike.${value}`);
      }
      const r = await q.range(pageParam, pageParam + 19);
      if (r.error) throw r.error;
      return { rows: r.data, count: r.count || 0 };
    },
    getNextPageParam: (last, pages) =>
      last.rows.length === 20 ? pages.length * 20 : undefined,
  });
  if (editing)
    return (
      <ClubCompetitionEditor
        key={editing.id || "new"}
        clubId={id}
        initial={editing}
        close={() => setEditing(null)}
      />
    );
  return (
    <>
      <Text style={s.h2}>Compétitions du club</Text>
      {!!permission.error && <ErrorState error={permission.error} />}
      {!!permission.data && (
        <Button title="Nouvelle compétition" onPress={() => setEditing({})} />
      )}
      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Nom ou catégorie"
      />
      <Button
        title="Actualiser"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!query.data && (
        <Text style={s.small}>
          {query.data.pages[0].count} compétitions trouvées
        </Text>
      )}
      {query.data?.pages
        .flatMap((page) => page.rows)
        .map((row) => (
          <View key={row.id} style={s.card}>
            <Text style={s.h2}>{row.name}</Text>
            {!!permission.data && (
              <Button
                title="Modifier"
                secondary
                onPress={() => setEditing(row)}
              />
            )}
            <Text style={s.subtitle}>
              {[
                types[row.type] || row.type,
                row.category,
                row.season,
                row.level,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {!!(row.start_date || row.end_date) && (
              <Text style={s.text}>
                {row.start_date ? `Début : ${dateLabel(row.start_date)}` : ""}
                {row.start_date && row.end_date ? " · " : ""}
                {row.end_date ? `Fin : ${dateLabel(row.end_date)}` : ""}
              </Text>
            )}
            <Text style={s.small}>
              {row.standings?.[0]?.count || 0} équipes au classement
            </Text>
            {!!row.external_url && (
              <ExternalLinkButton
                url={row.external_url}
                title="Voir la compétition sur son site"
              />
            )}
            <Button
              secondary
              title={
                selected === row.id
                  ? "Masquer le classement"
                  : "Voir le classement"
              }
              onPress={() => setSelected(selected === row.id ? null : row.id)}
            />
            {selected === row.id && (
              <Standings
                key={row.id}
                clubId={id}
                competitionId={row.id}
                canEdit={permission.data === true}
              />
            )}
          </View>
        ))}
      {!!(
        query.data && !query.data.pages.flatMap((page) => page.rows).length
      ) && (
        <Empty
          title="Aucune compétition trouvée"
          description="Les compétitions renseignées pour ce club apparaîtront ici."
        />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Charger la suite"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
function Standings({
  clubId,
  competitionId,
  canEdit,
}: {
  clubId: string;
  competitionId: string;
  canEdit: boolean;
}) {
  const s = useUIStyles();

  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["club-native-standings", clubId, competitionId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const r = await supabase
        .from("club_competition_standings")
        .select(
          "id,team_name,position,played,wins,draws,losses,goals_for,goals_against,points,is_own_team,updated_at,competition:club_competitions!competition_id!inner(club_id)",
        )
        .eq("competition_id", competitionId)
        .eq("competition.club_id", clubId)
        .order("position", { nullsFirst: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (r.error) throw r.error;
      return r.data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  if (editing)
    return (
      <ClubStandingEditor
        key={editing.id || "new"}
        clubId={clubId}
        competitionId={competitionId}
        initial={editing}
        close={() => setEditing(null)}
      />
    );
  return (
    <View style={{ gap: 12 }}>
      <Button
        title="Actualiser le classement"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {!!canEdit && (
        <Button
          title="Ajouter une équipe au classement"
          onPress={() => setEditing({})}
        />
      )}
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages.flat().map((row) => (
        <View key={row.id} style={{ gap: 4, paddingVertical: 8 }}>
          <Text style={s.h2}>
            {row.position ?? "–"}. {row.team_name}
            {row.is_own_team ? " · Notre équipe" : ""}
          </Text>
          <Text style={s.text}>
            {row.points ?? "–"} pts · {row.played ?? "–"} matchs joués
          </Text>
          <Text style={s.small}>
            V {row.wins ?? "–"} · N {row.draws ?? "–"} · D {row.losses ?? "–"} ·
            Buts {row.goals_for ?? "–"} / {row.goals_against ?? "–"}
          </Text>
          {!!canEdit && (
            <Button
              title="Modifier cette équipe"
              secondary
              onPress={() => setEditing(row)}
            />
          )}
          {!!row.updated_at && (
            <Text style={s.small}>
              Mis à jour le{" "}
              {new Date(row.updated_at).toLocaleDateString("fr-FR")}
            </Text>
          )}
        </View>
      ))}
      {!!(query.data && !query.data.pages.flat().length) && (
        <Empty title="Classement non renseigné" />
      )}
      {!!query.hasNextPage && (
        <Button
          secondary
          title="Suite du classement"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </View>
  );
}
