import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useClubs } from "../lib/data";
import { supabase } from "../lib/supabase";
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
  SearchField,
  useUIStyles,
} from "../components/ui";
export default function ClubClaim() {
  return (
    <Screen title="Représenter mon club">
      <AuthGate>
        <Form />
      </AuthGate>
    </Screen>
  );
}
function Form() {
  const s = useUIStyles();

  const { session, profile } = useAuth();
  const params = useLocalSearchParams<{ clubId?: string }>();
  const uid = session!.user.id;
  const cache = useQueryClient();
  const [clubId, setClubId] = useState(params.clubId || "");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const clubs = useClubs(search, department);
  const selected = useQuery({
    queryKey: ["claim-club", clubId],
    enabled: !!clubId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fff_clubs")
        .select("id,name,city")
        .eq("id", clubId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState(session?.user.email || "");
  const [phone, setPhone] = useState("");
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<
    Record<string, ImagePicker.ImagePickerAsset>
  >({});
  const attempt = useRef({
    id: randomUUID(),
    paths: {} as Record<string, string>,
  });
  const pick = useMutation({
    mutationFn: async (side: string) => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.85,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(
          file.mimeType || "image/jpeg",
        )
      )
        throw new Error("Choisissez une photo JPG, PNG ou WebP.");
      if (!file.base64 || file.base64.length * 0.75 > 5 * 1024 * 1024)
        throw new Error("Choisissez une photo de moins de 5 Mo.");
      setFiles((current) => ({ ...current, [side]: file }));
      delete attempt.current.paths[side];
    },
  });
  const send = useMutation({
    mutationFn: async () => {
      const {
        data: { session: fresh },
        error: authError,
      } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (fresh?.user.id !== uid)
        throw new Error("Reconnectez-vous avant d’envoyer votre demande.");
      if (
        !clubId ||
        !fullName.trim() ||
        !position.trim() ||
        !validEmail(email) ||
        !/^\d{8}$/.test(number)
      )
        throw new Error(
          "Renseignez le club, votre nom, votre fonction, votre e-mail et le numéro FFF à 8 chiffres.",
        );
      const existing = await supabase
        .from("club_claim_requests")
        .select("id")
        .eq("id", attempt.current.id)
        .eq("user_id", uid)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return;
      const pending = await supabase
        .from("club_claim_requests")
        .select("id")
        .eq("user_id", uid)
        .eq("club_id", clubId)
        .eq("status", "pending")
        .limit(1);
      if (pending.error) throw pending.error;
      if (pending.data?.length)
        throw new Error(
          "Une demande pour ce club est déjà en cours. Retrouvez-la dans Mes demandes de club.",
        );
      for (const side of ["front", "back"]) {
        if (!files[side] || attempt.current.paths[side]) continue;
        const { data, error } = await supabase.functions.invoke(
          "club-claim-upload",
          {
            body: {
              file: `data:${files[side].mimeType || "image/jpeg"};base64,${files[side].base64}`,
              fileName: `${side}.${files[side].mimeType === "image/png" ? "png" : files[side].mimeType === "image/webp" ? "webp" : "jpg"}`,
              contentType: files[side].mimeType || "image/jpeg",
            },
          },
        );
        if (error) throw error;
        if (
          typeof data?.path !== "string" ||
          !data.path.startsWith(`club-claims/${uid}/`)
        )
          throw new Error(
            "Impossible de confirmer l’enregistrement du document.",
          );
        attempt.current.paths[side] = data.path;
      }
      const { error } = await supabase.from("club_claim_requests").insert({
        id: attempt.current.id,
        user_id: uid,
        club_id: clubId,
        full_name: fullName.trim(),
        position: position.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: message.trim(),
        numero_affiliation_fff: number,
        status: "pending",
        id_card_front_url: attempt.current.paths.front || null,
        id_card_back_url: attempt.current.paths.back || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["my-club-claims", uid] });
    },
  });
  if (send.isSuccess)
    return (
      <View style={s.card}>
        <Text style={s.h2}>Demande enregistrée</Text>
        <Text style={s.text}>
          L’équipe FootNation examinera votre demande. Vous pouvez suivre son
          statut dans votre espace.
        </Text>
        <Button
          title="Mes demandes de club"
          onPress={() => router.replace("/club-claims")}
        />
      </View>
    );
  return (
    <>
      <Text style={s.subtitle}>
        Demandez à gérer la page officielle de votre club sur FootNation.
      </Text>
      {clubId ? (
        <View style={s.card}>
          {selected.isPending ? (
            <Loading />
          ) : selected.error ? (
            <ErrorState error={selected.error} />
          ) : (
            <Text style={s.h2}>{selected.data?.name}</Text>
          )}
          <Button
            secondary
            title="Changer de club"
            disabled={send.isPending}
            onPress={() => setClubId("")}
          />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <SearchField
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher mon club"
          />
          <Field
            label="Code du département (facultatif)"
            value={department}
            onChangeText={setDepartment}
            maxLength={3}
          />
          {clubs.isPending ? (
            <Loading />
          ) : clubs.error ? (
            <ErrorState
              error={clubs.error}
              retry={() => void clubs.refetch()}
            />
          ) : (
            clubs.data?.pages
              .flatMap((page) => page.rows)
              .map((club) => (
                <Chip
                  key={club.id}
                  label={`${club.name}${club.city ? ` · ${club.city}` : ""}`}
                  onPress={() => setClubId(club.id)}
                />
              ))
          )}
          {!!clubs.hasNextPage && (
            <Button
              secondary
              title="Clubs suivants"
              busy={clubs.isFetchingNextPage}
              onPress={() => void clubs.fetchNextPage()}
            />
          )}
        </View>
      )}
      <Field
        label="Nom complet"
        value={fullName}
        onChangeText={setFullName}
        maxLength={120}
        editable={!send.isPending}
      />
      <Field
        label="Fonction au sein du club"
        value={position}
        onChangeText={setPosition}
        maxLength={120}
        editable={!send.isPending}
      />
      <Field
        label="Adresse e-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!send.isPending}
      />
      <Field
        label="Téléphone (facultatif)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={30}
        editable={!send.isPending}
      />
      <Field
        label="Numéro d’affiliation FFF (8 chiffres)"
        value={number}
        onChangeText={setNumber}
        keyboardType="number-pad"
        maxLength={8}
        editable={!send.isPending}
      />
      <Field
        label="Message (facultatif)"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={3000}
        editable={!send.isPending}
      />
      <Text style={s.h2}>Justificatifs d’identité</Text>
      <Text style={s.small}>
        Vous pouvez joindre le recto et le verso de votre pièce d’identité. Les
        photos seront envoyées avec votre demande, uniquement après validation
        du formulaire.
      </Text>
      {(
        [
          ["front", "Recto"],
          ["back", "Verso"],
        ] as const
      ).map(([side, label]) => (
        <View key={side} style={{ gap: 8 }}>
          <Button
            secondary
            title={`${label}${files[side] ? " : photo sélectionnée" : " : choisir une photo"}`}
            disabled={send.isPending}
            busy={pick.isPending}
            onPress={() => pick.mutate(side)}
          />
          {!!files[side] && (
            <Button
              secondary
              title={`Retirer le ${label.toLowerCase()}`}
              disabled={send.isPending}
              onPress={() => {
                setFiles((current) => {
                  const next = { ...current };
                  delete next[side];
                  return next;
                });
                delete attempt.current.paths[side];
              }}
            />
          )}
        </View>
      ))}
      {!!pick.error && <ErrorState error={pick.error} />}
      {!!send.error && <ErrorState error={send.error} />}
      <Button
        title="Envoyer ma demande"
        busy={send.isPending}
        disabled={
          pick.isPending ||
          !clubId ||
          !selected.data ||
          !fullName.trim() ||
          !position.trim() ||
          !validEmail(email) ||
          !/^\d{8}$/.test(number)
        }
        onPress={() => send.mutate()}
      />
    </>
  );
}
export function ClubClaims() {
  return (
    <Screen title="Mes demandes de club">
      <AuthGate>
        <History />
      </AuthGate>
    </Screen>
  );
}
function History() {
  const s = useUIStyles();

  const { session } = useAuth();
  const uid = session!.user.id;
  const query = useInfiniteQuery({
    queryKey: ["my-club-claims", uid],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("club_claim_requests")
        .select("id,status,admin_notes,created_at,club:fff_clubs(name)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 19);
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 20 ? pages.length * 20 : undefined,
  });
  return (
    <>
      <Button
        title="Représenter un club"
        onPress={() => router.push("/club-claim")}
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data?.pages[0]?.length ? (
        <Empty title="Aucune demande" />
      ) : (
        query.data.pages.flat().map((row) => (
          <View style={s.card} key={row.id}>
            <Text style={s.h2}>
              {(Array.isArray(row.club) ? row.club[0] : row.club)?.name ||
                "Club"}
            </Text>
            <Text style={s.text}>
              {{
                pending: "En cours d’examen",
                approved: "Approuvée",
                rejected: "Refusée",
              }[row.status as string] || row.status}
            </Text>
            <Text style={s.small}>
              {new Date(row.created_at).toLocaleDateString("fr-FR")}
            </Text>
            {!!row.admin_notes && <Text style={s.text}>{row.admin_notes}</Text>}
          </View>
        ))
      )}
      {!!query.hasNextPage && (
        <Button
          secondary
          title="Demandes suivantes"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
