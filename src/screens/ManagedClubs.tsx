import React, { useCallback } from "react";
import { Text, View } from "react-native";
import {
  Redirect,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Banner,
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { loadManagedClubs } from "../lib/managedClubs";
export default function ManagedClubs() {
  const uid = useAuth().session?.user.id;
  const { id, clubId } = useLocalSearchParams<{
    id?: string;
    clubId?: string;
  }>();
  const requested = id || clubId;
  if (requested)
    return <Redirect href={`/club-admin/${encodeURIComponent(requested)}`} />;
  return (
    <Screen title="Tableau de bord des clubs">
      <AuthGate>{!!uid && <ClubList key={uid} uid={uid} />}</AuthGate>
    </Screen>
  );
}
function ClubList({ uid }: { uid: string }) {
  const s = useUIStyles();

  const query = useInfiniteQuery({
    queryKey: ["managed-clubs", uid],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => loadManagedClubs(uid, pageParam),
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );
  return (
    <>
      <Banner
        eyebrow="ESPACE RESPONSABLE"
        title="Mes clubs administrés"
        description="Choisissez un club pour accéder à ses informations, équipes et outils de gestion."
      />
      <Button
        secondary
        title="Actualiser"
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data?.pages.flat().length && (
            <Empty
              title="Aucun club administré"
              description="Pour représenter un club, retrouvez sa fiche dans l’annuaire puis utilisez « Je représente ce club »."
            />
          )}
          {query.data?.pages.flat().map((row) => (
            <View key={row.id} style={s.card}>
              <Avatar
                uri={row.club?.logo_url}
                name={row.club?.name || "Club"}
              />
              <Text style={s.h2}>
                {row.club?.short_name || row.club?.name || "Club indisponible"}
              </Text>
              {!!row.club?.city && <Text style={s.small}>{row.club.city}</Text>}
              {row.club ? (
                <Button
                  title="Administrer le club"
                  onPress={() => router.push(`/club-admin/${row.club_id}`)}
                />
              ) : (
                <Text style={s.small}>
                  Cette affectation ne correspond pas à une fiche accessible
                  dans l’annuaire.
                </Text>
              )}
            </View>
          ))}
          {!!query.hasNextPage && (
            <Button
              secondary
              title="Afficher davantage"
              busy={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          )}
        </>
      )}
      <Button
        secondary
        title="Rechercher un club"
        onPress={() => router.push("/clubs")}
      />
    </>
  );
}
