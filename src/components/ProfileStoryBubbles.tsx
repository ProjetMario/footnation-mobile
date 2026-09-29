import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../theme";
import { supportRpc } from "../lib/support";
import { useUIStyles } from "./ui";

export type StorySource = {
  source_id: string;
  media_url: string;
  caption: string | null;
  filters?: unknown;
  created_at: string;
};
export type StoryCollection = {
  id: string;
  user_id: string;
  title: string;
  items: StorySource[];
  revision: number;
};
export function useStoryCollections(profileId: string) {
  const uid = useAuth().session?.user.id;
  return useQuery({
    queryKey: ["story-collections", uid, profileId],
    enabled: !!uid && !!profileId,
    queryFn: () =>
      supportRpc<StoryCollection[]>(uid!, "list_profile_story_collections", {
        p_profile_id: profileId,
      }),
    retry: false,
    refetchInterval: 30000,
  });
}
export function ProfileStoryBubbles({ profileId }: { profileId: string }) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const uid = useAuth().session?.user.id;
  const query = useStoryCollections(profileId);
  const own = profileId === uid;
  const activeStory = useQuery({
    queryKey: ["profile-own-active-story-bubble", uid, profileId],
    enabled: !!uid && own,
    refetchInterval: 15000,
    queryFn: async () => {
      const result = await supabase
        .from("stories")
        .select("id,media_url,expires_at")
        .eq("user_id", profileId)
        .eq("moderation_hidden", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const ownStory =
    own &&
    !activeStory.error &&
    activeStory.data &&
    Date.parse(activeStory.data.expires_at) > Date.now()
      ? activeStory.data
      : null;
  if (!own && (!query.data?.length || query.error)) return null;
  return (
    <View style={{ paddingVertical: 16 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 17, paddingHorizontal: 18 }}
      >
        {own && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              ownStory
                ? "Voir votre story active"
                : "Créer une bulle de stories à la une"
            }
            onPress={() =>
              ownStory
                ? router.push(`/stories/${ownStory.id}`)
                : router.push("/story-collections/new")
            }
            style={{ width: 76, alignItems: "center", gap: 7 }}
          >
            {ownStory ? (
              <LinearGradient
                colors={[colors.red, colors.blue]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 34,
                  padding: 3,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image
                  source={{ uri: ownStory.media_url }}
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 29,
                    borderWidth: 2,
                    borderColor: colors.background,
                    backgroundColor: colors.surfaceRaised,
                  }}
                  contentFit="cover"
                />
              </LinearGradient>
            ) : (
              <View
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 34,
                  borderWidth: 2,
                  borderStyle: "dashed",
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={25} color={colors.muted} />
              </View>
            )}
            <Text style={s.small}>{ownStory ? "Votre story" : "Nouveau"}</Text>
          </Pressable>
        )}
        {!query.error &&
          query.data?.map((collection) => (
            <Pressable
              key={collection.id}
              accessibilityRole="button"
              accessibilityLabel={`Voir la bulle ${collection.title}`}
              onPress={() =>
                router.push(
                  `/story-collections/${collection.id}?profileId=${profileId}`,
                )
              }
              style={{ width: 76, alignItems: "center", gap: 7 }}
            >
              <View
                style={{
                  padding: 3,
                  borderRadius: 36,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Image
                  source={{ uri: collection.items[0]?.media_url }}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 31,
                    backgroundColor: colors.surfaceRaised,
                  }}
                  contentFit="cover"
                />
              </View>
              <Text
                style={[s.small, { textAlign: "center" }]}
                numberOfLines={2}
              >
                {collection.title}
              </Text>
            </Pressable>
          ))}
      </ScrollView>
    </View>
  );
}
