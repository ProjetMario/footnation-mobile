import {
  ClubButton as Button,
  useClubUIStyles as useUIStyles,
} from "./ClubDesign";
import { Text, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { ErrorState, Loading } from "./ui";

export function ClubAchievements({
  id,
  legacy,
}: {
  id: string;
  legacy?: unknown;
}) {
  const s = useUIStyles();

  const query = useInfiniteQuery({
    queryKey: ["club-achievements", id],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const r = await supabase
        .from("club_achievements")
        .select("id,title,competition,year,category,description")
        .eq("club_id", id)
        .order("year", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (r.error) throw r.error;
      return r.data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const titles = Array.isArray(legacy)
    ? legacy.filter(
        (title): title is string => typeof title === "string" && !!title.trim(),
      )
    : [];
  const rows = query.data?.pages.flat() || [];
  if (!query.isPending && !query.error && !rows.length && !titles.length)
    return (
      <View style={s.card}>
        <Text style={s.h2}>L’histoire reste à écrire</Text>
        <Text style={s.subtitle}>
          Les titres et distinctions du club apparaîtront ici.
        </Text>
      </View>
    );
  return (
    <View style={s.card}>
      <Text style={s.h2}>Palmarès du club</Text>
      {titles.map((title, index) => (
        <Text key={`${index}:${title}`} style={s.text}>
          {title}
        </Text>
      ))}
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {rows.map((row) => (
        <View key={row.id} style={{ gap: 4, paddingVertical: 8 }}>
          <Text style={s.h2}>{row.title}</Text>
          <Text style={s.subtitle}>
            {[row.year, row.competition, row.category]
              .filter((value) => value !== null && value !== "")
              .join(" · ")}
          </Text>
          {!!row.description && (
            <Text selectable style={s.text}>
              {row.description}
            </Text>
          )}
        </View>
      ))}
      {!!query.hasNextPage && (
        <Button
          secondary
          title="Voir les titres précédents"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </View>
  );
}
