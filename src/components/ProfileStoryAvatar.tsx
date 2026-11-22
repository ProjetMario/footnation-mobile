import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "./ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { supportRpc } from "../lib/support";
import { publicProfileName } from "../lib/publicTalent";
import type { Profile } from "../lib/models";
import { ProfilePhotoViewer } from "./ProfilePhotoViewer";

export function ProfileStoryAvatar({
  profile,
  compact = false,
}: {
  profile: Profile;
  compact?: boolean;
}) {
  const { session, profileStatus } = useAuth();
  const uid = session?.user.id;
  const ready = profileStatus === "ready";
  const [focused, setFocused] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const photo = profile.avatar_url?.trim();
  const name = publicProfileName(profile);
  const storySpin = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        setPhotoOpen(false);
      };
    }, []),
  );
  const stories = useQuery({
    queryKey: ["profile-active-stories", uid, profile.id],
    enabled: !!uid && focused && ready,
    refetchInterval: 15000,
    queryFn: async () => {
      const blocks = await supabase
        .from("user_blocks")
        .select("blocker_id")
        .or(
          `and(blocker_id.eq.${uid},blocked_id.eq.${profile.id}),and(blocker_id.eq.${profile.id},blocked_id.eq.${uid})`,
        )
        .limit(1);
      if (blocks.error) throw blocks.error;
      if (blocks.data.length) return null;
      const result = await supabase
        .from("stories")
        .select("id,expires_at")
        .eq("user_id", profile.id)
        .eq("moderation_hidden", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(100);
      if (result.error) throw result.error;
      if (!result.data.length) return null;
      const views = await supabase
        .from("story_views")
        .select("story_id")
        .eq("viewer_id", uid!)
        .in(
          "story_id",
          result.data.map((s) => s.id),
        );
      const seen = new Set(views.data?.map((v) => v.story_id) || []);
      const unseen = views.error
        ? null
        : result.data.find((s) => !seen.has(s.id));
      return { ...(unseen || result.data[0]), unseen: !!unseen };
    },
  });
  const presence = useQuery({
    queryKey: ["profile-presence", uid, profile.id],
    enabled: !!uid && focused && ready,
    queryFn: () =>
      supportRpc<boolean>(uid!, "read_profile_presence", {
        p_profile_id: profile.id,
      }),
    refetchInterval: 15000,
    retry: false,
    staleTime: 0,
  });
  const story =
    !stories.error &&
    stories.data &&
    Date.parse(stories.data.expires_at) > Date.now()
      ? stories.data
      : null;
  const online =
    focused &&
    !presence.error &&
    presence.data === true &&
    Date.now() - presence.dataUpdatedAt < 30000;
  const avatar = (
    <Avatar uri={profile.avatar_url} name={name} size={compact ? 64 : 82} />
  );
  useEffect(() => {
    if (!story?.unseen) {
      storySpin.stopAnimation();
      storySpin.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(storySpin, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [story?.unseen, storySpin]);
  const spin = storySpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <View>
        <Pressable
          disabled={!photo}
          accessibilityRole={photo ? "button" : undefined}
          accessibilityLabel={
            photo ? `Agrandir la photo de profil de ${name}` : name
          }
          accessibilityHint={
            photo ? "Afficher la photo entière en plein écran" : undefined
          }
          onPress={() => setPhotoOpen(true)}
          style={({ pressed }) => ({ opacity: pressed && photo ? 0.8 : 1 })}
        >
          {story ? (
            <View style={{ padding: 4, borderRadius: 60 }}>
              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: [{ rotate: story.unseen ? spin : "0deg" }],
                }}
              >
                <LinearGradient
                  colors={
                    story.unseen
                      ? ["#087CFF", "#8340FF", "#FF1944", "#087CFF"]
                      : ["#718099", "#A6AEBD", "#718099"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1, borderRadius: 60 }}
                />
              </Animated.View>
              <View
                style={{
                  padding: 3,
                  backgroundColor: "white",
                  borderRadius: 60,
                }}
              >
                {avatar}
              </View>
            </View>
          ) : (
            <View
              style={{
                padding: 7,
                borderRadius: 60,
                backgroundColor: "rgba(255,255,255,.18)",
              }}
            >
              {avatar}
            </View>
          )}
        </Pressable>
        {online && (
          <View
            pointerEvents="none"
            accessibilityRole="text"
            accessibilityLabel="En ligne en ce moment"
            style={{
              position: "absolute",
              right: 0,
              bottom: 1,
              width: 22,
              height: 22,
              backgroundColor: "#1CC75C",
              borderColor: "white",
              borderWidth: 3,
              borderRadius: 20,
            }}
          />
        )}
      </View>
      {!!story && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            story.unseen ? "Voir la nouvelle story" : "Revoir la story"
          }
          onPress={() => router.push(`/stories/${story.id}`)}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            minHeight: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? "#1957B6" : "#087CFF",
          })}
        >
          <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>
            {story.unseen ? "Voir la story" : "Revoir la story"}
          </Text>
        </Pressable>
      )}
      {online && !compact && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: "#8AF3B4", fontSize: 11 }}
        >
          En ligne
        </Text>
      )}
      {photoOpen && !!photo && (
        <ProfilePhotoViewer
          uri={photo}
          name={name}
          onClose={() => setPhotoOpen(false)}
        />
      )}
    </View>
  );
}
