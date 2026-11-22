import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowRight,
  Flag,
  MapPin,
  Plus,
  Search,
  Users,
} from "lucide-react-native";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  useQuery,
} from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { useProfile } from "../lib/data";
import { ChoiceField } from "../components/ChoiceField";
import { careerCountryOptions } from "../lib/careerZones";
import { ProfileAutocompleteField } from "../components/ProfileAutocompleteField";
import {
  getSupporterClub,
  loadSupporterClubAffinities,
} from "../lib/supporterClubDiscovery";
import {
  affinityLabels,
  supporterClubSeed,
  supporterDiscoveryPath,
  type SupporterClubSeed,
} from "../lib/supporterClubLinks";
import {
  createSupporterGroup,
  listSupporterGroups,
  listGroupsForMyClubs,
  SUPPORTERS_PAGE_SIZE,
  type SupporterGroup,
} from "../lib/supporters";
import { useTheme } from "../theme";
import {
  loadSupporterRecommendations,
  type SupporterRecommendation,
} from "../lib/supporterRecommendations";

const supporterCountryOptions = careerCountryOptions.map(({ code, label }) => ({ value: code, label }));
const supporterCityLabel = (city: string, country: string) => {
  const value = city.trim();
  const label = supporterCountryOptions.find((option) => option.value === country)?.label;
  return value && country !== "FR" && label ? `${value}, ${label}` : value;
};

const styles = StyleSheet.create({
  hero: { borderRadius: 24, padding: 24, gap: 16, overflow: "hidden" },
  eyebrow: {
    fontFamily: "Inter-Bold",
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: "700",
    color: "#8FE8C4",
  },
  heroTitle: {
    fontFamily: "Inter-Bold",
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroText: {
    fontFamily: "Inter-Regular",
    fontSize: 15,
    lineHeight: 23,
    color: "#D1E1F0",
    maxWidth: 460,
  },
  heroPill: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#476B80",
    borderRadius: 20,
    backgroundColor: "#10334B",
  },
  heroPillText: {
    flexShrink: 1,
    fontFamily: "Inter-SemiBold",
    fontSize: 12,
    fontWeight: "600",
    color: "#E4F5ED",
  },
  fieldRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  fieldColumn: { flexBasis: 220, flexGrow: 1, minWidth: 0 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  action: { flexGrow: 1, flexBasis: 170 },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  monogram: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  monogramText: {
    fontFamily: "Inter-Bold",
    fontSize: 18,
    fontWeight: "700",
    color: "#E2FFF2",
  },
  cardContent: { flex: 1, gap: 5, minWidth: 0 },
  metadata: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  metadataItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  recommendationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  recommendation: { flexBasis: 180, flexGrow: 1, minWidth: 150, gap: 4 },
  recommendationTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  recommendationLogo: { width: 42, height: 42, borderRadius: 21, flexShrink: 0 },
  headingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  createLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  note: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderRadius: 14,
    padding: 14,
  },
});

