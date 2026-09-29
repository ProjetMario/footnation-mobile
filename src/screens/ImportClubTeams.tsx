import React, { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Button,
  Empty,
  ErrorState,
  Field,
  Loading,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { requireClubAdmin } from "../lib/clubAccess";
import { supabase } from "../lib/supabase";
import { useTheme } from "../theme";
import { clubImportRpc } from "../lib/import-clubs/client";
import {
  buildTeamImportPlan,
  importTeamState,
  validImportSeason,
  type FffTeamSource,
  type ManagedTeam,
  type TeamImportRow,
} from "../lib/import-clubs/plan";

const stateLabels = {
  ready: "Disponible",
  incomplete: "Nom ou catégorie à compléter dans la source",
  imported: "Déjà importée pour cette saison",
  conflict: "Une équipe équivalente existe déjà — à vérifier",
};
export default function ImportClubTeams({ id }: { id: string }) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const uid = useAuth().session!.user.id;
  const [season, setSeason] = useState("");
  const [selected, setSelected] = useState<Record<string, FffTeamSource>>({});
  const [plan, setPlan] = useState<{
    season: string;
    rows: TeamImportRow[];
  } | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const cache = useQueryClient();
  const capability = useQuery({
    queryKey: ["club-import-capability", id, uid],
    queryFn: () =>
      clubImportRpc<boolean>(uid, "native_club_import_available", {
        p_club_id: id,
      }),
    retry: false,
  });
  const sources = useInfiniteQuery({
    queryKey: ["club-import-fff-sources", id, uid],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      await requireClubAdmin(id, uid);
      const result = await supabase
        .from("fff_teams")
        .select("id,club_id,name,category,age_range,division,level,updated_at")
        .eq("club_id", id)
        .order("name")
        .order("id")
        .range(pageParam, pageParam + 29);
      if (result.error) throw result.error;
      return result.data as FffTeamSource[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const teams = useQuery({
    queryKey: ["club-import-managed-teams", id, uid, capability.data === true],
    queryFn: async ({ signal }) => {
      await requireClubAdmin(id, uid);
      const columns =
        "id,name,category,age_group,season" +
        (capability.data === true ? ",native_fff_team_id" : "");
      const rows = new Map<string, ManagedTeam>();
      for (let offset = 0; ; offset += 200) {
        const result = await supabase
          .from("teams")
          .select(columns)
          .eq("club_id", id)
          .order("id")
          .range(offset, offset + 199)
          .abortSignal(signal);
        if (result.error) throw result.error;
        const page = result.data as unknown as ManagedTeam[];
        for (const row of page) rows.set(row.id, row);
        if (page.length < 200) return [...rows.values()];
      }
    },
  });
  const save = useMutation({
    mutationFn: async (snapshot: NonNullable<typeof plan>) => {
      const result = await clubImportRpc<
        {
          source_id: string;
          team_id: string;
          status: "created" | "already_imported";
        }[]
      >(uid, "import_native_club_teams", {
        p_club_id: id,
        p_season: snapshot.season,
        p_rows: snapshot.rows,
      });
      if (
        !Array.isArray(result) ||
        result.length !== snapshot.rows.length ||
        result.some(
          (row) =>
            !snapshot.rows.some((entry) => entry.source.id === row.source_id) ||
            !["created", "already_imported"].includes(row.status),
        )
      )
        throw new Error(
          "Vérifiez l’aperçu pour confirmer le résultat de cette tentative.",
        );
      return result;
    },
    onSuccess: (result) => {
      setNotice(
        `${result.filter((row) => row.status === "created").length} équipe(s) ajoutée(s), ${result.filter((row) => row.status === "already_imported").length} déjà présente(s).`,
      );
      setPlan(null);
      setSelected({});
      for (const queryKey of [
        ["club-import-managed-teams", id],
        ["club-organization-teams", id],
        ["club-admin-records", id, "teams"],
      ])
        void cache.invalidateQueries({ queryKey });
    },
    onSettled: () => {
      pending.current = false;
    },
  });
  const refresh = () => {
    setPlan(null);
    setSelected({});
    setError(null);
    save.reset();
    void sources.refetch();
    void teams.refetch();
    void capability.refetch();
  };
  return (
    <>
      <Text accessibilityRole="header" style={s.h2}>
        Importer les équipes du club
      </Text>
      <Text style={s.text}>
        Retrouvez les équipes déjà enregistrées dans l’annuaire FFF de ce club
        et choisissez celles à ajouter à votre organisation.
      </Text>
      <Text style={s.small}>
        Les équipes et les membres existants sont conservés. Cet aperçu ne lance
        ni recherche externe ni enrichissement automatique des clubs.
      </Text>
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.text}>
          {notice}
        </Text>
      )}
      {!!capability.error && <ErrorState error={capability.error} />}
      {!!sources.error && <ErrorState error={sources.error} />}
      {!!teams.error && <ErrorState error={teams.error} />}
      {!!error && <ErrorState error={error} />}
      {!!save.error && <ErrorState error={save.error} />}
      {!!(sources.isPending || teams.isPending) && <Loading />}
      <Button
        title="Actualiser l’aperçu"
        secondary
        disabled={save.isPending}
        onPress={refresh}
      />
      <Field
        label="Saison des équipes à créer, par exemple 2026-2027"
        value={season}
        editable={!save.isPending && !plan}
        onChangeText={(value) => {
          setSeason(value);
          setSelected({});
          setError(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={9}
      />
      {plan ? (
        <View style={s.card}>
          <Text accessibilityRole="header" style={s.h2}>
            Vérifier avant l’import
          </Text>
          <Text style={s.text}>
            {plan.rows.length} équipe(s) à ajouter pour {plan.season}.
          </Text>
          {plan.rows.map(({ source }) => (
            <Text key={source.id} style={s.text}>
              {source.name} · {source.category}
              {source.age_range ? ` · ${source.age_range}` : ""}
            </Text>
          ))}
          <Text style={s.small}>
            Si la source ou une équipe a changé entre-temps, l’import sera
            refusé pour permettre une nouvelle vérification. Aucun membre n’est
            affecté automatiquement.
          </Text>
          <Button
            title="Confirmer l’ajout de ces équipes"
            busy={save.isPending}
            disabled={capability.data !== true}
            onPress={() => {
              if (pending.current) return;
              pending.current = true;
              save.mutate(plan);
            }}
          />
          <Button
            title="Revenir à la sélection"
            secondary
            disabled={save.isPending}
            onPress={() => {
              setPlan(null);
              save.reset();
            }}
          />
        </View>
      ) : (
        <>
          {sources.data?.pages.flat().map((source) => {
            const state = importTeamState(source, teams.data || [], season);
            const disabled =
              state !== "ready" ||
              !validImportSeason(season) ||
              !teams.data ||
              !!teams.error ||
              (!selected[source.id] && Object.keys(selected).length >= 50);
            return (
              <Pressable
                key={source.id}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: !!selected[source.id],
                  disabled,
                }}
                accessibilityLabel={`${source.name || "Équipe sans nom"}, ${source.category || "catégorie non renseignée"}, ${stateLabels[state]}`}
                disabled={disabled}
                onPress={() =>
                  setSelected((previous) => {
                    const next = { ...previous };
                    if (next[source.id]) delete next[source.id];
                    else next[source.id] = { ...source };
                    return next;
                  })
                }
                style={[
                  s.card,
                  {
                    minHeight: 64,
                    borderColor: selected[source.id]
                      ? colors.blue
                      : colors.border,
                  },
                ]}
              >
                <Text style={s.h2}>
                  {selected[source.id] ? "✓ " : ""}
                  {source.name || "Nom non renseigné"}
                </Text>
                <Text style={s.text}>
                  {[
                    source.category,
                    source.age_range,
                    source.division || source.level,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Informations à compléter"}
                </Text>
                <Text style={s.small}>{stateLabels[state]}</Text>
              </Pressable>
            );
          })}
          {!!(sources.data && !sources.data.pages.flat().length) && (
            <Empty
              title="Aucune équipe FFF enregistrée pour ce club"
              description="Vous pouvez créer vos équipes depuis la rubrique Équipes. Aucun effectif ni niveau n’est inventé à partir du nom du club."
            />
          )}
          {!!sources.hasNextPage && (
            <Button
              title="Afficher d’autres équipes"
              secondary
              busy={sources.isFetchingNextPage}
              onPress={() => void sources.fetchNextPage()}
            />
          )}
          <Button
            title={`Préparer l’import (${Object.keys(selected).length})`}
            disabled={
              !Object.keys(selected).length ||
              !validImportSeason(season) ||
              capability.data !== true ||
              !teams.data ||
              !!teams.error
            }
            onPress={() => {
              try {
                setPlan({
                  season,
                  rows: buildTeamImportPlan(
                    id,
                    season,
                    Object.values(selected),
                    teams.data || [],
                    randomUUID,
                  ),
                });
                setError(null);
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure
                    : new Error("Sélection invalide."),
                );
              }
            }}
          />
        </>
      )}
    </>
  );
}
