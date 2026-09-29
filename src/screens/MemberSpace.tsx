import React, { useRef, useState } from "react";
import { normalizeTeamInvite } from "../lib/authReturn";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  memberTeamStatus,
  teamCalendarPath,
} from "../lib/memberTeamPresentation";

const labels: Record<string, string> = {
  invitations: "Mes invitations",
  convocations: "Mes convocations",
  teams: "Mes équipes",
};
const statuses: Record<string, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  declined: "Déclinée",
  rejected: "Refusée",
  injured: "Blessé",
  absent: "Absence renseignée par le club",
};
export default function MemberSpace() {
  const uid = useAuth().session?.user.id;
  const { section = "invitations", teamInvite } = useLocalSearchParams<{
    section: string;
    teamInvite?: string;
  }>();
  if (!Object.hasOwn(labels, section))
    return <Screen title="Page introuvable"><Empty title="Cette rubrique n’existe pas." /></Screen>;
  return (
    <Screen title={labels[section] || "Mon club"}>
      <AuthGate>
        <MemberContent
          key={`${uid}:${section}:${normalizeTeamInvite(teamInvite) || ""}`}
          section={section}
        />
      </AuthGate>
    </Screen>
  );
}
function MemberContent({ section }: { section: string }) {
  const s = useUIStyles();

  const { session, reload } = useAuth();
  const uid = session!.user.id;
  const cache = useQueryClient();
  const params = useLocalSearchParams<{ teamInvite?: string }>();
  const [teamInviteCode, setTeamInviteCode] = useState(
    () => normalizeTeamInvite(params.teamInvite) || "",
  );
  const invitationPending = useRef(false);
  const [teamInviteNotice, setTeamInviteNotice] = useState("");
  const [joinedClubId, setJoinedClubId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    accept: boolean;
    expectedStatus: string;
    expectedRespondedAt: string | null;
  } | null>(null);
  async function currentUser() {
    const r = await supabase.auth.getUser();
    if (r.error) throw r.error;
    if (r.data.user?.id !== uid)
      throw new Error("La session a changé. Rechargez cet écran.");
  }
  const query = useInfiniteQuery({
    queryKey: ["member-space", uid, section],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      await currentUser();
      let request;
      if (section === "invitations")
        request = supabase
          .from("club_membership_requests")
          .select(
            "id,requested_role,status,created_at,club:club_id(id,name,short_name,logo_url)",
          )
          .eq("profile_id", uid)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
      else if (section === "convocations") {
        const r = await supabase.rpc("get_native_member_convocations", {
          p_offset: pageParam,
          p_limit: 30,
        });
        if (r.error) throw r.error;
        return r.data as any[];
      } else if (section === "teams")
        request = supabase
          .from("team_members")
          .select(
            "id,role,jersey_number,position,status,team:teams!inner(id,name,category,season,club_id,club:fff_clubs!inner(id,name,logo_url))",
          )
          .eq("profile_id", uid)
          .eq("is_active", true);
      else throw new Error("Section inconnue");
      const { data, error } = await request
        .order("id")
        .range(pageParam, pageParam + 29);
      if (error) throw error;
      return data as any[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const teamInviteMutation = useMutation({
    mutationFn: async () => {
      invitationPending.current = true;
      try {
        await currentUser();
        const code = normalizeTeamInvite(teamInviteCode);
        if (!code)
          throw new Error(
            "Collez le code de 10 caractères reçu par votre coach.",
          );
        const result = await supabase.rpc(
          "accept_native_team_invitation_link",
          {
            p_code: code,
          },
        );
        if (result.error) throw result.error;
        return (result.data as { club_id: string }).club_id;
      } finally {
        invitationPending.current = false;
      }
    },
    onSuccess: (clubId) => {
      setJoinedClubId(clubId);
      setTeamInviteNotice(
        "Invitation acceptée. Votre équipe est maintenant rattachée à votre profil.",
      );
      setTeamInviteCode("");
      void reload();
      void cache.invalidateQueries({ queryKey: ["profile"] });
      void cache.invalidateQueries({ queryKey: ["club-people"] });
      void cache.invalidateQueries({ queryKey: ["member-space", uid] });
      void cache.invalidateQueries({ queryKey: ["club-member-context"] });
      void cache.invalidateQueries({ queryKey: ["club-member-rows"] });
      void cache.invalidateQueries({ queryKey: ["member-calendar"] });
      void cache.invalidateQueries({
        queryKey: ["onboarding-member-teams", uid],
      });
    },
  });
  const mutation = useMutation({
    mutationFn: async ({
      id,
      accept,
      expectedStatus,
      expectedRespondedAt,
    }: {
      id: string;
      accept: boolean;
      expectedStatus: string;
      expectedRespondedAt: string | null;
    }) => {
      await currentUser();
      let result;
      if (section === "invitations" && accept)
        result = await supabase.rpc("accept_club_membership_request", {
          request_id: id,
        });
      else if (section === "invitations") {
        result = await supabase
          .from("club_membership_requests")
          .update({ status: "rejected" })
          .eq("id", id)
          .eq("profile_id", uid)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (!result.error && !result.data) {
          const latest = await supabase
            .from("club_membership_requests")
            .select("status")
            .eq("id", id)
            .eq("profile_id", uid)
            .maybeSingle();
          if (latest.error) throw latest.error;
          if (latest.data?.status !== "rejected")
            throw new Error("Cette invitation a changé. Actualisez la liste.");
        }
      } else {
        result = await supabase.rpc("respond_native_member_convocation", {
          p_id: id,
          p_status: accept ? "accepted" : "declined",
          p_expected_status: expectedStatus,
          p_expected_responded_at: expectedRespondedAt,
        });
      }
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      setConfirmation(null);
      if (section === "invitations") {
        void reload();
        void cache.invalidateQueries({ queryKey: ["profile"] });
        void cache.invalidateQueries({ queryKey: ["club-people"] });
        void cache.invalidateQueries({ queryKey: ["club-member-context"] });
        void cache.invalidateQueries({ queryKey: ["club-member-rows"] });
        void cache.invalidateQueries({ queryKey: ["member-calendar"] });
        void cache.invalidateQueries({
          queryKey: ["onboarding-member-teams", uid],
        });
      }
      void cache.invalidateQueries({ queryKey: ["member-space", uid] });
      void cache.invalidateQueries({ queryKey: ["convocation-roster"] });
    },
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <>
      <Button
        title="Actualiser"
        secondary
        busy={query.isFetching}
        disabled={mutation.isPending}
        onPress={() => {
          setConfirmation(null);
          mutation.reset();
          void query.refetch();
        }}
      />
      {!!mutation.error && <ErrorState error={mutation.error} />}
      {section === "invitations" && (
        <View style={s.card}>
          <Text style={s.h2}>J’ai reçu une invitation d’équipe</Text>
          <Text style={s.subtitle}>
            {normalizeTeamInvite(params.teamInvite)
              ? "Le code de votre coach est prêt. Confirmez ci-dessous pour rejoindre son équipe avec votre compte."
              : "Collez le code envoyé par votre coach, puis confirmez pour rattacher votre profil au club et à l’équipe."}
          </Text>
          <Field
            label="Code d’invitation"
            value={teamInviteCode}
            autoCapitalize="characters"
            editable={!teamInviteMutation.isPending}
            onChangeText={(value) => {
              setTeamInviteNotice("");
              setTeamInviteCode(value);
            }}
          />
          <Button
            title="Rejoindre l’équipe"
            busy={teamInviteMutation.isPending}
            disabled={
              teamInviteMutation.isPending ||
              !normalizeTeamInvite(teamInviteCode)
            }
            onPress={() => {
              if (!invitationPending.current) {
                invitationPending.current = true;
                teamInviteMutation.mutate();
              }
            }}
          />
          {!!teamInviteNotice && (
            <Text accessibilityRole="alert" style={s.text}>
              {teamInviteNotice}
            </Text>
          )}
          {!!joinedClubId && (
            <Button
              title="Retrouver le calendrier de mon équipe"
              onPress={() => router.push(`/club/${joinedClubId}/member`)}
            />
          )}
          {!!teamInviteMutation.error && (
            <ErrorState error={teamInviteMutation.error} />
          )}
        </View>
      )}
      {!query.data?.pages.flat().length && (
        <Empty title="Aucun élément pour le moment" />
      )}
      {query.data?.pages.flat().map((row) => {
        const item =
          section === "teams"
            ? row.team
            : section === "convocations"
              ? row.convocation
              : row.club;
        return (
          <View key={row.id} style={s.card}>
            <Text style={s.h2}>{item?.title || item?.name || "Club"}</Text>
            {section === "teams" ? (
              <>
                <Text style={s.text}>
                  {item?.club?.name} · {item?.category} · {item?.season}
                </Text>
                <Text style={s.subtitle}>
                  {row.position || row.role}
                  {row.jersey_number ? ` · N° ${row.jersey_number}` : ""}
                </Text>
                <Text style={s.small}>{memberTeamStatus(row.status)}</Text>
                {!!(item?.club_id && row.status === "approved") && (
                  <Button
                    title="Voir mon calendrier"
                    onPress={() =>
                      router.push(teamCalendarPath(item.club_id, item.id))
                    }
                  />
                )}
              </>
            ) : section === "convocations" ? (
              <>
                <Text style={s.text}>
                  {item?.meeting_date
                    ? new Date(item.meeting_date).toLocaleString("fr-FR")
                    : "Date à préciser"}
                </Text>
                <Text style={s.subtitle}>{item?.meeting_location}</Text>
                <Text style={s.text}>{item?.description}</Text>
              </>
            ) : (
              <Text style={s.subtitle}>{row.requested_role}</Text>
            )}
            {!!(row.status && section !== "teams") && (
              <Text style={s.small}>{statuses[row.status] || row.status}</Text>
            )}
            {!!(
              section === "invitations" ||
              (section === "convocations" &&
                ["pending", "accepted", "declined"].includes(row.status))
            ) && (
              <>
                <Button
                  title={
                    section === "invitations"
                      ? "Accepter l’invitation"
                      : "Je serai présent"
                  }
                  busy={mutation.isPending}
                  disabled={mutation.isPending || row.status === "accepted"}
                  onPress={() => {
                    mutation.reset();
                    setConfirmation({
                      id: row.id,
                      accept: true,
                      expectedStatus: row.status,
                      expectedRespondedAt: row.responded_at || null,
                    });
                  }}
                />
                <Button
                  title={
                    section === "invitations" ? "Refuser" : "Je serai absent"
                  }
                  secondary
                  busy={mutation.isPending}
                  disabled={mutation.isPending || row.status === "declined"}
                  onPress={() => {
                    mutation.reset();
                    setConfirmation({
                      id: row.id,
                      accept: false,
                      expectedStatus: row.status,
                      expectedRespondedAt: row.responded_at || null,
                    });
                  }}
                />
              </>
            )}
            {!!(
              section === "convocations" &&
              ["injured", "absent"].includes(row.status)
            ) && (
              <Text style={s.subtitle}>
                Ce statut est géré par le club. Contactez un responsable pour le
                corriger.
              </Text>
            )}
            {confirmation && confirmation.id === row.id ? (
              <>
                <Text style={s.text}>
                  {section === "invitations" && confirmation.accept
                    ? "Accepter rattache votre profil à ce club avec le rôle proposé et remplace votre rattachement actuel. Confirmer ?"
                    : "Confirmer cette réponse ?"}
                </Text>
                <Button
                  title="Confirmer"
                  busy={mutation.isPending}
                  onPress={() => {
                    if (confirmation) mutation.mutate(confirmation);
                  }}
                />
                <Button
                  title="Annuler"
                  secondary
                  disabled={mutation.isPending}
                  onPress={() => setConfirmation(null)}
                />
              </>
            ) : null}
            <Button
              disabled={mutation.isPending}
              title="Voir le club"
              secondary
              onPress={() => router.push(`/club/${item?.club_id || item?.id}`)}
            />
          </View>
        );
      })}
      {!!query.hasNextPage && (
        <Button
          title="Charger la suite"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
