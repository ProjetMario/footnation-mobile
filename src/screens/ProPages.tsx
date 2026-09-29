import { ExternalLinkButton } from "../components/ExternalLinkButton";
import { proContent } from "../lib/proContent";
import * as ImagePicker from "expo-image-picker";
import { uploadPhoto } from "../lib/media";
import React, { useState } from "react";
import { Text, View, Switch } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Banner,
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  MenuRow,
  Screen,
  SearchField,
  useUIStyles,
} from "../components/ui";
import { NativeVideo } from "../components/Video";
import { withProReview } from "../lib/proReviewDetails";
import { ProVerification } from "../components/ProVerification";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
const types: Record<string, string> = {
  club_officiel: "Club officiel",
  club: "Club",
  equipe: "Équipe",
  marque: "Marque",
  entreprise: "Entreprise",
  centre_indoor: "Centre indoor",
  organisation: "Organisation",
  federation: "Fédération",
  ligue: "Ligue",
  district: "District",
  autre: "Autre",
};
export default function ProPages() {
  return (
    <Screen title="Mes Pages Pro">
      <AuthGate>
        <PageList />
      </AuthGate>
    </Screen>
  );
}
function PageList() {
  const s = useUIStyles();

  const { session } = useAuth();
  const query = useInfiniteQuery({
    queryKey: ["native-pro-pages", session!.user.id],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("pro_pages")
        .select("id,name,avatar_url,bio,published,page_type")
        .eq("owner_id", session!.user.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  return (
    <>
      <Banner eyebrow="PAGES PRO" title="Votre présence dans le football" />
      <Button
        title="Créer une Page Pro"
        onPress={() => router.push("/pro-pages/new")}
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages.flat().map((page) => (
        <View key={page.id} style={s.card}>
          <Avatar uri={page.avatar_url} name={page.name} />
          <MenuRow
            title={page.name}
            subtitle={`${types[page.page_type] || page.page_type} · ${page.published ? "Publiée" : "Brouillon"}`}
            onPress={() => router.push(`/pro-pages/${page.id}`)}
          />
          <Text style={s.text}>{page.bio}</Text>
        </View>
      ))}
      {!!(query.data && !query.data.pages.flat().length) && (
        <Empty
          title="Aucune Page Pro"
          description="Présentez votre club, votre entreprise ou votre organisation."
        />
      )}
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
export function ProPageDetail() {
  const { id, slug } = useLocalSearchParams<{ id?: string; slug?: string }>();
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ["native-pro-page", id, slug, session?.user.id],
    queryFn: async () => {
      let request = supabase
        .from("pro_pages")
        .select(
          "*,review:pro_page_review_details(request_message,verification_notes)",
        );
      if (slug) request = request.eq("slug", slug).eq("published", true);
      else request = request.eq("id", id!);
      const { data, error } = await request.single();
      if (error) throw error;
      if (!data.published && data.owner_id !== session?.user.id) {
        const access = await supabase.rpc("is_site_admin");
        if (access.error || access.data !== true)
          throw new Error("Cette page n’est pas publiée.");
      }
      return withProReview(data);
    },
  });
  return (
    <Screen title="Page Pro">
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <PageContent page={query.data} />
      )}
    </Screen>
  );
}
function PageContent({ page }: { page: any }) {
  const s = useUIStyles();

  const { session } = useAuth();
  const [section, setSection] = useState("posts");
  const cache = useQueryClient();
  const owner = page.owner_id === session?.user.id;
  const visibility = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("pro_pages")
        .update({ published: !page.published })
        .eq("id", page.id)
        .eq("owner_id", session!.user.id)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["native-pro-page"] });
      void cache.invalidateQueries({ queryKey: ["native-pro-pages"] });
    },
  });
  return (
    <>
      {!!page.cover_url && (
        <Image
          source={{ uri: page.cover_url }}
          style={{ height: 170, borderRadius: 20 }}
          contentFit="cover"
        />
      )}
      <Avatar uri={page.avatar_url} name={page.name} size={80} />
      <Text style={s.title}>{page.name}</Text>
      <Text style={s.subtitle}>
        {types[page.page_type] || page.page_type} {page.territory}
      </Text>
      <Text style={s.text}>{page.bio}</Text>
      <ProVerification
        key={`${page.id}:${page.verification_status}`}
        page={page}
      />
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {page.categories?.map((category: string) => (
          <Chip key={category} label={category} />
        ))}
      </View>
      {!!Array.isArray(page.links) &&
        page.links
          .filter((link: any) => /^https?:\/\//i.test(link.url || ""))
          .map((link: any, index: number) => (
            <ExternalLinkButton
              key={index}
              title={link.label || link.url}
              url={link.url}
            />
          ))}
      {!!owner && (
        <>
          <Button
            title="Modifier la page"
            onPress={() => router.push(`/pro-pages/${page.id}/edit`)}
          />
          <Button
            title={page.published ? "Masquer la page" : "Publier la page"}
            secondary
            busy={visibility.isPending}
            onPress={() => visibility.mutate()}
          />
          {!!visibility.error && <ErrorState error={visibility.error} />}
        </>
      )}
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries(contentSections).map(([key, config]) => (
          <Chip
            key={key}
            label={config.title}
            selected={section === key}
            onPress={() => setSection(key)}
          />
        ))}
      </View>
      <PageRecords
        key={`${page.id}/${section}`}
        page={page}
        section={section}
      />
    </>
  );
}
const contentSections: Record<
  string,
  { title: string; table: string; order: string }
