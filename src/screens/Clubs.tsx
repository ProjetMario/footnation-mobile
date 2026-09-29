import { ClubDirectoryMap } from "../components/ClubDirectoryMap";
import { DepartmentCities } from "./CityClubs";
import {
  FRENCH_DEPARTMENTS,
  departmentUrl,
  type FrenchDepartment,
} from "../data/french-departments";
import type { ClubSearchType } from "../lib/clubSearch";
import React, { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, MapPin, SlidersHorizontal } from "lucide-react-native";
import { useClubs } from "../lib/data";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  SearchField,
  useUIStyles,
} from "../components/ui";
import { useTheme } from "../theme";
export default function Clubs({
  centresOnly = false,
  fixedDepartment,
}: { centresOnly?: boolean; fixedDepartment?: FrenchDepartment } = {}) {
  const { colors, mode: themeMode } = useTheme();
  const s = useUIStyles();

  const [search, setSearch] = useState(""),
    [department, setDepartment] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [type, setType] = useState<ClubSearchType>("all");
  const hasFilters = Boolean(search || department || type !== "all");
  const query = useClubs(
    search,
    fixedDepartment?.code || department,
    type,
    centresOnly ? "five_center" : undefined,
  );
  return (
    <Screen
      title={
        fixedDepartment
          ? `${fixedDepartment.name} (${fixedDepartment.code})`
          : centresOnly
            ? "Centres de foot à 5"
            : "Clubs"
      }
      back
      scroll={false}
    >
      <FlatList
        data={query.data?.pages.flatMap((p) => p.rows) || []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        indicatorStyle={themeMode === "dark" ? "white" : "black"}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <View style={{ gap: 5 }}>
              <Text style={[s.h2, { fontSize: 26 }]}>
                {fixedDepartment
                  ? `Clubs de ${fixedDepartment.name}`
                  : centresOnly
                    ? "Centres de foot à 5"
                    : "Trouver un club"}
              </Text>
              <Text style={s.small}>
                {fixedDepartment
                  ? `${fixedDepartment.region} · département ${fixedDepartment.code}`
                  : "Recherche par nom, ville ou département."}
              </Text>
            </View>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder="Nom du club ou ville"
            />
            {!centresOnly && (
              <View style={[s.row, { flexWrap: "wrap", gap: 8 }]}>
                {(
                  [
                    ["all", "Tous"],
                    ["club", "Clubs"],
                    ["five_center", "Indoor"],
                  ] as const
                ).map(([value, label]) => (
                  <Chip
                    key={value}
                    label={label}
                    selected={type === value}
                    onPress={() => setType(value)}
                  />
                ))}
              </View>
            )}
            {!fixedDepartment && (
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "flex-end",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Field
                    label="Département"
                    placeholder="Ex. 73, 75, 2A"
                    value={department}
                    onChangeText={(v) => setDepartment(v.trim().toUpperCase())}
                    maxLength={3}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choisir un département"
                  onPress={() => router.push("/clubs-departement")}
                  style={({ pressed }) => ({
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <SlidersHorizontal size={22} color={colors.blue} />
                </Pressable>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Chip
                label="Liste"
                selected={!showMap}
                onPress={() => setShowMap(false)}
              />
              <Chip
                label="Carte"
                selected={showMap}
                onPress={() => setShowMap(true)}
              />
            </View>
            <ClubDirectoryMap
              showMap={showMap}
              search={search}
              department={fixedDepartment?.code || department}
              type={centresOnly ? "five_center" : type}
            />
            {!!fixedDepartment && (
              <DepartmentCities code={fixedDepartment.code} />
            )}
            {!!fixedDepartment && (
              <View style={[s.row, { flexWrap: "wrap" }]}>
                {FRENCH_DEPARTMENTS.filter(
                  (d) =>
                    d.regionSlug === fixedDepartment.regionSlug &&
                    d.code !== fixedDepartment.code,
                ).map((d) => (
                  <Chip
                    key={d.code}
                    label={`${d.name} (${d.code})`}
                    onPress={() => router.push(departmentUrl(d))}
                  />
                ))}
              </View>
            )}
            <Text style={s.h2}>
              {hasFilters ? "Résultats de recherche" : "Tous les clubs"}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Text style={s.small}>
                {query.data
                  ? `${query.data.pages[0].count.toLocaleString("fr-FR")} résultat${query.data.pages[0].count > 1 ? "s" : ""}`
                  : "Recherche"}
              </Text>
              {hasFilters && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Réinitialiser les filtres"
                  onPress={() => {
                    setSearch("");
                    setDepartment("");
                    setType("all");
                  }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Text style={{ color: colors.blue, fontWeight: "800" }}>
                    Effacer
                  </Text>
                </Pressable>
              )}
            </View>
            {!!(query.error && query.data) && (
              <ErrorState
                error={query.error}
                retry={() => void query.refetch()}
              />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/club/${item.id}`)}
            style={({ pressed }) => [
              s.card,
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 13,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${item.short_name || item.name}. ${[item.city, item.department_code].filter(Boolean).join(" · ")}`}
            accessibilityHint="Ouvre la fiche du club."
          >
            <Avatar uri={item.logo_url} name={item.short_name || item.name} />
            <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
              <Text style={[s.text, { fontWeight: "700" }]}>
                {item.short_name || item.name}
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <MapPin size={14} color={colors.muted} />
                <Text style={s.small} numberOfLines={1}>
                  {[
                    item.city,
                    item.department_name || item.department_code,
                    item.type === "five_center" ? "Indoor" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "France"}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.blue} />
          </Pressable>
        )}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage && !query.isError)
            void query.fetchNextPage();
        }}
        ListEmptyComponent={
          query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : (
            <Empty
              title={centresOnly ? "Aucun centre trouvé" : "Aucun club trouvé"}
              description="Essayez un autre nom ou un autre département."
            />
          )
        }
        ListFooterComponent={
          query.hasNextPage ? (
            <Button
              secondary
              title="Afficher davantage"
              busy={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          ) : null
        }
      />
    </Screen>
  );
}