function SupporterGroupCard({ group }: { group: SupporterGroup }) {
  const { colors } = useTheme();
  const s = useUIStyles();
  const initials = group.club_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Découvrir ${group.name}, supporters de ${group.club_name} à ${group.city}`}
      onPress={() => router.push(`/supporters/${encodeURIComponent(group.id)}`)}
      style={({ pressed }) => [s.card, { gap: 14, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={styles.cardTop}>
        <LinearGradient colors={["#154C70", "#0B3248"]} style={styles.monogram}>
          <Text style={styles.monogramText}>{initials || "FN"}</Text>
        </LinearGradient>
        <View style={styles.cardContent}>
          <Text style={s.h2}>{group.name}</Text>
          <Text
            style={[s.small, { color: colors.deepBlue, fontWeight: "600" }]}
          >
            {group.club_name}
          </Text>
        </View>
        <ArrowRight size={20} color={colors.deepBlue} />
      </View>
      {!!group.description && (
        <Text style={s.subtitle} numberOfLines={3}>
          {group.description}
        </Text>
      )}
      <View style={styles.metadata}>
        <View style={styles.metadataItem}>
          <MapPin size={15} color={colors.muted} />
          <Text style={[s.small, { flexShrink: 1 }]}>{group.city}</Text>
        </View>
        <View style={styles.metadataItem}>
          <Users size={15} color={colors.muted} />
          <Text style={s.small}>
            {group.member_count}{" "}
            {group.member_count === 1 ? "membre" : "membres"}
          </Text>
        </View>
      </View>
      <View style={[styles.cardFooter, { borderColor: colors.border }]}>
        <Text style={[s.small, { flexShrink: 1 }]}>
          Communauté de supporters
        </Text>
        <Text style={[s.small, { color: colors.deepBlue, fontWeight: "700" }]}>
          Découvrir
        </Text>
      </View>
    </Pressable>
  );
}

function SupporterRecommendationCard({ club }: { club: SupporterRecommendation }) {
  const { colors } = useTheme();
  const s = useUIStyles();
  const initials = club.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Découvrir la communauté de ${club.name}`}
      onPress={() => router.push(supporterDiscoveryPath({ club: club.name }))}
      style={[s.card, styles.recommendation, { borderColor: colors.border }]}
    >
      <View style={styles.recommendationTop}>
        {club.logo_url ? (
          <Image
            source={{ uri: club.logo_url }}
            accessibilityLabel={`Logo de ${club.name}`}
            resizeMode="contain"
            style={styles.recommendationLogo}
          />
        ) : (
          <LinearGradient
            colors={["#154C70", "#0B3248"]}
            style={[styles.recommendationLogo, styles.monogram]}
          >
            <Text style={styles.monogramText}>{initials || "FN"}</Text>
          </LinearGradient>
        )}
        <Text style={[s.text, { fontWeight: "700", flex: 1 }]}>{club.name}</Text>
      </View>
      <Text style={s.small}>{club.competition}</Text>
      <Text style={[s.small, { color: colors.deepBlue, fontWeight: "600" }]}>Voir la communauté →</Text>
    </Pressable>
  );
}

export function Supporters() {
  const params = useLocalSearchParams();
  const uid = useAuth().session?.user.id;
  const seed = supporterClubSeed(params);
  return (
    <SupportersDirectory
      key={`${uid ?? "guest"}:${JSON.stringify(seed)}`}
      seed={seed}
    />
  );
}

