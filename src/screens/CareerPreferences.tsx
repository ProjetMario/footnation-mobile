import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../theme";
import { CareerGoalWizard } from "../components/CareerGoalWizard";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  careerRoles,
  emptyGoal,
  profileCareerRoles,
  legacyGoal,
  goalPreview,
  validateGoal,
  type GoalValues,
} from "../lib/careerGoals";

type SavedGoal = {
  role: string;
  details: GoalValues;
  opportunity_id: string | null;
  published: boolean;
  opportunity?: { is_active: boolean; expires_at: string | null } | null;
};
function serviceError(error: { code?: string; message?: string }) {
  return new Error(
    ["42P01", "PGRST205", "PGRST202"].includes(error.code || "")
      ? "La publication des objectifs est en cours d’activation. Réessayez plus tard."
      : error.message || "Impossible d’enregistrer. Réessayez.",
  );
}
export default function CareerPreferences() {
  return (
    <Screen title="Mes objectifs carrière" scroll={false}>
      <AuthGate>
        <Load />
      </AuthGate>
    </Screen>
  );
}
function Load() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const s = useUIStyles();
  const { colors } = useTheme();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(false);
  const query = useQuery({
    queryKey: ["native-career-preferences", uid],
    queryFn: async () => {
      const profile = await supabase
        .from("profiles")
        .select(
          "id,account_type,primary_role,secondary_roles,target_competition_level,target_level,target_position,target_age_category,desired_salary,desired_benefits",
        )
        .eq("id", uid)
        .single();
      if (profile.error) throw serviceError(profile.error);
      const goals = await supabase
        .from("career_goal_requests")
        .select(
          "role,details,opportunity_id,published,opportunity:opportunities(is_active,expires_at)",
        )
        .eq("user_id", uid);
      if (goals.error) throw serviceError(goals.error);
      return {
        profile: profile.data,
        goals: (goals.data || []) as unknown as SavedGoal[],
      };
    },
  });
  if (query.isPending) return <Loading />;
  if (query.isError && !query.data)
    return (
      <>
        <ErrorState error={query.error} />
        <Button title="Réessayer" onPress={() => void query.refetch()} />
      </>
    );
  const roles = profileCareerRoles(query.data.profile);
  const oldRoles = query.data.goals.filter((g) => !roles.includes(g.role));
  const activeRole = roles.includes(selectedRole || "")
    ? selectedRole!
    : roles[0];
  return (
    <View style={{ flex: 1 }}>
      {!!roles.length && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 8,
            backgroundColor: colors.surface,
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
          >
            {roles.map((role) => {
              const saved = query.data.goals.find((goal) => goal.role === role);
              return (
                <Pressable
                  key={role}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: activeRole === role && !showOld,
                  }}
                  onPress={() => {
                    setSelectedRole(role);
                    setShowOld(false);
                  }}
                  style={{
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor:
                      activeRole === role && !showOld
                        ? colors.blue
                        : colors.border,
                    backgroundColor:
                      activeRole === role && !showOld
                        ? colors.accentSoft
                        : colors.surface,
                  }}
                >
                  <Text
                    style={{
                      color: colors.ink,
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    {role}
                  </Text>
                  <Text
                    style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}
                  >
                    {goalStatus(saved)}
                  </Text>
                </Pressable>
              );
            })}
            {!!oldRoles.length && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: showOld }}
                onPress={() => setShowOld(!showOld)}
                style={{ padding: 14, justifyContent: "center" }}
              >
                <Text style={{ color: colors.muted }}>
                  Anciens rôles ({oldRoles.length})
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}
      {!roles.length && (
        <View style={{ padding: 20, gap: 16 }}>
          <Text style={s.h2}>Quel est votre rôle dans le football ?</Text>
          <Text style={s.text}>
            Ajoutez votre rôle au profil pour découvrir les objectifs qui vous
            correspondent.
          </Text>
          <Button
            title="Compléter mon profil"
            onPress={() => router.push("/my-profile")}
          />
        </View>
      )}
      {roles.map((role, index) => (
        <View
          key={`${uid}:${role}`}
          style={{
            flex: 1,
            display: activeRole === role && !showOld ? "flex" : "none",
          }}
        >
          <GoalForm
            uid={uid}
            role={role}
            saved={query.data.goals.find((g) => g.role === role)}
            initial={
              index === 0 ? legacyGoal(query.data.profile, role) : emptyGoal
            }
          />
        </View>
      ))}
      {(showOld || !roles.length) && !!oldRoles.length && (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text style={s.h2}>Demandes de vos anciens rôles</Text>
          {oldRoles.map((g) => (
            <GoalForm
              key={`${uid}:${g.role}`}
              uid={uid}
              role={g.role}
              saved={g}
              initial={emptyGoal}
              retired
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
function goalStatus(saved?: SavedGoal) {
  if (!saved?.published) return "À publier";
  return saved.opportunity?.is_active &&
    (!saved.opportunity.expires_at ||
      Date.parse(saved.opportunity.expires_at) > Date.now())
    ? "Publiée"
    : "Inactive ou expirée";
}

function GoalForm({
  uid,
  role,
  initial,
  saved,
  retired = false,
}: {
  uid: string;
  role: string;
  initial: GoalValues;
  saved?: SavedGoal;
  retired?: boolean;
}) {
  const s = useUIStyles();
  const cache = useQueryClient();
  const [v, setV] = useState<GoalValues>({
    ...emptyGoal,
    ...initial,
    ...saved?.details,
  });
  const [success, setSuccess] = useState("");
  const def = careerRoles[role];
  const preview = def ? goalPreview(role, v) : null;
  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      if (publish) {
        const error = validateGoal(role, v);
        if (error) throw new Error(error);
      }
      const { data, error } = await supabase.rpc("save_career_goal_request", {
        p_role: role,
        p_details: v,
        p_title: preview?.title || role,
        p_description: preview?.description || "",
        p_target: def?.target || null,
        p_publish: publish,
      });
      if (error) throw serviceError(error);
      return { publish, data };
    },
    onSuccess: async ({ publish }) => {
      setSuccess(
        publish
          ? "Votre demande est publiée dans les opportunités."
          : "Votre demande a été retirée. Vos objectifs sont conservés.",
      );
      await Promise.all(
        [
          "native-career-preferences",
          "my-opportunity-requests",
          "opportunities",
          "opportunity",
        ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
  const viewRequest =
    saved?.opportunity_id && saved.published
      ? () => router.push(`/opportunity/${saved.opportunity_id}`)
      : undefined;
  const withdraw = () => {
    setSuccess("");
    save.mutate(false);
  };
  if (retired || !def)
    return (
      <View style={s.card}>
        <Text style={s.h2}>{role}</Text>
        <Text style={s.small}>
          {goalStatus(saved)} · Ce rôle ne figure plus sur votre profil.
        </Text>
        {!!viewRequest && (
          <Button title="Voir ma demande" secondary onPress={viewRequest} />
        )}
        {saved?.published && (
          <Button
            title="Retirer ma demande"
            secondary
            disabled={save.isPending}
            onPress={withdraw}
          />
        )}
        {!!save.error && <ErrorState error={save.error} />}
        {!!success && (
          <Text accessibilityRole="alert" style={s.text}>
            {success}
          </Text>
        )}
      </View>
    );
  return (
    <CareerGoalWizard
      role={role}
      value={v}
      onChange={(next) => {
        if (save.isPending) return;
        setSuccess("");
        save.reset();
        setV(next);
      }}
      published={!!saved?.published}
      status={goalStatus(saved)}
      busy={save.isPending}
      error={save.error}
      success={success}
      onPublish={() => {
        setSuccess("");
        save.mutate(true);
      }}
      onWithdraw={saved?.published ? withdraw : undefined}
      onView={viewRequest}
    />
  );
}
