import { ApplicationFollowup } from "../components/ApplicationFollowup";
import React from "react";
import { LockKeyhole } from "lucide-react-native";
import { useTheme } from "../theme";
import {
  OpportunityIntro,
  OpportunityAction,
  OpportunityCard,
  OpportunityBadge,
  OpportunityMessage,
  opportunityDate,
  opportunityUI,
} from "../components/OpportunityUI";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { AuthGate } from "../components/AuthGate";
import { ErrorState, Loading, Screen, useUIStyles } from "../components/ui";

const statusLabels: Record<string, string> = {
  pending: "Envoyée",
  reviewed: "En cours d’examen",
  accepted: "Acceptée",
  rejected: "Non retenue",
  withdrawn: "Retirée",
};

type ApplicationRow = {
  id: string;
  applicant_id: string;
  opportunity_id: string;
  status: string | null;
  created_at: string | null;
  message: string | null;
  opportunities: { title: string; user_id: string } | null;
};

export default function ProfileApplications() {
  const s = useUIStyles();
  const { colors } = useTheme();
  const { session } = useAuth();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const received = mode === "received";
  const uid = session?.user.id;
  const q = useInfiniteQuery({
    queryKey: ["profile-applications", uid, received ? "received" : "sent"],
    enabled: !!uid,
    staleTime: 0,
    refetchInterval: 30000,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let request = supabase
        .from("opportunity_applications")
        .select(
          received
            ? "id,applicant_id,opportunity_id,status,created_at,message,opportunities!inner(title,user_id)"
            : "id,applicant_id,opportunity_id,status,created_at,message,opportunities(title,user_id)",
        );
      request = received
        ? request.eq("opportunities.user_id", uid!)
        : request.eq("applicant_id", uid!);
      const { data, error } = await request
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam * 30, pageParam * 30 + 29);
      if (error) throw error;
      return data as unknown as ApplicationRow[];
    },
    getNextPageParam: (last, _pages, page) =>
      last.length === 30 ? page + 1 : undefined,
  });
  const rows = q.data?.pages.flat() || [];
  return (
    <Screen title={received ? "Candidatures reçues" : "Candidatures"}>
      <AuthGate>
        <OpportunityIntro
          tone="rose"
          Icon={LockKeyhole}
          title={
            received
              ? "Une réponse peut tout changer"
              : "Chaque candidature, une nouvelle chance"
          }
          description={
            received
              ? "Consultez les candidatures et donnez une réponse aux candidats. Cet espace est privé."
              : "Retrouvez vos démarches, leur statut et leur suivi de lecture. Cet espace est privé."
          }
        />
        {q.isPending ? (
          <Loading />
        ) : q.isError && !q.data ? (
          <ErrorState error={q.error} retry={() => void q.refetch()} />
        ) : (
          <>
            {!rows.length && (
              <OpportunityCard>
                <Text style={s.h2}>
                  {received
                    ? "Aucune candidature reçue pour le moment"
                    : "Votre prochaine aventure vous attend"}
                </Text>
                <Text style={s.text}>
                  {received
                    ? "Les candidatures à vos annonces apparaîtront ici."
                    : "Découvrez les annonces et envoyez votre première candidature."}
                </Text>
                <OpportunityAction
                  tone="rose"
                  title={
                    received ? "Voir mes offres" : "Explorer les opportunités"
                  }
                  onPress={() =>
                    router.push(received ? "/my-offers" : "/opportunities")
                  }
                />
              </OpportunityCard>
            )}
            {rows.map((a) => (
              <OpportunityCard key={a.id}>
                <View style={opportunityUI.row}>
                  <OpportunityBadge
                    label={statusLabels[a.status || "pending"] || "En cours"}
                    tone={
                      a.status === "accepted"
                        ? "green"
                        : a.status === "rejected" || a.status === "withdrawn"
                          ? "rose"
                          : "blue"
                    }
                  />
                  {!!opportunityDate(a.created_at) && (
                    <Text style={s.small}>
                      Envoyée le {opportunityDate(a.created_at)}
                    </Text>
                  )}
                </View>
                <Text style={[opportunityUI.title, { color: colors.ink }]}>
                  {a.opportunities?.title || "Opportunité indisponible"}
                </Text>
                {!received && !!a.message && (
                  <OpportunityMessage message={a.message} />
                )}
                {!!a.opportunities && (
                  <OpportunityAction
                    title="Voir l’opportunité"
                    tone="rose"
                    onPress={() =>
                      router.push(`/opportunity/${a.opportunity_id}`)
                    }
                  />
                )}
                <ApplicationFollowup
                  application={a}
                  owner={received}
                  dashboard
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
                tone="rose"
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