function SupportersDirectory({ seed }: { seed: SupporterClubSeed }) {
  const { colors } = useTheme();
  const s = useUIStyles();
  const { session, profile: authProfile } = useAuth();
  const uid = session?.user.id;
  const profileQuery = useProfile(uid);
  const profile = profileQuery.data || authProfile;
  const currentProfile = profile?.id === uid ? profile : null;
  const [club, setClub] = useState(seed.club ?? "");
  const [clubId, setClubId] = useState(seed.clubId);
  const [city, setCity] = useState(seed.city ?? "");
  const [cityRegion, setCityRegion] = useState("FR");
  const [filters, setFilters] = useState<SupporterClubSeed>(seed);
  const selectedClub = useQuery({
    queryKey: ["supporters", "club", clubId],
    enabled: !!clubId,
    queryFn: ({ signal }) => getSupporterClub(clubId!, signal),
    staleTime: 300_000,
  });
  useEffect(() => {
    if (selectedClub.data)
      setClub(selectedClub.data.name);
  }, [selectedClub.data, clubId]);
  const related = useQuery({
    queryKey: [
      "my-followed-clubs",
      uid,
      "supporters",
      currentProfile?.linked_club_id,
      currentProfile?.club,
      currentProfile?.favorite_pro_club,
      currentProfile?.favorite_amateur_club,
    ],
    enabled: !!currentProfile,
    queryFn: ({ signal }) =>
      loadSupporterClubAffinities(currentProfile!, signal),
    staleTime: 60_000,
  });
  const clubIds = related.data?.clubs.map((c) => c.id) ?? [];
  const personalGroups = useQuery({
    queryKey: [
      "supporters",
      "for-my-clubs",
      uid,
      clubIds,
      currentProfile?.city,
    ],
    enabled: !!uid && !!related.data,
    queryFn: () =>
      listGroupsForMyClubs(clubIds, currentProfile?.city ?? undefined),
    staleTime: 60_000,
  });
  const filtered = !!filters.club || !!filters.clubId || !!filters.city;
  const recommendations = useQuery({
    queryKey: ["supporters", "recommendations", uid ?? "guest"],
    queryFn: loadSupporterRecommendations,
    enabled: !filtered && (!currentProfile || related.data?.clubs.length === 0),
    staleTime: 600_000,
  });
  const groupsQuery = useInfiniteQuery({
    queryKey: ["supporters", "directory", uid ?? "public", filters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listSupporterGroups({ ...filters, offset: pageParam }),
    getNextPageParam: (last, pages) =>
      last.length === SUPPORTERS_PAGE_SIZE
        ? pages.length * SUPPORTERS_PAGE_SIZE
        : undefined,
    staleTime: 60_000,
  });
  const recommended = filtered ? [] : (personalGroups.data ?? []);
  const groups = (groupsQuery.data?.pages.flat() ?? []).filter(
    (g) => !recommended.some((r) => r.id === g.id),
  );
  const applyFilters = () =>
    setFilters({ club: club.trim(), clubId, city: supporterCityLabel(city, cityRegion) });
  const clearFilters = () => {
    setClub("");
    setClubId(undefined);
    setCity("");
    setFilters({ club: "", city: "" });
  };
  const createPath = supporterDiscoveryPath(
    { ...filters, city: filters.city || currentProfile?.city || undefined },
    true,
  );

  return (
    <Screen title="Supporters">
      <LinearGradient
        colors={["#123C69", "#0B283D", "#104C48"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.eyebrow}>LA PASSION, PRÈS DE CHEZ TOI</Text>
        <Text accessibilityRole="header" style={styles.heroTitle}>
          Le match se vit{"\n"}ensemble.
        </Text>
        <Text style={styles.heroText}>
          Retrouve les supporters de ton club, rejoins une communauté locale et
          partage tes prochains rendez-vous.
        </Text>
        <View style={styles.heroPill}>
          <Flag size={15} color="#8FE8C4" />
          <Text style={styles.heroPillText}>
            Ton club. Ta ville. Ta communauté.
          </Text>
        </View>
      </LinearGradient>

      {!!uid && !filtered && (
        <View style={{ gap: 14 }}>
          <Text accessibilityRole="header" style={s.h2}>
            Pour tes clubs
          </Text>
          <Text style={s.subtitle}>
            Tes clubs de cœur, suivis et actuel. Rejoins uniquement les groupes
            qui te plaisent.
          </Text>
          {!!currentProfile?.city && (
            <Text style={s.small}>
              Les communautés à {currentProfile.city} passent en premier.
            </Text>
          )}
          {(profileQuery.isPending ||
            (!!currentProfile && related.isPending) ||
            (!!related.data && personalGroups.isPending)) && <Loading />}
          {!!(related.error || personalGroups.error) && (
            <ErrorState
              error={related.error || personalGroups.error}
              retry={() => {
                void related.refetch();
                void personalGroups.refetch();
              }}
            />
          )}
          <View style={styles.actions}>
            {related.data?.clubs.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={`Communautés de ${c.name}`}
                onPress={() =>
                  router.push(supporterDiscoveryPath({ clubId: c.id }))
                }
                style={[
                  styles.note,
                  {
                    backgroundColor: colors.accentSoft,
                    flexDirection: "column",
                    gap: 4,
                    maxWidth: "100%",
                  },
                ]}
              >
                <Text style={[s.text, { fontWeight: "600" }]}>{c.name}</Text>
                <Text style={s.small}>
                  {c.reasons.map((r) => affinityLabels[r]).join(" · ")}
                </Text>
              </Pressable>
            ))}
            {related.data?.unresolved.map((c) => (
              <Button
                key={`${c.reason}:${c.name}`}
                title={`Rechercher les supporters de ${c.name}`}
                secondary
                onPress={() =>
                  router.push(
                    supporterDiscoveryPath({
                      club: c.name,
                      city: currentProfile?.city ?? undefined,
                    }),
                  )
                }
              />
            ))}
          </View>
          {related.data?.hasMoreFollowed && (
            <Button
              title="Voir tous mes clubs suivis"
              secondary
              onPress={() => router.push("/my-followed-clubs")}
            />
          )}
          {!related.isPending &&
            !related.error &&
            !personalGroups.isPending &&
            !personalGroups.error &&
            !recommended.length && (
              <Empty
                title="Tes communautés commencent ici"
                description="Découvre les groupes de tes clubs ou crée le premier dans ta ville. Tu peux modifier tes clubs de cœur dans ton profil."
                action={
                  <Button
                    title="Choisir mes clubs de cœur"
                    secondary
                    onPress={() => router.push("/settings")}
                  />
                }
              />
            )}
          {recommended.map((group) => (
            <SupporterGroupCard key={group.id} group={group} />
          ))}
        </View>
      )}

      {!filtered && (!uid || (related.data && related.data.clubs.length === 0)) && (
        <View style={s.card}>
          <Text accessibilityRole="header" style={s.h2}>Choisis ton club de cœur</Text>
          <Text style={s.subtitle}>
            Rejoins sa communauté de supporters. Le choix reste séparé de l’adhésion : tu décideras ensuite si tu veux rejoindre un groupe.
          </Text>
          {recommendations.isPending ? <Loading /> : null}
          {recommendations.error ? (
            <ErrorState error={recommendations.error} retry={() => void recommendations.refetch()} />
          ) : (
            <>
              <Text style={s.small}>
                {recommendations.data?.country && recommendations.data.country !== "FR"
                  ? `Clubs populaires pour ${recommendations.data.country}`
                  : "Ligue 1 en priorité, puis les clubs les plus suivis"}
              </Text>
              <View style={styles.recommendationGrid}>
                {(recommendations.data?.clubs ?? []).slice(0, 24).map((club) => (
                  <SupporterRecommendationCard key={club.id} club={club} />
                ))}
              </View>
              {!!recommendations.data?.clubs.length && (
                <Text style={s.small}>Jusqu’à 300 clubs sont proposés progressivement dans la recherche.</Text>
              )}
            </>
          )}
        </View>
      )}

      <View style={s.card}>
        <View style={s.row}>
          <Search size={20} color={colors.deepBlue} />
          <Text accessibilityRole="header" style={s.h2}>
            Trouve ton groupe
          </Text>
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.fieldColumn}>
            <ProfileAutocompleteField kind="club" label="Ton club" value={club}
              onChange={(value) => { setClub(value); setClubId(undefined); }}
              onSelect={(suggestion) => setClubId(suggestion.id)} maxLength={200} allowManual={false} />
          </View>
          <View style={styles.fieldColumn}>
            <ChoiceField label="Pays" value={cityRegion} options={supporterCountryOptions} optional={false}
              onChange={(value) => { setCityRegion(value); setCity(""); }} />
            {cityRegion === "FR" ? <ProfileAutocompleteField kind="city" country="FR" label="Ta ville" value={city} onChange={setCity} maxLength={200} allowManual={false} /> :
              <Field label="Ta ville" placeholder="Ex. Londres" value={city} onChangeText={setCity} maxLength={200} /> }
          </View>
        </View>
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button title="Trouver des supporters" onPress={applyFilters} />
          </View>
          {(filtered || !!club || !!city) && (
            <View style={styles.action}>
              <Button
                title="Effacer les filtres"
                secondary
                onPress={clearFilters}
              />
            </View>
          )}
        </View>
      </View>
      {!!seed.clubId && !!selectedClub.error && (
        <ErrorState
          error={selectedClub.error}
          retry={() => void selectedClub.refetch()}
        />
      )}
      {!!filters.clubId && !!selectedClub.data && (
        <Text style={s.small}>
          Communautés rattachées à {selectedClub.data.name}. Le choix du club ne
          t’inscrit à aucun groupe.
        </Text>
      )}

      <View style={styles.headingRow}>
        <Text accessibilityRole="header" style={s.h2}>
          {filtered
            ? "Les groupes qui te correspondent"
            : uid
              ? "Les autres communautés"
              : "Les communautés"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Créer un groupe de supporters"
          onPress={() => router.push(createPath)}
          style={styles.createLink}
        >
          <Plus size={18} color={colors.deepBlue} />
          <Text style={[s.text, { color: colors.deepBlue, fontWeight: "600" }]}>
            Créer un groupe
          </Text>
        </Pressable>
      </View>
      {groupsQuery.isPending ? (
        <Loading />
      ) : (
        <>
          {!!groupsQuery.error && (
            <ErrorState
              error={groupsQuery.error}
              retry={() =>
                void (groupsQuery.isFetchNextPageError
                  ? groupsQuery.fetchNextPage()
                  : groupsQuery.refetch())
              }
            />
          )}
          {!groupsQuery.error && !groups.length && (
            <Empty
              title={
                filtered
                  ? "Pas encore de groupe ici"
                  : recommended.length ? "Aucune autre communauté pour le moment" : "La communauté commence avec toi"
              }
              description={
                filtered
                  ? "Essaie un autre club ou une ville voisine, ou rassemble les premiers supporters de ta ville."
                  : recommended.length ? "Tes communautés suggérées sont affichées plus haut. Tu peux aussi créer ton propre groupe." : "Crée le premier groupe de ton club dans ta ville et invite tes amis à le rejoindre."
              }
              action={
                <Button
                  title="Créer un groupe de supporters"
                  onPress={() => router.push(createPath)}
                />
              }
            />
          )}
          {groups.map((group) => (
            <SupporterGroupCard key={group.id} group={group} />
          ))}
          {groupsQuery.hasNextPage && (
            <Button
              title="Afficher d’autres groupes"
              secondary
              busy={groupsQuery.isFetchingNextPage}
              onPress={() => void groupsQuery.fetchNextPage()}
            />
          )}
        </>
      )}
    </Screen>
  );
}

