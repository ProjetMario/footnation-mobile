import React, { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Quote } from "lucide-react-native";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useDebounced } from "../lib/data";
import type { Profile } from "../lib/models";
import { publicProfileName } from "../lib/publicTalent";
import { searchFootNation } from "../lib/globalSearch";
import {
  createProfileRecommendation,
  loadProfileRecommendations,
  moderateProfileRecommendation,
  type ProfileRecommendation,
} from "../lib/profileRecommendations";
import { useTheme } from "../theme";
import {
  Avatar,
  Button,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "./ui";
import { ChoiceField } from "./ChoiceField";

export function ProfileRecommendations({ profile }: { profile: Profile }) {
  const { session } = useAuth();
  const uid = session?.user.id || "";
  const own = uid === profile.id;
  const s = useUIStyles();
  const { colors } = useTheme();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [removing, setRemoving] = useState<ProfileRecommendation | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["profile-recommendations", profile.id, uid],
    initialPageParam: 0,
    enabled: !!uid,
    queryFn: ({ pageParam }) =>
      loadProfileRecommendations(profile.id, uid, pageParam),
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const change = useMutation({
    mutationFn: ({
      row,
      action,
    }: {
      row: ProfileRecommendation;
      action: "approve" | "delete";
    }) => moderateProfileRecommendation(uid, row, action),
    onSuccess: () => {
      setRemoving(null);
      void query.refetch();
    },
  });
  return (
    <View style={[s.card, { gap: 16, borderRadius: 18 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Quote size={21} color={colors.blue} />
        <Text accessibilityRole="header" style={[s.h2, { fontSize: 17 }]}>
          Recommandations
        </Text>
      </View>
      <Text style={s.small}>
        {own
          ? "Les mots de celles et ceux qui ont partagé votre parcours. Vous choisissez les recommandations à afficher."
          : "Coéquipiers, entraîneurs et membres partagent leur expérience."}
      </Text>
      {!!uid && (
        <Button
          title={own ? "Recommander un membre" : "Recommander ce profil"}
          secondary
          onPress={() => {
            setSuccess(false);
            setOpen(true);
          }}
        />
      )}
      {success && (
        <Text accessibilityRole="alert" style={{ color: colors.blue }}>
          Recommandation envoyée. Elle sera visible après validation du membre.
        </Text>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data?.pages.flat().length && (
            <Text style={s.small}>Aucune recommandation pour le moment.</Text>
          )}
          {query.data?.pages.flat().map((row) => (
            <View
              key={row.id}
              style={{
                gap: 10,
                paddingTop: 16,
                borderTopWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Voir le profil de ${row.author_name}`}
                onPress={() => router.push(`/profile/${row.author_id}`)}
                style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
              >
                <Avatar
                  uri={row.author_avatar}
                  name={row.author_name}
                  size={42}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[s.text, { fontFamily: "Inter-SemiBold" }]}>
                    {row.author_name}
                  </Text>
                  <Text style={s.small}>
                    {[row.relationship, row.author_role]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
              </Pressable>
              <Text style={s.text}>{row.content}</Text>
              {!row.is_approved && (
                <Text style={{ color: colors.blue, fontSize: 12 }}>
                  En attente de validation
                </Text>
              )}
              {(own || row.author_id === uid) && (
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {own && !row.is_approved && (
                    <Button
                      title="Afficher sur mon profil"
                      disabled={change.isPending}
                      onPress={() => change.mutate({ row, action: "approve" })}
                    />
                  )}
                  <Button
                    title={own && !row.is_approved ? "Refuser" : "Retirer"}
                    secondary
                    disabled={change.isPending}
                    onPress={() => {
                      change.reset();
                      setRemoving(row);
                    }}
                  />
                </View>
              )}
            </View>
          ))}
          {query.hasNextPage && (
            <Button
              title="Voir plus de recommandations"
              secondary
              busy={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          )}
        </>
      )}
      {!!change.error && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {change.error.message}
        </Text>
      )}
      {open && (
        <RecommendationComposer
          uid={uid}
          initialTarget={
            own
              ? undefined
              : { id: profile.id, name: publicProfileName(profile) }
          }
          onClose={() => setOpen(false)}
          onSent={() => {
            setOpen(false);
            setSuccess(true);
            void cache.invalidateQueries({
              queryKey: ["profile-recommendations"],
            });
          }}
        />
      )}
      {!!removing && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!change.isPending) setRemoving(null);
          }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              padding: 24,
              backgroundColor: "rgba(3,12,24,0.6)",
            }}
          >
            <View
              style={[
                s.card,
                { alignSelf: "center", width: "100%", maxWidth: 460, gap: 16 },
              ]}
            >
              <Text style={s.h2}>Retirer cette recommandation ?</Text>
              <Text style={s.small}>
                Elle ne sera plus affichée sur ce profil.
              </Text>
              {!!change.error && (
                <Text accessibilityRole="alert" style={s.small}>
                  {change.error.message}
                </Text>
              )}
              <Button
                title="Confirmer le retrait"
                busy={change.isPending}
                onPress={() =>
                  change.mutate({ row: removing, action: "delete" })
                }
              />
              <Button
                title="Annuler"
                secondary
                disabled={change.isPending}
                onPress={() => setRemoving(null)}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
function RecommendationComposer({
  uid,
  initialTarget,
  onClose,
  onSent,
}: {
  uid: string;
  initialTarget?: { id: string; name: string };
  onClose: () => void;
  onSent: () => void;
}) {
  const s = useUIStyles();
  const [target, setTarget] = useState(initialTarget);
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const [content, setContent] = useState("");
  const [relationship, setRelationship] = useState("");
  const results = useQuery({
    queryKey: ["recommendation-members", uid, term],
    queryFn: () => searchFootNation(uid, term, "profiles", 0),
    enabled: !target && term.trim().length >= 2,
  });
  const send = useMutation({
    mutationFn: () =>
      createProfileRecommendation(uid, target!.id, content, relationship),
    onSuccess: onSent,
  });
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!send.isPending) onClose();
      }}
    >
      <Screen
        title="Recommander un membre"
        back={false}
        right={
          <Button
            title="Fermer"
            secondary
            disabled={send.isPending}
            onPress={onClose}
          />
        }
      >
        <View style={{ gap: 16 }}>
          {!target ? (
            <>
              <Field
                label="Trouver un membre"
                placeholder="Nom, pseudo ou club"
                value={search}
                onChangeText={setSearch}
              />
              {term.length < 2 ? (
                <Text style={s.small}>Saisissez au moins deux caractères.</Text>
              ) : results.isPending ? (
                <Loading />
              ) : results.isError ? (
                <ErrorState
                  error={results.error}
                  retry={() => void results.refetch()}
                />
              ) : results.data?.rows.length ? (
                results.data.rows.map((row) => (
                  <Pressable
                    key={row.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Recommander ${row.title}`}
                    onPress={() =>
                      setTarget({
                        id: row.id.replace("profiles:", ""),
                        name: row.title,
                      })
                    }
                    style={[
                      s.card,
                      { flexDirection: "row", gap: 12, alignItems: "center" },
                    ]}
                  >
                    <Avatar uri={row.image} name={row.title} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.text}>{row.title}</Text>
                      <Text style={s.small}>{row.subtitle}</Text>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={s.small}>Aucun membre trouvé.</Text>
              )}
            </>
          ) : (
            <>
              <Text style={s.h2}>{target.name}</Text>
              {!initialTarget && (
                <Button
                  title="Choisir un autre membre"
                  secondary
                  disabled={send.isPending}
                  onPress={() => setTarget(undefined)}
                />
              )}
              <ChoiceField
                label="Votre relation"
                value={relationship}
                onChange={setRelationship}
                disabled={send.isPending}
                allowCustom
                optionalLabel="Préciser votre relation"
                options={[
                  "Coéquipier",
                  "Ancien coéquipier",
                  "Entraîneur",
                  "Ancien entraîneur",
                  "Dirigeant",
                  "Éducateur",
                  "Collaborateur",
                ].map((value) => ({ label: value, value }))}
              />
              <Field
                label="Votre recommandation"
                placeholder="Ce que vous appréciez dans son jeu, son engagement ou votre collaboration…"
                value={content}
                onChangeText={setContent}
                multiline
                maxLength={2000}
                editable={!send.isPending}
              />
              <Text style={s.small}>
                Le membre recevra votre recommandation et pourra choisir de
                l’afficher sur son profil.
              </Text>
              {!!send.error && (
                <Text accessibilityRole="alert" style={s.small}>
                  {send.error.message}
                </Text>
              )}
              <Button
                title="Envoyer la recommandation"
                busy={send.isPending}
                disabled={!content.trim()}
                onPress={() => send.mutate()}
              />
            </>
          )}
        </View>
      </Screen>
    </Modal>
  );
}
