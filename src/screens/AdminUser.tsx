import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";
import {
  Avatar,
  Button,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  SearchField,
  useUIStyles,
} from "../components/ui";
import {
  AdminAccess,
  AdminConfirm,
  AdminModal,
  AdminTabs,
  Notice,
  useAdmin,
  useAdminLayout,
} from "../components/admin/AdminUI";
import {
  AdminRecords,
  EditFields,
  useAdminCommand,
} from "../components/admin/AdminRecords";
import {
  completion,
  completionFields,
  formatDate,
  isSuspended,
  objectValue,
  profileName,
  textValue,
  userSectionFrom,
  userSections,
  type AdminRecord,
  type Json,
  type Resource,
  type UserSection,
} from "../lib/admin/contracts";
import { fieldPatch, profileFieldGroups } from "../lib/admin/fields";
import { useTheme } from "../theme";

export default function AdminUser() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen title="Fiche utilisateur" scroll={false}>
      <AdminAccess>
        <User key={id} id={id} />
      </AdminAccess>
    </Screen>
  );
}
function User({ id }: { id: string }) {
  const { api, uid } = useAdmin();
  const s = useUIStyles();
  const { styles, compact } = useAdminLayout();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = userSectionFrom(params.tab);
  const q = useQuery({
    queryKey: ["admin", uid, "user", id],
    queryFn: () => api.page("users", { id }),
    retry: false,
    staleTime: 30000,
  });
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const profile = q.data?.rows[0];
  if (!profile)
    return (
      <Empty
        title="Utilisateur introuvable"
        description="Ce compte a peut-être été supprimé."
      />
    );
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={styles.content}
    >
      <View
        style={[
          styles.card,
          s.between,
          {
            flexDirection: compact ? "column" : "row",
            alignItems: compact ? "stretch" : "center",
          },
        ]}
      >
        <View style={[s.row, { flex: compact ? undefined : 1, minWidth: 0 }]}>
          <Avatar
            uri={textValue(profile.avatar_url, "")}
            name={profileName(profile)}
            size={64}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[s.title, compact && { fontSize: 24, lineHeight: 30 }]}
            >
              {profileName(profile)}
            </Text>
            <Text style={s.small}>
              {textValue(profile.primary_role)} · Inscription le{" "}
              {formatDate(profile.created_at)}
            </Text>
          </View>
        </View>
        <Button
          title="Voir le profil public"
          secondary
          onPress={() => router.push(`/profile/${id}`)}
        />
      </View>
      <AdminTabs
        items={userSections}
        value={tab}
        onChange={(value) => router.setParams({ tab: value })}
        label="Rubriques de la fiche utilisateur"
      />
      {tab === "profile" && <ProfileEditor profile={profile} />}
      {tab === "completion" && <Completion profile={profile} />}
      {tab === "admin" && <AccountAdmin profile={profile} />}
      {["content", "social", "favorites", "opportunities", "activity"].includes(
        tab,
      ) && <UserRecords key={tab} userId={id} tab={tab} />}
    </ScrollView>
  );
}
const detailLists: Partial<
  Record<UserSection, ReadonlyArray<readonly [Resource, string]>>
