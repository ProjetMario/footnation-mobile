import { searchPattern, useDebounced } from "../lib/data";
import * as Clipboard from "expo-clipboard";
import { randomUUID } from "expo-crypto";
import { createProContent } from "../lib/proContentSave";
import React, { useState } from "react";
import { Share, Text, View } from "react-native";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  SearchField,
  useUIStyles,
} from "../components/ui";
import { supabase } from "../lib/supabase";
import { requireClubAdmin } from "../lib/clubAccess";
import { useAuth } from "../lib/auth";
import { teamInvitationMaxUses } from "../lib/teamInvitationInput";
export const peopleSections: Record<string, { title: string }> = {
  members: { title: "Membres et invitations" },
  admins: { title: "Administrateurs" },
};
export default function ClubPeople({
  id,
  section,
}: {
  id: string;
  section: string;
}) {
  const s = useUIStyles();

  const { session } = useAuth();
  const uid = session!.user.id;
  const cache = useQueryClient();
  const [mode, setMode] = useState("list");
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const [role, setRole] = useState("Joueur amateur");
  const [teamId, setTeamId] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [inviteUrl, setInviteUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<any>(null);
  async function requirePeopleAccess() {
    await requireClubAdmin(id, uid);
    if (section === "admins") {
      const r = await supabase.rpc("is_fff_club_admin", { p_club_id: id });
      if (r.error) throw r.error;
      if (r.data !== true)
        throw new Error(
          "Seuls les administrateurs du club et du site peuvent gérer ces accès.",
        );
    }
  }
  const teamsQuery = useQuery({
    queryKey: ["club-invite-teams", id, uid],
    enabled: section !== "admins",
    queryFn: async () => {
      await requirePeopleAccess();
      const { data, error } = await supabase
        .from("teams")
        .select("id,name,category,season")
        .eq("club_id", id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });
  const inviteLinks = useQuery({
    queryKey: ["team-invitation-links", id, uid],
    enabled: section !== "admins" && mode === "team-link",
    queryFn: async () => {
      await requirePeopleAccess();
      const { data, error } = await supabase
        .from("team_invitation_links")
        .select(
          "id,code,role,max_uses,uses_count,status,expires_at,created_at,team:teams(name,category)",
        )
        .eq("club_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });
  const query = useInfiniteQuery({
    queryKey: ["club-people", id, section, uid, mode, term],
    initialPageParam: 0,
    enabled: mode !== "team-link",
    queryFn: async ({ pageParam }) => {
      await requirePeopleAccess();
      let request;
      if (mode === "add") {
        request = supabase
          .from("profiles")
          .select("id,full_name,avatar_url,primary_role,linked_club_id")
          .neq("id", session!.user.id)
          .order("full_name");
        if (term.trim())
          request = request.ilike("full_name", searchPattern(term));
      } else if (section === "admins")
        request = supabase
          .from("club_admins")
          .select("id,profile_id,role,profiles(full_name,avatar_url)")
          .eq("club_id", id)
          .order("id");
      else if (mode === "pending")
        request = supabase
          .from("club_membership_requests")
          .select(
            "id,profile_id,requested_role,status,profile:profile_id(full_name,avatar_url)",
          )
          .eq("club_id", id)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
      else
        request = supabase
          .from("profiles")
          .select("id,full_name,avatar_url,primary_role")
          .eq("linked_club_id", id)
          .order("full_name");
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
      if (!teamId) throw new Error("Choisissez l’équipe à rejoindre.");
      const uses = teamInvitationMaxUses(maxUses);
      await requirePeopleAccess();
      const { data, error } = await supabase.rpc(
        "create_native_team_invitation_link",
        {
          p_club_id: id,
          p_team_id: teamId,
          p_role: role.trim() || "Joueur",
          p_position: null,
          p_jersey_number: null,
          p_max_uses: uses,
          p_expires_at: null,
        },
      );
      if (error) throw error;
      const code = (data as any)?.code;
      if (!code) throw new Error("Code d’invitation non retourné.");
      return `https://www.foot-nation.com/login?mode=signup&teamInvite=${encodeURIComponent(code)}`;
    },
    onSuccess: (url) => {
      setInviteUrl(url);
      setNotice(
        "Invitation d’équipe créée. Le futur membre doit créer son compte puis accepter ce code.",
      );
      void cache.invalidateQueries({ queryKey: ["team-invitation-links", id] });
    },
  });
  const inviteAction = useMutation({
    mutationFn: async (action: "copy" | "share") => {
      if (!inviteUrl) throw new Error("Créez un lien d’invitation.");
      setNotice("");
      if (action === "copy") {
        await Clipboard.setStringAsync(inviteUrl);
        setNotice("Lien copié.");
      } else {
        await Share.share({
          message: `Rejoins mon équipe sur FootNation ⚽\nCrée ton compte puis accepte l’invitation :\n${inviteUrl}`,
        });
      }
    },
  });
  const mutation = useMutation({
    mutationFn: async ({
      row,
      remove,
      creationId,
      proposedRole,
    }: {
      row: any;
      remove?: boolean;
      creationId: string;
      proposedRole: string;
    }) => {
      await requirePeopleAccess();
      setNotice("");
      if (remove) {
        if (section === "admins" && row.profile_id === session?.user.id)
          throw new Error("Un autre administrateur doit retirer votre accès.");
        let request = supabase
          .from(
            section === "admins" ? "club_admins" : "club_membership_requests",
          )
          .delete()
          .eq("id", row.id)
          .eq("club_id", id);
        if (section !== "admins") request = request.eq("status", "pending");
        const result = await request.select("id").maybeSingle();
        if (!result.error && !result.data)
          throw new Error(
            "Cet accès ou cette invitation a changé. Actualisez la liste.",
          );
        if (result.error) throw result.error;
        return;
      }
      if (section === "admins") {
        await createProContent(
          {
            read: async (key) => {
              const r = await supabase
                .from("club_admins")
                .select("id,club_id,profile_id,role")
                .eq("id", key)
                .eq("club_id", id)
                .maybeSingle();
              if (r.error) throw r.error;
              return r.data;
            },
            insert: async (value) => {
              const r = await supabase.from("club_admins").insert(value);
              if (r.error) throw r.error;
            },
          },
          { id: creationId, club_id: id, profile_id: row.id, role: "admin" },
        );
        return;
      }
      if (!proposedRole.trim()) throw new Error("Précisez le rôle proposé.");
      const existing = await supabase
        .from("club_membership_requests")
        .select("id,club_id,profile_id,requested_role,invited_by,status")
        .eq("club_id", id)
        .eq("profile_id", row.id)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (
        existing.data &&
        (existing.data.id !== creationId || existing.data.status !== "pending")
      )
        throw new Error(
          existing.data.status === "pending"
            ? "Une invitation est déjà en attente."
            : "Une demande a déjà été traitée pour ce membre. Actualisez les invitations.",
        );
      if (!existing.data) {
        const profile = await supabase
          .from("profiles")
          .select("linked_club_id")
          .eq("id", row.id)
          .maybeSingle();
        if (profile.error) throw profile.error;
        if (!profile.data)
          throw new Error(
            "Ce profil n’est plus accessible. Actualisez la recherche.",
          );
        if (profile.data.linked_club_id === id)
          throw new Error("Cette personne est déjà membre du club.");
      }
      await createProContent(
        {
          read: async () => existing.data,
          insert: async (value) => {
            const r = await supabase
              .from("club_membership_requests")
              .insert(value);
            if (r.error) throw r.error;
          },
        },
        {
          id: creationId,
          club_id: id,
          profile_id: row.id,
          requested_role: proposedRole.trim(),
          invited_by: uid,
          status: "pending",
        },
      );
      const club = await supabase
        .from("fff_clubs")
        .select("name")
        .eq("id", id)
        .single();
      const name = club.data?.name || "votre club";
      const notification = await supabase.from("notifications").insert({
        type: "club_invitation",
        content: `Vous avez été invité à rejoindre le club ${name} en tant que ${proposedRole.trim()}.`,
        receiver_id: row.id,
        sender_id: session!.user.id,
        link: "/my-invitations",
        metadata: {
          club_id: id,
          club_name: name,
          request_id: creationId,
          requested_role: proposedRole.trim(),
        },
      });
      return notification.error
        ? "Invitation enregistrée. La notification n’a pas pu être envoyée ; le membre la retrouvera dans ses invitations."
        : "Invitation envoyée.";
    },
    onSuccess: (message) => {
      setNotice(message || "Modification enregistrée.");
      setConfirm(null);
      setMode(section === "admins" ? "list" : "pending");
      void cache.invalidateQueries({ queryKey: ["club-people", id] });
    },
  });
  return (
    <>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <Chip
          label={section === "admins" ? "Administrateurs" : "Membres"}
          selected={mode === "list"}
          disabled={mutation.isPending || teamInviteMutation.isPending}
          onPress={() => {
            setConfirm(null);
            setMode("list");
          }}
        />
        {section !== "admins" && (
          <Chip
            label="Invitations"
            selected={mode === "pending"}
            disabled={mutation.isPending || teamInviteMutation.isPending}
            onPress={() => {
              setConfirm(null);
              setMode("pending");
            }}
          />
        )}
        {section !== "admins" && (
          <Chip
            label="Lien équipe"
            selected={mode === "team-link"}
            disabled={mutation.isPending || teamInviteMutation.isPending}
            onPress={() => {
              setConfirm(null);
              setMode("team-link");
            }}
          />
        )}
        <Chip
          label={section === "admins" ? "Ajouter un administrateur" : "Inviter"}
          selected={mode === "add"}
          disabled={mutation.isPending || teamInviteMutation.isPending}
          onPress={() => {
            setConfirm(null);
            setMode("add");
          }}
        />
      </View>
      {!!(mode === "team-link" && section !== "admins") && (
        <View style={s.card}>
          <Text style={s.h2}>Inviter un futur membre dans une équipe</Text>
          <Text style={s.subtitle}>
            Le lien sert à créer un compte FootNation. Le rattachement au club
            et à l’équipe se fait seulement quand l’utilisateur connecté accepte
            le code.
          </Text>
          <Text style={s.small}>Équipe cible</Text>
          <View style={[s.row, { flexWrap: "wrap" }]}>
            {(teamsQuery.data || []).map((team) => (
              <Chip
                key={team.id}
                label={[team.name, team.category].filter(Boolean).join(" · ")}
                selected={teamId === team.id}
                disabled={teamInviteMutation.isPending}
                onPress={() => setTeamId(team.id)}
              />
            ))}
          </View>
          {!!teamsQuery.isPending && <Loading />}
          {!!teamsQuery.error && <ErrorState error={teamsQuery.error} />}
          <Field
            label="Rôle à attribuer après inscription"
            value={role}
            editable={!teamInviteMutation.isPending}
            onChangeText={setRole}
          />
          <Field
            label="Nombre maximum d’utilisations"
            value={maxUses}
            editable={!teamInviteMutation.isPending}
            keyboardType="number-pad"
            onChangeText={setMaxUses}
          />
          <Button
            title="Créer le lien d’invitation"
            busy={teamInviteMutation.isPending}
            disabled={teamInviteMutation.isPending}
            onPress={() => teamInviteMutation.mutate()}
          />
          {!!teamInviteMutation.error && (
            <ErrorState error={teamInviteMutation.error} />
          )}
          {!!inviteUrl && (
            <>
              <Text selectable style={s.text}>
                {inviteUrl}
              </Text>
              <View style={[s.row, { flexWrap: "wrap" }]}>
                <Button
                  title="Copier"
                  secondary
                  busy={inviteAction.isPending}
                  onPress={() => inviteAction.mutate("copy")}
                />
                <Button
                  title="Partager"
                  secondary
                  busy={inviteAction.isPending}
                  onPress={() => inviteAction.mutate("share")}
                />
              </View>
            </>
          )}
          {!!inviteAction.error && <ErrorState error={inviteAction.error} />}
          <Text style={s.h2}>Liens récents</Text>
          {!!inviteLinks.isPending && <Loading />}
          {!!inviteLinks.error && <ErrorState error={inviteLinks.error} />}
          {(inviteLinks.data || []).map((link) => (
            <View key={link.id} style={s.card}>
              <Text style={s.text}>
                {link.team?.name || "Équipe"} · {link.role}
              </Text>
              <Text selectable style={s.subtitle}>
                Code : {link.code}
              </Text>
              <Text style={s.small}>
                {link.status} · {link.uses_count}/{link.max_uses} utilisation(s)
              </Text>
            </View>
          ))}
        </View>
      )}
      {mode === "add" && (
        <>
          <SearchField
            value={search}
            onChangeText={(value) => {
              if (!mutation.isPending) {
                setConfirm(null);
                setSearch(value);
              }
            }}
          />
          {section !== "admins" && (
            <Field
              label="Rôle proposé"
              value={role}
              editable={!mutation.isPending && !confirm}
              onChangeText={setRole}
            />
          )}
        </>
      )}
      <Button
        title="Actualiser la liste"
        secondary
        busy={
          mode === "team-link"
            ? inviteLinks.isFetching || teamsQuery.isFetching
            : query.isFetching
        }
        disabled={mutation.isPending || teamInviteMutation.isPending}
        onPress={() => {
          setConfirm(null);
          mutation.reset();
          if (mode === "team-link") {
            void teamsQuery.refetch();
            void inviteLinks.refetch();
          } else void query.refetch();
        }}
      />
      {!!notice && (
        <Text accessibilityRole="alert" style={s.text}>
          {notice}
        </Text>
      )}
      {mode !== "team-link" && query.isPending && <Loading />}
      {mode !== "team-link" && !!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!mutation.error && <ErrorState error={mutation.error} />}
      {mode !== "team-link" &&
        query.data?.pages.flat().map((row) => {
          const person = row.profiles || row.profile || row;
          return (
            <View key={row.id} style={s.card}>
              <Avatar name={person.full_name} uri={person.avatar_url} />
              <Text style={s.h2}>
                {person.full_name || "Membre FootNation"}
              </Text>
              <Text style={s.subtitle}>
                {row.primary_role || row.requested_role || row.role}
              </Text>
              {mode === "add" ? (
                <Button
                  title={
                    section === "admins"
                      ? "Nommer administrateur"
                      : "Inviter ce membre"
                  }
                  disabled={mutation.isPending || teamInviteMutation.isPending}
                  onPress={() => {
                    mutation.reset();
                    setConfirm({
                      row,
                      remove: false,
                      creationId: randomUUID(),
                      proposedRole: role,
                    });
                  }}
                />
              ) : section === "admins" || mode === "pending" ? (
                <Button
                  title={
                    section === "admins"
                      ? "Retirer l’accès"
                      : "Annuler l’invitation"
                  }
                  secondary
                  disabled={mutation.isPending || teamInviteMutation.isPending}
                  onPress={() => {
                    mutation.reset();
                    setConfirm({
                      row,
                      remove: true,
                      creationId: randomUUID(),
                      proposedRole: role,
                    });
                  }}
                />
              ) : null}
              {confirm?.row.id === row.id && (
                <>
                  <Text style={s.text}>
                    {section === "admins" && !confirm.remove
                      ? "Cette personne pourra administrer le club. Confirmer ?"
                      : "Confirmer cette action ?"}
                  </Text>
                  <Button
                    title="Confirmer"
                    busy={mutation.isPending}
                    onPress={() => confirm && mutation.mutate(confirm)}
                  />
                  <Button
                    title="Annuler"
                    secondary
                    disabled={
                      mutation.isPending || teamInviteMutation.isPending
                    }
                    onPress={() => setConfirm(null)}
                  />
                </>
              )}
            </View>
          );
        })}
      {!!(
        mode !== "team-link" &&
        query.data &&
        !query.data.pages.flat().length
      ) && <Empty title="Aucun résultat" />}
      {mode !== "team-link" && !!query.hasNextPage && (
        <Button
          title="Charger la suite"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
