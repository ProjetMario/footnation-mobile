import React, { useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Chip,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { formatAchievement } from "../lib/cv";
const sections = {
  education: "Diplômes",
  certifications: "Certifications",
  training_history: "Formation football",
};
type Section = keyof typeof sections;
export default function Education() {
  return (
    <Screen title="Diplômes et formations">
      <AuthGate>
        <Load />
      </AuthGate>
    </Screen>
  );
}
function Load() {
  const s = useUIStyles();

  const { session } = useAuth();
  const [section, setSection] = useState<Section>("education");
  const query = useQuery({
    queryKey: ["profile-education", session!.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,updated_at,education,certifications,training_history")
        .eq("id", session!.user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  return (
    <>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries(sections).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={section === key}
            onPress={() => setSection(key as Section)}
          />
        ))}
      </View>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <Editor
          key={`${section}:${query.data.updated_at}`}
          section={section}
          profile={query.data}
        />
      )}
    </>
  );
}
function Editor({ section, profile }: { section: Section; profile: any }) {
  const s = useUIStyles();

  const { session, reload } = useAuth();
  const cache = useQueryClient();
  const raw = profile[section];
  const rows: any[] = Array.isArray(raw) ? raw : [];
  const [editing, setEditing] = useState<number | null>(null);
  const [remove, setRemove] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [club, setClub] = useState("");
  const [ageCategory, setAgeCategory] = useState("");
  const mutation = useMutation({
    mutationFn: async (deleteIndex: number | null) => {
      if (!session || session.user.id !== profile.id)
        throw new Error("Connexion requise.");
      if (raw != null && !Array.isArray(raw))
        throw new Error(
          "Ce format ancien doit être conservé sans modification.",
        );
      if (deleteIndex === null && !title.trim())
        throw new Error("Indiquez un intitulé.");
      if (
        deleteIndex === null &&
        year.trim() &&
        !/^\d{4}(\s*[-–]\s*\d{4})?$/.test(year.trim())
      )
        throw new Error(
          "Indiquez une année ou une période, par exemple 2022 - 2025.",
        );
      const fresh = await supabase
        .from("profiles")
        .select(`${section},updated_at`)
        .eq("id", profile.id)
        .single();
      if (fresh.error) throw fresh.error;
      const latest = fresh.data as any;
      if (JSON.stringify(latest[section]) !== JSON.stringify(raw))
        throw new Error(
          "Cette rubrique a changé. Actualisez-la avant de continuer.",
        );
      const next = [...rows];
      if (deleteIndex !== null) next.splice(deleteIndex, 1);
      else {
        const value = {
          ...(editing !== null && typeof rows[editing] === "object"
            ? rows[editing]
            : {}),
          title: title.trim(),
          year: year.trim(),
          ...(section === "training_history"
            ? { club: club.trim(), ageCategory: ageCategory.trim() }
            : {}),
        };
        if (editing === null) next.push(value);
        else next[editing] = value;
      }
      let update = supabase
        .from("profiles")
        .update({ [section]: next })
        .eq("id", profile.id);
      update = latest.updated_at
        ? update.eq("updated_at", latest.updated_at)
        : update.is("updated_at", null);
      const { error } = await update.select("id").single();
      if (error) throw error;
    },
    onSuccess: async () => {
      setEditing(null);
      setRemove(null);
      setTitle("");
      setYear("");
      setClub("");
      setAgeCategory("");
      for (const key of [["profile-education"], ["profile"], ["native-cv"]])
        void cache.invalidateQueries({ queryKey: key });
      await reload();
    },
  });
  if (raw != null && !Array.isArray(raw))
    return (
      <View style={s.card}>
        <Text style={s.text}>
          {Object.values(raw).map(formatAchievement).join("\n")}
        </Text>
        <Text style={s.small}>
          Ces données utilisent un ancien format et sont conservées en lecture.
        </Text>
      </View>
    );
  return (
    <>
      {rows.map((row, index) => (
        <View key={index} style={s.card}>
          <Text style={s.text}>{formatAchievement(row)}</Text>
          <Button
            title="Modifier"
            secondary
            disabled={mutation.isPending}
            onPress={() => {
              setEditing(index);
              setTitle(row.title || String(row));
              setYear(row.year || "");
              setClub(row.club || "");
              setAgeCategory(row.ageCategory || "");
            }}
          />
          {remove === index ? (
            <>
              <Text style={s.small}>Supprimer cette entrée ?</Text>
              <Button
                title="Confirmer la suppression"
                busy={mutation.isPending}
                onPress={() => mutation.mutate(index)}
              />
              <Button
                title="Annuler"
                secondary
                disabled={mutation.isPending}
                onPress={() => setRemove(null)}
              />
            </>
          ) : (
            <Button
              title="Supprimer"
              secondary
              disabled={mutation.isPending}
              onPress={() => setRemove(index)}
            />
          )}
        </View>
      ))}
      <Text style={s.h2}>
        {editing === null ? "Ajouter une entrée" : "Modifier l’entrée"}
      </Text>
      <Field
        label={section === "training_history" ? "Club / formation" : "Intitulé"}
        value={title}
        onChangeText={setTitle}
        maxLength={250}
      />
      <Field
        label="Année ou période"
        value={year}
        onChangeText={setYear}
        placeholder="2022 - 2025"
        maxLength={20}
      />
      {section === "training_history" && (
        <>
          <Field
            label="Niveau du club"
            value={club}
            onChangeText={setClub}
            maxLength={100}
          />
          <Field
            label="Catégories d’âge"
            value={ageCategory}
            onChangeText={setAgeCategory}
            maxLength={150}
          />
        </>
      )}
      {!!mutation.error && <ErrorState error={mutation.error} />}
      <Button
        title={editing === null ? "Ajouter" : "Enregistrer"}
        busy={mutation.isPending}
        disabled={!title.trim()}
        onPress={() => mutation.mutate(null)}
      />
      {editing !== null && (
        <Button
          title="Annuler la modification"
          secondary
          onPress={() => {
            setEditing(null);
            setTitle("");
            setYear("");
            setClub("");
            setAgeCategory("");
          }}
        />
      )}
    </>
  );
}