> = {
  content: [
    ["publications", "Publications"],
    ["shorts", "Vidéos"],
    ["photos", "Photos"],
  ],
  social: [
    ["connections", "Connexions"],
    ["followers", "Abonnés"],
    ["following", "Abonnements"],
    ["likes", "Likes"],
    ["blocks", "Profils bloqués"],
    ["blocked-by", "Bloqué par"],
    ["reports-received", "Signalements reçus"],
    ["reports-sent", "Signalements envoyés"],
  ],
  favorites: [
    ["favorite-clubs", "Clubs favoris"],
    ["club-follows", "Clubs suivis"],
    ["saved-posts", "Publications enregistrées"],
    ["match-follows", "Matchs suivis"],
  ],
  opportunities: [
    ["opportunities", "Annonces publiées"],
    ["applications", "Candidatures"],
    ["events", "Événements"],
  ],
  activity: [
    ["profile-views", "Vues du profil"],
    ["sessions", "Sessions"],
    ["page-views", "Pages consultées"],
    ["interactions", "Interactions"],
    ["ratings", "Évaluations reçues"],
    ["ratings-given", "Évaluations données"],
    ["post-reactions", "Réactions données"],
    ["short-likes", "Likes vidéos donnés"],
    ["reactions-received", "Réactions reçues"],
    ["short-likes-received", "Likes vidéos reçus"],
  ],
};
function UserRecords({ userId, tab }: { userId: string; tab: UserSection }) {
  const items = detailLists[tab]!;
  const [resource, setResource] = useState<Resource>(items[0][0]);
  const { styles } = useAdminLayout();
  return (
    <View style={styles.stack}>
      <AdminTabs
        items={items}
        value={resource}
        onChange={setResource}
        label="Type de données"
      />
      <AdminRecords
        key={resource}
        resource={resource}
        userId={userId}
        title={items.find(([k]) => k === resource)![1]}
      />
    </View>
  );
}
function ProfileEditor({ profile }: { profile: AdminRecord }) {
  const { api, uid } = useAdmin();
  const cache = useQueryClient();
  const s = useUIStyles();
  const { styles } = useAdminLayout();
  const [snapshot, setSnapshot] = useState(profile);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [clubs, setClubs] = useState<Record<string, Json>>({});
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState(false);
  const [arrays, setArrays] = useState<Record<string, Json>>({});
  const reload = useMutation({
    mutationFn: () => api.page("users", { id: profile.id }),
    onSuccess: ({ rows }) => {
      if (!rows[0]) return;
      setSnapshot(rows[0]);
      setDraft({});
      setClubs({});
      setArrays({});
      setReason("");
      setSuccess(false);
      save.reset();
    },
  });
  const fields = profileFieldGroups.flatMap((g) => g.fields);
  const save = useMutation({
    mutationFn: async () => {
      const values = {
        ...fieldPatch(snapshot, fields, draft),
        ...clubs,
        ...arrays,
      };
      if (!Object.keys(values).length)
        throw new Error("Aucune modification à enregistrer.");
      await api.mutate({
        record: snapshot,
        action: "profile.update",
        values,
        reason,
      });
      const result = await api.page("users", { id: profile.id });
      if (!result.rows[0])
        throw new Error("Actualisez la fiche pour voir le résultat.");
      return result.rows[0];
    },
    onSuccess: (row) => {
      setSnapshot(row);
      setDraft({});
      setClubs({});
      setArrays({});
      setReason("");
      setSuccess(true);
      void cache.invalidateQueries({ queryKey: ["admin", uid] });
    },
  });
  const upload = useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });
      if (result.canceled) return null;
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      if (
        blob.size > 8 * 1024 * 1024 ||
        !/^image\/(jpeg|png|webp)$/.test(blob.type || asset.mimeType || "")
      )
        throw new Error(
          "Choisissez une image JPG, PNG ou WebP de moins de 8 Mo.",
        );
      const signed = await api.edge("admin-console-account", {
        action: "avatar_upload",
        userId: profile.id,
        mimeType: blob.type || asset.mimeType,
      });
      if (
        typeof signed.path !== "string" ||
        typeof signed.token !== "string" ||
        typeof signed.url !== "string"
      )
        throw new Error("L’envoi de l’image n’a pas été autorisé.");
      const stored = await supabase.storage
        .from("avatars")
        .uploadToSignedUrl(signed.path, signed.token, blob, {
          contentType: blob.type || asset.mimeType,
        });
      if (stored.error) throw new Error("Impossible d’envoyer l’image.");
      return signed.url;
    },
    onSuccess: (url) => {
      if (url) setDraft((d) => ({ ...d, avatar_url: url }));
    },
  });
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={s.h2}>Photo de profil</Text>
        <Avatar
          uri={textValue(draft.avatar_url || snapshot.avatar_url, "")}
          name={profileName(profile)}
          size={80}
        />
        <Button
          title="Choisir une photo"
          secondary
          busy={upload.isPending}
          onPress={() => upload.mutate()}
        />
        {!!upload.error && <ErrorState error={upload.error} />}
      </View>
      {profileFieldGroups.map((group) => (
        <View key={group.title} style={styles.card}>
          <Text style={s.h2}>{group.title}</Text>
          <EditFields
            fields={group.fields}
            row={snapshot}
            draft={draft}
            setDraft={(v) => {
              setSuccess(false);
              setDraft(v);
            }}
            disabled={save.isPending}
          />
        </View>
      ))}
      <View style={styles.card}>
        <Text style={s.h2}>Clubs et favoris</Text>
        {[
          ["club", "Club actuel"],
          ["favorite_pro_club", "Club professionnel favori"],
          ["favorite_amateur_club", "Club amateur favori"],
          ["favorite_indoor_center", "Centre indoor favori"],
        ].map(([field, label]) => (
          <ClubPicker
            key={field}
            label={label}
            value={textValue(clubs[field] ?? snapshot[field], "Non renseigné")}
            onSelect={(club) =>
              setClubs({
                ...clubs,
                [field]: club?.name || null,
                [`${field}_id`]: club?.id || null,
              })
            }
          />
        ))}
      </View>
      <View style={styles.card}>
        <Text style={s.h2}>Expériences</Text>
        <ExperienceEditor
          value={arrays.experience_history ?? snapshot.experience_history}
          onChange={(v) => setArrays({ ...arrays, experience_history: v })}
          disabled={save.isPending}
        />
      </View>
      {[
        ["achievements", "Réalisations"],
        ["individual_awards", "Distinctions"],
        ["skills", "Compétences"],
      ].map(([key, label]) => (
        <View key={key} style={styles.card}>
          <Text style={s.h2}>{label}</Text>
          <StringArrayEditor
            value={arrays[key] ?? snapshot[key]}
            onChange={(v) => setArrays({ ...arrays, [key]: v })}
            disabled={save.isPending}
          />
        </View>
      ))}
      <View style={styles.card}>
        <Field
          label="Motif de la modification"
          value={reason}
          onChangeText={setReason}
          maxLength={1000}
          editable={!save.isPending}
        />
        {!!save.error && <ErrorState error={save.error} />}
        {!!reload.error && <ErrorState error={reload.error} />}
        {success && (
          <Notice>
            <Text>Profil enregistré.</Text>
          </Notice>
        )}
        <Button
          title="Enregistrer le profil"
          busy={save.isPending}
          disabled={
            reason.trim().length < 3 || upload.isPending || reload.isPending
          }
          onPress={() => save.mutate()}
        />
        <Button
          title="Recharger et annuler le brouillon"
          secondary
          busy={reload.isPending}
          disabled={save.isPending || upload.isPending}
          onPress={() => reload.mutate()}
        />
      </View>
    </View>
  );
}
function ClubPicker({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: string;
  onSelect: (club: AdminRecord | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { api, uid } = useAdmin();
  const s = useUIStyles();
  const q = useQuery({
    queryKey: ["admin", uid, "club-picker", search],
    queryFn: () => api.page("clubs", { search }),
    enabled: open && search.trim().length >= 2,
    retry: false,
  });
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <Button title={value} secondary onPress={() => setOpen(true)} />
      <AdminModal title={label} visible={open} onClose={() => setOpen(false)}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Au moins deux lettres"
        />
        {q.isFetching && <Loading />}
        {!!q.error && <ErrorState error={q.error} />}
        {q.data?.rows.map((club) => (
          <Button
            key={club.id}
            title={`${textValue(club.name)} · ${textValue(club.city)}`}
            secondary
            onPress={() => {
              onSelect(club);
              setOpen(false);
            }}
          />
        ))}
        {q.data?.rows.length === 0 && <Empty title="Aucun club trouvé" />}
        <Button
          title="Retirer ce club"
          secondary
          onPress={() => {
            onSelect(null);
            setOpen(false);
          }}
        />
      </AdminModal>
    </View>
  );
}
function StringArrayEditor({
  value,
  onChange,
  disabled,
}: {
  value: unknown;
  onChange: (v: Json[]) => void;
  disabled: boolean;
}) {
  const s = useUIStyles();
  const rows = Array.isArray(value) ? (value as Json[]) : [];
  const [text, setText] = useState("");
  return (
    <View style={{ gap: 10 }}>
      {rows.map((v, i) => (
        <View key={i} style={[s.between, { flexWrap: "wrap" }]}>
          <Text style={[s.text, { flex: 1 }]}>
            {typeof v === "string" ? v : JSON.stringify(v)}
          </Text>
          <Button
            title="Retirer"
            secondary
            disabled={disabled}
            onPress={() => onChange(rows.filter((_, j) => j !== i))}
          />
        </View>
      ))}
      <Field
        label="Nouvel élément"
        value={text}
        onChangeText={setText}
        editable={!disabled}
      />
      <Button
        title="Ajouter"
        secondary
        disabled={disabled || !text.trim()}
        onPress={() => {
          onChange([...rows, text.trim()]);
          setText("");
        }}
      />
    </View>
  );
}
function ExperienceEditor({
  value,
  onChange,
  disabled,
}: {
  value: unknown;
  onChange: (v: Json[]) => void;
  disabled: boolean;
}) {
  const s = useUIStyles();
  const { styles } = useAdminLayout();
  const rows = Array.isArray(value) ? value.map(objectValue) : [];
  return (
    <View style={{ gap: 12 }}>
      {rows.map((row, i) => (
        <View key={i} style={styles.card}>
          <Text style={s.label}>Expérience {i + 1}</Text>
          {[
            ["club", "Club"],
            ["ageCategory", "Catégorie"],
            ["level", "Niveau"],
            ["position", "Poste"],
            ["startYear", "Année de début"],
            ["endYear", "Année de fin"],
          ].map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={textValue(row[key], "")}
              editable={!disabled}
              onChangeText={(v) =>
                onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)))
              }
            />
          ))}
          <Button
            title="Retirer cette expérience"
            secondary
            disabled={disabled}
            onPress={() => onChange(rows.filter((_, j) => j !== i))}
          />
        </View>
      ))}
      <Button
        title="Ajouter une expérience"
        secondary
        disabled={disabled}
        onPress={() =>
          onChange([
            ...rows,
            {
              club: "",
              ageCategory: "",
              level: "",
              position: "",
              startYear: "",
              endYear: "",
            },
          ])
        }
      />
    </View>
  );
}
function Completion({ profile }: { profile: AdminRecord }) {
  const s = useUIStyles();
  const { styles } = useAdminLayout();
  const command = useAdminCommand();
  const info = completion(profile);
  const override = objectValue(profile._completion_override);
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={s.h2}>{info.percent} % du profil renseigné</Text>
        <Text style={s.text}>
          {info.missing.length
            ? `À compléter : ${info.missing.map((k) => completionFields[k as keyof typeof completionFields]).join(", ")}.`
            : "Tous les champs requis sont renseignés."}
        </Text>
        {!!override.at && (
          <Text style={s.small}>
            Dérogation accordée le {formatDate(override.at)} ·{" "}
            {textValue(override.reason)}
          </Text>
        )}
        <AccountOperation
          profile={profile}
          action="reminder"
          title="Envoyer une relance"
          description="Envoyer un e-mail à cet utilisateur pour lui proposer de compléter son profil."
        />
        <Button
          title={
            override.at ? "Retirer la dérogation" : "Accorder une dérogation"
          }
          secondary
          onPress={() =>
            command.request({
              record: profile,
              action: "profile.completion",
              values: { enabled: !override.at },
              title: override.at
                ? "Retirer la dérogation"
                : "Accorder une dérogation",
              detail:
                "La dérogation suspend les relances de complétude. Elle ne modifie ni les informations ni le pourcentage réellement renseigné.",
            })
          }
        />
        {command.dialog}
        {!!command.message && <Notice>{command.message}</Notice>}
      </View>
      <AdminRecords
        resource="reminders"
        title="Historique des relances"
        userId={profile.id}
      />
    </View>
  );
}
function AccountAdmin({ profile }: { profile: AdminRecord }) {
  const { uid } = useAdmin();
  const s = useUIStyles();
  const { styles } = useAdminLayout();
  const { colors } = useTheme();
  const command = useAdminCommand();
  const [expiry, setExpiry] = useState("");
  const suspended = isSuspended(profile);
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={s.h2}>Accès et abonnement</Text>
        <Text selectable style={s.small}>
          Identifiant : {profile.id}
        </Text>
        <Text style={s.text}>
          {profile.is_admin === true ? "Administrateur du site" : "Membre"}
        </Text>
        <Button
          title={
            profile.is_premium === true || profile.is_open_premium === true
              ? "Retirer Premium"
              : "Accorder Premium"
          }
          secondary
          onPress={() =>
            command.request({
              record: profile,
              action: "profile.premium",
              values: {
                is_premium: !(
                  profile.is_premium === true ||
                  profile.is_open_premium === true
                ),
                is_open_premium: false,
              },
              title:
                profile.is_premium === true || profile.is_open_premium === true
                  ? "Retirer Premium"
                  : "Accorder Premium",
              detail:
                "Modifier l’accès Premium de ce profil. Cela ne crée ni n’annule un abonnement facturé.",
            })
          }
        />
      </View>
      <View style={styles.card}>
        <Text style={s.h2}>Suspension du compte</Text>
        <Text style={s.text}>
          {suspended
            ? `Compte suspendu · ${textValue(profile.suspension_reason)}`
            : "Compte actif"}
        </Text>
        {!suspended && (
          <Field
            label="Fin de suspension (date ISO, vide = sans échéance)"
            value={expiry}
            onChangeText={setExpiry}
            placeholder="2026-10-01T12:00:00Z"
            autoCapitalize="none"
          />
        )}
        <Button
          title={suspended ? "Réactiver le compte" : "Suspendre le compte"}
          secondary
          disabled={
            uid === profile.id ||
            (!suspended &&
              !!expiry &&
              (!Number.isFinite(Date.parse(expiry)) ||
                Date.parse(expiry) <= Date.now()))
          }
          onPress={() =>
            command.request({
              record: profile,
              action: "profile.suspend",
              values: {
                is_suspended: !suspended,
                suspended_until:
                  !suspended && expiry ? new Date(expiry).toISOString() : null,
              },
              title: suspended ? "Réactiver le compte" : "Suspendre le compte",
              detail:
                "La suspension conserve les données et peut être levée. Le compte ne peut plus utiliser l’application pendant la suspension.",
            })
          }
        />
        {uid === profile.id && (
          <Text style={s.small}>
            Vous ne pouvez pas suspendre votre propre compte.
          </Text>
        )}
      </View>
      <Security profile={profile} />
      <View style={[styles.card, { borderColor: colors.danger }]}>
        <Text style={[s.h2, { color: colors.danger }]}>
          Suppression définitive
        </Text>
        <Text style={s.text}>
          Supprimer ce compte, ses données personnelles et ses médias via le
          parcours de suppression. Les espaces partagés sont conservés.
        </Text>
        <AccountOperation
          profile={profile}
          action="delete_account"
          title="Supprimer définitivement le compte"
          description={`Supprimer définitivement le compte de ${profileName(profile)}. Une authentification récente est requise.`}
          disabled={uid === profile.id}
          destructive
        />
      </View>
      {command.dialog}
      {!!command.message && <Notice>{command.message}</Notice>}
    </View>
  );
}
function Security({ profile }: { profile: AdminRecord }) {
  const { api, uid } = useAdmin();
  const s = useUIStyles();
  const { styles } = useAdminLayout();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const q = useQuery({
    queryKey: ["admin", uid, "security", profile.id],
    queryFn: () =>
      api.edge("admin-console-account", {
        action: "security",
        userId: profile.id,
      }),
    retry: false,
  });
  return (
    <View style={styles.card}>
      <Text style={s.h2}>Sécurité du compte</Text>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <Text style={s.text}>E-mail actuel : {textValue(q.data?.email)}</Text>
      )}
      <Field
        label="Nouvelle adresse e-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <AccountOperation
        profile={profile}
        action="update_email"
        title="Modifier l’adresse e-mail"
        description={`Remplacer l’adresse e-mail du compte par ${email}.`}
        values={{ email: email.trim() }}
        disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
      />
      <Field
        label="Nouveau mot de passe (12 caractères minimum)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Field
        label="Confirmer le mot de passe"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <AccountOperation
        profile={profile}
        action="update_password"
        title="Modifier le mot de passe"
        description="Remplacer le mot de passe de ce compte. Une authentification récente est requise."
        values={{ password }}
        disabled={password.length < 12 || password !== confirm}
        onSuccess={() => {
          setPassword("");
          setConfirm("");
        }}
      />
      <AccountOperation
        profile={profile}
        action="reset_password"
        title="Envoyer un lien de réinitialisation"
        description="Envoyer un lien sécurisé à l’adresse e-mail actuelle de ce compte."
      />
    </View>
  );
}
function AccountOperation({
  profile,
  action,
  title,
  description,
  values = {},
  disabled = false,
  destructive = false,
  onSuccess,
}: {
  profile: AdminRecord;
  action: string;
  title: string;
  description: string;
  values?: Record<string, unknown>;
  disabled?: boolean;
  destructive?: boolean;
  onSuccess?: () => void;
}) {
  const { api, uid } = useAdmin();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [operationId, setOperationId] = useState("");
  const [success, setSuccess] = useState("");
  const m = useMutation({
    mutationFn: async (reason: string) => {
      const result = await api.edge("admin-console-account", {
        action,
        userId: profile.id,
        ...values,
        reason,
        operationId,
        expected: profile._version,
      });
      if (result.ok !== true || result.userId !== profile.id)
        throw new Error(
          "L’opération n’a pas été confirmée. Actualisez avant de réessayer.",
        );
      return result;
    },
    onSuccess: (result) => {
      setOpen(false);
      setSuccess(textValue(result.detail, "Opération confirmée."));
      onSuccess?.();
      void cache.invalidateQueries({ queryKey: ["admin", uid] });
      if (action === "delete_account")
        router.replace("/admin?section=users" as any);
    },
  });
  return (
    <>
      <Button
        title={title}
        secondary
        disabled={disabled}
        onPress={() => {
          setSuccess("");
          m.reset();
          setOperationId(Crypto.randomUUID());
          setOpen(true);
        }}
      />
      {!!success && <Notice>{success}</Notice>}
      {open && (
        <AdminConfirm
          title={title}
          detail={description}
          visible
          destructive={destructive}
          busy={m.isPending}
          error={m.error}
          onCancel={() => setOpen(false)}
          onConfirm={(reason) => m.mutate(reason)}
        />
      )}
    </>
  );
}
