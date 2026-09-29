import { ProfileIdentity } from "../components/ProfileIdentity";
import { PublicProfileShare } from "../components/PublicProfileShare";
import { OrganizationDetails } from "../components/OrganizationDetails";
import React, { useCallback } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Banner,
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { loadPublicTalent, publicProfileName } from "../lib/publicTalent";
import { cvSections } from "../lib/cv";
export default function PublicTalent() {
  const s = useUIStyles();

  const { slug } = useLocalSearchParams<{ slug: string }>();
  const uid = useAuth().session?.user.id;
  const query = useQuery({
    queryKey: ["public-talent", slug, uid],
    queryFn: () => loadPublicTalent(slug || ""),
  });
  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );
  const profile = query.data;
  const isOrganization = ["club", "business", "institution"].includes(
    profile?.account_type || "",
  );
  return (
    <Screen title="Profil public">
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !profile ? (
        <Empty
          title="Profil indisponible"
          description="Ce profil n’existe pas ou n’est pas publié."
        />
      ) : (
        <>
          {profile.cover_image_url ? (
            <Image
              source={{ uri: profile.cover_image_url }}
              style={{ height: 190, borderRadius: 24 }}
              contentFit="cover"
            />
          ) : (
            <Banner
              eyebrow="PROFIL FOOTNATION"
              title={profile.club || "Le football nous rassemble."}
            />
          )}
          <View style={s.card}>
            <Avatar
              uri={profile.avatar_url}
              name={publicProfileName(profile)}
              size={90}
            />
            <Text style={s.title}>{publicProfileName(profile)}</Text>
            <ProfileIdentity profile={profile} />
            <Text style={s.subtitle}>
              {[profile.position, profile.primary_role, profile.highest_level]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            <Text style={s.small}>
              {[profile.city, profile.department].filter(Boolean).join(" · ")}
            </Text>
            {!!profile.club && <Text style={s.text}>{profile.club}</Text>}
          </View>
          {!!profile.bio && (
            <View style={s.card}>
              <Text style={s.h2}>À propos</Text>
              <Text style={s.text}>{profile.bio}</Text>
            </View>
          )}
          <PublicProfileShare
            key={profile.id}
            id={profile.id}
            slug={profile.slug}
            name={publicProfileName(profile)}
          />
          <OrganizationDetails key={profile.id} profile={profile} />
          {!!(
            !isOrganization &&
            (profile.nationality ||
              profile.height ||
              profile.weight ||
              profile.strong_foot ||
              profile.skills?.length)
          ) && (
            <View style={s.card}>
              <Text style={s.h2}>Profil football</Text>
              {!!profile.nationality && (
                <Text style={s.text}>Nationalité : {profile.nationality}</Text>
              )}
              {!!profile.height && (
                <Text style={s.text}>Taille : {profile.height} cm</Text>
              )}
              {!!profile.weight && (
                <Text style={s.text}>Poids : {profile.weight} kg</Text>
              )}
              {!!profile.strong_foot && (
                <Text style={s.text}>Pied fort : {profile.strong_foot}</Text>
              )}
              {!!profile.skills?.length && (
                <Text style={s.text}>{profile.skills.join(" · ")}</Text>
              )}
            </View>
          )}
          {!isOrganization &&
            cvSections(profile)
              .filter((section) =>
                [
                  "Parcours",
                  "Distinctions",
                  "Certifications",
                  "Compétences techniques",
                  "Points forts",
                ].includes(section.title),
              )
              .map((section) => (
                <View key={section.title} style={s.card}>
                  <Text style={s.h2}>{section.title}</Text>
                  {section.lines.map((line, index) => (
                    <Text key={index} style={s.text}>
                      {line}
                    </Text>
                  ))}
                </View>
              ))}
          {uid ? (
            <Button
              title={
                uid === profile.id
                  ? "Ouvrir mon profil"
                  : "Voir le profil et interagir"
              }
              onPress={() => router.push(`/profile/${profile.id}`)}
            />
          ) : (
            <>
              <Text style={s.small}>
                Rejoignez FootNation pour échanger avec les membres du réseau.
              </Text>
              <Button
                title="Se connecter"
                onPress={() =>
                  router.push({
                    pathname: "/login",
                    params: {
                      next: `/talent/${encodeURIComponent(profile.slug || profile.id)}`,
                    },
                  })
                }
              />
              <Button
                secondary
                title="Créer mon profil gratuitement"
                onPress={() =>
                  router.push({
                    pathname: "/signup",
                    params: {
                      next: `/talent/${encodeURIComponent(profile.slug || profile.id)}`,
                    },
                  })
                }
              />
            </>
          )}
        </>
      )}
    </Screen>
  );
}