> = {
  posts: {
    title: "Publications",
    table: "pro_page_posts",
    order: "created_at",
  },
  teams: { title: "Équipes", table: "pro_page_teams", order: "name" },
  matches: { title: "Matchs", table: "pro_page_matches", order: "match_date" },
  media: { title: "Médias", table: "pro_page_media", order: "created_at" },
};
function PageRecords({ page, section }: { page: any; section: string }) {
  const s = useUIStyles();

  const config = contentSections[section];
  const [mediaFilter, setMediaFilter] = useState("all");
  const [playingMedia, setPlayingMedia] = useState<string | null>(null);
  const { session } = useAuth();
  const query = useInfiniteQuery({
    queryKey: [
      "native-pro-content",
      page.id,
      section,
      session?.user.id,
      mediaFilter,
    ],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let request = supabase
        .from(config.table)
        .select(
          section === "matches"
            ? "*,team:pro_page_teams!team_id(name,category)"
            : section === "media"
              ? "*,match:pro_page_matches!match_id(opponent,match_date)"
              : "*",
        )
        .eq("page_id", page.id)
        .order(config.order, { ascending: false })
        .order("id");
      if (section === "media" && mediaFilter !== "all") {
        request =
          mediaFilter === "featured"
            ? request.eq("is_featured", true)
            : request.eq("type", mediaFilter);
      }
      if (section === "posts" && page.owner_id !== session?.user.id)
        request = request.eq("published", true);
      const { data, error } = await request
        .range(pageParam, pageParam + 19)
        .returns<Record<string, any>[]>();
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 20 ? pages.length * 20 : undefined,
  });
  return (
    <>
      {page.owner_id === session?.user.id && (
        <Button
          title="Ajouter du contenu"
          onPress={() =>
            router.push(`/pro-pages/${page.id}/content/${section}`)
          }
        />
      )}
      {section === "media" && (
        <View style={[s.row, { flexWrap: "wrap" }]}>
          {[
            ["all", "Tous"],
            ["photo", "Photos"],
            ["video", "Vidéos"],
            ["featured", "À la une"],
          ].map(([value, label]) => (
            <Chip
              key={value}
              label={label}
              selected={mediaFilter === value}
              onPress={() => {
                setPlayingMedia(null);
                setMediaFilter(value);
              }}
            />
          ))}
        </View>
      )}
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages.flat().map((row) => (
        <View key={row.id} style={s.card}>
          {page.owner_id === session?.user.id && (
            <Button
              title="Modifier"
              secondary
              onPress={() =>
                router.push(
                  `/pro-pages/${page.id}/content/${section}?record=${row.id}`,
                )
              }
            />
          )}
          {section === "teams" && (
            <Button
              title={
                page.owner_id === session?.user.id
                  ? "Gérer l’effectif"
                  : "Voir l’effectif"
              }
              secondary
              onPress={() =>
                router.push(`/pro-pages/${page.id}/team/${row.id}`)
              }
            />
          )}
          <Text style={s.h2}>
            {row.name || row.title || row.opponent || "Publication"}
          </Text>
          {section === "matches" && (
            <>
              <Text style={s.subtitle}>
                {proContent.matches.fields
                  .find((field) => field.key === "status")
                  ?.options?.find(([value]) => value === row.status)?.[1] ||
                  row.status}
                {" · "}
                {row.is_home ? "À domicile" : "À l’extérieur"}
              </Text>
              {!!(row.competition || row.round) && (
                <Text style={s.subtitle}>
                  {[row.competition, row.round].filter(Boolean).join(" · ")}
                </Text>
              )}
              {!!row.notes && <Text style={s.text}>{row.notes}</Text>}
              {!!row.stream_url && (
                <ExternalLinkButton
                  url={row.stream_url}
                  title="Voir la diffusion"
                />
              )}
              {!!row.video_highlight_url && (
                <ExternalLinkButton
                  url={row.video_highlight_url}
                  title="Voir le résumé vidéo"
                />
              )}
            </>
          )}
          {!!row.team?.name && (
            <Text style={s.subtitle}>
              Équipe : {row.team.name}
              {row.team.category ? ` · ${row.team.category}` : ""}
            </Text>
          )}
          {!!row.match?.opponent && (
            <Text style={s.subtitle}>
              Match : {row.match.opponent} ·{" "}
              {new Date(row.match.match_date).toLocaleString("fr-FR")}
            </Text>
          )}
          {!!row.match_date && (
            <Text style={s.subtitle}>
              {new Date(row.match_date).toLocaleString("fr-FR")} ·{" "}
              {row.location}
            </Text>
          )}
          {!!(row.score_home != null || row.score_away != null) && (
            <Text style={s.title}>
              Domicile {row.score_home ?? "–"} – {row.score_away ?? "–"}{" "}
              Extérieur
            </Text>
          )}
          {!!(row.content || row.description) && (
            <Text style={s.text}>{row.content || row.description}</Text>
          )}
          {!!(row.event_date || row.event_location) && (
            <Text style={s.subtitle}>
              Événement :{" "}
              {[
                row.event_date
                  ? new Date(row.event_date).toLocaleString("fr-FR")
                  : null,
                row.event_location,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          )}
          {!!row.category && (
            <Text style={s.subtitle}>
              {row.category} · {row.season}
            </Text>
          )}
          {!!row.coach_name && (
            <Text style={s.text}>Entraîneur : {row.coach_name}</Text>
          )}
          {section === "media" && (
            <>
              {!!row.is_featured && <Text style={s.small}>À la une</Text>}
              {!!row.album && (
                <Text style={s.subtitle}>Album : {row.album}</Text>
              )}
              <ProGalleryMedia
                key={`${row.id}:${row.url}`}
                url={row.url}
                thumbnail={row.thumbnail_url}
                title={row.title}
                video={row.type === "video"}
                playing={playingMedia === row.id}
                onToggle={() =>
                  setPlayingMedia(playingMedia === row.id ? null : row.id)
                }
              />
            </>
          )}
          {row.media_urls?.map((url: string, index: number) => (
            <ProPostMedia key={`${index}:${url}`} url={url} />
          ))}
        </View>
      ))}
      {!!(query.data && !query.data.pages.flat().length) && (
        <Empty
          title={
            section === "media" && mediaFilter !== "all"
              ? "Aucun média dans ce filtre"
              : "Aucun contenu pour le moment"
          }
        />
      )}
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
export function ProPageEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <Screen title={id ? "Modifier la Page Pro" : "Créer une Page Pro"}>
      <AuthGate>
        <LoadEditor id={id} />
      </AuthGate>
    </Screen>
  );
}
function LoadEditor({ id }: { id?: string }) {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ["native-pro-edit", id, session!.user.id],
    queryFn: async () => {
      if (!id) return {};
      const { data, error } = await supabase
        .from("pro_pages")
        .select(
          "*,review:pro_page_review_details(request_message,verification_notes)",
        )
        .eq("id", id)
        .eq("owner_id", session!.user.id)
        .single();
      if (error) throw error;
      return withProReview(data);
    },
  });
  return query.isPending ? (
    <Loading />
  ) : query.error ? (
    <ErrorState error={query.error} />
  ) : (
    <PageForm initial={query.data} />
  );
}
const fields: [string, string][] = [
  ["name", "Nom de la page"],
  ["slug", "Adresse de la page"],
  ["bio", "Présentation"],
  ["territory", "Territoire"],
  ["avatar_url", "Lien du logo"],
  ["cover_url", "Lien de la couverture"],
  ["request_message", "Message pour la vérification"],
];
function PageForm({ initial }: { initial: any }) {
  const s = useUIStyles();

  const { session } = useAuth();
  const cache = useQueryClient();
  const [photos, setPhotos] = useState<
    Record<string, ImagePicker.ImagePickerAsset>
  >({});
  const pickPhoto = useMutation({
    mutationFn: async (key: string) => {
      // Choosing an image does not require access to the entire photo library.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.85,
      });
      if (!result.canceled)
        setPhotos((previous) => ({ ...previous, [key]: result.assets[0] }));
    },
  });
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(([key]) => [key, initial[key] || ""])),
  );
  const [type, setType] = useState(initial.page_type || "entreprise");
  const [clubId, setClubId] = useState<string | null>(initial.club_id || null);
  const [categories, setCategories] = useState(
    (initial.categories || []).join(", "),
  );
  const [published, setPublished] = useState(!!initial.published);
  const [links, setLinks] = useState<{ label: string; url: string }[]>(
    initial.links || [],
  );
  const save = useMutation({
    mutationFn: async () => {
      if (!values.name.trim()) throw new Error("Le nom est obligatoire.");
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug))
        throw new Error(
          "L’adresse doit contenir des lettres minuscules, chiffres et tirets.",
        );
      if (type === "club_officiel" && !clubId)
        throw new Error(
          "Une page officielle doit être liée à un club avant de demander sa vérification.",
        );
      if (links.some((link) => !/^https?:\/\//i.test(link.url)))
        throw new Error("Les liens doivent commencer par https:// ou http://.");
      const photoUrls: Record<string, string> = {};
      for (const [key, asset] of Object.entries(photos)) {
        const uploaded = await uploadPhoto(
          asset,
          "pro-pages",
          `${session!.user.id}/${key === "avatar_url" ? "avatars" : "covers"}`,
        );
        photoUrls[key] = uploaded.url;
      }
      const payload = {
        ...Object.fromEntries(
          fields.map(([key]) => [
            key,
            key === "request_message"
              ? values[key].trim()
              : values[key].trim() || null,
          ]),
        ),
        ...photoUrls,
        page_type: type,
        club_id: type === "club_officiel" ? clubId : null,
        categories: categories
          .split(",")
          .map((x: string) => x.trim())
          .filter(Boolean),
        links,
        published,
      };
      const result = initial.id
        ? await supabase
            .from("pro_pages")
            .update(payload)
            .eq("id", initial.id)
            .eq("owner_id", session!.user.id)
            .select("id")
            .single()
        : await supabase
            .from("pro_pages")
            .insert({ ...payload, owner_id: session!.user.id })
            .select("id")
            .single();
      if (result.error) throw result.error;
      return result.data.id;
    },
    onSuccess: (id) => {
      void cache.invalidateQueries({ queryKey: ["native-pro-pages"] });
      void cache.invalidateQueries({ queryKey: ["native-pro-page"] });
      void cache.invalidateQueries({ queryKey: ["native-pro-edit"] });
      router.replace(`/pro-pages/${id}`);
    },
  });
  return (
    <>
      <Button
        title="Choisir le logo"
        secondary
        busy={pickPhoto.isPending}
        onPress={() => pickPhoto.mutate("avatar_url")}
      />
      <Button
        title="Choisir la couverture"
        secondary
        busy={pickPhoto.isPending}
        onPress={() => pickPhoto.mutate("cover_url")}
      />
      {Object.entries(photos).map(([key, asset]) => (
        <Image
          key={key}
          source={{ uri: asset.uri }}
          style={{ height: key === "avatar_url" ? 90 : 150, borderRadius: 16 }}
          contentFit="contain"
        />
      ))}
      {!!pickPhoto.error && <ErrorState error={pickPhoto.error} />}
      {fields.map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={values[key]}
          multiline={key === "bio" || key === "request_message"}
          autoCapitalize={
            key === "slug" || key.endsWith("url") ? "none" : "sentences"
          }
          onChangeText={(value) =>
            setValues((previous) => ({ ...previous, [key]: value }))
          }
        />
      ))}
      <Text style={s.label}>Type de page</Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries(types).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={type === key}
            onPress={() => setType(key)}
          />
        ))}
      </View>
      {type === "club_officiel" && (
        <OfficialClubPicker value={clubId} onChange={setClubId} />
      )}
      <Field
        label="Catégories, séparées par des virgules"
        value={categories}
        onChangeText={setCategories}
      />
      <View style={s.between}>
        <Text style={s.text}>Page publiée</Text>
        <Switch
          accessibilityLabel="Page publiée"
          value={published}
          onValueChange={setPublished}
        />
      </View>
      <Text style={s.h2}>Liens</Text>
      {links.map((link, index) => (
        <View style={s.card} key={index}>
          <Field
            label="Titre du lien"
            value={link.label}
            onChangeText={(label) =>
              setLinks((previous) =>
                previous.map((item, i) =>
                  i === index ? { ...item, label } : item,
                ),
              )
            }
          />
          <Field
            label="Adresse du lien"
            autoCapitalize="none"
            value={link.url}
            onChangeText={(url) =>
              setLinks((previous) =>
                previous.map((item, i) =>
                  i === index ? { ...item, url } : item,
                ),
              )
            }
          />
          <Button
            title="Retirer ce lien"
            secondary
            onPress={() =>
              setLinks((previous) => previous.filter((_, i) => i !== index))
            }
          />
        </View>
      ))}
      <Button
        title="Ajouter un lien"
        secondary
        onPress={() =>
          setLinks((previous) => [...previous, { label: "", url: "https://" }])
        }
      />
      {!!save.error && <ErrorState error={save.error} />}
      {!!(
        ["approved", "pending_review", "rejected"].includes(
          initial.verification_status,
        ) &&
        (type !== initial.page_type ||
          (type === "club_officiel" ? clubId : null) !== initial.club_id)
      ) && (
        <Text style={s.text}>
          Changer le type de page ou le club lié remet sa validation à l’état de
          brouillon. Une nouvelle demande sera nécessaire.
        </Text>
      )}
      <Button
        title="Enregistrer"
        busy={save.isPending}
        onPress={() => save.mutate()}
      />
    </>
  );
}

function OfficialClubPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string) => void;
}) {
  const s = useUIStyles();

  const [search, setSearch] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["pro-page-club-picker", search],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let request = supabase
        .from("clubs")
        .select("id,name,city")
        .order("name")
        .order("id");
      if (search.trim())
        request = request.ilike("name", `%${search.replace(/[%_]/g, "")}%`);
      const { data, error } = await request.range(pageParam, pageParam + 19);
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 20 ? pages.length * 20 : undefined,
  });
  return (
    <View style={s.card}>
      <Text style={s.h2}>Club officiel associé</Text>
      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher le club"
      />
      {!!query.isPending && <Loading />}
      {!!query.error && <ErrorState error={query.error} />}
      {query.data?.pages.flat().map((club) => (
        <Chip
          key={club.id}
          label={`${club.name}${club.city ? ` · ${club.city}` : ""}`}
          selected={value === club.id}
          onPress={() => onChange(club.id)}
        />
      ))}
      {!!query.hasNextPage && (
        <Button
          title="Autres clubs"
          secondary
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </View>
  );
}

function ProPostMedia({ url }: { url: string }) {
  const s = useUIStyles();

  const [imageFailed, setImageFailed] = useState(false);
  let video = false;
  try {
    video = /\.(mp4|m4v|mov|webm|m3u8)$/i.test(new URL(url).pathname);
  } catch {
    // The link button reports invalid legacy addresses when opened.
  }
  return (
    <View style={{ gap: 8 }}>
      {video ? (
        <NativeVideo uri={url} />
      ) : !imageFailed ? (
        <Image
          source={{ uri: url }}
          style={{ height: 260, borderRadius: 14 }}
          contentFit="contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text style={s.subtitle}>Aperçu indisponible.</Text>
      )}
      <ExternalLinkButton url={url} title="Ouvrir le média" />
    </View>
  );
}

function ProGalleryMedia({
  url,
  thumbnail,
  title,
  video,
  playing,
  onToggle,
}: {
  url: string;
  thumbnail?: string | null;
  title?: string | null;
  video: boolean;
  playing: boolean;
  onToggle: () => void;
}) {
  const s = useUIStyles();

  const [imageFailed, setImageFailed] = useState(false);
  const preview = video ? thumbnail : url;
  return (
    <View style={{ gap: 10 }}>
      {video && playing ? (
        <NativeVideo uri={url} />
      ) : preview && !imageFailed ? (
        <Image
          source={{ uri: preview }}
          accessibilityLabel={title || (video ? "Aperçu de la vidéo" : "Photo")}
          style={{ height: 280, borderRadius: 14 }}
          contentFit="contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text style={s.subtitle}>
          {video ? "Vidéo" : "Aperçu indisponible"}
        </Text>
      )}
      {video ? (
        <Button
          title={playing ? "Fermer le lecteur" : "Afficher le lecteur vidéo"}
          secondary
          onPress={onToggle}
        />
      ) : null}
      <ExternalLinkButton
        url={url}
        title={video ? "Ouvrir le lien vidéo" : "Ouvrir la photo"}
      />
    </View>
  );
}