export function CreateSupporterGroup() {
  const uid = useAuth().session?.user.id;
  const params = useLocalSearchParams();
  const seed = supporterClubSeed(params);
  return (
    <Screen title="Créer un groupe de supporters">
      <AuthGate>
        {!!uid && (
          <SupporterGroupForm
            key={`${uid}:${JSON.stringify(seed)}`}
            seed={seed}
          />
        )}
      </AuthGate>
    </Screen>
  );
}

function SupporterGroupForm({ seed }: { seed: SupporterClubSeed }) {
  const { colors } = useTheme();
  const s = useUIStyles();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const { profile, session } = useAuth();
  const [clubName, setClubName] = useState(seed.club ?? "");
  const [clubId, setClubId] = useState(seed.clubId);
  const [city, setCity] = useState(
    seed.city || (profile?.id === session?.user.id ? profile?.city : "") || "",
  );
  const [cityRegion, setCityRegion] = useState(supporterCountryOptions.find((option) => option.value === profile?.country || option.label === profile?.country)?.value || "FR");
  const [selectedCity, setSelectedCity] = useState("");
  const [description, setDescription] = useState("");
  const selectedClub = useQuery({
    queryKey: ["supporters", "club", clubId],
    enabled: !!clubId,
    queryFn: ({ signal }) => getSupporterClub(clubId!, signal),
    staleTime: 300_000,
  });
  useEffect(() => {
    if (selectedClub.data) setClubName(selectedClub.data.name);
  }, [selectedClub.data]);
  const create = useMutation({
    mutationFn: () =>
      createSupporterGroup({
        name: name.trim(),
        clubName: clubName.trim(),
        clubId,
        city: supporterCityLabel(city, cityRegion),
        description: description.trim(),
      }),
    onSuccess: (group) => {
      void queryClient.invalidateQueries({ queryKey: ["supporters"] });
      router.replace(`/supporters/${encodeURIComponent(group.id)}`);
    },
  });
  const valid =
    name.trim().length >= 3 &&
    clubName.trim().length >= 2 &&
    !!clubId && !!selectedClub.data && !selectedClub.isError &&
    supporterCityLabel(city, cityRegion).length <= 120 && city.trim().length >= 2 && (cityRegion !== "FR" || selectedCity === city.trim());

  return (
    <>
      <LinearGradient
        colors={["#123C69", "#104C48"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroPill}>
          <Users size={17} color="#8FE8C4" />
          <Text style={styles.heroPillText}>
            La même passion, le même rendez-vous
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          style={[styles.heroTitle, { fontSize: 27, lineHeight: 33 }]}
        >
          Rassemble les supporters de ta ville.
        </Text>
        <Text style={styles.heroText}>
          Présente ton groupe, puis invite tes amis à le rejoindre. Tu en seras
          l’organisateur.
        </Text>
      </LinearGradient>
      <View style={s.card}>
        <Field
          label="Nom du groupe *"
          placeholder="Ex. Supporters du PSG à Montpellier"
          value={name}
          onChangeText={setName}
          maxLength={100}
          editable={!create.isPending}
          autoCapitalize="sentences"
        />
        <Text style={s.small}>
          Choisis un nom clair, de 3 à 100 caractères.
        </Text>
        <ProfileAutocompleteField
          kind="club"
          label="Club soutenu *"
          allowManual={false}
          value={clubName}
          onChange={(value) => {
            setClubName(value);
            setClubId(undefined);
          }}
          onSelect={(suggestion) => setClubId(suggestion.id)}
          maxLength={120}
          disabled={create.isPending}
        />
        {!!clubId && selectedClub.isPending && <Loading />}
        {!!clubId && !!selectedClub.error && (
          <ErrorState
            error={selectedClub.error}
            retry={() => void selectedClub.refetch()}
          />
        )}
        {!!clubId && selectedClub.isSuccess && !selectedClub.data && (
          <Text style={s.small}>
            Ce club n’est plus disponible. Choisis un autre club.
          </Text>
        )}
        {!!clubId && !!selectedClub.data && (
          <Text style={s.small}>
            Rattaché à {selectedClub.data.name}
            {selectedClub.data.city ? ` · ${selectedClub.data.city}` : ""}. Ce
            lien ne donne aucun droit sur le club.
          </Text>
        )}
        {!clubId && !!clubName && (
          <Text style={s.small}>
            Choisis une fiche parmi tous les clubs amateurs, professionnels et sélections de l’annuaire.
          </Text>
        )}
        <View style={{ gap: 8 }}>
        <Text style={s.small}>Localisation du groupe de supporters</Text>
        <ChoiceField label="Pays *" value={cityRegion} options={supporterCountryOptions} optional={false} disabled={create.isPending}
          onChange={(value) => { setCityRegion(value); setCity(""); setSelectedCity(""); }} />
        {cityRegion === "FR" ? <ProfileAutocompleteField kind="city" country="FR" label="Ville *" value={city}
          onChange={(value) => { setCity(value); setSelectedCity(""); }} onSelect={(suggestion) => setSelectedCity(suggestion.name)}
          maxLength={120} allowManual={false} disabled={create.isPending} /> :
          <Field label="Ville *" placeholder="Ex. Londres" value={city} onChangeText={setCity} maxLength={120} editable={!create.isPending} />}
        <Text style={s.small}>{cityRegion === "FR" ? "Choisis une commune dans les suggestions." : "Saisis la ville de ton groupe dans le pays sélectionné."}</Text>
        </View>
        <Field
          label="Présente ton groupe"
          placeholder="Votre ambiance, vos rendez-vous, ce que vous aimeriez vivre ensemble…"
          value={description}
          onChangeText={setDescription}
          maxLength={1500}
          editable={!create.isPending}
          multiline
        />
        <Text style={[s.small, { textAlign: "right" }]}>
          {description.length} / 1500
        </Text>
        <Text style={s.small}>
          * Champs obligatoires. Le groupe et sa description seront visibles
          publiquement.
        </Text>
      </View>
      <View style={[styles.note, { backgroundColor: colors.accentSoft }]}>
        <Flag size={20} color={colors.deepBlue} />
        <Text style={[s.small, { flex: 1, color: colors.ink }]}>
          Tu crées une communauté indépendante. Utilise tes propres textes et ne
          présente pas ton groupe comme officiel sans l’accord du club.
        </Text>
      </View>
      {!!create.error && <ErrorState error={create.error} />}
      <Button
        title="Créer mon groupe"
        disabled={!valid}
        busy={create.isPending}
        onPress={() => {
          if (valid && !create.isPending) create.mutate();
        }}
      />
    </>
  );
}
