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

export function ProfileStoryAvatar({ profile }: { profile: Profile }) {
  const uid = useAuth().session?.user.id;
  const [focused, setFocused] = useState(false);
  const storySpin = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const stories = useQuery({
    queryKey: ["profile-active-stories", uid, profile.id],
    enabled: !!uid && focused,
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
    enabled: !!uid && focused,
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
    <Avatar
      uri={profile.avatar_url}
      name={publicProfileName(profile)}
      size={82}
    />
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
        {story ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              story.unseen ? "Voir la nouvelle story" : "Revoir la story"
            }
            onPress={() => router.push(`/stories/${story.id}`)}
          >
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
          </Pressable>
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
        {online && (
          <View
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
      {online && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: "#8AF3B4", fontSize: 11 }}
        >
          En ligne
        </Text>
      )}
    </View>
  );
}
