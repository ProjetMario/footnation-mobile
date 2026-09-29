import React, { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
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
import { FilteredStoryImage } from "../components/FilteredStoryImage";
import {
  useStoryCollections,
  type StoryCollection,
  type StorySource,
} from "../components/ProfileStoryBubbles";
import { useAuth } from "../lib/auth";
import { supportRpc, supportUnavailable } from "../lib/support";
import { useTheme } from "../theme";

function CollectionError({ error }: { error: unknown }) {
  return (
    <ErrorState
      error={
        supportUnavailable(error)
          ? new Error(
              "Les bulles de stories ne sont pas encore activées. Réessayez après l’activation du service.",
            )
          : error
      }
    />
  );
}
export function StoryCollectionCreate() {
  const uid = useAuth().session?.user.id;
  return (
    <Screen title="Créer une bulle">
      <AuthGate>{!!uid && <Editor key={uid} uid={uid} />}</AuthGate>
    </Screen>
  );
}
function Editor({
  uid,
  collection,
  onClose,
}: {
  uid: string;
  collection?: StoryCollection;
  onClose?: () => void;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const cache = useQueryClient();
  const [id] = useState(() => collection?.id || randomUUID());
  const [title, setTitle] = useState(collection?.title || "");
  const [selected, setSelected] = useState<string[]>(
    collection?.items.map((i) => i.source_id) || [],
  );
  const snapshot = useRef<{ title: string; ids: string[] } | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["my-story-sources", uid],
    initialPageParam: 0,
    retry: false,
    queryFn: ({ pageParam }) =>
      supportRpc<StorySource[]>(uid, "list_my_story_sources", {
        p_offset: pageParam,
      }),
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const sources = [
    ...new Map(
      [...(collection?.items || []), ...(query.data?.pages.flat() || [])].map(
        (item) => [item.source_id, item],
      ),
    ).values(),
  ];
  const save = useMutation({
    mutationFn: () => {
      if (!snapshot.current)
        snapshot.current = { title: title.trim(), ids: selected };
      return supportRpc<string>(uid, "save_profile_story_collection", {
        p_id: id,
        p_title: snapshot.current.title,
        p_story_ids: snapshot.current.ids,
        p_revision: collection?.revision ?? null,
      });
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["story-collections", uid] });
      if (onClose) onClose();
      else router.replace(`/story-collections/${id}?profileId=${uid}`);
    },
  });
  const locked = save.isPending || !!snapshot.current;
  return (
    <>
      <Text style={s.title}>
        {collection ? "Personnaliser la bulle" : "Vos moments à la une"}
      </Text>
      <Text style={s.subtitle}>
        Choisissez vos stories et donnez un nom à votre bulle. Elles resteront
        sur votre profil après 24 heures, jusqu’à leur retrait de la bulle.
      </Text>
      <Field
        label="Nom de la bulle"
        value={title}
        onChangeText={setTitle}
        maxLength={24}
        editable={!locked}
        placeholder="Matchs, entraînements, souvenirs…"
      />
      <Text style={s.small}>
        {selected.length}/20 stories · La première sert de couverture.
      </Text>
      {!!selected.length && (
        <View style={s.card}>
          {selected.map((id, i) => (
            <View key={id} style={s.row}>
              <Image
                source={{
                  uri: sources.find((s) => s.source_id === id)?.media_url,
                }}
                style={{ width: 46, height: 58, borderRadius: 8 }}
                contentFit="cover"
              />
              <Text style={[s.small, { flex: 1 }]}>
                {i === 0 ? "Couverture" : `Story ${i + 1}`}
              </Text>
              {i > 0 && (
                <Button
                  title="En premier"
                  secondary
                  disabled={locked}
                  onPress={() =>
                    setSelected([id, ...selected.filter((x) => x !== id)])
                  }
                />
              )}
              <Button
                title="Retirer"
                secondary
                disabled={locked}
                onPress={() => setSelected(selected.filter((x) => x !== id))}
              />
            </View>
          ))}
        </View>
      )}
      {query.isPending && <Loading />}
      {!!query.error && <CollectionError error={query.error} />}
      {!query.isPending && !query.error && !sources.length && (
        <>
          <Empty
            title="Créez votre première story"
            description="Vos stories disponibles apparaîtront ici pour composer vos bulles."
          />
          <Button
            title="Créer une story"
            onPress={() => router.push("/stories/create")}
          />
        </>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {sources.map((item) => (
          <Pressable
            key={item.source_id}
            accessibilityRole="checkbox"
            accessibilityLabel={
              item.caption ||
              `Story du ${new Date(item.created_at).toLocaleDateString("fr-FR")}`
            }
            accessibilityState={{
              checked: selected.includes(item.source_id),
              disabled: locked,
            }}
            disabled={locked}
            onPress={() =>
              setSelected((current) =>
                current.includes(item.source_id)
                  ? current.filter((id) => id !== item.source_id)
                  : current.length < 20
                    ? [...current, item.source_id]
                    : current,
              )
            }
            style={{
              width: "30%",
              padding: 3,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: selected.includes(item.source_id)
                ? colors.blue
                : colors.border,
            }}
          >
            <Image
              source={{ uri: item.media_url }}
              style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: 8 }}
              contentFit="cover"
            />
            <Text style={s.small} numberOfLines={1}>
              {selected.includes(item.source_id) ? "✓ " : ""}
              {item.caption || "Story"}
            </Text>
          </Pressable>
        ))}
      </View>
      {query.hasNextPage && (
        <Button
          title="Voir plus de stories"
          secondary
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
      {save.isError && <CollectionError error={save.error} />}
      <Button
        title={
          save.isError ? "Réessayer l’enregistrement" : "Enregistrer ma bulle"
        }
        busy={save.isPending}
        disabled={!title.trim() || !selected.length}
        onPress={() => save.mutate()}
      />
      <Button
        title="Annuler"
        secondary
        disabled={save.isPending}
        onPress={onClose || (() => router.back())}
      />
    </>
  );
}
export default function StoryCollectionDetail() {
  const uid = useAuth().session?.user.id;
  const { id, profileId } = useLocalSearchParams<{
    id: string;
    profileId?: string;
  }>();
  return (
    <Screen title="Stories à la une">
      <AuthGate>
        {!!uid && (
          <Collection
            key={`${uid}:${id}`}
            uid={uid}
            id={id}
            profileId={profileId || uid}
          />
        )}
      </AuthGate>
    </Screen>
  );
}
function Collection({
  uid,
  id,
  profileId,
}: {
  uid: string;
  id: string;
  profileId: string;
}) {
  const s = useUIStyles();
  const cache = useQueryClient();
  const query = useStoryCollections(profileId);
  const [index, setIndex] = useState(0);
  const [edit, setEdit] = useState(false);
  const [remove, setRemove] = useState(false);
  const collection = query.data?.find((c) => c.id === id);
  const deletion = useMutation({
    mutationFn: () =>
      supportRpc(uid, "delete_profile_story_collection", {
        p_id: id,
        p_revision: collection?.revision,
      }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["story-collections", uid] });
      router.replace("/my-profile");
    },
    onError: () => {
      void query.refetch();
    },
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <CollectionError error={query.error} />;
  if (!collection) return <Empty title="Cette bulle n’est plus disponible" />;
  if (edit && collection.user_id === uid)
    return (
      <Editor
        key={collection.revision}
        uid={uid}
        collection={collection}
        onClose={() => setEdit(false)}
      />
    );
  const current = Math.min(index, collection.items.length - 1);
  const item = collection.items[current];
  return (
    <>
      <Text style={s.title}>{collection.title}</Text>
      {item ? (
        <>
          <Text style={s.small}>
            {current + 1} / {collection.items.length}
          </Text>
          <FilteredStoryImage
            key={item.source_id}
            uri={item.media_url}
            filters={item.filters}
            style={{
              width: "100%",
              aspectRatio: 9 / 16,
              borderRadius: 18,
              backgroundColor: "#06111D",
            }}
          />
          <Text style={s.text}>{item.caption}</Text>
          <View style={s.between}>
            <Button
              secondary
              title="Précédente"
              disabled={current <= 0}
              onPress={() => setIndex(current - 1)}
            />
            <Button
              title="Suivante"
              disabled={current >= collection.items.length - 1}
              onPress={() => setIndex(current + 1)}
            />
          </View>
        </>
      ) : (
        <Empty title="Aucune story disponible dans cette bulle" />
      )}
      {collection.user_id === uid && (
        <>
          <Button
            title="Modifier la bulle"
            secondary
            onPress={() => setEdit(true)}
          />
          {!remove ? (
            <Button
              title="Supprimer la bulle"
              secondary
              onPress={() => setRemove(true)}
            />
          ) : (
            <View style={s.card}>
              <Text style={s.text}>
                Retirer cette bulle de votre profil ? Vos stories d’origine sont
                conservées.
              </Text>
              <Button
                title="Confirmer la suppression"
                busy={deletion.isPending}
                onPress={() => deletion.mutate()}
              />
              <Button
                secondary
                title="Conserver la bulle"
                disabled={deletion.isPending}
                onPress={() => setRemove(false)}
              />
            </View>
          )}
        </>
      )}
      {deletion.isError && <CollectionError error={deletion.error} />}
    </>
  );
}
