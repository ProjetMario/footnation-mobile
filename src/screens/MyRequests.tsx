import React from "react";
import { Text, View } from "react-native";
import { Briefcase, FileText, Plus, Target } from "lucide-react-native";
import { useTheme } from "../theme";
import {
  OpportunityIntro,
  OpportunityAction,
  OpportunityCard,
  OpportunityBadge,
  opportunityDate,
  opportunityUI,
} from "../components/OpportunityUI";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { AuthGate } from "../components/AuthGate";
import { ErrorState, Loading, Screen, useUIStyles } from "../components/ui";
export default function MyRequests({ offers = false }: { offers?: boolean }) {
  const { session } = useAuth();
  const s = useUIStyles();
  const { colors } = useTheme();
  const tone = offers ? "green" : "violet";
  const publish = () =>
    router.push(
      offers ? "/opportunity/new?kind=offer" : "/opportunity/new?kind=request",
    );
  const q = useInfiniteQuery({
    queryKey: ["my-opportunity-requests", session?.user.id, offers],
    enabled: !!session,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id,title,is_active,expires_at,created_at")
        .eq("user_id", session!.user.id)
        .or(
          offers
            ? "listing_kind.eq.offer,and(listing_kind.is.null,opportunity_type.not.in.(recherche_club,recherche_emploi,recherche_stage,job_request,club_request))"
            : "listing_kind.eq.request,and(listing_kind.is.null,opportunity_type.in.(recherche_club,recherche_emploi,recherche_stage,job_request,club_request))",
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam * 30, pageParam * 30 + 29);
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, _pages, page) =>
      last.length === 30 ? page + 1 : undefined,
  });
  const rows = q.data?.pages.flat() || [];
  return (
    <Screen title={offers ? "Offres" : "Demandes publiées"}>
      <AuthGate>
        <OpportunityIntro
          tone={tone}
          Icon={offers ? Briefcase : FileText}
          title={
            offers
              ? "Faites grandir votre équipe"
              : "Donnez de la visibilité à vos projets"
          }
          description={
            offers
              ? "Les places, missions et projets que vous proposez."
              : "Vos recherches publiées depuis votre projet carrière ou directement."
          }
        >
          <OpportunityAction
            title={offers ? "Publier une offre" : "Publier une demande"}
            primary
            tone={tone}
            Icon={Plus}
            onPress={publish}
          />
          {!offers && (
            <OpportunityAction
              title="Mon projet carrière"
              tone={tone}
              Icon={Target}
              onPress={() => router.push("/career-preferences")}
            />
          )}
        </OpportunityIntro>
        {q.isPending ? (
          <Loading />
        ) : q.isError && !q.data ? (
          <ErrorState error={q.error} retry={() => void q.refetch()} />
        ) : (
          <>
            {!rows.length && (
              <OpportunityCard>
                <Text style={s.h2}>
                  {offers
                    ? "Votre prochaine rencontre commence par une offre"
                    : "Votre recherche mérite d’être découverte"}
                </Text>
                <Text style={s.text}>
                  {offers
                    ? "Publiez votre première offre pour rencontrer les profils qui vous correspondent."
                    : "Publiez votre première demande pour faire connaître votre recherche à la communauté."}
                </Text>
                <OpportunityAction
                  title={
                    offers
                      ? "Créer ma première offre"
                      : "Créer ma première demande"
                  }
                  tone={tone}
                  onPress={publish}
                />
              </OpportunityCard>
            )}
            {rows.map((item) => (
              <OpportunityCard key={item.id}>
                <View style={opportunityUI.row}>
                  <OpportunityBadge
                    tone={
                      !item.is_active ||
                      (item.expires_at &&
                        Date.parse(item.expires_at) < Date.now())
                        ? "rose"
                        : tone
                    }
                    label={
                      !item.is_active
                        ? "Désactivée"
                        : item.expires_at &&
                            Date.parse(item.expires_at) < Date.now()
                          ? "Expirée"
                          : "Publiée"
                    }
                  />
                  {!!opportunityDate(item.created_at) && (
                    <Text style={s.small}>
                      Créée le {opportunityDate(item.created_at)}
                    </Text>
                  )}
                </View>
                <Text style={[opportunityUI.title, { color: colors.ink }]}>
                  {item.title}
                </Text>
                <OpportunityAction
                  title={offers ? "Voir mon offre" : "Voir ma demande"}
                  tone={tone}
                  onPress={() => router.push(`/opportunity/${item.id}`)}
                />
              </OpportunityCard>
            ))}
            {q.isError && !!q.data && (
              <ErrorState
                error={q.error}
                retry={() =>
                  void (q.isFetchNextPageError
                    ? q.fetchNextPage()
                    : q.refetch())
                }
              />
            )}
            {q.hasNextPage && (
              <OpportunityAction
                title="Voir plus"
                tone={tone}
                busy={q.isFetchingNextPage}
                onPress={() => void q.fetchNextPage()}
              />
            )}
          </>
        )}
      </AuthGate>
    </Screen>
  );
}
