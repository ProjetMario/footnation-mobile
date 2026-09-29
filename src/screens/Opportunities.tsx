import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, usePathname } from "expo-router";
import {
  Briefcase,
  Building2,
  MapPin,
  Megaphone,
  Search,
  Send,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { FootballMatchCard } from "../components/FootballMatchCard";
import type { Opportunity } from "../lib/models";
import { useOpportunities } from "../lib/data";
import { opportunityListingKind } from "../lib/opportunityKind";
import { Button, Empty, ErrorState, Loading, Screen } from "../components/ui";
import { AuthGate } from "../components/AuthGate";
import { creationTypes, opportunityProfiles } from "./OpportunityActions";
import { ChoiceField } from "../components/ChoiceField";
import { departmentOptions } from "../lib/networkOptions";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import { useTranslation, type TranslationKey } from "../lib/i18n";

const opportunityDepartments = [
  { value: "", label: "Tous les départements" },
  ...departmentOptions.map((option) => ({
    value: option.value.split(" - ")[0],
    label: option.label,
  })),
];
export const opportunityTypes = [
  ["", "Toutes"],
  ...creationTypes,
  ["player", "Joueur recherché"],
  ["coach_staff", "Coach / Staff"],
  ["volunteer", "Bénévole"],
  ["referee", "Arbitre"],
  ["sponsorship", "Sponsoring / Partenariat"],
  ["event", "Événement football"],
  ["professional", "Opportunité pro"],
];


function opportunityTypeLabel(type: string | null | undefined) {
  return (
    opportunityTypes.find(([id]) => id === type)?.[1] ||
    opportunityProfiles.find(([id]) => id === type)?.[1] ||
    type ||
    "Opportunité"
  );
}

function OpportunityHighlightBadge({ item }: { item: Opportunity }) {
  const kind = opportunityListingKind(item.opportunity_type, item.listing_kind) === "offer" ? "Offre" : "Demande";
  const target = (item.target_profile_type ? profileLabel(item.target_profile_type) : opportunityTypeLabel(item.opportunity_type)).toUpperCase();
  return (
    <LinearGradient
      colors={["#0967FF", "#7C3AED", "#FF2D55"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={deckStyles.highlightBadge}
    >
      <Text style={deckStyles.highlightKicker}>{kind}</Text>
      <Text style={deckStyles.highlightTarget} numberOfLines={1}>{target}</Text>
      <Text style={deckStyles.highlightHint}>C’est le profil recherché</Text>
    </LinearGradient>
  );
}

const MAIN_TABS: {
  id: "" | "offres" | "demandes";
  labelKey: TranslationKey;
}[] = [
  { id: "", labelKey: "opportunities.allTab" },
  { id: "offres", labelKey: "opportunities.offersTab" },
  { id: "demandes", labelKey: "opportunities.requestsTab" },
];

export function OpportunityList() {
  const { mode: themeMode } = useTheme();
  const styles = useThemedStyles(createOpportunityStyles);
  const t = useTranslation();

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [profile, setProfile] = useState("");
  const [department, setDepartment] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tab, setTab] = useState<"" | "offres" | "demandes">("");
  const localizedDepartments = useMemo(
    () => [
      {
        ...opportunityDepartments[0],
        label: t("opportunities.allDepartments"),
      },
      ...opportunityDepartments.slice(1),
    ],
    [t],
  );
  const localizedTypes = useMemo(
    () => [
      ["", t("opportunities.allTypes")] as const,
      ...opportunityTypes.slice(1),
    ],
    [t],
  );
  const query = useOpportunities(search, type, profile, department, tab);
  const rows = query.data?.pages.flat() || [];
  const featured = rows.slice(0, 3);
  const activeFilters = [
    opportunityTypes.find(([id]) => id === type && !!type)?.[1],
    opportunityProfiles.find(([id]) => id === profile && !!profile)?.[1],
    localizedDepartments.find(
      (option) => option.value === department && !!department,
    )?.label,
  ].filter(Boolean);

  return (
    <Screen title="" back={false} scroll={false}>
      <AuthGate>
        <FlatList
          data={rows}
          keyExtractor={(p) => p.id}
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          indicatorStyle={themeMode === "dark" ? "white" : "black"}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.hero}>
                <View style={styles.heroGlow} />
                <View style={styles.heroTopRow}>
                  <View style={styles.heroIcon}>
                    <Briefcase size={22} color="#fff" />
                  </View>
                  <Text style={styles.heroEyebrow}>
                    {t("opportunities.eyebrow")}
                  </Text>
                </View>
                <Text style={styles.heroTitle}>{t("opportunities.title")}</Text>
                <Text style={styles.heroText}>
                  {t("opportunities.subtitle")}
                </Text>
                <View style={styles.heroActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("opportunities.publishAd")}
                    onPress={() => router.push("/opportunity/new")}
                    style={styles.primaryAction}
                  >
                    <Megaphone size={18} color="#fff" />
                    <Text style={styles.primaryActionText}>
                      {t("common.publish")}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      filtersOpen
                        ? t("opportunities.closeFilters")
                        : t("opportunities.openFilters")
                    }
                    accessibilityState={{ expanded: filtersOpen }}
                    onPress={() => setFiltersOpen((open) => !open)}
                    style={[
                      styles.secondaryAction,
                      filtersOpen && styles.secondaryActionActive,
                    ]}
                  >
                    <Target
                      size={18}
                      color={filtersOpen ? "#fff" : "#087CFF"}
                    />
                    <Text
                      style={[
                        styles.secondaryActionText,
                        filtersOpen && styles.secondaryActionTextActive,
                      ]}
                    >
                      {t("common.refine")}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {!!filtersOpen && (
                <View style={styles.advancedFilters}>
                  <ChoiceField
                    label={t("opportunities.profileWanted")}
                    optional={false}
                    value={profile}
                    options={opportunityProfiles.map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    onChange={setProfile}
                  />
                  <ChoiceField
                    label={t("opportunities.department")}
                    optional={false}
                    value={department}
                    options={localizedDepartments}
                    onChange={setDepartment}
                  />
                </View>
              )}

              <View style={styles.searchBox}>
                <Search size={21} color="rgba(16,24,40,0.48)" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t("opportunities.searchPlaceholder")}
                  placeholderTextColor="rgba(16,24,40,0.48)"
                  returnKeyType="search"
                  style={styles.searchInput}
                  accessibilityLabel={t("opportunities.searchAccessibility")}
                />
              </View>

              <View style={styles.mainTabs}>
                {MAIN_TABS.map((item) => (
                  <Pressable
                    key={item.id || "all"}
                    accessibilityRole="button"
                    accessibilityState={{ selected: tab === item.id }}
                    aria-pressed={tab === item.id}
                    onPress={() => setTab(item.id)}
                    style={[
                      styles.mainTab,
                      tab === item.id && styles.mainTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.mainTabText,
                        tab === item.id && styles.mainTabTextActive,
                      ]}
                    >
                      {t(item.labelKey)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <ScrollView
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.typeRail}
              >
                {localizedTypes.map(([id, label]) => (
                  <Pressable
                    key={id || "all"}
                    accessibilityRole="button"
                    accessibilityState={{ selected: type === id }}
                    aria-pressed={type === id}
                    onPress={() => setType(id)}
                    style={[
                      styles.typePill,
                      type === id && styles.typePillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typePillText,
                        type === id && styles.typePillTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {!!activeFilters.length && (
                <Text style={styles.activeFilters}>
                  {activeFilters.join(" · ")}
                </Text>
              )}

              {!!(search || type || profile || department || tab) && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("opportunities.clearFilters")}
                  onPress={() => {
                    setSearch("");
                    setType("");
                    setProfile("");
                    setDepartment("");
                    setTab("");
                  }}
                  style={styles.clearButton}
                >
                  <Text style={styles.clearButtonText}>
                    {t("opportunities.clearFilters")}
                  </Text>
                </Pressable>
              )}

              {featured.length > 0 ? (
                <View style={styles.featuredSection}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>
                      {t("opportunities.featured")}
                    </Text>
                    <Sparkles size={18} color="#FFB020" />
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.featuredRail}
                  >
                    {featured.map((item) => (
                      <Pressable
                        key={`featured:${item.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={item.title}
                        onPress={() => router.push(`/opportunity/${item.id}`)}
                        style={styles.featuredCard}
                      >
                        <Text style={styles.featuredKind}>
                          {opportunityKindLabel(item.opportunity_type)}
                        </Text>
                        <Text style={styles.featuredTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={styles.featuredMeta} numberOfLines={1}>
                          {locationLabel(
                            item.location_city,
                            item.location_department,
                          )}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {!!(query.error && query.data) && (
                <ErrorState
                  error={query.error}
                  retry={() => void query.refetch()}
                />
              )}
            </View>
          }
          renderItem={({ item }) => {
            const isOffer =
              opportunityListingKind(
                item.opportunity_type,
                item.listing_kind,
              ) === "offer";
            const Icon = isOffer ? Building2 : UserRound;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Ouvre l’annonce complète."
                accessibilityLabel={item.title}
                onPress={() => router.push(`/opportunity/${item.id}`)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.cardIcon,
                      isOffer ? styles.cardIconOffer : styles.cardIconDemand,
                    ]}
                  >
                    <Icon size={21} color="#fff" />
                  </View>
                  <View style={styles.cardHeading}>
                    <Text style={styles.cardType}>
                      {isOffer
                        ? t("opportunities.offer")
                        : t("opportunities.request")}{" "}
                      · {opportunityKindLabel(item.opportunity_type)}
                    </Text>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>
                </View>
                <Text style={styles.cardDescription} numberOfLines={3}>
                  {item.description}
                </Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaPill}>
                    <MapPin size={14} color="#087CFF" />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {locationLabel(
                        item.location_city,
                        item.location_department,
                      )}
                    </Text>
                  </View>
                  {!!item.target_profile_type && (
                    <View style={styles.metaPillSoft}>
                      <Text style={styles.metaText} numberOfLines={1}>
                        {profileLabel(item.target_profile_type)}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardFooter}>
                  {Number.isFinite(Date.parse(item.created_at)) ? (
                    <Text style={styles.dateText}>
                      {t("opportunities.publishedAt")}{" "}
                      {new Date(item.created_at).toLocaleDateString("fr-FR")}
                    </Text>
                  ) : null}
                  <View style={styles.applyHint}>
                    <Text style={styles.applyHintText}>
                      {t("opportunities.view")}
                    </Text>
                    <Send size={14} color="#087CFF" />
                  </View>
                </View>
              </Pressable>
            );
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
                title={t("opportunities.emptyTitle")}
                description={t("opportunities.emptyDescription")}
              />
            )
          }
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          onEndReached={() => {
            if (
              query.hasNextPage &&
              !query.isFetching &&
              !query.isFetchNextPageError
            )
              void query.fetchNextPage();
          }}
          ListFooterComponent={
            query.isFetchNextPageError ? (
              <ErrorState
                error={query.error}
                retry={() => void query.fetchNextPage()}
              />
            ) : query.isFetchingNextPage ? (
              <Loading />
            ) : null
          }
        />
      </AuthGate>
    </Screen>
  );
}

function opportunityKindLabel(value: string) {
  return opportunityTypes.find(([id]) => id === value)?.[1] || value;
}

function profileLabel(value: string) {
  return opportunityProfiles.find(([id]) => id === value)?.[1] || value;
}

function locationLabel(city?: string | null, department?: string | null) {
  return [city, department].filter(Boolean).join(" · ") || "Lieu non précisé";
}

const createOpportunityStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 108,
      gap: 14,
    },
    header: { gap: 14, paddingBottom: 4 },
    hero: {
      overflow: "hidden",
      borderRadius: 30,
      backgroundColor: "#071429",
      padding: 22,
      gap: 13,
      shadowColor: "#071429",
      shadowOpacity: 0.22,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 14 },
      elevation: 5,
    },
    heroGlow: {
      position: "absolute",
      width: 190,
      height: 190,
      borderRadius: 95,
      right: -48,
      top: -60,
      backgroundColor: "rgba(8,124,255,0.36)",
    },
    heroTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    heroIcon: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.blue,
    },
    heroEyebrow: {
      color: "rgba(255,255,255,0.72)",
      fontFamily: "Inter-Bold",
      fontSize: 12,
      letterSpacing: 1.6,
      fontWeight: "800",
    },
    heroTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 30,
      lineHeight: 36,
      fontWeight: "900",
    },
    heroText: {
      color: "rgba(255,255,255,0.72)",
      fontFamily: "Inter-Regular",
      fontSize: 16,
      lineHeight: 23,
    },
    heroActions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    primaryAction: {
      minHeight: 48,
      borderRadius: 16,
      paddingHorizontal: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.blue,
    },
    primaryActionText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 16,
      fontWeight: "800",
    },
    secondaryAction: {
      minHeight: 48,
      borderRadius: 16,
      paddingHorizontal: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.white,
    },
    secondaryActionActive: { backgroundColor: colors.blue },
    secondaryActionText: {
      color: colors.blue,
      fontFamily: "Inter-Bold",
      fontSize: 16,
      fontWeight: "800",
    },
    secondaryActionTextActive: { color: colors.white },
    searchBox: {
      minHeight: 54,
      borderRadius: 18,
      backgroundColor: colors.surfaceRaised,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 15,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      color: colors.ink,
      fontFamily: "Inter-Regular",
      fontSize: 17,
      paddingVertical: 0,
    },
    mainTabs: {
      flexDirection: "row",
      borderRadius: 18,
      backgroundColor: colors.surfaceRaised,
      padding: 4,
      gap: 4,
    },
    mainTab: {
      flex: 1,
      minHeight: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    mainTabActive: { backgroundColor: colors.white },
    mainTabText: {
      color: colors.muted,
      fontFamily: "Inter-Bold",
      fontSize: 15,
      fontWeight: "800",
    },
    mainTabTextActive: { color: colors.ink },
    typeRail: { gap: 9, paddingRight: 10 },
    typePill: {
      minHeight: 40,
      borderRadius: 14,
      paddingHorizontal: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typePillActive: { backgroundColor: colors.blue, borderColor: colors.blue },
    typePillText: {
      color: colors.muted,
      fontFamily: "Inter-Bold",
      fontSize: 13,
      fontWeight: "800",
    },
    typePillTextActive: { color: colors.white },
    filtersToggle: {
      minHeight: 48,
      borderRadius: 16,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filtersToggleText: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 15,
      fontWeight: "800",
    },
    advancedFilters: {
      gap: 12,
      padding: 14,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    activeFilters: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 20,
    },
    clearButton: {
      alignSelf: "flex-start",
      minHeight: 38,
      borderRadius: 14,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,71,87,0.1)",
    },
    clearButtonText: {
      color: colors.magenta,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "800",
    },
    featuredSection: { gap: 10, marginTop: 4 },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    sectionTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 19,
      fontWeight: "900",
    },
    featuredRail: { gap: 12, paddingRight: 6 },
    featuredCard: {
      width: 210,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 8,
    },
    featuredKind: {
      color: colors.blue,
      fontFamily: "Inter-Bold",
      fontSize: 12,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    featuredTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      lineHeight: 23,
      fontWeight: "900",
    },
    featuredMeta: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 13,
    },
    card: {
      borderRadius: 26,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 17,
      gap: 13,
      shadowColor: "#101828",
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 3,
    },
    cardPressed: { transform: [{ scale: 0.99 }], opacity: 0.92 },
    cardTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    cardIcon: {
      width: 48,
      height: 48,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    cardIconOffer: { backgroundColor: colors.blue },
    cardIconDemand: { backgroundColor: "#8B5CF6" },
    cardHeading: { flex: 1, minWidth: 0, gap: 3 },
    cardType: {
      color: colors.muted,
      fontFamily: "Inter-Bold",
      fontSize: 12,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    cardTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 20,
      lineHeight: 25,
      fontWeight: "900",
    },
    cardDescription: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 15,
      lineHeight: 22,
    },
    metaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    metaPill: {
      maxWidth: "100%",
      minHeight: 34,
      borderRadius: 14,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.accentSoft,
    },
    metaPillSoft: {
      maxWidth: "100%",
      minHeight: 34,
      borderRadius: 14,
      paddingHorizontal: 10,
      justifyContent: "center",
      backgroundColor: colors.surfaceRaised,
    },
    metaText: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 13,
      fontWeight: "800",
    },
    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    dateText: {
      flex: 1,
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 13,
    },
    applyHint: { flexDirection: "row", alignItems: "center", gap: 6 },
    applyHintText: {
      color: colors.blue,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "900",
    },
  });

export default function Opportunities() {
  return (
    <AuthGate>
      <OpportunityDeck />
    </AuthGate>
  );
}
function OpportunityDeck() {
  const focused = usePathname() === "/opportunities";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [department, setDepartment] = useState("");
  const [kind, setKind] = useState<"" | "offres" | "demandes">("");
  const [passed, setPassed] = useState<Opportunity[]>([]);
  const [review, setReview] = useState<Opportunity | null>(null);
  const query = useOpportunities(search, type, "", department, kind);
  const candidate = query.data?.pages
    .flat()
    .find((item) => !passed.some((previous) => previous.id === item.id));
  const item = review || candidate;
  const author = useQuery({
    queryKey: ["opportunity-card-author", item?.user_id, item?.club_id],
    enabled: !!item,
    queryFn: async () => {
      if (item!.club_id) {
        const club = await supabase
          .from("clubs")
          .select("name,logo_url")
          .eq("id", item!.club_id)
          .maybeSingle();
        if (club.error) throw club.error;
        if (club.data?.logo_url)
          return {
            image: club.data.logo_url,
            name: club.data.name,
            role: "Club",
          };
      }
      const profile = await supabase
        .from("profiles")
        .select("full_name,avatar_url,primary_role")
        .eq("id", item!.user_id)
        .maybeSingle();
      if (profile.error) throw profile.error;
      return {
        image: profile.data?.avatar_url,
        name: profile.data?.full_name,
        role: profile.data?.primary_role,
      };
    },
  });
  useEffect(() => {
    if (!candidate && query.hasNextPage && !query.isFetching && !query.isError)
      void query.fetchNextPage();
  }, [
    candidate,
    query.hasNextPage,
    query.isFetching,
    query.isError,
    query.fetchNextPage,
  ]);
  const control = (label: string, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: "#132c49",
        padding: 12,
        borderRadius: 24,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ color: "white", fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
  const openAuthor = () => {
    if (!item) return;
    router.push(item.club_id ? `/club/${item.club_id}` : `/profile/${item.user_id}`);
  };
  return (
    <>
      <Screen title="Matching · Opportunités">
        {control("Filtres", () => setFiltersOpen(!filtersOpen))}
        {filtersOpen && (
          <View style={{ gap: 16 }}>
            <TextInput
              accessibilityLabel="Rechercher une opportunité"
              placeholder="Rechercher une opportunité"
              value={search}
              onChangeText={setSearch}
              style={{
                padding: 16,
                backgroundColor: "white",
                borderRadius: 16,
              }}
            />
            <ChoiceField
              label="Type d’annonce"
              value={kind}
              options={[
                { value: "", label: "Toutes" },
                { value: "offres", label: "Offres" },
                { value: "demandes", label: "Demandes" },
              ]}
              onChange={(value) => setKind(value as typeof kind)}
            />
            <ChoiceField
              label="Opportunité recherchée"
              value={type}
              options={opportunityTypes.map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={setType}
            />
            <ChoiceField
              label="Département"
              value={department}
              options={opportunityDepartments}
              onChange={setDepartment}
            />
            <Button
              title="Afficher les cartes"
              onPress={() => {
                setReview(null);
                setFiltersOpen(false);
              }}
            />
          </View>
        )}
        {query.isPending || (!candidate && query.isFetchingNextPage) ? (
          <Loading />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : !item ? (
          <>
            <Empty
              title="Tu as vu toutes les opportunités"
              description="Modifie les filtres ou revois les annonces."
            />
            <Button
              title="Revoir les annonces"
              onPress={() => {
                setPassed([]);
                setReview(null);
              }}
            />
          </>
        ) : null}
      </Screen>
      {!!item && (
        <Modal
          visible={focused && !filtersOpen}
          onRequestClose={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          animationType="fade"
        >
          <FootballMatchCard
            key={`${item.id}:${author.data?.image || "default"}`}
            fullscreen
            opportunity
            showScore={false}
            canLike
            busy={false}
            item={{
              id: item.id,
              entity_type: "club",
              name: item.title,
              avatar_url: author.data?.image || null,
              logo_url: author.data?.image || null,
              location: {
                city: item.location_city,
                department: item.location_department,
              },
              compatibility_score: 0,
              division:
                opportunityTypes.find(
                  ([id]) => id === item.opportunity_type,
                )?.[1] || item.opportunity_type,
              competition_level: null,
              recruiting_status: false,
              recruiting_positions: [],
              age_category: null,
              stadium_name: null,
              youth_academy: false,
              women_team: false,
              project_description: item.description,
            }}
            onOpen={() => router.push(`/opportunity/${item.id}`)}
            onChoose={(direction) => {
              if (direction !== "left") {
                router.push(`/opportunity/${item.id}`);
                return;
              }
              if (review) {
                setReview(null);
                return;
              }
              setPassed((list) => [...list, item]);
            }}
            overlay={
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {!!author.data?.name && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Voir ${item.club_id ? "le club" : "le profil"} ${author.data.name}`}
                    onPress={openAuthor}
                    style={deckStyles.authorLink}
                  >
                    <Text style={deckStyles.authorLinkText}>
                      {author.data.name}
                      {author.data.role ? ` · ${author.data.role}` : ""}
                    </Text>
                    <Text style={deckStyles.authorLinkHint}>Voir {item.club_id ? "le club" : "le profil"}</Text>
                  </Pressable>
                )}
                {control("Retour", () =>
                  router.canGoBack() ? router.back() : router.replace("/"),
                )}
                {control("Filtres", () => setFiltersOpen(true))}
                {control(
                  "Précédente",
                  () => {
                    setReview(null);
                    setPassed((list) => list.slice(0, -1));
                  },
                  !passed.length,
                )}
                {control("Publier", () => router.push("/opportunity/new"))}
                <Text style={deckStyles.instructionText}>
                  {opportunityListingKind(
                    item.opportunity_type,
                    item.listing_kind,
                  ) === "offer"
                    ? "Offre"
                    : "Demande"}{" "}
                  · Glisse à droite pour consulter l’annonce et y répondre
                </Text>
                <OpportunityHighlightBadge item={item} />
              </View>
            }
          />
        </Modal>
      )}
    </>
  );
}

const deckStyles = StyleSheet.create({
  authorLink: { width: "100%", alignSelf: "flex-start", gap: 2 },
  authorLinkText: { color: "white", fontWeight: "900", fontSize: 16 },
  authorLinkHint: { color: "rgba(255,255,255,0.82)", fontWeight: "800", fontSize: 12, textDecorationLine: "underline" },
  instructionText: { color: "white", width: "100%", fontSize: 16, fontWeight: "800", lineHeight: 22 },
  highlightBadge: {
    width: "100%",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginTop: 6,
    shadowColor: "#FF2D55",
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  highlightKicker: { color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  highlightTarget: { color: "#FFFFFF", fontSize: 34, lineHeight: 39, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase", marginTop: 2 },
  highlightHint: { color: "rgba(255,255,255,0.88)", fontSize: 13, fontWeight: "800", marginTop: 3 },
});
