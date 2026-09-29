import { ChoiceField } from "../components/ChoiceField";
import { roleOptions, departmentOptions } from "../lib/networkOptions";
import React, { useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ChevronRight, SlidersHorizontal } from "lucide-react-native";
import { router } from "expo-router";
import { usePeople, useConnections } from "../lib/data";
import { displayName } from "../lib/models";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  ErrorState,
  Loading,
  Screen,
  SearchField,
  useUIStyles,
} from "../components/ui";
import { AuthGate } from "../components/AuthGate";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
export default function Network() {
  const { colors } = useTheme();
  const s = useUIStyles();
  const networkStyles = useThemedStyles(createNetworkStyles);

  const [search, setSearch] = useState(""),
    [tab, setTab] = useState("discover");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = Number(!!role) + Number(!!department);
  const people = usePeople(search, role, department);
  const connections = useConnections(
    tab === "pending" ? "pending" : tab === "sent" ? "sent" : "connections",
    search,
  );
  const profileRows =
    tab === "discover"
      ? people.data?.pages.flatMap((page) => page.rows) || []
      : (connections.data?.pages.flat() || []).map((p) => ({
          id: p.other_profile_id,
          full_name: p.other_full_name,
          username: p.other_username,
          avatar_url: p.other_avatar_url,
          position: p.other_position,
          club: p.other_club,
          city: undefined,
          primary_role: undefined,
        }));
  const profiles = [...new Map(profileRows.map((p) => [p.id, p])).values()];
  const query = tab === "discover" ? people : connections;
  return (
    <Screen title="Mon réseau" back={false} scroll={false}>
      <AuthGate>
        <FlatList
          data={profiles}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[s.content, networkStyles.list]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          ListHeaderComponent={
            <View style={networkStyles.header}>
              <Text accessibilityRole="header" style={s.title}>
                Le talent se partage.
              </Text>
              <Text style={s.subtitle}>
                Joueurs, éducateurs, bénévoles et fans : retrouvez votre
                communauté football.
              </Text>
              <ScrollView
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {[
                  ["discover", "Découvrir"],
                  ["connections", "Relations"],
                  ["pending", "Invitations"],
                  ["sent", "Envoyées"],
                ].map(([id, label]) => (
                  <Chip
                    key={id}
                    label={label}
                    selected={tab === id}
                    onPress={() => setTab(id)}
                  />
                ))}
              </ScrollView>
              <View style={networkStyles.searchRow}>
                <View style={networkStyles.search}>
                  <SearchField
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Nom, pseudo, club ou ville"
                  />
                </View>
                {tab === "discover" && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Filtres${activeFilters ? `, ${activeFilters} actif${activeFilters > 1 ? "s" : ""}` : ""}`}
                    accessibilityState={{ expanded: filtersOpen }}
                    onPress={() => setFiltersOpen((open) => !open)}
                    style={({ pressed }) => [
                      networkStyles.filterButton,
                      (filtersOpen || activeFilters > 0) &&
                        networkStyles.filterButtonActive,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <SlidersHorizontal
                      size={18}
                      color={colors.ink}
                      strokeWidth={1.7}
                    />
                    <Text style={networkStyles.filterLabel}>Filtres</Text>
                    {activeFilters > 0 && (
                      <View style={networkStyles.filterCount}>
                        <Text style={networkStyles.filterCountLabel}>
                          {activeFilters}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                )}
              </View>
              {tab === "discover" && (
                <>
                  {!!filtersOpen && (
                    <View style={networkStyles.filterPanel}>
                      <ChoiceField
                        label="Rôle dans le football"
                        value={role}
                        options={roleOptions}
                        onChange={setRole}
                      />
                      <ChoiceField
                        label="Département"
                        value={department}
                        options={departmentOptions}
                        onChange={setDepartment}
                      />
                    </View>
                  )}
                  {!!(role || department || search) && (
                    <View style={networkStyles.filterSummary}>
                      <Text style={networkStyles.filterSummaryLabel}>
                        {[role, department].filter(Boolean).join(" · ") ||
                          "Recherche active"}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Réinitialiser les filtres et la recherche"
                        onPress={() => {
                          setRole("");
                          setDepartment("");
                          setSearch("");
                        }}
                        style={({ pressed }) => [
                          networkStyles.resetButton,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Text style={networkStyles.resetLabel}>
                          Réinitialiser
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Voir le profil de ${displayName(item)}. ${[item.position || item.primary_role, item.club, item.city].filter(Boolean).join(" · ") || "Membre FootNation"}`}
              onPress={() => router.push(`/profile/${item.id}`)}
              style={({ pressed }) => [
                networkStyles.person,
                {
                  backgroundColor: pressed ? colors.surface : colors.background,
                },
              ]}
            >
              <Avatar
                uri={item.avatar_url}
                name={displayName(item)}
                size={54}
              />
              <View style={networkStyles.personInfo}>
                <Text style={networkStyles.personName}>
                  {displayName(item)}
                </Text>
                <Text style={networkStyles.personDetail}>
                  {[item.position || item.primary_role, item.club, item.city]
                    .filter(Boolean)
                    .join(" · ") || "Membre FootNation"}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.muted} strokeWidth={1.5} />
            </Pressable>
          )}
          ListEmptyComponent={
            query.isPending ? (
              <Loading />
            ) : query.isError ? (
              <ErrorState
                error={query.error}
                retry={() => void query.refetch()}
              />
            ) : (
              <Empty title="Aucun membre à afficher" />
            )
          }
          ListFooterComponent={
            <View style={{ gap: 10, paddingTop: 16 }}>
              {!!(query.isError && profiles.length) && (
                <ErrorState
                  error={query.error}
                  retry={() => void query.refetch()}
                />
              )}
              {query.hasNextPage ? (
                <Button
                  secondary
                  title="Afficher davantage de membres"
                  busy={query.isFetchingNextPage}
                  onPress={() => void query.fetchNextPage()}
                />
              ) : null}
            </View>
          }
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          onEndReached={() => {
            if (
              query.hasNextPage &&
              !query.isFetchingNextPage &&
              !query.isError
            )
              void query.fetchNextPage();
          }}
        />
      </AuthGate>
    </Screen>
  );
}
const createNetworkStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    list: { padding: 16, gap: 0, paddingBottom: 32 },
    header: { gap: 14, paddingBottom: 10 },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
    },
    search: { flex: 1, minWidth: 150 },
    filterButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 50,
      gap: 7,
      paddingHorizontal: 13,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterButtonActive: {
      borderColor: colors.blue,
      backgroundColor: colors.accentSoft,
    },
    filterLabel: { color: colors.ink, fontSize: 13, fontWeight: "600" },
    filterCount: {
      minHeight: 19,
      minWidth: 19,
      paddingHorizontal: 4,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0064D8",
    },
    filterCountLabel: {
      color: colors.white,
      fontSize: 11,
      fontWeight: "800",
    },
    filterPanel: {
      gap: 14,
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterSummary: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: -8,
    },
    filterSummaryLabel: {
      flex: 1,
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
    },
    resetButton: {
      minHeight: 44,
      minWidth: 44,
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    resetLabel: { color: colors.deepBlue, fontSize: 12, fontWeight: "600" },
    person: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 2,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    personInfo: { flex: 1, minWidth: 0, gap: 4 },
    personName: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 21,
      fontWeight: "700",
    },
    personDetail: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  });
