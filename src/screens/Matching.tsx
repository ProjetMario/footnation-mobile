import React, { useEffect, useReducer, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Check, MessageCircle, Sparkles } from "lucide-react-native";
import { useMatchingEntities } from "../hooks/useMatchingEntities";
import { MatchableItem } from "../types/matching";
import { FootballMatchCard } from "../components/FootballMatchCard";
import { ChoiceField } from "../components/ChoiceField";
import { roleOptions, departmentOptions } from "../lib/networkOptions";
import {
  matchingFiltersReducer,
  matchingPositionOptions,
  matchingLevelOptions,
} from "../lib/matchingFilters";
import { supportsClubMatching } from "../lib/matchingSchema";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";

function formatMatchDate(value?: string | null) {
  const time = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) return "Date du match inconnue";
  const date = new Date(time),
    now = Date.now(),
    diff = now - time,
    day = 24 * 60 * 60 * 1000;
  if (diff >= 0 && diff < day)
    return `Match aujourd’hui à ${date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  if (diff >= day && diff < 2 * day) return "Match hier";
  return `Match du ${date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  })}`;
}

function matchCountLabel(count: number, hasMore?: boolean) {
  if (!count) return "Aucun match";
  return `${count}${hasMore ? "+" : ""} match${count > 1 ? "s" : ""}`;
}

export default function Matching() {
  return (
    <Screen title="Matching">
      <AuthGate>
        <Content />
      </AuthGate>
    </Screen>
  );
}
function Content() {
  const s = useUIStyles();
  const isFocused = usePathname() === "/matching";

  const { session } = useAuth();
  const uid = session!.user.id;
  const cache = useQueryClient();
  const [tab, setTab] = useState("discover");
  const [filterState, dispatchFilters] = useReducer(matchingFiltersReducer, {
    draft: {},
    applied: {},
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [category, setCategory] = useState("Tous");
  const [matchFilter, setMatchFilter] = useState("Tous");
  const [matchCelebration, setMatchCelebration] = useState<MatchableItem | null>(null);
  const filters = {
    ...filterState.applied,
    ...(category === "Clubs"
      ? { entityType: "club" as const, role: undefined }
      : {}),
    ...(category === "Joueurs"
      ? {
          entityType: "profile" as const,
          role: undefined,
          profileGroup: "players" as const,
        }
      : {}),
    ...(category === "Agents"
      ? {
          entityType: "profile" as const,
          role: undefined,
          profileGroup: "agents" as const,
        }
      : {}),
  };
  const categoryBar = (dark = false) => (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, width: "100%" }}
    >
      {["Tous", "Joueurs", "Clubs", "Agents", "Opportunités"].map((label) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityState={{ selected: category === label }}
          onPress={() => {
            if (label === "Opportunités") {
              router.push("/opportunities");
              return;
            }
            setReview(null);
            swipe.reset();
            setCategory(label);
          }}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 24,
            backgroundColor:
              category === label ? "#087fff" : dark ? "#102338dd" : "#e7edf5",
          }}
        >
          <Text
            style={{
              fontWeight: "700",
              color: category === label || dark ? "white" : "#152238",
            }}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  const draft = filterState.draft;
  const [history, setHistory] = useState<MatchableItem[]>([]);
  const [review, setReview] = useState<MatchableItem | null>(null);
  const [handled, setHandled] = useState<string[]>([]);
  const query = useMatchingEntities(filters);
  const candidate = query.data?.pages
    .flatMap((page) => page.entities)
    .find((item) => !handled.includes(`${item.entity_type}:${item.id}`));
  const item = review || candidate;
  const leaveMatching = () =>
    router.canGoBack() ? router.back() : router.replace("/");
  useEffect(() => {
    if (
      !candidate &&
      query.hasNextPage &&
      !query.isFetching &&
      !query.isError
    ) {
      void query.fetchNextPage();
    }
  }, [
    candidate,
    query.hasNextPage,
    query.isFetching,
    query.isError,
    query.fetchNextPage,
  ]);
  const hasProfile = query.data?.pages[0]?.hasProfile === true;
  const matches = useInfiniteQuery({
    enabled: tab === "matches",
    queryKey: ["matching-matches", uid],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("matching_matches")
        .select("*")
        .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (error) throw error;
      return Promise.all(
        data.map(async (row) => {
          const mineFirst = row.user1_id === uid;
          const otherId = mineFirst ? row.user2_id : row.user1_id;
          const club = (mineFirst ? row.user2_type : row.user1_type) === "club";
          const other = await supabase
            .from(club ? "fff_clubs" : "profiles")
            .select(club ? "id,name,logo_url" : "id,full_name,avatar_url")
            .eq("id", otherId)
            .maybeSingle();
          if (other.error) throw other.error;
          const value = other.data as any;
          return {
            ...row,
            otherId,
            club,
            name: value?.name || value?.full_name || "Compte indisponible",
            avatar: value?.logo_url || value?.avatar_url,
          };
        }),
      );
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const loadedMatches = matches.data?.pages.flat() || [];
  const filteredMatches = loadedMatches.filter((match) => {
    if (matchFilter === "Validés") return match.status === "active";
    if (matchFilter === "En attente") return match.status === "pending";
    if (matchFilter === "Profils") return !match.club;
    if (matchFilter === "Clubs") return match.club;
    return true;
  });
  const swipe = useMutation({
    mutationFn: async ({
      item,
      direction,
    }: {
      item: MatchableItem;
      direction: "left" | "right" | "super";
    }): Promise<{ message: string; newMatch: boolean; item: MatchableItem }> => {
      if (!hasProfile)
        throw new Error("Enregistrez votre profil pour envoyer un intérêt.");
      const typed = await supportsClubMatching();
      if (item.entity_type === "club" && !typed)
        throw new Error(
          "La mise en relation avec les clubs n’est pas encore disponible.",
        );
      let priorQuery = supabase
        .from("swipes")
        .select("id,direction")
        .eq("swiper_id", uid)
        .eq("target_id", item.id);
      if (typed) priorQuery = priorQuery.eq("target_type", item.entity_type);
      const prior = await priorQuery.maybeSingle();
      if (prior.error) throw prior.error;
      if (prior.data && prior.data.direction !== direction)
        throw new Error(
          "Un autre choix est déjà enregistré pour cette fiche. Actualisez les suggestions.",
        );
      if (!prior.data) {
        const { error } = await supabase.from("swipes").insert({
          swiper_id: uid,
          target_id: item.id,
          ...(typed ? { target_type: item.entity_type } : {}),
          direction,
        });
        if (error) throw error;
      }
      if (direction === "left") return { message: "Choix enregistré.", newMatch: false, item };
      if (item.entity_type === "profile") {
        const reciprocal = await supabase
          .from("swipes")
          .select("id")
          .eq("swiper_id", item.id)
          .eq("target_id", uid)
          .in("direction", ["right", "super"])
          .maybeSingle();
        if (reciprocal.error)
          throw new Error(
            "Votre intérêt est enregistré, mais sa réciprocité n’a pas pu être vérifiée.",
          );
        if (!reciprocal.data) return { message: "Votre intérêt est enregistré.", newMatch: false, item };
      }
      const club = item.entity_type === "club";
      const first = club || uid < item.id ? uid : item.id;
      const second = club || uid < item.id ? item.id : uid;
      const priorMatch = await supabase
        .from("matching_matches")
        .select("id,status")
        .eq("user1_id", first)
        .eq("user2_id", second)
        .maybeSingle();
      if (priorMatch.error) throw priorMatch.error;
      let newMatch = false;
      if (!priorMatch.data) {
        const { error } = await supabase.from("matching_matches").insert({
          user1_id: first,
          user2_id: second,
          ...(typed
            ? { user1_type: "profile", user2_type: club ? "club" : "profile" }
            : {}),
          status: club ? "pending" : "active",
          compatibility_score: item.compatibility_score,
        });
        if (error)
          throw new Error(
            "Votre intérêt est enregistré, mais la rencontre n’a pas pu être confirmée. Réessayez pour terminer.",
          );
        newMatch = true;
        const rows = [
          {
            receiver_id: uid,
            sender_id: item.entity_type === "profile" ? item.id : uid,
            type: "matching_match",
            content: club
              ? `Nouveau match avec ${item.name}. Contacte le club maintenant.`
              : `C’est un match avec ${item.name} ! Envoie-lui un message maintenant.`,
            link: club ? `/club/${item.id}` : `/conversation/${item.id}`,
            metadata: {
              target_id: item.id,
              target_type: item.entity_type,
              compatibility_score: item.compatibility_score,
            },
          },
          ...(!club
            ? [
                {
                  receiver_id: item.id,
                  sender_id: uid,
                  type: "matching_match",
                  content: `C’est un match avec toi sur FootNation ! Discuter maintenant.`,
                  link: `/conversation/${uid}`,
                  metadata: {
                    target_id: uid,
                    target_type: "profile",
                    compatibility_score: item.compatibility_score,
                  },
                },
              ]
            : []),
        ];
        const notification = await supabase.from("notifications").insert(rows);
        if (notification.error) {
          // The match is already created; keep the user flow intact and refresh visible counters.
          console.warn("matching notification failed", notification.error.message);
        }
      }
      return {
        message: club
          ? "Intérêt transmis au club, en attente de réponse."
          : "Vous avez un intérêt réciproque !",
        newMatch,
        item,
      };
    },
    onSuccess: (result, { item }) => {
      setHistory((list) => [...list, item]);
      setHandled((list) => [...list, `${item.entity_type}:${item.id}`]);
      if (result.newMatch) setMatchCelebration(item);
      void cache.invalidateQueries({ queryKey: ["matching-matches", uid] });
      void cache.invalidateQueries({ queryKey: ["notifications", uid] });
      void cache.invalidateQueries({ queryKey: ["notifications", uid, "unread-count"] });
    },
  });
  return (
    <>
      <Modal
        visible={!!matchCelebration}
        transparent
        animationType="fade"
        onRequestClose={() => setMatchCelebration(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: "rgba(2,8,23,0.82)",
          }}
        >
          {!!matchCelebration && (
            <View
              style={{
                borderRadius: 34,
                padding: 24,
                gap: 18,
                alignItems: "center",
                backgroundColor: "#071A2F",
                borderWidth: 1,
                borderColor: "rgba(96,165,250,0.45)",
                shadowColor: "#0B7CFF",
                shadowOpacity: 0.35,
                shadowRadius: 30,
                shadowOffset: { width: 0, height: 14 },
              }}
            >
              <Text style={{ fontSize: 54 }}>🔥</Text>
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 38,
                  lineHeight: 44,
                  fontWeight: "900",
                  textAlign: "center",
                }}
              >
                C’est un match !
              </Text>
              <Text
                style={{
                  color: "#BFDBFE",
                  fontSize: 18,
                  lineHeight: 25,
                  textAlign: "center",
                  fontWeight: "700",
                }}
              >
                {matchCelebration.entity_type === "club"
                  ? `${matchCelebration.name} a été ajouté à tes rencontres.`
                  : `${matchCelebration.name} est prêt à discuter avec toi.`}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  matchCelebration.entity_type === "club"
                    ? "Contacter le club"
                    : "Envoyer un message"
                }
                onPress={() => {
                  const target = matchCelebration;
                  setMatchCelebration(null);
                  router.push(
                    target.entity_type === "club"
                      ? `/club/${target.id}`
                      : `/conversation/${target.id}`,
                  );
                }}
                style={({ pressed }) => ({
                  width: "100%",
                  minHeight: 62,
                  borderRadius: 22,
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? "#005BD1" : "#087BFF",
                })}
              >
                <MessageCircle size={25} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 19, fontWeight: "900" }}>
                  {matchCelebration.entity_type === "club"
                    ? "Contacter le club"
                    : "Envoyer un message"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continuer à matcher"
                onPress={() => setMatchCelebration(null)}
                style={{ padding: 10 }}
              >
                <Text style={{ color: "rgba(255,255,255,0.72)", fontWeight: "800" }}>
                  Continuer à matcher
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
      <Text style={s.subtitle}>
        Trouve ton équipe. Rencontre les talents du foot.
      </Text>
      <View style={s.row}>
        <Chip
          label="Découvrir"
          selected={tab === "discover"}
          onPress={() => setTab("discover")}
        />
        <Chip
          label="Mes rencontres"
          selected={tab === "matches"}
          onPress={() => setTab("matches")}
        />
      </View>
      {tab === "discover" ? (
        <>
          {categoryBar()}
          <Button
            title={
              filtersOpen ? "Masquer les filtres" : "Filtrer les suggestions"
            }
            secondary
            onPress={() => setFiltersOpen((open) => !open)}
          />
          <Text style={s.small}>
            {[
              filters.entityType === "club"
                ? "Clubs"
                : filters.entityType === "profile"
                  ? "Profils"
                  : "Tous les profils et clubs",
              filters.role,
              filters.position,
              filters.level,
              filters.department,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {!!filtersOpen && (
            <View style={s.card}>
              <Text style={s.h2}>Filtrer les suggestions</Text>
              <Text style={s.small}>
                Vos choix seront utilisés après avoir touché Appliquer.
              </Text>
              <View style={[s.row, { flexWrap: "wrap" }]}>
                {[
                  ["all", "Tous"],
                  ["profile", "Profils"],
                  ["club", "Clubs"],
                ].map(([value, label]) => (
                  <Chip
                    key={value}
                    label={label}
                    selected={(draft.entityType || "all") === value}
                    onPress={() =>
                      dispatchFilters({
                        type: "edit",
                        field: "entityType",
                        value,
                      })
                    }
                  />
                ))}
              </View>
              {draft.entityType !== "club" && (
                <ChoiceField
                  label="Rôle recherché"
                  value={draft.role || ""}
                  options={roleOptions}
                  onChange={(value) =>
                    dispatchFilters({ type: "edit", field: "role", value })
                  }
                />
              )}
              <ChoiceField
                label="Poste recherché"
                value={draft.position || ""}
                options={matchingPositionOptions}
                onChange={(value) =>
                  dispatchFilters({ type: "edit", field: "position", value })
                }
              />
              <ChoiceField
                label="Niveau recherché"
                value={draft.level || ""}
                options={matchingLevelOptions}
                onChange={(value) =>
                  dispatchFilters({ type: "edit", field: "level", value })
                }
              />
              <ChoiceField
                label="Département"
                value={draft.department || ""}
                options={departmentOptions}
                onChange={(value) =>
                  dispatchFilters({ type: "edit", field: "department", value })
                }
              />
              <Button
                title="Appliquer les filtres"
                onPress={() => {
                  dispatchFilters({ type: "apply" });
                  setCategory("Tous");
                  setReview(null);
                  swipe.reset();
                  setFiltersOpen(false);
                }}
              />
              <Button
                title="Réinitialiser les filtres"
                secondary
                onPress={() => {
                  dispatchFilters({ type: "reset" });
                  setCategory("Tous");
                  setReview(null);
                  swipe.reset();
                }}
              />
            </View>
          )}
          {!item && (query.isPending || query.isFetchingNextPage) ? (
            <Loading />
          ) : !item && query.error ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : item ? (
            <>
              <Modal
                visible={!filtersOpen && isFocused}
                animationType="fade"
                onRequestClose={() =>
                  review ? setReview(null) : leaveMatching()
                }
              >
                <FootballMatchCard
                  key={`${item.entity_type}:${item.id}`}
                  item={item}
                  busy={swipe.isPending || !!review}
                  fullscreen
                  overlay={
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      {[
                        ["Retour", leaveMatching],
                        [
                          "Filtres",
                          () => {
                            setReview(null);
                            setFiltersOpen(true);
                          },
                        ],
                        [
                          "Rencontres",
                          () => {
                            setReview(null);
                            setTab("matches");
                          },
                        ],
                      ].map(([label, action]) => (
                        <Pressable
                          key={label as string}
                          accessibilityRole="button"
                          accessibilityLabel={label as string}
                          onPress={action as () => void}
                          style={{
                            padding: 10,
                            backgroundColor: "#102338dd",
                            borderRadius: 20,
                          }}
                        >
                          {label === "Retour" ? (
                            <ArrowLeft
                              size={22}
                              color="white"
                              strokeWidth={2.4}
                            />
                          ) : (
                            <Text
                              style={{ color: "white", fontWeight: "700" }}
                            >
                              {label as string}
                            </Text>
                          )}
                        </Pressable>
                      ))}
                      {categoryBar(true)}
                      {!hasProfile && (
                        <Pressable
                          onPress={() => router.push("/profile-setup")}
                        >
                          <Text style={{ color: "white" }}>
                            Enregistrer mon profil pour matcher →
                          </Text>
                        </Pressable>
                      )}
                      {!!swipe.error && (
                        <Text
                          accessibilityRole="alert"
                          style={{
                            color: "white",
                            width: "100%",
                            backgroundColor: "#6b1f2b",
                            padding: 12,
                            borderRadius: 12,
                          }}
                        >
                          {swipe.error.message ||
                            "Impossible d’enregistrer votre choix. Réessayez."}
                        </Text>
                      )}
                    </View>
                  }
                  showScore={hasProfile}
                  canReview={!review && !!history.length}
                  onReview={() => setReview(history[history.length - 1] || null)}
                  canLike={
                    hasProfile &&
                    (item.entity_type === "profile" ||
                      !!query.data?.pages[0]?.supportsClubs)
                  }
                  onOpen={() =>
                    router.push(
                      `/${item.entity_type === "club" ? "club" : "profile"}/${item.id}`,
                    )
                  }
                  onChoose={(direction) => {
                    if (review || !candidate) return;
                    swipe.reset();
                    if (
                      direction === "left" &&
                      (!hasProfile ||
                        (candidate.entity_type === "club" &&
                          !query.data?.pages[0]?.supportsClubs))
                    ) {
                      setHistory((items) => [...items, candidate]);
                      setHandled((items) => [
                        ...items,
                        `${candidate.entity_type}:${candidate.id}`,
                      ]);
                    } else {
                      swipe.mutate({ item: candidate, direction });
                    }
                  }}
                />
              </Modal>
              {!hasProfile && (
                <Button
                  title="Enregistrer mon profil pour matcher"
                  onPress={() => router.push("/profile-setup")}
                />
              )}
              {item.entity_type === "club" &&
                !query.data?.pages[0]?.supportsClubs && (
                  <Text style={s.small}>
                    La mise en relation avec les clubs n’est pas encore
                    disponible. Vous pouvez consulter leur fiche.
                  </Text>
                )}
            </>
          ) : (
            <>
              <Empty
                title="Aucune suggestion disponible"
                description="Essayez d’autres filtres."
              />
              {!!history.length && (
                <Button
                  title="Revoir la dernière fiche"
                  secondary
                  onPress={() => setReview(history[history.length - 1])}
                />
              )}
            </>
          )}
          {!!(!candidate && query.hasNextPage) && (
            <Button
              title="Charger d’autres suggestions"
              busy={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          )}
          {!!swipe.error && <ErrorState error={swipe.error} />}
        </>
      ) : (
        <>
          {matches.isPending ? (
            <Loading />
          ) : matches.error ? (
            <ErrorState error={matches.error} />
          ) : !loadedMatches.length ? (
            <Empty title="Aucune rencontre pour le moment" />
          ) : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {["Tous", "Validés", "En attente", "Profils", "Clubs"].map((label) => (
                  <Pressable
                    key={label}
                    accessibilityRole="button"
                    accessibilityState={{ selected: matchFilter === label }}
                    onPress={() => setMatchFilter(label)}
                    style={{
                      minHeight: 42,
                      borderRadius: 999,
                      paddingHorizontal: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: matchFilter === label ? "#087BFF" : "#EAF0F7",
                      borderWidth: 1,
                      borderColor: matchFilter === label ? "#087BFF" : "#D8E1EC",
                    }}
                  >
                    <Text
                      style={{
                        color: matchFilter === label ? "#FFFFFF" : "#142033",
                        fontWeight: "900",
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View
                style={{
                  borderRadius: 24,
                  padding: 18,
                  gap: 6,
                  backgroundColor: "#EAF3FF",
                  borderWidth: 1,
                  borderColor: "#B9D8FF",
                }}
              >
                <Text style={{ color: "#0B63CE", fontSize: 15, fontWeight: "900" }}>
                  {matchCountLabel(filteredMatches.length, matchFilter === "Tous" && matches.hasNextPage)}
                </Text>
                <Text style={s.small}>
                  {matchFilter === "Tous"
                    ? "Continue la discussion avec tes matchs les plus récents."
                    : `${loadedMatches.length - filteredMatches.length} match(s) masqué(s) par le filtre.`}
                </Text>
              </View>
              {!filteredMatches.length ? (
                <Empty
                  title="Aucun match avec ce filtre"
                  description="Changez de filtre pour retrouver vos autres rencontres."
                />
              ) : filteredMatches.map((m) => (
              <View
                key={m.id}
                style={{
                  borderRadius: 30,
                  padding: 18,
                  gap: 16,
                  backgroundColor: "#071A2F",
                  borderWidth: 1,
                  borderColor: "rgba(37,99,235,0.24)",
                  shadowColor: "#0B63FF",
                  shadowOpacity: 0.16,
                  shadowRadius: 22,
                  shadowOffset: { width: 0, height: 10 },
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      padding: 3,
                      borderRadius: 999,
                      backgroundColor: "#0B7CFF",
                    }}
                  >
                    <Avatar uri={m.avatar} name={m.name} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                    <View
                      style={{
                        alignSelf: "flex-start",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                        backgroundColor:
                          m.status === "active"
                            ? "rgba(52,211,153,0.16)"
                            : "rgba(251,191,36,0.16)",
                      }}
                    >
                      <Sparkles
                        size={13}
                        color={m.status === "active" ? "#34D399" : "#FBBF24"}
                      />
                      <Text
                        style={{
                          color: m.status === "active" ? "#A7F3D0" : "#FDE68A",
                          fontSize: 12,
                          fontWeight: "900",
                        }}
                      >
                        {m.status === "pending" ? "En attente" : "Match validé"}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 25,
                        lineHeight: 31,
                        fontWeight: "900",
                      }}
                      numberOfLines={1}
                    >
                      {m.name}
                    </Text>
                    <Text style={{ color: "rgba(226,232,240,0.72)", fontSize: 14 }}>
                      {formatMatchDate(m.created_at)}
                    </Text>
                    <Text style={{ color: "rgba(226,232,240,0.62)", fontSize: 13 }}>
                      Lance la discussion maintenant.
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={m.club ? "Contacter le club" : "Envoyer un message"}
                  onPress={() =>
                    m.club
                      ? router.push(`/club/${m.otherId}`)
                      : router.push(`/conversation/${m.otherId}`)
                  }
                  style={({ pressed }) => ({
                    minHeight: 62,
                    borderRadius: 22,
                    paddingHorizontal: 18,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    backgroundColor: pressed ? "#005BD1" : "#087BFF",
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <MessageCircle size={24} color="#FFFFFF" />
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 19,
                      fontWeight: "900",
                    }}
                  >
                    {m.club ? "Contacter le club" : "Envoyer un message"}
                  </Text>
                </Pressable>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <MatchFollowButton
                      id={m.otherId}
                      name={m.name}
                      club={m.club}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={m.club ? "Voir le club" : "Voir le profil"}
                    onPress={() =>
                      router.push(`/${m.club ? "club" : "profile"}/${m.otherId}`)
                    }
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 52,
                      borderRadius: 18,
                      flexDirection: "row",
                      gap: 8,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: pressed
                        ? "rgba(255,255,255,0.18)"
                        : "rgba(255,255,255,0.10)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.14)",
                    })}
                  >
                    <Text style={{ color: "#E5F0FF", fontWeight: "900" }}>
                      {m.club ? "Voir le club" : "Voir le profil"}
                    </Text>
                    <ArrowUpRight size={17} color="#E5F0FF" />
                  </Pressable>
                </View>
              </View>
            ))}
            </>
          )}
          {!!matches.hasNextPage && (
            <Button
              title="Voir plus"
              busy={matches.isFetchingNextPage}
              onPress={() => void matches.fetchNextPage()}
            />
          )}
        </>
      )}
    </>
  );
}

function MatchFollowButton({
  id,
  name,
  club,
}: {
  id: string;
  name: string;
  club: boolean;
}) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const cache = useQueryClient();
  const s = useUIStyles();
  const queryKey = club ? ["club-follow", id, uid] : ["following", uid, id];
  const follow = useQuery({
    enabled: !!uid,
    queryKey,
    queryFn: async () => {
      const result = club
        ? await supabase
            .from("club_followers")
            .select("id")
            .eq("club_id", id)
            .eq("profile_id", uid!)
            .maybeSingle()
        : await supabase
            .from("profile_followers")
            .select("id")
            .eq("follower_id", uid!)
            .eq("followed_id", id)
            .maybeSingle();
      if (result.error) throw result.error;
      return result.data?.id || null;
    },
  });
  const mutation = useMutation({
    mutationFn: async () => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (!uid || auth.data.user?.id !== uid)
        throw new Error("Votre session a changé. Reconnectez-vous.");
      if (follow.data) {
        const result = club
          ? await supabase
              .from("club_followers")
              .delete()
              .eq("id", follow.data)
              .eq("club_id", id)
              .eq("profile_id", uid)
          : await supabase
              .from("profile_followers")
              .delete()
              .eq("id", follow.data)
              .eq("follower_id", uid)
              .eq("followed_id", id);
        if (result.error) throw result.error;
        return;
      }
      const result = club
        ? await supabase
            .from("club_followers")
            .insert({ club_id: id, profile_id: uid, club_name: name })
        : await supabase
            .from("profile_followers")
            .insert({ follower_id: uid, followed_id: id });
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey }),
        cache.invalidateQueries({ queryKey: ["profile-follows", uid] }),
        cache.invalidateQueries({ queryKey: ["club-follow", id] }),
        cache.invalidateQueries({ queryKey: ["my-followed-clubs", uid] }),
      ]);
    },
  });
  const busy = follow.isFetching || mutation.isPending;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={follow.data ? "Ne plus suivre" : "Suivre"}
        accessibilityState={{ selected: !!follow.data, disabled: !uid || busy }}
        disabled={!uid || busy}
        onPress={() => mutation.mutate()}
        style={({ pressed }) => ({
          minHeight: 52,
          borderRadius: 18,
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: follow.data
            ? "rgba(52,211,153,0.16)"
            : pressed
              ? "rgba(255,255,255,0.18)"
              : "rgba(255,255,255,0.10)",
          borderWidth: 1,
          borderColor: follow.data
            ? "rgba(52,211,153,0.40)"
            : "rgba(255,255,255,0.14)",
          opacity: busy ? 0.65 : 1,
        })}
      >
        {!!follow.data && <Check size={17} color="#A7F3D0" />}
        <Text
          style={{
            color: follow.data ? "#A7F3D0" : "#E5F0FF",
            fontWeight: "900",
          }}
        >
          {busy
            ? "…"
            : mutation.isError || follow.isError
              ? "Réessayer"
              : follow.data
                ? "Suivi"
                : "Suivre"}
        </Text>
      </Pressable>
      {!!mutation.error && (
        <Text accessibilityRole="alert" style={[s.small, { color: "#FCA5A5" }]}>
          Suivi non enregistré.
        </Text>
      )}
    </>
  );
}
