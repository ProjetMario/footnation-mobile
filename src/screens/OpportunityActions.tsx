import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { validEmail } from "../lib/validation";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { DateField } from "../components/DateField";
import {
  opportunityListingKind,
  type OpportunityListingKind,
} from "../lib/opportunityKind";
export const creationTypes = [
  ["emploi_cdi", "CDI"],
  ["emploi_cdd", "CDD"],
  ["benevolat", "Bénévolat"],
  ["mission_ponctuelle", "Mission ponctuelle"],
  ["recherche_joueur", "Recherche joueur"],
  ["recherche_staff", "Recherche staff"],
];
export const opportunityProfiles = [
  ["", "Tous les profils"],
  ["passionne", "Passionné"],
  ["joueur_pro", "Joueur PRO"],
  ["amateur", "Amateur"],
  ["entraineur", "Entraîneur"],
  ["benevole", "Bénévole"],
  ["dirigeant", "Dirigeant"],
  ["arbitre", "Arbitre"],
  ["president", "Président"],
  ["agent", "Agent"],
  ["joueur_loisir", "Joueur Loisir"],
  ["educateur", "Éducateur"],
  ["supporter", "Supporter"],
  ["parent", "Parent"],
  ["entreprise", "Entreprise"],
  ["ligue_district", "Ligue & District"],
  ["foot_corpo", "Foot corpo"],
  ["centre_indoor", "Centre indoor"],
];
const profiles = opportunityProfiles;
export interface Offer {
  id: string;
  user_id: string;
  is_active: boolean;
  expires_at?: string | null;
  screening_questions?: { id: string; question: string; required: boolean }[];
}
export function Application({ offer }: { offer: Offer }) {
  const s = useUIStyles();

  const { session } = useAuth();
  const uid = session?.user.id;
  const cache = useQueryClient();
  const [message, setMessage] = useState(""),
    [answers, setAnswers] = useState<Record<string, string>>({});
  const mine = useQuery({
    queryKey: ["application", offer.id, uid],
    enabled: !!uid && uid !== offer.user_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunity_applications")
        .select("id,status")
        .eq("opportunity_id", offer.id)
        .eq("applicant_id", uid!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const send = useMutation({
    mutationFn: async () => {
      if (!uid || uid === offer.user_id)
        throw new Error("Vous ne pouvez pas postuler à cette annonce.");
      const questions = offer.screening_questions || [];
      if (questions.some((q) => q.required && !answers[q.id]?.trim()))
        throw new Error("Répondez aux questions obligatoires.");
      const { error } = await supabase.from("opportunity_applications").insert({
        opportunity_id: offer.id,
        applicant_id: uid,
        message: message.trim() || null,
        screening_answers: questions.map((q) => ({
          question_id: q.id,
          answer: answers[q.id]?.trim() || "",
        })),
      });
      if (error) throw error;
    },
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["application", offer.id, uid] }),
  });
  const deactivate = useMutation({
    mutationFn: async () => {
      if (uid !== offer.user_id) throw new Error("Action réservée à l’auteur.");
      const { error } = await supabase
        .from("opportunities")
        .update({ is_active: !offer.is_active })
        .eq("id", offer.id)
        .eq("user_id", uid!);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: ["opportunities"] }),
        cache.invalidateQueries({ queryKey: ["opportunity", offer.id] }),
      ]),
  });
  if (uid === offer.user_id)
    return (
      <View style={s.card}>
        <Button
          title="Modifier mon annonce"
          secondary
          onPress={() => router.push(`/opportunity/${offer.id}/edit`)}
        />
        <Button
          title="Voir les candidatures"
          onPress={() => router.push(`/opportunity/${offer.id}/applications`)}
        />
        <Button
          title={
            offer.is_active ? "Désactiver l’annonce" : "Réactiver l’annonce"
          }
          secondary
          busy={deactivate.isPending}
          onPress={() => deactivate.mutate()}
        />
        {!!deactivate.isError && <ErrorState error={deactivate.error} />}
      </View>
    );
  return (
    <View style={s.card}>
      <Text style={s.h2}>Votre candidature</Text>
      {mine.isPending ? (
        <Loading />
      ) : mine.isError ? (
        <ErrorState error={mine.error} />
      ) : mine.data ? (
        <Text style={s.text}>Votre candidature a été transmise.</Text>
      ) : !offer.is_active ||
        (offer.expires_at && Date.parse(offer.expires_at) < Date.now()) ? (
        <Text style={s.text}>
          Cette annonce n’accepte plus de candidatures.
        </Text>
      ) : (
        <>
          <Field
            label="Message de candidature"
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={5000}
          />
          {offer.screening_questions?.map((q) => (
            <Field
              key={q.id}
              label={`${q.question}${q.required ? " *" : ""}`}
              value={answers[q.id] || ""}
              onChangeText={(text) =>
                setAnswers((a) => ({ ...a, [q.id]: text }))
              }
              multiline
              maxLength={3000}
            />
          ))}
          <Button
            title="Envoyer ma candidature"
            busy={send.isPending}
            onPress={() => send.mutate()}
          />
          {!!send.isError && <ErrorState error={send.error} />}
        </>
      )}
    </View>
  );
}
export function OpportunityEditor() {
  const s = useUIStyles();

  const { id, kind } = useLocalSearchParams<{ id?: string; kind?: string }>();
  const [listingKind, setListingKind] = useState<OpportunityListingKind>(
    kind === "request" ? "request" : "offer",
  );
  const { session } = useAuth();
  const cache = useQueryClient();
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [type, setType] = useState("recherche_joueur"),
    [target, setTarget] = useState(""),
    [city, setCity] = useState(""),
    [department, setDepartment] = useState(""),
    [club, setClub] = useState(""),
    [locationType, setLocationType] = useState("sur_site"),
    [contact, setContact] = useState("messagerie"),
    [email, setEmail] = useState(""),
    [expiry, setExpiry] = useState("");
  const existing = useQuery({
    queryKey: ["offer-editor", id, session?.user.id],
    enabled: !!id && !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", id!)
        .eq("user_id", session!.user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const d = existing.data;
    if (!d) return;
    setTitle(d.title || "");
    setDescription(d.description || "");
    setType(d.opportunity_type);
    setListingKind(opportunityListingKind(d.opportunity_type, d.listing_kind));
    setTarget(d.target_profile_type || "");
    setCity(d.location_city || "");
    setDepartment(d.location_department || "");
    setClub(d.club_name || "");
    setLocationType(d.location_type || "sur_site");
    setContact(d.contact_method || "messagerie");
    setEmail(d.contact_email || "");
    setExpiry(d.expires_at || "");
  }, [existing.data]);
  const save = useMutation({
    mutationFn: async () => {
      if (!session || !title.trim()) throw new Error("Indiquez un titre.");
      if (id && !existing.data)
        throw new Error("L’annonce n’a pas été chargée.");
      if (contact !== "messagerie" && !validEmail(email))
        throw new Error("Indiquez un email de contact valide.");
      if (
        expiry &&
        (!Number.isFinite(Date.parse(expiry)) ||
          Date.parse(expiry) <= Date.now())
      )
        throw new Error("La date d’expiration doit être à venir.");
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        opportunity_type: type,
        listing_kind: listingKind,
        target_profile_type: target || null,
        location_type: locationType,
        location_city: city.trim() || null,
        location_department: department.trim() || null,
        club_name: club.trim() || null,
        contact_method: contact,
        contact_email: email.trim() || null,
        expires_at: expiry ? new Date(expiry).toISOString() : null,
      };
      const r = id
        ? await supabase
            .from("opportunities")
            .update(payload)
            .eq("id", id)
            .eq("user_id", session.user.id)
            .select("id")
            .single()
        : await supabase
            .from("opportunities")
            .insert({
              ...payload,
              user_id: session.user.id,
              screening_questions: [],
            })
            .select("id")
            .single();
      if (r.error) throw r.error;
      return r.data.id as string;
    },
    onSuccess: (targetId) => {
      void cache.invalidateQueries({ queryKey: ["opportunities"] });
      void cache.invalidateQueries({ queryKey: ["opportunity"] });
      router.replace(`/opportunity/${targetId}`);
    },
  });
  return (
    <Screen title={id ? "Modifier une annonce" : "Publier une annonce"}>
      <AuthGate>
        {id && existing.isPending ? (
          <Loading />
        ) : id && existing.isError ? (
          <ErrorState error={existing.error} />
        ) : (
          <>
            <Field
              label="Titre"
              value={title}
              onChangeText={setTitle}
              maxLength={150}
            />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={10000}
            />
            <Text style={s.label}>Que veux-tu publier ?</Text>
            <View style={[s.row, { flexWrap: "wrap" }]}>
              <Chip
                label="Une offre"
                selected={listingKind === "offer"}
                onPress={() => setListingKind("offer")}
              />
              <Chip
                label="Une demande"
                selected={listingKind === "request"}
                onPress={() => setListingKind("request")}
              />
            </View>
            <Text style={s.small}>
              {listingKind === "offer"
                ? "Tu proposes une place, un poste ou une mission."
                : "Tu recherches un club, un poste ou une mission pour toi."}
            </Text>
            <Text style={s.label}>Type d’annonce</Text>
            <View style={[s.row, { flexWrap: "wrap" }]}>
              {creationTypes.map(([v, label]) => (
                <Chip
                  key={v}
                  label={
                    listingKind === "request" && v === "recherche_joueur"
                      ? "Club pour jouer"
                      : listingKind === "request" && v === "recherche_staff"
                        ? "Poste dans un staff"
                        : label
                  }
                  selected={type === v}
                  onPress={() => setType(v)}
                />
              ))}
            </View>
            <Text style={s.label}>
              {listingKind === "request" ? "Mon profil" : "Profil recherché"}
            </Text>
            <View style={[s.row, { flexWrap: "wrap" }]}>
              {profiles.map(([v, label]) => (
                <Chip
                  key={v}
                  label={label}
                  selected={target === v}
                  onPress={() => setTarget(v)}
                />
              ))}
            </View>
            <Field
              label="Club / organisation"
              value={club}
              onChangeText={setClub}
              maxLength={150}
            />
            <Field
              label="Ville"
              value={city}
              onChangeText={setCity}
              maxLength={150}
            />
            <Field
              label="Département"
              value={department}
              onChangeText={setDepartment}
              maxLength={3}
            />
            <Text style={s.label}>Lieu de travail</Text>
            <View style={[s.row, { flexWrap: "wrap" }]}>
              {[
                ["sur_site", "Sur site"],
                ["hybride", "Hybride"],
                ["a_distance", "À distance"],
              ].map(([v, label]) => (
                <Chip
                  key={v}
                  label={label}
                  selected={locationType === v}
                  onPress={() => setLocationType(v)}
                />
              ))}
            </View>
            <Text style={s.label}>Contact</Text>
            <View style={[s.row, { flexWrap: "wrap" }]}>
              {[
                ["messagerie", "Messagerie"],
                ["email", "Email"],
                ["both", "Les deux"],
              ].map(([v, label]) => (
                <Chip
                  key={v}
                  label={label}
                  selected={contact === v}
                  onPress={() => setContact(v)}
                />
              ))}
            </View>
            {contact !== "messagerie" && (
              <Field
                label="Email de contact"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}
            <DateField
              label="Expiration (facultative)"
              value={expiry}
              onChange={setExpiry}
            />
            {!!save.isError && <ErrorState error={save.error} />}
            <Button
              title={id ? "Enregistrer" : "Publier"}
              disabled={!title.trim()}
              busy={save.isPending}
              onPress={() => save.mutate()}
            />
          </>
        )}
      </AuthGate>
    </Screen>
  );
}
export function Applications() {
  const s = useUIStyles();

  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const q = useInfiniteQuery({
    queryKey: ["applications", id, session?.user.id],
    enabled: !!session,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const own = await supabase
        .from("opportunities")
        .select("id")
        .eq("id", id)
        .eq("user_id", session!.user.id)
        .single();
      if (own.error) throw own.error;
      const { data, error } = await supabase
        .from("opportunity_applications")
        .select("*")
        .eq("opportunity_id", id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam * 30, pageParam * 30 + 29);
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, _pages, p) =>
      last.length === 30 ? p + 1 : undefined,
  });
  return (
    <Screen title="Candidatures">
      <AuthGate>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorState error={q.error} />
        ) : !q.data.pages.flat().length ? (
          <Empty title="Aucune candidature pour le moment" />
        ) : (
          q.data.pages.flat().map((a) => (
            <View key={a.id} style={s.card}>
              <Text style={s.text}>
                {a.message || "Candidature sans message"}
              </Text>
              {!!Array.isArray(a.screening_answers) &&
                a.screening_answers.map(
                  (answer: { question_id: string; answer: string }) => (
                    <Text key={answer.question_id} style={s.text}>
                      {answer.answer}
                    </Text>
                  ),
                )}
              <Button
                title="Voir le candidat"
                secondary
                onPress={() => router.push(`/profile/${a.applicant_id}`)}
              />
            </View>
          ))
        )}
        {!!q.hasNextPage && (
          <Button
            title="Voir plus"
            secondary
            busy={q.isFetchingNextPage}
            onPress={() => void q.fetchNextPage()}
          />
        )}
      </AuthGate>
    </Screen>
  );
}
