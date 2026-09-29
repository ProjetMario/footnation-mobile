import React, { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getDepartmentByCode, departmentUrl } from "../data/french-departments";
import { cityUrl, parseCityDeptUrl } from "../lib/citySlug";
import { loadDepartmentCityClubs } from "../lib/cityClubs";
import {
  Avatar,
  Banner,
  Button,
  Chip,
  Empty,
  ErrorState,
  Loading,
  MenuRow,
  Screen,
  SearchField,
  useUIStyles,
} from "../components/ui";
function useCities(code: string) {
  return useQuery({
    queryKey: ["department-city-clubs", code],
    queryFn: () => loadDepartmentCityClubs(code),
  });
}
export function DepartmentCities({ code }: { code: string }) {
  const s = useUIStyles();

  const query = useCities(code);
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.h2}>Villes du département</Text>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <View style={[s.row, { flexWrap: "wrap" }]}>
          {query.data.slice(0, 12).map((city) => (
            <Chip
              key={city.slug}
              label={`${city.name} (${city.clubs.length})`}
              onPress={() => router.push(cityUrl(city.name, code))}
            />
          ))}
        </View>
      )}
    </View>
  );
}
export default function CityClubs() {
  const { combined } = useLocalSearchParams<{ combined: string }>();
  const parsed = parseCityDeptUrl(combined || "");
  const dept = parsed ? getDepartmentByCode(parsed.deptCode) : undefined;
  if (!parsed || !dept)
    return (
      <Screen title="Ville introuvable">
        <Empty title="Ce lien de ville n’est pas reconnu" />
        <Button
          title="Choisir un département"
          onPress={() => router.replace("/clubs-departement")}
        />
      </Screen>
    );
  return (
    <CityResults
      key={`${dept.code}:${parsed.citySlug}`}
      code={dept.code}
      slug={parsed.citySlug}
    />
  );
}
function CityResults({ code, slug }: { code: string; slug: string }) {
  const s = useUIStyles();

  const query = useCities(code);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(30);
  const city = query.data?.find((c) => c.slug === slug);
  const term = search.trim().toLocaleLowerCase("fr-FR");
  const rows = (city?.clubs || []).filter((c) =>
    c.name.toLocaleLowerCase("fr-FR").includes(term),
  );
  const dept = getDepartmentByCode(code)!;
  return (
    <Screen
      title={city ? `${city.name} (${code})` : "Clubs par ville"}
      scroll={false}
    >
      <FlatList
        data={query.error ? [] : rows.slice(0, limit)}
        keyExtractor={(r) => r.id}
        contentContainerStyle={s.content}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <Banner
              eyebrow={`${dept.name} · ${code}`}
              title={`Clubs de football · ${city?.name || slug.replace(/-/g, " ")}`}
              description="Équipes, entraînements, contact et inscriptions sur FootNation."
            />
            <Button
              secondary
              title={`Voir les clubs du département ${code}`}
              onPress={() => router.push(departmentUrl(dept))}
            />
            <SearchField
              value={search}
              onChangeText={(v) => {
                setSearch(v);
                setLimit(30);
              }}
              placeholder="Rechercher un club dans cette ville"
            />
            {!!(query.data && !query.error) && (
              <Text style={s.small}>{rows.length} club(s) trouvé(s)</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Avatar uri={item.logo_url} name={item.name} />
              <View style={{ flex: 1 }}>
                <MenuRow
                  title={item.name}
                  subtitle={item.city || ""}
                  onPress={() => router.push(`/club/${item.id}`)}
                />
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          query.isPending ? (
            <Loading />
          ) : query.error ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : (
            <Empty
              title="Aucun club trouvé dans cette ville"
              description="Essayez un autre nom ou consultez les clubs du département."
            />
          )
        }
        ListFooterComponent={
          <View style={{ gap: 12 }}>
            {!!(limit < rows.length && !query.error) ? (
              <Button
                secondary
                title="Afficher davantage"
                onPress={() => setLimit((v) => v + 30)}
              />
            ) : null}
            {!!(query.data && !query.error) && (
              <>
                <Text style={s.h2}>Autres villes du département</Text>
                <View style={[s.row, { flexWrap: "wrap" }]}>
                  {query.data
                    .filter((c) => c.slug !== slug)
                    .slice(0, 8)
                    .map((c) => (
                      <Chip
                        key={c.slug}
                        label={`${c.name} (${c.clubs.length})`}
                        onPress={() => router.push(cityUrl(c.name, code))}
                      />
                    ))}
                </View>
              </>
            )}
          </View>
        }
      />
    </Screen>
  );
}
