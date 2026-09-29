import { clubInformationValue } from "../lib/clubInformationValue";
import React, { useState } from "react";
import { Text } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  ErrorState,
  Field,
  Loading,
  useUIStyles,
} from "../components/ui";
import { supabase } from "../lib/supabase";
import { requireClubAdmin } from "../lib/clubAccess";
import { useAuth } from "../lib/auth";
export const informationSections: Record<
  string,
  { title: string; fields: [string, string][] }
> = {
  infos: {
    title: "Identité du club",
    fields: [
      ["name", "Nom"],
      ["short_name", "Nom court"],
      ["logo_url", "Lien du logo"],
      ["founded_date", "Date de fondation"],
    ],
  },
  about: {
    title: "Présentation et histoire",
    fields: [
      ["description", "Présentation"],
      ["history", "Histoire du club"],
    ],
  },
  contact: {
    title: "Coordonnées",
    fields: [
      ["address", "Adresse"],
      ["city", "Ville"],
      ["postal_code", "Code postal"],
      ["phone", "Téléphone"],
      ["email", "Email"],
      ["website", "Site internet"],
    ],
  },
};
export default function ClubInformation({
  id,
  section,
}: {
  id: string;
  section: string;
}) {
  const uid = useAuth().session!.user.id;
  const [reloadVersion, setReloadVersion] = useState(0);
  const query = useQuery({
    queryKey: ["club-information", id, uid],
    queryFn: async () => {
      await requireClubAdmin(id, uid);
      const { data, error } = await supabase
        .from("fff_clubs")
        .select(
          "name,short_name,logo_url,founded_date,type,description,history,address,city,postal_code,phone,email,website",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  return query.isPending ? (
    <Loading />
  ) : query.error && !query.data ? (
    <ErrorState error={query.error} retry={() => void query.refetch()} />
  ) : (
    <Editor
      key={`${uid}:${id}:${section}:${reloadVersion}`}
      id={id}
      section={section}
      initial={query.data!}
      onReload={async () => {
        const fresh = await query.refetch();
        if (fresh.error) throw fresh.error;
        setReloadVersion((value) => value + 1);
      }}
    />
  );
}
function Editor({
  id,
  section,
  initial,
  onReload,
}: {
  id: string;
  section: string;
  initial: Record<string, any>;
  onReload: () => Promise<void>;
}) {
  const s = useUIStyles();
  const uid = useAuth().session!.user.id;

  const config = informationSections[section];
  const [baseline, setBaseline] = useState(initial);
  const reload = useMutation({ mutationFn: onReload });
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(config.fields.map(([key]) => [key, initial[key] || ""])),
  );
  const [success, setSuccess] = useState(false);
  const cache = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      await requireClubAdmin(id, uid);
      const patch = Object.fromEntries(
        config.fields.map(([key]) => [
          key,
          clubInformationValue(key, values[key]),
        ]),
      );
      const response = await supabase.functions.invoke("update-club-info", {
        body: {
          clubId: id,
          section,
          ...patch,
          expected: Object.fromEntries(
            config.fields.map(([key]) => [key, baseline[key] ?? null]),
          ),
        },
      });
      if (response.error) {
        let message =
          "Impossible d’enregistrer ces informations. Réessayez ou rechargez le formulaire.";
        try {
          const detail = await response.error.context?.json();
          if (detail?.error) message = detail.error;
        } catch {
          /* Keep the recoverable network error message. */
        }
        throw new Error(message);
      }
      if (response.data?.error) throw new Error(response.data.error);
      if (!response.data?.values)
        throw new Error(
          "Réponse du serveur incomplète. Rechargez le formulaire.",
        );
      return response.data.values as Record<string, any>;
    },
    onSuccess: (saved) => {
      setBaseline(saved);
      setSuccess(true);
      void cache.invalidateQueries({ queryKey: ["club", id] });
      void cache.invalidateQueries({ queryKey: ["club-information", id] });
      void cache.invalidateQueries({ queryKey: ["club-admin-name", id] });
    },
  });
  return (
    <>
      <Text style={s.h2}>{config.title}</Text>
      {config.fields.map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={values[key]}
          multiline={section === "about"}
          editable={!save.isPending && !reload.isPending}
          autoCapitalize={
            key === "email" || key === "website" || key === "logo_url"
              ? "none"
              : "sentences"
          }
          keyboardType={
            key === "email"
              ? "email-address"
              : key === "phone"
                ? "phone-pad"
                : key === "website" || key === "logo_url"
                  ? "url"
                  : "default"
          }
          placeholder={key === "founded_date" ? "AAAA-MM-JJ" : undefined}
          onChangeText={(value) => {
            setSuccess(false);
            setValues((previous) => ({ ...previous, [key]: value }));
          }}
        />
      ))}
      {!!save.error && (
        <>
          <ErrorState error={save.error} />
          <Button
            title="Abandonner les changements et recharger"
            secondary
            busy={reload.isPending}
            disabled={save.isPending}
            onPress={() => reload.mutate()}
          />
        </>
      )}
      {!!reload.error && <ErrorState error={reload.error} />}
      {!!success && (
        <Text accessibilityRole="alert" style={s.text}>
          Modifications enregistrées.
        </Text>
      )}
      <Button
        title="Enregistrer"
        busy={save.isPending}
        disabled={reload.isPending}
        onPress={() => save.mutate()}
      />
    </>
  );
}
