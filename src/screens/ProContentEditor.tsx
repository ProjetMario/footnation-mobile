import React, { useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { uploadPhoto } from "../lib/media";
import { randomUUID } from "expo-crypto";
import { createProContent, proContentIdentity } from "../lib/proContentSave";
import { Text, View, Switch } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { ChoiceField } from "../components/ChoiceField";
import { ProRelationField } from "../components/ProRelationField";
import { proFieldValue } from "../lib/proFieldValue";
import { BirthdateField } from "../components/BirthdateField";
import { DateField } from "../components/DateField";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { proContent } from "../lib/proContent";
import { NativeVideo } from "../components/Video";
import { validateProVideo } from "../lib/proVideo";
import { createProVideoUploader } from "../lib/proVideoUpload";
async function requireOwner(pageId: string, uid: string, teamId?: string) {
  const session = await supabase.auth.getUser();
  if (session.error) throw session.error;
  if (session.data.user?.id !== uid)
    throw new Error("La session a changé. Rechargez cet écran.");
  const page = await supabase
    .from("pro_pages")
    .select("id")
    .eq("id", pageId)
    .eq("owner_id", uid)
    .single();
  if (page.error) throw page.error;
  if (teamId) {
    const team = await supabase
      .from("pro_page_teams")
      .select("id")
      .eq("id", teamId)
      .eq("page_id", pageId)
      .single();
    if (team.error) throw team.error;
  }
}
export default function ProContentEditor() {
  const params = useLocalSearchParams<{
    id: string;
    section: string;
    record?: string;
    teamId?: string;
  }>();
  return (
    <Screen title={proContent[params.section]?.title || "Contenu"}>
      <AuthGate>
        <Load {...params} />
      </AuthGate>
    </Screen>
  );
}
function Load({
  id,
  section,
  record,
  teamId,
}: {
  id: string;
  section: string;
  record?: string;
  teamId?: string;
}) {
  const { session } = useAuth();
  const [reloadVersion, setReloadVersion] = useState(0);
  const query = useQuery({
    queryKey: [
      "native-pro-editor",
      id,
      section,
      record,
      teamId,
      session!.user.id,
    ],
    queryFn: async () => {
      if (!Object.hasOwn(proContent, section))
        throw new Error("Type de contenu inconnu.");
      if (section === "players" && !teamId)
        throw new Error("Sélectionnez une équipe.");
      await requireOwner(id, session!.user.id, teamId);
      if (!record) return {};
      const { data, error } = await supabase
        .from(proContent[section].table)
        .select("*")
        .eq("id", record)
        .eq(
          section === "players" ? "team_id" : "page_id",
          section === "players" ? teamId! : id,
        )
        .single();
      if (error) throw error;
      return data;
    },
  });
  return query.isPending ? (
    <Loading />
  ) : query.error && !query.data ? (
    <ErrorState error={query.error} />
  ) : (
    <>
      {!!query.error && <ErrorState error={query.error} />}
      <Editor
        key={JSON.stringify([
          id,
          section,
          record,
          teamId,
          reloadVersion,
          session?.user.id,
        ])}
        id={id}
        section={section}
        teamId={teamId}
        initial={query.data}
        onReload={async () => {
          const fresh = await query.refetch();
          if (!fresh.error) setReloadVersion((value) => value + 1);
        }}
      />
    </>
  );
}
function Editor({
  id,
  section,
  teamId,
  initial: loaded,
  onReload,
}: {
  id: string;
  section: string;
  teamId?: string;
  initial: any;
  onReload: () => Promise<void>;
}) {
  const s = useUIStyles();

  // Keep the form and its comparison baseline together across background refetches.
  const [initial] = useState(loaded);
  const [creationId] = useState(randomUUID);
  const config = proContent[section];
  const { session } = useAuth();
  const cache = useQueryClient();
  const [values, setValues] = useState<Record<string, any>>(() =>
    Object.fromEntries(
      config.fields.map((field) => [
        field.key,
        field.kind === "urls"
          ? (initial[field.key] || []).join("\n")
          : (initial[field.key] ??
            field.defaultValue ??
            field.options?.[0][0] ??
            (field.kind === "boolean" ? false : "")),
      ]),
    ),
  );
  const [confirm, setConfirm] = useState(false);
  const [photos, setPhotos] = useState<
    Record<string, ImagePicker.ImagePickerAsset[]>
  >({});
  const uploads = useRef(new Map<ImagePicker.ImagePickerAsset, string>());
  const uploadVideo = useRef(createProVideoUploader()).current;
  const submitting = useRef(false);
  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const videoCapability = useQuery({
    queryKey: ["pro-video-upload-capability", session?.user.id],
    enabled: section === "media" && !!session,
    retry: false,
    staleTime: 60000,
    queryFn: async () => {
      const result = await supabase.rpc("native_pro_video_upload_available");
      return !result.error && result.data === true;
    },
  });
  const pickVideo = useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsMultipleSelection: false,
      });
      if (result.canceled) return;
      validateProVideo(result.assets[0]);
      setVideo(result.assets[0]);
      setPhotos((previous) => ({ ...previous, url: [] }));
      setValues((previous) => ({ ...previous, type: "video" }));
    },
  });
  const photoFields = config.fields.filter((field) =>
    [
      "url",
      "media_urls",
      "thumbnail_url",
      "logo_url",
      "opponent_logo_url",
      "photo_url",
    ].includes(field.key),
  );
  const pick = useMutation({
    mutationFn: async (key: string) => {
      // The system photo picker grants access only to the chosen images.
      const multiple = key === "media_urls";
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.85,
        allowsMultipleSelection: multiple,
        selectionLimit: multiple ? 10 : 1,
      });
      if (!result.canceled) {
        setPhotos((previous) => ({ ...previous, [key]: result.assets }));
        if (section === "media" && key === "url") {
          setVideo(null);
          setValues((previous) => ({ ...previous, type: "photo" }));
        }
      }
    },
  });
  const relationKey =
    section === "matches" ? "team_id" : section === "media" ? "match_id" : null;
  const [relation, setRelation] = useState<string>(() =>
    relationKey ? initial[relationKey] || "" : "",
  );
  const mutation = useMutation({
    mutationFn: async (remove: boolean) => {
      await requireOwner(id, session!.user.id, teamId);
      const scope = section === "players" ? "team_id" : "page_id";
      const scopeId = section === "players" ? teamId! : id;
      let result;
      const compare = (request: any) => {
        if (initial.updated_at)
          return request.eq("updated_at", initial.updated_at);
        for (const key of [
          ...config.fields.map((field) => field.key),
          ...(relationKey ? [relationKey] : []),
        ])
          request =
            initial[key] == null
              ? request.is(key, null)
              : request.eq(key, initial[key]);
        return request;
      };
      if (remove) {
        result = await compare(
          supabase
            .from(config.table)
            .delete()
            .eq("id", initial.id)
            .eq(scope, scopeId),
        )
          .select("id")
          .maybeSingle();
      } else {
        const payload: Record<string, any> = {};
        if (relationKey) {
          if (relation) {
            const related = await supabase
              .from(
                section === "matches" ? "pro_page_teams" : "pro_page_matches",
              )
              .select("id")
              .eq("id", relation)
              .eq("page_id", id)
              .single();
            if (related.error)
              throw new Error(
                "L’élément associé n’est plus disponible sur cette page. Choisissez une autre association.",
              );
          }
          payload[relationKey] = relation || null;
        }
        for (const field of config.fields) {
          if (video && field.key === "url") continue;
          if (photos[field.key]?.length && field.kind !== "urls") continue;
          payload[field.key] = proFieldValue(field, values[field.key]);
        }
        if (video) {
          if (values.type !== "video")
            throw new Error(
              "Choisissez le format Vidéo ou retirez la vidéo sélectionnée.",
            );
          payload.url = await uploadVideo(video, session!.user.id, id);
          await requireOwner(id, session!.user.id, teamId);
        }
        if (
          photos.url?.length &&
          section === "media" &&
          values.type !== "photo"
        )
          throw new Error(
            "Choisissez le format Photo ou retirez la photo sélectionnée.",
          );
        for (const [key, assets] of Object.entries(photos)) {
          const urls: string[] = [];
          for (const asset of assets) {
            let url = uploads.current.get(asset);
            if (!url) {
              const uploaded = await uploadPhoto(
                asset,
                "pro-pages",
                `${session!.user.id}/content/${id}`,
              );
              url = uploaded.url;
              uploads.current.set(asset, url);
            }
            urls.push(url);
          }
          if (urls.length)
            payload[key] =
              key === "media_urls"
                ? [...(payload[key] || []), ...urls]
                : urls[0];
        }
        if (initial.id) {
          result = await compare(
            supabase
              .from(config.table)
              .update(payload)
              .eq("id", initial.id)
              .eq(scope, scopeId),
          )
            .select("id")
            .maybeSingle();
        } else {
          await createProContent(
            {
              read: async (recordId) => {
                const response = await supabase
                  .from(config.table)
                  .select("*")
                  .eq("id", recordId)
                  .eq(scope, scopeId)
                  .maybeSingle();
                if (response.error) throw response.error;
                return response.data;
              },
              insert: async (row) => {
                const response = await supabase
                  .from(config.table)
                  .insert(row)
                  .select("id")
                  .single();
                if (response.error) throw response.error;
              },
            },
            {
              ...payload,
              ...proContentIdentity(section, session!.user.id),
              [scope]: scopeId,
              id: creationId,
            },
          );
          return;
        }
      }
      if (result.error) throw result.error;
      if (!result.data)
        throw new Error(
          "Cet élément a été modifié ou supprimé depuis son ouverture. Rechargez la version enregistrée avant de continuer.",
        );
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["native-pro-content", id] });
      void cache.invalidateQueries({ queryKey: ["native-pro-editor", id] });
      void cache.invalidateQueries({ queryKey: ["native-pro-roster", id] });
      router.replace(
        section === "players"
          ? `/pro-pages/${id}/team/${teamId}`
          : `/pro-pages/${id}`,
      );
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  return (
    <>
      {!!relationKey && (
        <ProRelationField
          pageId={id}
          kind={section === "matches" ? "team" : "match"}
          value={relation}
          onChange={setRelation}
          disabled={mutation.isPending}
        />
      )}
      {config.fields.map((field) => {
        const set = (value: any) =>
          setValues((previous) => ({ ...previous, [field.key]: value }));
        return field.kind === "boolean" ? (
          <View style={s.between} key={field.key}>
            <Text style={s.text}>{field.label}</Text>
            <Switch
              accessibilityLabel={field.label}
              value={!!values[field.key]}
              onValueChange={set}
              disabled={mutation.isPending}
            />
          </View>
        ) : field.options ? (
          <ChoiceField
            key={field.key}
            label={field.label}
            value={String(values[field.key])}
            options={field.options.map(([value, label]) => ({ value, label }))}
            onChange={set}
            optional={false}
            disabled={mutation.isPending}
          />
        ) : field.key === "birthdate" ? (
          <BirthdateField
            key={field.key}
            value={String(values[field.key])}
            onChange={set}
            disabled={mutation.isPending}
          />
        ) : field.kind === "date" ? (
          <DateField
            key={field.key}
            disabled={mutation.isPending}
            label={field.label}
            value={String(values[field.key])}
            onChange={set}
          />
        ) : (
          <Field
            key={field.key}
            label={field.label}
            value={String(values[field.key])}
            onChangeText={set}
            editable={
              !mutation.isPending &&
              !(video && field.key === "url") &&
              !(photos[field.key]?.length && field.kind !== "urls")
            }
            multiline={field.kind === "long" || field.kind === "urls"}
            keyboardType={field.kind === "number" ? "number-pad" : "default"}
          />
        );
      })}
      {!!(section === "media" && videoCapability.data) && (
        <View style={s.card}>
          <Button
            title="Choisir une vidéo"
            secondary
            busy={pickVideo.isPending}
            disabled={mutation.isPending || pick.isPending}
            onPress={() => pickVideo.mutate()}
          />
          {!!video && (
            <>
              <NativeVideo uri={video.uri} />
              <Text style={s.small}>
                La vidéo sera envoyée lors de l’enregistrement (50 Mo maximum).
                Son lien sera public, comme les autres médias de la page.
              </Text>
              <Button
                title="Retirer la vidéo"
                secondary
                disabled={mutation.isPending}
                onPress={() => setVideo(null)}
              />
            </>
          )}
          {!!pickVideo.error && <ErrorState error={pickVideo.error} />}
        </View>
      )}
      {photoFields.map((field) => (
        <View key={`photo-${field.key}`} style={s.card}>
          <Button
            title={`Choisir ${field.kind === "urls" ? "des photos" : "une photo"} — ${field.label}`}
            secondary
            busy={pick.isPending}
            disabled={mutation.isPending || pickVideo.isPending}
            onPress={() => pick.mutate(field.key)}
          />
          {photos[field.key]?.map((asset) => (
            <Image
              key={asset.uri}
              source={{ uri: asset.uri }}
              style={{ height: 180, width: "100%", borderRadius: 12 }}
              contentFit="contain"
            />
          ))}
          {!!photos[field.key]?.length && (
            <>
              <Text style={s.small}>
                La sélection sera envoyée lors de l’enregistrement (10 Mo par
                photo maximum).
              </Text>
              <Button
                title="Retirer cette sélection"
                secondary
                disabled={mutation.isPending}
                onPress={() =>
                  setPhotos((previous) => ({ ...previous, [field.key]: [] }))
                }
              />
            </>
          )}
        </View>
      ))}
      {!!pick.error && <ErrorState error={pick.error} />}
      {!!mutation.error && <ErrorState error={mutation.error} />}
      {!!(mutation.error && initial.id) && (
        <Button
          title="Abandonner mes changements et recharger"
          secondary
          disabled={mutation.isPending}
          onPress={() => void onReload()}
        />
      )}
      <Button
        title="Enregistrer"
        busy={mutation.isPending}
        disabled={pick.isPending || pickVideo.isPending}
        onPress={() => {
          if (submitting.current) return;
          submitting.current = true;
          mutation.mutate(false);
        }}
      />
      {!!initial.id &&
        (confirm ? (
          <>
            <Text style={s.text}>Supprimer définitivement cet élément ?</Text>
            <Button
              title="Confirmer la suppression"
              busy={mutation.isPending}
              onPress={() => mutation.mutate(true)}
            />
            <Button
              title="Annuler"
              secondary
              disabled={mutation.isPending}
              onPress={() => setConfirm(false)}
            />
          </>
        ) : (
          <Button
            title="Supprimer"
            secondary
            disabled={mutation.isPending}
            onPress={() => setConfirm(true)}
          />
        ))}
    </>
  );
}
export function ProTeamRoster() {
  const { id, teamId } = useLocalSearchParams<{ id: string; teamId: string }>();
  return (
    <Screen title="Effectif">
      <Roster id={id} teamId={teamId} />
    </Screen>
  );
}
function Roster({ id, teamId }: { id: string; teamId: string }) {
  const s = useUIStyles();

  const { session } = useAuth();
  const query = useInfiniteQuery({
    queryKey: ["native-pro-roster", id, teamId, session?.user.id],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const team = await supabase
        .from("pro_page_teams")
        .select("id,name,page:pro_pages!page_id(owner_id,published)")
        .eq("id", teamId)
        .eq("page_id", id)
        .single();
      if (team.error) throw team.error;
      const page = Array.isArray(team.data.page)
        ? team.data.page[0]
        : team.data.page;
      if (!page || (!page.published && page.owner_id !== session?.user.id))
        throw new Error("Cet effectif n’est pas accessible.");
      const { data, error } = await supabase
        .from("pro_page_team_players")
        .select(
          "id,name,number,position,is_staff,staff_role,photo_url,nationality",
        )
        .eq("team_id", teamId)
        .order("name")
        .order("id")
        .range(pageParam, pageParam + 29);
      if (error) throw error;
      return {
        players: data,
        owner: page.owner_id === session?.user.id,
        teamName: team.data.name,
      };
    },
    getNextPageParam: (last, pages) =>
      last.players.length === 30 ? pages.length * 30 : undefined,
  });
  return (
    <>
      {!!query.data?.pages[0]?.teamName && (
        <Text style={s.h2}>{query.data.pages[0].teamName}</Text>
      )}
      {!!query.data?.pages[0]?.owner && (
        <Button
          title="Ajouter un joueur ou membre du staff"
          onPress={() =>
            router.push(`/pro-pages/${id}/content/players?teamId=${teamId}`)
          }
        />
      )}
      {!!query.isPending && <Loading />}
      {!!query.error && <ErrorState error={query.error} />}
      {query.data?.pages
        .flatMap((page) => page.players)
        .map((player) => (
          <View key={player.id} style={s.card}>
            {!!player.photo_url && (
              <Image
                source={{ uri: player.photo_url }}
                style={{ width: 72, height: 72, borderRadius: 36 }}
                contentFit="cover"
              />
            )}
            <Text style={s.h2}>
              {player.number != null ? `${player.number}. ` : ""}
              {player.name}
            </Text>
            <Text style={s.subtitle}>
              {player.is_staff ? player.staff_role : player.position}
            </Text>
            {!!player.nationality && (
              <Text style={s.subtitle}>{player.nationality}</Text>
            )}
            {!!query.data?.pages[0]?.owner && (
              <Button
                title="Modifier"
                secondary
                onPress={() =>
                  router.push(
                    `/pro-pages/${id}/content/players?teamId=${teamId}&record=${player.id}`,
                  )
                }
              />
            )}
          </View>
        ))}
      {!!(
        query.data && !query.data.pages.flatMap((page) => page.players).length
      ) && <Empty title="Aucun membre dans cet effectif" />}
      {!!query.hasNextPage && (
        <Button
          title="Charger la suite"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
