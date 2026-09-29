import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { DateField } from "../components/DateField";
import { ChoiceField } from "../components/ChoiceField";
import { ProfileAutocompleteField } from "../components/ProfileAutocompleteField";
import { departmentOptions } from "../lib/networkOptions";
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
const types = [
  ["tournament", "Tournoi"],
  ["match", "Match"],
  ["training", "Entraînement"],
  ["social", "Rencontre"],
  ["competition", "Compétition"],
  ["camp", "Stage"],
  ["other", "Autre"],
];
function CommunityEditor({ kind }: { kind: "groups" | "events" }) {
  const s = useUIStyles();

  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const uid = session?.user.id;
  const cache = useQueryClient();
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [city, setCity] = useState(""),
    [department, setDepartment] = useState(""),
    [privacy, setPrivacy] = useState("public"),
    [type, setType] = useState("tournament"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [price, setPrice] = useState("0"),
    [max, setMax] = useState(""),
    [location, setLocation] = useState("");
  // A stable group ID allows retrying admin membership setup without duplicate groups.
  const groupId = useRef(randomUUID()),
    created = useRef(false);
  const existing = useQuery({
    queryKey: ["community-editor", kind, id, uid],
    enabled: !!id && !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(kind)
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      if (kind === "events" && data.organizer_id !== uid)
        throw new Error("Seul l’organisateur peut modifier cet événement.");
      if (kind === "groups" && data.created_by !== uid) {
        const m = await supabase
          .from("group_memberships")
          .select("role")
          .eq("group_id", id!)
          .eq("user_id", uid!)
          .single();
        if (m.error || m.data.role !== "admin")
          throw new Error("Vous ne pouvez pas modifier ce groupe.");
      }
      return data;
    },
  });
  useEffect(() => {
    const d = existing.data;
    if (!d) return;
    setName(d.name || d.title || "");
    setDescription(d.description || "");
    setCity(d.location_city || "");
    setDepartment(d.location_department_code || "");
    setPrivacy(d.privacy || d.visibility || "public");
    setType(d.event_type || "tournament");
    setStart(d.start_date || "");
    setEnd(d.end_date || "");
    setPrice(String(d.price || 0));
    setMax(d.max_participants ? String(d.max_participants) : "");
    setLocation(d.location || "");
  }, [existing.data]);
  const save = useMutation({
    mutationFn: async () => {
      if (!uid || !name.trim()) throw new Error("Un nom est requis.");
      if (id && !existing.data)
        throw new Error("Attendez le chargement du contenu.");
      const common = {
        description: description.trim() || null,
        location_city: city.trim() || null,
        location_department_code: department.trim() || null,
      };
      if (kind === "groups") {
        const values = { ...common, name: name.trim(), privacy };
        const target = id || groupId.current;
        if (id) {
          const r = await supabase
            .from("groups")
            .update(values)
            .eq("id", id)
            .select("id")
            .single();
          if (r.error) throw r.error;
        } else {
          if (!created.current) {
            const r = await supabase
              .from("groups")
              .insert({
                ...values,
                id: target,
                created_by: uid,
                slug: `${name
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "")
                  .slice(0, 50)}-${target.slice(0, 8)}`,
              })
              .select("id")
              .single();
            if (r.error) throw r.error;
            created.current = true;
          }
          const member = await supabase
            .from("group_memberships")
            .upsert(
              { group_id: target, user_id: uid, role: "admin" },
              { onConflict: "group_id,user_id" },
            );
          if (member.error)
            throw new Error(
              "Le groupe a été créé, mais sa gestion n’a pas pu être activée. Réessayez pour terminer.",
            );
        }
        return target;
      }
      if (!Number.isFinite(Date.parse(start)))
        throw new Error(
          "Indiquez une date de début valide, avec son fuseau horaire.",
        );
      if (
        end &&
        (!Number.isFinite(Date.parse(end)) ||
          Date.parse(end) <= Date.parse(start))
      )
        throw new Error("La fin doit se situer après le début.");
      const amount = Number(price.replace(",", "."));
      const capacity = max ? Number(max) : null;
      if (!Number.isFinite(amount) || amount < 0)
        throw new Error("Le tarif doit être un nombre positif ou nul.");
      if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1))
        throw new Error("Le nombre de places doit être un entier positif.");
      const { data, error } = await supabase.functions.invoke(
        id ? `events/${id}` : "events",
        {
          method: id ? "PUT" : "POST",
          body: {
            ...common,
            title: name.trim(),
            event_type: type,
            start_date: new Date(start).toISOString(),
            end_date: end ? new Date(end).toISOString() : null,
            location: location.trim() || null,
            price: amount,
            currency: existing.data?.currency || "EUR",
            max_participants: capacity,
            visibility: privacy,
            ...(!id ? { categories: [], tags: [] } : {}),
          },
        },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.event?.id)
        throw new Error(
          "La confirmation du serveur est manquante. Vérifiez vos événements avant de réessayer.",
        );
      return data.event.id as string;
    },
    onSuccess: (target) => {
      void cache.invalidateQueries({ queryKey: ["collection", kind] });
      router.replace(`/${kind}/${target}`);
    },
  });
  return (
    <Screen
      title={`${id ? "Modifier" : "Créer"} ${kind === "groups" ? "un groupe" : "un événement"}`}
    >
      <AuthGate>
        {id && existing.isPending ? (
          <Loading />
        ) : id && existing.isError ? (
          <ErrorState error={existing.error} />
        ) : (
          <>
            <Field
              label={kind === "groups" ? "Nom du groupe" : "Titre"}
              value={name}
              onChangeText={setName}
              maxLength={150}
              editable={!save.isPending && !created.current}
            />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={10000}
            />
            <ProfileAutocompleteField
              kind="city"
              label="Ville"
              value={city}
              disabled={save.isPending}
              onChange={setCity}
              onSelect={(item) => {
                setCity(item.name);
                if (item.department) setDepartment(item.department);
              }}
            />
            <ChoiceField
              label="Département"
              value={department}
              options={departmentOptions}
              disabled={save.isPending}
              onChange={setDepartment}
            />
            <Text style={s.label}>Visibilité</Text>
            <View style={s.row}>
              {[
                ["public", "Public"],
                ["private", "Privé"],
              ].map(([value, label]) => (
                <Chip
                  key={value}
                  label={label}
                  selected={privacy === value}
                  onPress={() => setPrivacy(value)}
                />
              ))}
            </View>
            {kind === "events" && (
              <>
                <Text style={s.label}>Type d’événement</Text>
                <View style={[s.row, { flexWrap: "wrap" }]}>
                  {types.map(([value, label]) => (
                    <Chip
                      key={value}
                      label={label}
                      selected={type === value}
                      onPress={() => setType(value)}
                    />
                  ))}
                </View>
                <DateField label="Début" value={start} onChange={setStart} />
                <DateField
                  label="Fin (facultative)"
                  value={end}
                  onChange={setEnd}
                />
                <ProfileAutocompleteField
                  kind="city"
                  label="Lieu / adresse"
                  value={location}
                  disabled={save.isPending}
                  maxLength={300}
                  onChange={setLocation}
                  onSelect={(item) => {
                    setLocation(item.name);
                    if (!city) setCity(item.name);
                    if (item.department) setDepartment(item.department);
                  }}
                />
                <Field
                  label="Tarif"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                />
                <Field
                  label="Nombre de places (vide : illimité)"
                  value={max}
                  onChangeText={setMax}
                  keyboardType="number-pad"
                />
                {!id && (
                  <Text style={s.small}>
                    L’événement sera publié dès sa création.
                  </Text>
                )}
              </>
            )}
            {!!save.isError && <ErrorState error={save.error} />}
            <Button
              title={
                created.current
                  ? "Terminer la création"
                  : id
                    ? "Enregistrer"
                    : kind === "events"
                      ? "Créer et publier l’événement"
                      : "Créer le groupe"
              }
              busy={save.isPending}
              disabled={!name.trim()}
              onPress={() => save.mutate()}
            />
          </>
        )}
      </AuthGate>
    </Screen>
  );
}
export function GroupEditor() {
  return <CommunityEditor kind="groups" />;
}
export function EventEditor() {
  return <CommunityEditor kind="events" />;
}
