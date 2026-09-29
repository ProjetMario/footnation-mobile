import React, { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
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
  Loading,
  useUIStyles,
} from "../components/ui";
import { supabase } from "../lib/supabase";
import { requireClubAdmin } from "../lib/clubAccess";
import { useAuth } from "../lib/auth";
import { useTheme } from "../theme";
import { clubImportRpc } from "../lib/import-clubs/client";
import {
  buildAssignmentPlan,
  type AssignmentMember,
} from "../lib/import-clubs/plan";
export default function ClubOrganization({ id }: { id: string }) {
  const s = useUIStyles();
  const uid = useAuth().session!.user.id;
  const [grouping, setGrouping] = useState(false);

  const [selection, setSelection] = useState<{
    member: any;
    team: string;
  } | null>(null);
  const cache = useQueryClient();
  const teams = useQuery({
    queryKey: ["club-organization-teams", id, uid],
    queryFn: async () => {
      await requireClubAdmin(id, uid);
      const { data, error } = await supabase
        .from("teams")
        .select("id,name,category")
        .eq("club_id", id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const members = useInfiniteQuery({
    queryKey: ["club-organization", id, uid],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      await requireClubAdmin(id, uid);
      const result = await supabase
        .from("profiles")
        .select(
          "id,full_name,username,avatar_url,primary_role,position,target_position",
        )
        .eq("linked_club_id", id)
        .order("full_name")
        .order("id")
        .range(pageParam, pageParam + 29);
      if (result.error) throw result.error;
      const ids = result.data.map((m) => m.id);
      if (!ids.length) return [];
      const assignments = await supabase
        .from("team_members")
        .select(
          "id,profile_id,team_id,is_primary,team:teams!inner(name,club_id)",
        )
        .in("profile_id", ids)
        .eq("team.club_id", id)
        .eq("is_active", true);
      if (assignments.error) throw assignments.error;
      return result.data.map((member) => ({
        ...member,
        assignments: assignments.data.filter(
          (a) => a.profile_id === member.id,
        ) as any[],
      }));
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const mutation = useMutation({
    mutationFn: async ({ member, team }: { member: any; team: string }) => {
      await requireClubAdmin(id, uid);
      const snapshot = await supabase.auth.getSession();
      if (snapshot.error || snapshot.data.session?.user.id !== uid)
        throw new Error("La session a changé. Rouvrez cet espace.");
      const primaries = member.assignments.filter((a: any) => a.is_primary);
      if (primaries.length > 1)
        throw new Error(
          "Plusieurs équipes principales sont enregistrées pour ce membre.",
        );
      const response = await supabase
        .rpc("set_native_primary_team", {
          p_club_id: id,
          p_profile_id: member.id,
          p_team_id: team || null,
          p_expected_team_id: primaries[0]?.team_id || null,
        })
        .setHeader(
          "Authorization",
          `Bearer ${snapshot.data.session.access_token}`,
        );
      if (response.error) throw response.error;
    },
    onSuccess: () => {
      setSelection(null);
      void cache.invalidateQueries({ queryKey: ["club-organization", id] });
      void cache.invalidateQueries({ queryKey: ["member-space"] });
      for (const prefix of [
        "club-member-context",
        "member-calendar",
        "convocation-roster",
        "calendar-editor-teams",
      ])
        void cache.invalidateQueries({ queryKey: [prefix, id] });
    },
  });
  if (grouping)
    return (
      <GroupAssignments
        id={id}
        uid={uid}
        teams={teams.data || []}
        members={members.data?.pages.flat() || []}
        loadingMore={members.isFetchingNextPage}
        more={
          members.hasNextPage ? () => void members.fetchNextPage() : undefined
        }
        error={members.error || teams.error}
        refresh={() => {
          void members.refetch();
          void teams.refetch();
        }}
        close={() => setGrouping(false)}
      />
    );
  return (
    <>
      <Text style={s.h2}>Affectations aux équipes</Text>
      <Text style={s.small}>
        Changer l’équipe principale conserve les autres appartenances du membre.
      </Text>
      <Button
        title="Préparer une affectation groupée"
        secondary
        disabled={
          mutation.isPending ||
          !teams.data?.length ||
          !members.data?.pages.flat().length ||
          !!teams.error ||
          !!members.error
        }
        onPress={() => {
          setSelection(null);
          setGrouping(true);
        }}
      />
      {!!(teams.isPending || members.isPending) && <Loading />}
      {!!teams.error && <ErrorState error={teams.error} />}
      {!!members.error && (
        <ErrorState
          error={members.error}
          retry={() => void members.refetch()}
        />
      )}
      {!!mutation.error && (
        <ErrorState
          error={mutation.error}
          retry={() => {
            setSelection(null);
            void members.refetch();
          }}
        />
      )}
      {members.data?.pages.flat().map((member) => (
        <View key={member.id} style={s.card}>
          <Avatar
            uri={member.avatar_url}
            name={member.full_name || undefined}
          />
          <Text style={s.h2}>{member.full_name}</Text>
          <Text style={s.subtitle}>{member.primary_role}</Text>
          {member.assignments.length ? (
            member.assignments.map((a) => (
              <Text style={s.text} key={a.id}>
                {a.team?.name}
                {a.is_primary ? " · équipe principale" : ""}
              </Text>
            ))
          ) : (
            <Text style={s.small}>Aucune équipe affectée</Text>
          )}
          {selection?.member.id === member.id ? (
            <>
              <View style={[s.row, { flexWrap: "wrap" }]}>
                <Chip
                  label="Aucune équipe principale"
                  selected={!selection?.team}
                  disabled={mutation.isPending}
                  onPress={() =>
                    setSelection((previous) =>
                      previous ? { ...previous, team: "" } : null,
                    )
                  }
                />
                {teams.data?.map((team) => (
                  <Chip
                    key={team.id}
                    label={team.name}
                    selected={selection?.team === team.id}
                    disabled={mutation.isPending}
                    onPress={() =>
                      setSelection((previous) =>
                        previous ? { ...previous, team: team.id } : null,
                      )
                    }
                  />
                ))}
              </View>
              <Button
                title="Enregistrer l’affectation"
                busy={mutation.isPending}
                onPress={() => selection && mutation.mutate(selection)}
              />
              <Button
                title="Annuler"
                secondary
                disabled={mutation.isPending}
                onPress={() => setSelection(null)}
              />
            </>
          ) : (
            <Button
              title="Modifier l’équipe principale"
              secondary
              disabled={mutation.isPending}
              onPress={() =>
                setSelection({
                  member,
                  team:
                    member.assignments.find((a) => a.is_primary)?.team_id || "",
                })
              }
            />
          )}
        </View>
      ))}
      {!!(members.data && !members.data.pages.flat().length) && (
        <Empty title="Aucun membre lié au club" />
      )}
      {!!members.hasNextPage && (
        <Button
          title="Charger la suite"
          busy={members.isFetchingNextPage}
          onPress={() => void members.fetchNextPage()}
        />
      )}
    </>
  );
}

type OrganizationMember = AssignmentMember & {
  username?: string | null;
  avatar_url?: string | null;
  primary_role?: string | null;
};
function GroupAssignments({
  id,
  uid,
  teams,
  members,
  close,
  more,
  loadingMore,
  error,
  refresh,
}: {
  id: string;
  uid: string;
  teams: { id: string; name: string; category: string }[];
  members: OrganizationMember[];
  close: () => void;
  more?: () => void;
  loadingMore: boolean;
  error: unknown;
  refresh: () => void;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const cache = useQueryClient();
  const [selected, setSelected] = useState<Record<string, OrganizationMember>>(
    {},
  );
  const [teamId, setTeamId] = useState("");
  const [preview, setPreview] = useState<{
    team: { id: string; name: string };
    members: OrganizationMember[];
    values: ReturnType<typeof buildAssignmentPlan>;
  } | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const capability = useQuery({
    queryKey: ["club-import-capability", id, uid],
    queryFn: () =>
      clubImportRpc<boolean>(uid, "native_club_import_available", {
        p_club_id: id,
      }),
    retry: false,
  });
  const save = useMutation({
    mutationFn: async (snapshot: NonNullable<typeof preview>) => {
      const count = await clubImportRpc<number>(
        uid,
        "assign_native_club_primary_teams",
        {
          p_club_id: id,
          p_team_id: snapshot.team.id,
          p_members: snapshot.values,
        },
      );
      if (count !== snapshot.values.length)
        throw new Error(
          "Actualisez les affectations pour vérifier le résultat de cette tentative.",
        );
      return count;
    },
    onSuccess: (count) => {
      setNotice(
        `${count} affectation(s) confirmée(s). Les autres appartenances sont conservées.`,
      );
      setPreview(null);
      setSelected({});
      void cache.invalidateQueries({ queryKey: ["club-organization", id] });
      void cache.invalidateQueries({ queryKey: ["member-space"] });
      for (const prefix of [
        "club-member-context",
        "member-calendar",
        "convocation-roster",
        "calendar-editor-teams",
      ])
        void cache.invalidateQueries({ queryKey: [prefix, id] });
    },
    onSettled: () => {
      pending.current = false;
    },
  });
  return (
    <>
      <Text accessibilityRole="header" style={s.h2}>
        Affectation groupée
      </Text>
      <Text style={s.text}>
        Choisissez les membres déjà liés à ce club et leur équipe principale.
        Aucun rapprochement n’est effectué à partir d’un nom ou d’un poste.
      </Text>
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.text}>
          {notice}
        </Text>
      )}
      {!!error && <ErrorState error={error} />}
      {!!capability.error && <ErrorState error={capability.error} />}
      {!!failure && <ErrorState error={failure} />}
      {!!save.error && <ErrorState error={save.error} />}
      <Button
        title="Actualiser les affectations"
        secondary
        disabled={save.isPending}
        onPress={() => {
          setPreview(null);
          setSelected({});
          setFailure(null);
          save.reset();
          refresh();
          void capability.refetch();
        }}
      />
      {preview ? (
        <View style={s.card}>
          <Text style={s.h2}>Équipe principale : {preview.team.name}</Text>
          {preview.members.map((member) => (
            <Text key={member.id} style={s.text}>
              {member.full_name || "Membre du club"}
              {member.username ? ` · @${member.username}` : ""}
            </Text>
          ))}
          <Text style={s.small}>
            Ces {preview.members.length} affectations seront vérifiées ensemble.
            Si l’une a changé, aucune nouvelle affectation du lot ne sera
            enregistrée.
          </Text>
          <Button
            title="Confirmer ces affectations"
            busy={save.isPending}
            disabled={capability.data !== true}
            onPress={() => {
              if (pending.current) return;
              pending.current = true;
              save.mutate(preview);
            }}
          />
          <Button
            title="Modifier la sélection"
            secondary
            disabled={save.isPending}
            onPress={() => {
              setPreview(null);
              save.reset();
            }}
          />
        </View>
      ) : (
        <>
          <Text style={s.label}>Choisir l’équipe principale</Text>
          {teams.map((team) => (
            <Chip
              key={team.id}
              label={`${team.name} · ${team.category}`}
              selected={teamId === team.id}
              onPress={() => setTeamId(team.id)}
            />
          ))}
          <Text style={s.label}>
            Sélectionner les membres ({Object.keys(selected).length}/50)
          </Text>
          {members.map((member) => (
            <View
              key={member.id}
              style={[
                s.card,
                {
                  borderColor: selected[member.id]
                    ? colors.blue
                    : colors.border,
                },
              ]}
            >
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: !!selected[member.id],
                  disabled:
                    !selected[member.id] && Object.keys(selected).length >= 50,
                }}
                disabled={
                  !selected[member.id] && Object.keys(selected).length >= 50
                }
                accessibilityLabel={`Sélectionner ${member.full_name || "ce membre du club"}${member.username ? `, @${member.username}` : ""}`}
                onPress={() =>
                  setSelected((previous) => {
                    const next = { ...previous };
                    if (next[member.id]) delete next[member.id];
                    else if (Object.keys(next).length < 50)
                      next[member.id] = {
                        ...member,
                        assignments: member.assignments.map((value) => ({
                          ...value,
                        })),
                      };
                    return next;
                  })
                }
                style={{ minHeight: 48, gap: 8 }}
              >
                <Avatar
                  uri={member.avatar_url}
                  name={member.full_name || undefined}
                />
                <Text style={s.text}>
                  {selected[member.id] ? "✓ " : ""}
                  {member.full_name || "Membre du club"}
                </Text>
                {!!member.username && (
                  <Text style={s.small}>@{member.username}</Text>
                )}
                {!!member.primary_role && (
                  <Text style={s.small}>{member.primary_role}</Text>
                )}
                <Text style={s.small}>
                  {member.assignments.some(
                    (assignment) => assignment.is_primary,
                  )
                    ? "Possède déjà une équipe principale — elle sera remplacée après confirmation"
                    : "Sans équipe principale"}
                </Text>
              </Pressable>
              <Button
                title="Consulter le profil"
                secondary
                onPress={() => router.push(`/profile/${member.id}`)}
              />
            </View>
          ))}
          {!!more && (
            <Button
              title="Charger d’autres membres"
              secondary
              busy={loadingMore}
              onPress={more}
            />
          )}
          <Button
            title="Vérifier le récapitulatif"
            disabled={
              !teamId ||
              !Object.keys(selected).length ||
              !!error ||
              capability.data !== true
            }
            onPress={() => {
              try {
                const team = teams.find((value) => value.id === teamId);
                if (!team) throw new Error("Choisissez une équipe disponible.");
                setPreview({
                  team: { id: team.id, name: team.name },
                  members: Object.values(selected),
                  values: buildAssignmentPlan(Object.values(selected)),
                });
                setFailure(null);
              } catch (problem) {
                setFailure(
                  problem instanceof Error
                    ? problem
                    : new Error("Sélection invalide."),
                );
              }
            }}
          />
        </>
      )}
      <Button
        title="Revenir à l’organigramme"
        secondary
        disabled={save.isPending}
        onPress={close}
      />
    </>
  );
}
