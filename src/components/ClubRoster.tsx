import {
  ClubButton as Button,
  useClubUIStyles as useUIStyles,
  ClubSectionHeading,
} from "./ClubDesign";
import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { searchPattern, useDebounced } from "../lib/data";
import { supabase } from "../lib/supabase";
import {
  Avatar,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  SearchField,
} from "./ui";
type Person = {
  id: string;
  name: string;
  category: string | null;
  position?: string | null;
  jersey_number?: number | null;
  role?: string;
  profile: { id: string; avatar_url: string | null } | null;
};
export function ClubRoster({ id }: { id: string }) {
  const s = useUIStyles();

  const uid = useAuth().session?.user.id;
  const [mode, setMode] = useState<"players" | "staff">("players");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const term = useDebounced(name);
  const categoryTerm = useDebounced(category);
  const query = useInfiniteQuery({
    queryKey: ["club-public-roster", id, uid, mode, term, categoryTerm],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from(mode === "players" ? "club_players" : "club_staff")
        .select(
          mode === "players"
            ? "id,name,category,position,jersey_number,profile:profiles(id,avatar_url)"
            : "id,name,category,role,profile:profiles(id,avatar_url)",
          { count: "exact" },
        )
        .eq("club_id", id)
        .eq("is_active", true);
      if (term) q = q.ilike("name", searchPattern(term));
      if (categoryTerm) q = q.ilike("category", searchPattern(categoryTerm));
      const r = await q
        .order("category", { nullsFirst: false })
        .order("name")
        .order("id")
        .range(pageParam, pageParam + 29)
        .returns<Person[]>();
      if (r.error) throw r.error;
      return { rows: r.data, count: r.count || 0 };
    },
    getNextPageParam: (last, pages) =>
      last.rows.length === 30 ? pages.length * 30 : undefined,
  });
  return (
    <>
      <ClubSectionHeading
        title="L’effectif"
        refresh={() => void query.refetch()}
        busy={query.isFetching}
      />
      <View style={s.row}>
        <Chip
          label="Joueurs"
          selected={mode === "players"}
          onPress={() => setMode("players")}
        />
        <Chip
          label="Staff"
          selected={mode === "staff"}
          onPress={() => setMode("staff")}
        />
      </View>
      <SearchField
        value={name}
        onChangeText={setName}
        placeholder="Rechercher un nom"
      />
      <Field
        label="Filtrer par catégorie"
        placeholder="Seniors, U19, Féminines…"
        value={category}
        onChangeText={setCategory}
      />
      {!!(name || category) && (
        <Button
          title="Effacer les filtres"
          secondary
          onPress={() => {
            setName("");
            setCategory("");
          }}
        />
      )}
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!query.data && (
        <Text style={s.small}>
          {query.data.pages[0].count} {mode === "players" ? "joueur" : "membre"}
          {query.data.pages[0].count > 1 ? "s" : ""}
          {mode === "staff" ? " du staff" : ""} trouvé
          {query.data.pages[0].count > 1 ? "s" : ""}
        </Text>
      )}
      {query.data?.pages
        .flatMap((page) => page.rows)
        .map((person) => (
          <View key={person.id} style={s.card}>
            <View style={s.row}>
              <Avatar name={person.name} uri={person.profile?.avatar_url} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.h2}>{person.name}</Text>
                <Text style={s.subtitle}>
                  {[
                    person.category,
                    person.position || person.role,
                    person.jersey_number != null
                      ? `N° ${person.jersey_number}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </View>
            {!!person.profile?.id && (
              <Button
                title="Voir le profil"
                secondary
                onPress={() => router.push(`/profile/${person.profile!.id}`)}
              />
            )}
          </View>
        ))}
      {!!(
        query.data && !query.data.pages.flatMap((page) => page.rows).length
      ) && (
        <Empty
          title={
            mode === "players"
              ? "Aucun joueur à afficher"
              : "Aucun membre du staff à afficher"
          }
          description={
            term || categoryTerm
              ? "Essayez un autre nom ou une autre catégorie."
              : "L’effectif actif apparaîtra ici lorsqu’il sera renseigné."
          }
        />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Charger la suite de l’effectif"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
