import React, { useState } from "react";
import { Text, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Avatar,
  Banner,
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { ChoiceField } from "../components/ChoiceField";
import { ExternalLinkButton } from "../components/ExternalLinkButton";
import { ProfessionalContactButton } from "../components/ProfessionalContactButton";
import {
  ages,
  levels,
  positions,
  benefits,
  choices,
} from "../lib/careerOptions";
import { supabase } from "../lib/supabase";
const blank = {
  type: "",
  level: "",
  position: "",
  experience: "",
  ageCategory: "",
  minSalary: "",
  benefits: [] as string[],
};
export default function Career() {
  const s = useUIStyles();

  const [draft, setDraft] = useState(blank);
  const [filters, setFilters] = useState(blank);
  const [expanded, setExpanded] = useState(false);
  const query = useInfiniteQuery({
    queryKey: ["native-career", filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let request = supabase
        .from("clubs")
        .select("*")
        .eq("recruiting_status", true)
        .order("name")
        .order("id");
      if (filters.type) request = request.eq("competition_level", filters.type);
      if (filters.level) request = request.eq("division", filters.level);
      if (filters.position)
        request = request.contains("recruiting_positions", {
          [filters.position]: true,
        });
      if (filters.experience)
        request = request.eq("required_experience", filters.experience);
      if (filters.ageCategory)
        request = request.contains("age_category", [filters.ageCategory]);
      if (filters.benefits.length)
        request = request.contains(
          "benefits",
          Object.fromEntries(filters.benefits.map((key) => [key, true])),
        );
      if (Number(filters.minSalary) > 0)
        request = request.gte("salary_range->min", Number(filters.minSalary));
      const { data, error } = await request.range(pageParam, pageParam + 19);
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 20 ? pages.length * 20 : undefined,
  });
  return (
    <Screen title="Recherche de club">
      <Banner eyebrow="CARRIÈRE" title="Trouvez votre prochain club" />
      <Button
        title={expanded ? "Masquer les filtres" : "Filtrer les clubs"}
        secondary
        onPress={() => setExpanded(!expanded)}
      />
      {!!expanded && (
        <View style={s.card}>
          <ChoiceField
            label="Type de club"
            value={draft.type}
            options={[
              { value: "professional", label: "Professionnel" },
              { value: "amateur", label: "Amateur" },
            ]}
            onChange={(type) => setDraft((previous) => ({ ...previous, type }))}
          />
          {(
            [
              ["level", "Niveau souhaité", levels],
              ["position", "Poste recherché", positions],
              [
                "experience",
                "Expérience requise",
                ["Débutant", "Amateur", "Semi-pro", "Professionnel"],
              ],
              ["ageCategory", "Catégorie d’âge", ages],
            ] as const
          ).map(([key, label, options]) => (
            <ChoiceField
              key={key}
              label={label}
              value={draft[key]}
              options={choices([...options])}
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, [key]: value }))
              }
            />
          ))}
          <Field
            label="Rémunération minimum (€)"
            keyboardType="number-pad"
            value={draft.minSalary}
            onChangeText={(minSalary) =>
              setDraft((previous) => ({
                ...previous,
                minSalary: minSalary.replace(/[^0-9]/g, ""),
              }))
            }
          />
          <Text style={s.label}>Avantages souhaités</Text>
          <View style={[s.row, { flexWrap: "wrap" }]}>
            {Object.entries(benefits).map(([key, label]) => (
              <Chip
                key={key}
                label={label}
                selected={draft.benefits.includes(key)}
                onPress={() =>
                  setDraft((previous) => ({
                    ...previous,
                    benefits: previous.benefits.includes(key)
                      ? previous.benefits.filter((b) => b !== key)
                      : [...previous.benefits, key],
                  }))
                }
              />
            ))}
          </View>
          <Button
            title="Rechercher"
            onPress={() => {
              setFilters({ ...draft });
              setExpanded(false);
            }}
          />
          <Button
            title="Réinitialiser"
            secondary
            onPress={() => {
              setDraft(blank);
              setFilters(blank);
            }}
          />
        </View>
      )}
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages.flat().map((club) => (
        <View key={club.id} style={s.card}>
          <Avatar uri={club.logo_url} name={club.name} size={60} />
          <Text style={s.h2}>{club.name}</Text>
          <Text style={s.subtitle}>
            {club.city} · {club.division}
          </Text>
          {!!club.description && <Text style={s.text}>{club.description}</Text>}
          {!!club.salary_range && (
            <Text style={s.text}>
              Rémunération : {club.salary_range.min ?? "À préciser"} –{" "}
              {club.salary_range.max ?? "À préciser"} €
            </Text>
          )}
          <View style={[s.row, { flexWrap: "wrap" }]}>
            {Object.entries(club.benefits || {})
              .filter(([, value]) => value)
              .map(([key]) => (
                <Chip key={key} label={benefits[key] || key} />
              ))}
          </View>
          {!!club.email && (
            <ProfessionalContactButton kind="email" value={club.email} />
          )}
          {!!club.website && (
            <ExternalLinkButton title="Site du club" url={club.website} />
          )}
        </View>
      ))}
      {!!(query.data && !query.data.pages.flat().length) && (
        <Empty
          title="Aucun club pour ces critères"
          description="Essayez d’élargir votre recherche."
        />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Charger la suite"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </Screen>
  );
}
