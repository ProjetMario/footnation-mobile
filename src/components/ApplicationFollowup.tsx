import React, { useState } from "react";
import { Text, View } from "react-native";
import { Eye } from "lucide-react-native";
import { useTheme } from "../theme";
import { OpportunityAction, OpportunityMessage } from "./OpportunityUI";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Button, ErrorState, useUIStyles } from "./ui";

function FollowupAction(props: React.ComponentProps<typeof Button>) {
  return (
    <OpportunityAction
      title={props.title}
      onPress={props.onPress}
      tone="rose"
      primary={!props.secondary}
      disabled={props.disabled}
      busy={props.busy}
    />
  );
}

export function ApplicationFollowup({
  application,
  owner = false,
  dashboard = false,
}: {
  application: {
    id: string;
    applicant_id: string;
    status: string | null;
    created_at: string | null;
    message: string | null;
    screening_answers?: unknown;
  };
  owner?: boolean;
  dashboard?: boolean;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const Action = dashboard ? FollowupAction : Button;
  const { session } = useAuth();
  const cache = useQueryClient();
  const [opened, setOpened] = useState(false);
  const tracking = useQuery({
    queryKey: ["application-tracking", application.id, session?.user.id],
    enabled: !!session,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunity_application_tracking")
        .select("read_at,last_reminded_at")
        .eq("application_id", application.id)
        .maybeSingle();
      if (error) throw error;
      return data as {
        read_at: string | null;
        last_reminded_at: string | null;
      } | null;
    },
  });
  const action = useMutation({
    mutationFn: async ({
      kind,
      status,
    }: {
      kind: "read" | "status" | "remind";
      status?: string;
    }) => {
      const { data, error } = await supabase.rpc(
        "manage_opportunity_application",
        {
          p_application_id: application.id,
          p_action: kind,
          p_status: status || null,
        },
      );
      if (error)
        throw new Error(error.message || "Action impossible. Réessayez.");
      return data;
    },
    onSuccess: (_data, variables) => {
      if (variables.kind === "read") setOpened(true);
      void cache.invalidateQueries({
        queryKey: ["application-tracking", application.id],
      });
      void cache.invalidateQueries({ queryKey: ["profile-applications"] });
      void cache.invalidateQueries({ queryKey: ["applications"] });
      void cache.invalidateQueries({ queryKey: ["application"] });
    },
  });
  const nextReminder =
    Date.parse(
      tracking.data?.last_reminded_at || application.created_at || "",
    ) +
    3 * 86400000;
  const pending =
    !application.status || ["pending", "reviewed"].includes(application.status);
  const unavailable = tracking.isPending || tracking.isError;
  return (
    <View
      style={{
        gap: 12,
        ...(dashboard
          ? { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }
          : {}),
      }}
    >
      {dashboard && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Eye size={16} color={colors.muted} />
          <Text style={[s.small, { fontWeight: "700" }]}>Suivi de lecture</Text>
        </View>
      )}
      <Text style={s.small}>
        {tracking.isError
          ? "Suivi de lecture indisponible pour le moment."
          : tracking.isPending
            ? "Chargement du suivi…"
            : tracking.data?.read_at
              ? `Lue le ${new Date(tracking.data.read_at).toLocaleString("fr-FR")}`
              : "Lecture non confirmée"}
      </Text>
      {owner ? (
        <>
          {!opened ? (
            <Action
              title="Ouvrir la candidature"
              secondary
              busy={action.isPending}
              disabled={unavailable}
              onPress={() => action.mutate({ kind: "read" })}
            />
          ) : (
            <>
              {dashboard ? (
                <OpportunityMessage
                  message={application.message || "Candidature sans message"}
                />
              ) : (
                <Text style={s.text}>
                  {application.message || "Candidature sans message"}
                </Text>
              )}
              {Array.isArray(application.screening_answers) &&
                application.screening_answers.map((answer, index) => (
                  <Text key={index} style={s.text}>
                    {String(answer.answer || "")}
                  </Text>
                ))}
              <Action
                title="Voir le profil du candidat"
                secondary
                onPress={() =>
                  router.push(`/profile/${application.applicant_id}`)
                }
              />
              <Text style={s.small}>
                Donnez une réponse au candidat. Il sera notifié du changement de
                statut.
              </Text>
              {(
                [
                  ["reviewed", "En cours d’examen"],
                  ["accepted", "Accepter"],
                  ["rejected", "Ne pas retenir"],
                ] as const
              ).map(([status, label]) => (
                <Action
                  key={status}
                  title={label}
                  secondary={status !== "accepted"}
                  disabled={action.isPending || application.status === status}
                  onPress={() => action.mutate({ kind: "status", status })}
                />
              ))}
            </>
          )}
        </>
      ) : (
        pending && (
          <>
            <Action
              title="Relancer l’auteur"
              secondary
              busy={action.isPending}
              disabled={
                unavailable ||
                !Number.isFinite(nextReminder) ||
                Date.now() < nextReminder
              }
              onPress={() => action.mutate({ kind: "remind" })}
            />
            {Number.isFinite(nextReminder) && Date.now() < nextReminder && (
              <Text style={s.small}>
                Prochaine relance possible le{" "}
                {new Date(nextReminder).toLocaleString("fr-FR")}.
              </Text>
            )}
            {action.isSuccess && action.variables?.kind === "remind" && (
              <Text style={s.small}>
                Relance envoyée à l’auteur de l’annonce.
              </Text>
            )}
          </>
        )
      )}
      {tracking.isError && (
        <Action
          title="Réessayer le suivi"
          secondary
          onPress={() => void tracking.refetch()}
        />
      )}
      {action.isError && <ErrorState error={action.error} />}
    </View>
  );
}
