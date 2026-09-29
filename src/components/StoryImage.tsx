import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { FilteredStoryImage } from "./FilteredStoryImage";
import { NativeVideo } from "./Video";
import { useFocusEffect } from "expo-router";
import { scheduleStoryView } from "../lib/storyViewRecording";
import { supabase } from "../lib/supabase";
import { ErrorState } from "./ui";

function isVideoStoryUrl(url: string) {
  return /\.(mp4|mov|m4v|webm)(?:[?#]|$)/i.test(url);
}
export function StoryImage({
  story,
  uid,
  fullScreen = false,
}: {
  story: {
    id: string;
    user_id: string;
    media_url: string;
    expires_at: string;
    filters?: unknown;
  };
  uid: string;
  fullScreen?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [recorded, setRecorded] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const visible = useRef({
    loaded: false,
    focused: false,
    active: AppState.currentState === "active",
  });
  useFocusEffect(
    useCallback(() => {
      visible.current.focused = true;
      setFocused(true);
      return () => {
        visible.current.focused = false;
        setFocused(false);
      };
    }, []),
  );
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      visible.current.active = state === "active";
      setActive(state === "active");
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (recorded) return;
    return scheduleStoryView({
      uid,
      owner: story.user_id,
      expiresAt: story.expires_at,
      isCurrent: () =>
        visible.current.loaded &&
        visible.current.focused &&
        visible.current.active,
      authenticate: async () => {
        const auth = await supabase.auth.getUser();
        if (auth.error) throw auth.error;
        return auth.data.user?.id;
      },
      record: async () => {
        const result = await supabase
          .from("story_views")
          .upsert(
            { story_id: story.id, viewer_id: uid },
            { onConflict: "story_id,viewer_id", ignoreDuplicates: true },
          );
        if (result.error) throw result.error;
      },
      onSuccess: () => {
        setRecorded(true);
        setError(null);
      },
      onError: () =>
        setError(
          new Error("La vue de cette story n’a pas pu être enregistrée."),
        ),
    });
  }, [
    loaded,
    focused,
    active,
    recorded,
    uid,
    story.id,
    story.user_id,
    story.expires_at,
    attempt,
  ]);
  return (
    <View style={fullScreen ? { flex: 1 } : { gap: 10 }}>
      {isVideoStoryUrl(story.media_url) ? (
        <NativeVideo
          key={mediaAttempt}
          uri={story.media_url}
          active
          visible
          contentFit="cover"
          style={
            fullScreen
              ? {
                  width: "100%",
                  height: "100%",
                  borderRadius: 0,
                  backgroundColor: "#000000",
                }
              : {
                  width: "100%",
                  aspectRatio: 9 / 16,
                  borderRadius: 20,
                  overflow: "hidden",
                  backgroundColor: "#0F172A",
                }
          }
          onPlayback={() => {
            visible.current.loaded = true;
            setLoaded(true);
            setMediaError(false);
          }}
        />
      ) : (
        <FilteredStoryImage
          key={mediaAttempt}
          uri={story.media_url}
          filters={story.filters}
          style={
            fullScreen
              ? {
                  width: "100%",
                  height: "100%",
                  borderRadius: 0,
                  backgroundColor: "#000000",
                }
              : {
                  width: "100%",
                  aspectRatio: 9 / 16,
                  borderRadius: 20,
                  backgroundColor: "#0F172A",
                }
          }
          onLoad={() => {
            visible.current.loaded = true;
            setLoaded(true);
            setMediaError(false);
          }}
          onError={() => {
            visible.current.loaded = false;
            setLoaded(false);
            setMediaError(true);
          }}
        />
      )}
      {!!mediaError && (
        <ErrorState
          error={new Error("L’image de cette story n’a pas pu être chargée.")}
          retry={() => {
            visible.current.loaded = false;
            setLoaded(false);
            setMediaError(false);
            setMediaAttempt((value) => value + 1);
          }}
        />
      )}
      {!!error && (
        <ErrorState
          error={error}
          retry={() => {
            setError(null);
            setAttempt((value) => value + 1);
          }}
        />
      )}
    </View>
  );
}
