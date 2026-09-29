import React from "react";
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { loadCalendarEditorContext } from "../lib/calendarManagement";
import { ChoiceField } from "./ChoiceField";
import { ErrorState, Loading, useUIStyles } from "./ui";

export function EventTeamField({
  clubId,
  value,
  onChange,
  disabled,
}: {
  clubId: string;
  value: string;
  onChange: (teamId: string, category?: string | null) => void;
  disabled?: boolean;
}) {
  const uid = useAuth().session?.user.id;
  const s = useUIStyles();
  const teams = useQuery({
    queryKey: ["calendar-editor-teams", clubId, uid],
    queryFn: () => loadCalendarEditorContext(clubId, uid!),
  });
  return (
    <View style={{ gap: 8 }}>
      {teams.isPending ? (
        <Loading />
      ) : teams.error ? (
        <ErrorState error={teams.error} retry={() => void teams.refetch()} />
      ) : (
        <ChoiceField
          label="Équipe concernée"
          value={value || (teams.data?.clubAllowed ? "club" : "")}
          optional={false}
          disabled={disabled}
          options={[
            ...(teams.data?.clubAllowed
              ? [
                  {
                    value: "club",
                    label: "Événement du club / de la catégorie",
                  },
                ]
              : []),
            ...(teams.data?.teams || [])
              .filter((team) => team.is_active !== false || team.id === value)
              .map((team) => ({
                value: team.id,
                label: `${team.name}${team.is_active === false ? " (archivée)" : ""}`,
              })),
          ]}
          onChange={(next) =>
            onChange(
              next === "club" ? "" : next,
              teams.data?.teams.find((team) => team.id === next)?.category,
            )
          }
        />
      )}
      <Text style={s.small}>
        Choisissez l’équipe exacte pour que ses membres retrouvent cet événement
        dans leur calendrier.
      </Text>
    </View>
  );
}
