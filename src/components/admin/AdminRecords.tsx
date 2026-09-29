import React, { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  SearchField,
  useUIStyles,
} from "../ui";
import {
  AdminConfirm,
  AdminModal,
  Notice,
  Pagination,
  useAdmin,
  useAdminLayout,
} from "./AdminUI";
import {
  completion,
  completionFields,
  formatCount,
  formatDate,
  isSuspended,
  objectValue,
  profileName,
  textValue,
  type AdminRecord,
  type Command,
  type Filters,
  type Resource,
  type Json,
} from "../../lib/admin/contracts";
import {
  clubFields,
  fieldPatch,
  fieldValue,
  ratingFields,
  type EditField,
} from "../../lib/admin/fields";
import { useTheme } from "../../theme";

export function useAdminCommand() {
  const { api, uid } = useAdmin();
  const cache = useQueryClient();
  const [command, setCommand] = useState<
    (Command & { title: string; detail: string; destructive?: boolean }) | null
  >(null);
  const [message, setMessage] = useState("");
  const mutation = useMutation({
    mutationFn: (reason: string) => {
      if (!command) throw new Error("Aucune action sélectionnée.");
      return api.mutate({ ...command, reason });
    },
    onSuccess: () => {
      setCommand(null);
      setMessage("Modification enregistrée.");
      void cache.invalidateQueries({ queryKey: ["admin", uid] });
    },
  });
  return {
    request: (next: NonNullable<typeof command>) => {
      mutation.reset();
      setMessage("");
      setCommand(next);
    },
    message,
    dialog: command && (
      <AdminConfirm
        key={`${command.action}:${command.record.id}`}
        title={command.title}
        detail={command.detail}
        destructive={command.destructive}
        visible
        onCancel={() => setCommand(null)}
        onConfirm={(reason) => mutation.mutate(reason)}
        busy={mutation.isPending}
        error={mutation.error}
      />
    ),
  };
}
export function EditFields({
  fields,
  row,
  draft,
  setDraft,
  disabled,
}: {
  fields: EditField[];
  row: AdminRecord;
  draft: Record<string, string | boolean>;
  setDraft: (value: Record<string, string | boolean>) => void;
  disabled?: boolean;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  return (
    <View style={{ gap: 16 }}>
      {fields.map((field) => {
        const value = draft[field.key] ?? fieldValue(row, field);
        return field.kind === "boolean" ? (
          <View key={field.key} style={[s.between, { minHeight: 48 }]}>
            <Text style={[s.text, { flex: 1 }]}>{field.label}</Text>
            <Switch
              accessibilityLabel={field.label}
              disabled={disabled}
              value={value === true}
              onValueChange={(v) => setDraft({ ...draft, [field.key]: v })}
              trackColor={{ true: colors.blue }}
            />
          </View>
        ) : (
          <Field
            key={field.key}
            label={field.label}
            value={String(value)}
            onChangeText={(v) => setDraft({ ...draft, [field.key]: v })}
            editable={!disabled}
            autoCapitalize={field.kind === "url" ? "none" : "sentences"}
            keyboardType={
              field.kind === "number"
                ? "decimal-pad"
                : field.kind === "url"
                  ? "url"
                  : "default"
            }
            multiline={["multiline", "list"].includes(field.kind || "")}
            maxLength={field.kind === "multiline" ? 5000 : 2000}
          />
        );
      })}
    </View>
  );
}
export function RecordEditor({
  record,
  fields,
  action,
  title,
  onClose,
}: {
  record: AdminRecord;
  fields: EditField[];
  action: Command["action"];
  title: string;
  onClose: () => void;
}) {
  const { api, uid } = useAdmin();
  const cache = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      const values = fieldPatch(record, fields, draft);
      if (!Object.keys(values).length)
        throw new Error("Aucune modification à enregistrer.");
      await api.mutate({ action, record, values, reason });
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["admin", uid] });
      onClose();
    },
  });
  return (
    <AdminModal
      visible
      title={title}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <EditFields
        fields={fields}
        row={record}
        draft={draft}
        setDraft={setDraft}
        disabled={mutation.isPending}
      />
      <Field
        label="Motif de la modification"
        value={reason}
        onChangeText={setReason}
        maxLength={1000}
        editable={!mutation.isPending}
      />
      {!!mutation.error && <ErrorState error={mutation.error} />}
      <Button
        title="Enregistrer les modifications"
        busy={mutation.isPending}
        disabled={reason.trim().length < 3}
        onPress={() => mutation.mutate()}
      />
    </AdminModal>
  );
}
export function ProfileLink({
  profile,
  label,
}: {
  profile: Record<string, unknown>;
  label?: string;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  if (typeof profile.id !== "string") return null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label ? label + " : " : ""}${profileName(profile)}, ouvrir la fiche`}
      onPress={() => router.push(`/admin/user/${profile.id}` as any)}
      style={[s.row, { minHeight: 44, flex: 1, minWidth: 0 }]}
    >
      <Avatar
        uri={
          typeof profile.avatar_url === "string"
            ? profile.avatar_url
            : undefined
        }
        name={profileName(profile)}
        size={36}
      />
      <View style={{ flex: 1 }}>
        {!!label && <Text style={s.small}>{label}</Text>}
        <Text
          style={[
            s.text,
            { color: colors.deepBlue, fontFamily: "Inter-SemiBold" },
          ]}
        >
          {profileName(profile)}
        </Text>
      </View>
    </Pressable>
  );
}

export function AdminRecords({
  resource,
  filters = {},
  onFiltersChange,
  title,
  userId,
}: {
  resource: Resource;
  filters?: Filters;
  onFiltersChange?: (filters: Filters) => void;
  title?: string;
  userId?: string;
}) {
  const { api, uid } = useAdmin();
  const s = useUIStyles();
  const { colors } = useTheme();
  const { compact, styles } = useAdminLayout();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState(filters.search || "");
  const [debounced, setDebounced] = useState(search);
  const [filterOpen, setFilterOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<Filters>({});
  const [editor, setEditor] = useState<{
    row: AdminRecord;
    kind: "club" | "rating";
  } | null>(null);
  const command = useAdminCommand();
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      if (search !== (filters.search || ""))
        onFiltersChange?.({ ...filters, search });
    }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const selectedFilters = onFiltersChange
    ? filters
    : { ...filters, ...localFilters };
  const effective = {
    ...selectedFilters,
    search: debounced,
    ...(userId ? { userId } : {}),
  };
  const signature = JSON.stringify(effective);
  useEffect(() => {
    setOffset(0);
  }, [signature, resource]);
  const query = useQuery({
    queryKey: ["admin", uid, resource, effective, offset],
    queryFn: () => api.page(resource, effective, offset),
    staleTime: 15000,
    retry: false,
  });
  const update = (value: Filters) => {
    setOffset(0);
    if (onFiltersChange) onFiltersChange(value);
    else setLocalFilters(value);
  };
  const profiles = ["users", "premium", "incomplete-profiles"].includes(
    resource,
  );
  function ask(
    row: AdminRecord,
    action: Command["action"],
    title: string,
    values?: Record<string, Json>,
    destructive = false,
  ) {
    command.request({
      record: row,
      action,
      title,
      detail: `${title} — ${textValue(row.full_name, textValue(row.name, textValue(row.title, "élément sélectionné")))}. Cette action est enregistrée dans le journal d’administration.`,
      values,
      destructive,
    });
  }
  return (
    <View style={styles.stack}>
      <View style={[s.between, { flexWrap: "wrap" }]}>
        <Text accessibilityRole="header" style={s.h2}>
          {title || "Gestion"}
        </Text>
        <Button
          title="Actualiser"
          secondary
          busy={query.isFetching}
          onPress={() => void query.refetch()}
        />
      </View>
      {(!userId || ["publications", "shorts"].includes(resource)) && (
        <SearchField
          placeholder={
            profiles
              ? "Rechercher un nom ou un identifiant"
              : resource === "clubs"
                ? "Rechercher un club ou une ville"
                : "Rechercher"
          }
          value={search}
          onChangeText={setSearch}
        />
      )}
      {(profiles || resource === "clubs" || resource === "message-reports") && (
        <View style={[s.row, { flexWrap: "wrap" }]}>
          <Button
            title="Filtres et tri"
            secondary
            onPress={() => setFilterOpen(true)}
          />
          {Object.entries(selectedFilters)
            .filter(
              ([key, v]) => v && !["search", "sort", "direction"].includes(key),
            )
            .map(([key, value]) => (
              <Chip
                key={key}
                label={`${({ complete: "Complets", incomplete: "Incomplets", pending: "En attente", reviewed: "Examinés", resolved: "Résolus", dismissed: "Classés", suspended: "Suspendus" } as Record<string, string>)[String(value)] || value} ×`}
                onPress={() => update({ ...selectedFilters, [key]: "" })}
              />
            ))}
        </View>
      )}
      <AdminModal
        visible={filterOpen}
        title="Filtres et tri"
        onClose={() => setFilterOpen(false)}
      >
        {profiles && (
          <>
            <Field
              label="Rôle principal"
              value={selectedFilters.role || ""}
              onChangeText={(v) => update({ ...selectedFilters, role: v })}
            />
            <Field
              label="Pays / nationalité"
              value={selectedFilters.country || ""}
              onChangeText={(v) => update({ ...selectedFilters, country: v })}
            />
          </>
        )}
        {(profiles || resource === "clubs") && (
          <Field
            label="Département"
            value={selectedFilters.department || ""}
            onChangeText={(v) => update({ ...selectedFilters, department: v })}
          />
        )}
        {resource === "incomplete-profiles" && (
          <View style={[s.row, { flexWrap: "wrap" }]}>
            {[
              ["", "Tous"],
              ["incomplete", "Incomplets"],
              ["complete", "Complets"],
            ].map(([id, label]) => (
              <Chip
                key={id}
                label={label}
                selected={(selectedFilters.completion || "") === id}
                onPress={() => update({ ...selectedFilters, completion: id })}
              />
            ))}
          </View>
        )}
        {resource === "message-reports" && (
          <View style={[s.row, { flexWrap: "wrap" }]}>
            {[
              ["pending", "En attente"],
              ["reviewed", "Examinés"],
              ["resolved", "Résolus"],
              ["dismissed", "Classés"],
            ].map(([id, label]) => (
              <Chip
                key={id}
                label={label}
                selected={selectedFilters.status === id}
                onPress={() => update({ ...selectedFilters, status: id })}
              />
            ))}
          </View>
        )}
        <Text style={s.label}>Trier par</Text>
        <View style={[s.row, { flexWrap: "wrap" }]}>
          {[
            ["activity", "Date"],
            ["name", "Nom"],
            ...(resource === "incomplete-profiles"
              ? [
                  ["completion", "Complétude"],
                  ["reminders", "Relances"],
                ]
              : []),
          ].map(([id, label]) => (
            <Chip
              key={id}
              label={label}
              selected={(selectedFilters.sort || "activity") === id}
              onPress={() => update({ ...selectedFilters, sort: id })}
            />
          ))}
        </View>
        <View style={s.row}>
          {[
            ["asc", "Croissant"],
            ["desc", "Décroissant"],
          ].map(([id, label]) => (
            <Chip
              key={id}
              label={label}
              selected={(selectedFilters.direction || "desc") === id}
              onPress={() => update({ ...selectedFilters, direction: id })}
            />
          ))}
        </View>
        <Button
          title="Voir les résultats"
          onPress={() => setFilterOpen(false)}
        />
        <Button
          title="Réinitialiser"
          secondary
          onPress={() => {
            update({});
            setSearch("");
          }}
        />
      </AdminModal>
      {!!command.message && <Notice>{command.message}</Notice>}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data?.rows.length ? (
        <Empty
          title="Aucun résultat"
          description="Essayez d’autres filtres ou revenez plus tard."
        />
      ) : (
        <View style={styles.card}>
          {!compact && (
            <View
              style={[
                s.row,
                {
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                  paddingBottom: 12,
                },
              ]}
            >
              <Text style={[s.label, { flex: 2 }]}>
                {profiles
                  ? "Utilisateur"
                  : resource === "clubs"
                    ? "Club"
                    : "Élément"}
              </Text>
              <Text style={[s.label, { flex: 2 }]}>Informations</Text>
              <Text style={[s.label, { flex: 1 }]}>Actions</Text>
            </View>
          )}
          {query.data.rows.map((row) => (
            <View
              key={row.id}
              style={{
                gap: 14,
                flexDirection: compact ? "column" : "row",
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{ flex: compact ? undefined : 2, gap: 8, minWidth: 0 }}
              >
                {profiles ? (
                  <ProfileLink profile={row} />
                ) : resource === "clubs" ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => router.push(`/club/${row.id}`)}
                    style={[s.row, { minHeight: 48 }]}
                  >
                    <Avatar
                      uri={textValue(row.logo_url, "")}
                      name={textValue(row.name)}
                      size={44}
                    />
                    <Text
                      style={[
                        s.text,
                        {
                          color: colors.deepBlue,
                          flex: 1,
                          fontFamily: "Inter-SemiBold",
                        },
                      ]}
                    >
                      {textValue(row.name)}
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    <Text
                      selectable
                      style={[s.text, { fontFamily: "Inter-SemiBold" }]}
                    >
                      {textValue(
                        row.title,
                        textValue(
                          row.content,
                          textValue(
                            row.reason,
                            textValue(
                              row.page_path,
                              textValue(row.event_type, title || "Élément"),
                            ),
                          ),
                        ),
                      )}
                    </Text>
                    {(resource === "photos" ||
                      typeof row.image_url === "string") && (
                      <Image
                        source={{
                          uri: textValue(row.url, textValue(row.image_url, "")),
                        }}
                        contentFit="contain"
                        style={{ width: "100%", height: 160 }}
                        accessibilityLabel="Aperçu du média"
                      />
                    )}
                    <RelatedProfiles row={row} userId={userId} />
                  </>
                )}
              </View>
              <View
                style={{ flex: compact ? undefined : 2, gap: 6, minWidth: 0 }}
              >
                {profiles && (
                  <>
                    <Text style={s.text}>
                      {textValue(row.primary_role)} · {textValue(row.club)}
                    </Text>
                    <Text style={s.small}>
                      {[row.city, row.department, row.nationality]
                        .filter(Boolean)
                        .join(" · ") || "Localisation non renseignée"}
                    </Text>
                    {row.is_premium === true && (
                      <Text style={{ color: colors.success }}>Premium</Text>
                    )}
                    {row.is_open_premium === true && (
                      <Text style={s.small}>Open Premium</Text>
                    )}
                    {isSuspended(row) && (
                      <Text style={{ color: colors.danger }}>
                        Suspendu · {textValue(row.suspension_reason)}
                      </Text>
                    )}
                  </>
                )}
                {resource === "incomplete-profiles" && (
                  <>
                    <Text style={s.text}>
                      {completion(row).percent} % renseignés
                    </Text>
                    <View
                      style={{
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: colors.border,
                      }}
                    >
                      <View
                        style={{
                          height: 5,
                          borderRadius: 3,
                          width: `${completion(row).percent}%`,
                          backgroundColor: colors.blue,
                        }}
                      />
                    </View>
                    <Text style={s.small}>
                      {completion(row)
                        .missing.map(
                          (k) =>
                            completionFields[
                              k as keyof typeof completionFields
                            ],
                        )
                        .join(", ") || "Tous les champs sont renseignés"}
                    </Text>
                    <Text style={s.small}>
                      {formatCount(objectValue(row._reminders).count)} relances
                      · {formatDate(objectValue(row._reminders).last)}
                    </Text>
                    {!!row._completion_override && (
                      <Text style={s.small}>
                        Dérogation administrative enregistrée
                      </Text>
                    )}
                  </>
                )}
                {resource === "clubs" && (
                  <>
                    <Text style={s.text}>
                      {textValue(row.city)} · {textValue(row.department_code)}
                    </Text>
                    <Text style={s.small}>
                      {textValue(row.level)}
                      {row.is_verified === true ||
                      objectValue(row.metadata).is_verified === true
                        ? " · Vérifié"
                        : ""}
                    </Text>
                    {objectValue(row.metadata).is_suspended === true && (
                      <Text style={{ color: colors.danger }}>
                        Club suspendu
                      </Text>
                    )}
                  </>
                )}
                {!profiles && resource !== "clubs" && (
                  <RecordDetails row={row} />
                )}
                <Text style={s.small}>
                  {formatDate(
                    row.created_at ||
                      row.sent_at ||
                      row.login_at ||
                      row.viewed_at,
                  )}
                </Text>
              </View>
              <View
                style={{ flex: compact ? undefined : 1, gap: 8, minWidth: 0 }}
              >
                {profiles && (
                  <>
                    <Button
                      title="Gérer"
                      secondary
                      onPress={() =>
                        router.push(`/admin/user/${row.id}` as any)
                      }
                    />
                    {resource !== "incomplete-profiles" && (
                      <Button
                        title={
                          row.is_premium === true ||
                          row.is_open_premium === true
                            ? "Retirer Premium"
                            : "Accorder Premium"
                        }
                        secondary
                        onPress={() =>
                          ask(
                            row,
                            "profile.premium",
                            row.is_premium === true ||
                              row.is_open_premium === true
                              ? "Retirer Premium"
                              : "Accorder Premium",
                            {
                              is_premium: !(
                                row.is_premium === true ||
                                row.is_open_premium === true
                              ),
                              is_open_premium: false,
                            },
                          )
                        }
                      />
                    )}
                  </>
                )}
                {resource === "clubs" && (
                  <>
                    <Button
                      title="Modifier"
                      secondary
                      onPress={() => setEditor({ row, kind: "club" })}
                    />
                    <Button
                      title="Espace du club"
                      secondary
                      onPress={() => router.push(`/admin/club/${row.id}`)}
                    />
                    <Button
                      title={
                        objectValue(row.metadata).is_suspended === true
                          ? "Réactiver"
                          : "Suspendre"
                      }
                      secondary
                      onPress={() =>
                        ask(
                          row,
                          "club.suspend",
                          objectValue(row.metadata).is_suspended === true
                            ? "Réactiver le club"
                            : "Suspendre le club",
                          {
                            is_suspended:
                              objectValue(row.metadata).is_suspended !== true,
                          },
                        )
                      }
                    />
                    <Button
                      title="Supprimer"
                      secondary
                      onPress={() =>
                        ask(row, "club.delete", "Supprimer le club", {}, true)
                      }
                    />
                  </>
                )}
                {resource === "publications" && (
                  <>
                    <Button
                      title="Voir la publication"
                      secondary
                      onPress={() => router.push(`/posts/${row.id}`)}
                    />
                    <Button
                      title="Supprimer"
                      secondary
                      onPress={() =>
                        ask(
                          row,
                          "post.delete",
                          "Supprimer la publication",
                          {},
                          true,
                        )
                      }
                    />
                  </>
                )}
                {resource === "shorts" && (
                  <>
                    <Button
                      title="Voir la vidéo"
                      secondary
                      onPress={() => router.push(`/shorts/${row.id}`)}
                    />
                    <Button
                      title="Supprimer"
                      secondary
                      onPress={() =>
                        ask(row, "short.delete", "Supprimer la vidéo", {}, true)
                      }
                    />
                  </>
                )}
                {(
                  [
                    "photos",
                    "connections",
                    "followers",
                    "following",
                    "blocks",
                    "blocked-by",
                    "ratings",
                    "ratings-given",
                  ] as Resource[]
                ).includes(resource) && (
                  <Button
                    title={
                      resource.includes("block") ? "Débloquer" : "Supprimer"
                    }
                    secondary
                    onPress={() =>
                      ask(
                        row,
                        (
                          {
                            photos: "photo.delete",
                            connections: "connection.delete",
                            followers: "follower.delete",
                            following: "follower.delete",
                            blocks: "block.delete",
                            "blocked-by": "block.delete",
                            ratings: "rating.delete",
                            "ratings-given": "rating.delete",
                          } as Record<string, Command["action"]>
                        )[resource],
                        resource.includes("block")
                          ? "Retirer ce blocage"
                          : "Supprimer cet élément",
                        {},
                        true,
                      )
                    }
                  />
                )}
                {["ratings", "ratings-given"].includes(resource) && (
                  <Button
                    title="Modifier la note"
                    secondary
                    onPress={() => setEditor({ row, kind: "rating" })}
                  />
                )}
                {resource === "message-reports" && (
                  <>
                    <Button
                      title="Marquer examiné"
                      secondary
                      onPress={() =>
                        ask(row, "message.review", "Marquer examiné", {
                          status: "reviewed",
                        })
                      }
                    />
                    <Button
                      title="Classer sans suite"
                      secondary
                      onPress={() =>
                        ask(row, "message.review", "Classer sans suite", {
                          status: "dismissed",
                        })
                      }
                    />
                    <Button
                      title={
                        objectValue(row._message).is_blocked === true
                          ? "Débloquer le message"
                          : "Bloquer le message"
                      }
                      secondary
                      onPress={() =>
                        ask(
                          row,
                          "message.block",
                          objectValue(row._message).is_blocked === true
                            ? "Débloquer le message"
                            : "Bloquer le message",
                          {
                            status: "resolved",
                            blocked:
                              objectValue(row._message).is_blocked !== true,
                            expected_message: row._message_version || null,
                          },
                        )
                      }
                    />
                  </>
                )}
                <RelatedLinks row={row} resource={resource} />
              </View>
            </View>
          ))}
          <Pagination
            offset={offset}
            total={query.data.total}
            next={query.data.nextOffset}
            onChange={setOffset}
            busy={query.isFetching}
          />
        </View>
      )}
      {command.dialog}
      {!!editor && (
        <RecordEditor
          key={editor.row.id}
          record={editor.row}
          fields={editor.kind === "club" ? clubFields : ratingFields}
          action={editor.kind === "club" ? "club.update" : "rating.update"}
          title={
            editor.kind === "club"
              ? "Modifier le club"
              : "Modifier l’évaluation"
          }
          onClose={() => setEditor(null)}
        />
      )}
    </View>
  );
}
function RelatedProfiles({
  row,
  userId,
}: {
  row: AdminRecord;
  userId?: string;
}) {
  const profiles = Array.isArray(row._profiles)
    ? row._profiles.map(objectValue).filter((p) => p.id !== userId)
    : [];
  const roles = {
    user_id: "Auteur",
    connected_user_id: "Connexion",
    follower_id: "Abonné",
    followed_id: "Suivi",
    blocker_id: "Bloqueur",
    blocked_id: "Bloqué",
    reporter_id: "Signalé par",
    reported_id: "Profil signalé",
    viewer_id: "Visiteur",
    rater_id: "Évaluateur",
    rated_id: "Joueur",
  };
  return (
    <>
      {profiles.map((p) => (
        <ProfileLink
          key={String(p.id)}
          profile={p}
          label={Object.entries(roles).find(([key]) => row[key] === p.id)?.[1]}
        />
      ))}
    </>
  );
}
function RecordDetails({ row }: { row: AdminRecord }) {
  const s = useUIStyles();
  const labels: Record<string, string> = {
    club: "Club favori",
    club_name: "Club",
    filename: "Fichier",
    home_team: "Domicile",
    away_team: "Extérieur",
    tournament_name: "Compétition",
    page_title: "Titre de page",
    time_spent_seconds: "Temps passé (s)",
    device_type: "Appareil",
    browser: "Navigateur",
    country: "Pays",
    city: "Ville",
    login_at: "Connexion",
    logout_at: "Déconnexion",
    status: "Statut",
    description: "Description",
    details: "Détails",
    admin_notes: "Décision",
    message: "Message",
    duration: "Durée",
    page_path: "Page",
    interaction_type: "Interaction",
    missing_fields: "Champs manquants",
    reminder_number: "Relance",
    pace: "Vitesse",
    shooting: "Tir",
    passing: "Passe",
    dribbling: "Dribble",
    defending: "Défense",
    physical: "Physique",
    match_id: "Match",
    type: "Type",
    reaction_type: "Réaction",
  };
  return (
    <>
      {Object.entries(labels)
        .filter(([k]) => row[k] != null && row[k] !== "")
        .map(([k, label]) => (
          <Text key={k} selectable style={s.small}>
            {label} :{" "}
            {Array.isArray(row[k])
              ? (row[k] as Json[]).join(", ")
              : textValue(row[k])}
          </Text>
        ))}
      {typeof objectValue(row._message).content === "string" && (
        <Text selectable style={s.text}>
          {String(objectValue(row._message).content)}
        </Text>
      )}
      {!!objectValue(row._club).name && (
        <Text style={s.text}>{String(objectValue(row._club).name)}</Text>
      )}
    </>
  );
}
function RelatedLinks({
  row,
  resource,
}: {
  row: AdminRecord;
  resource: Resource;
}) {
  const links: { label: string; path: string }[] = [];
  if (row.club_id)
    links.push({ label: "Voir le club", path: `/club/${row.club_id}` });
  if (row.post_id)
    links.push({ label: "Voir la publication", path: `/posts/${row.post_id}` });
  if (row.short_id)
    links.push({ label: "Voir la vidéo", path: `/shorts/${row.short_id}` });
  if (resource === "opportunities" || row.opportunity_id)
    links.push({
      label: "Voir l’annonce",
      path: `/opportunity/${resource === "opportunities" ? row.id : row.opportunity_id}`,
    });
  if (row.external_match_id)
    links.push({
      label: "Voir le match",
      path: `/match/${row.external_match_id}`,
    });
  if (row.event_id)
    links.push({ label: "Voir l’événement", path: `/events/${row.event_id}` });
  return (
    <>
      {links.map((l) => (
        <Button
          key={l.path}
          title={l.label}
          secondary
          onPress={() => router.push(l.path as any)}
        />
      ))}
    </>
  );
}
