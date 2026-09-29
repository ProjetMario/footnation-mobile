import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import { Check, Plus, RotateCw } from "lucide-react-native";
import { router, usePathname } from "expo-router";
import { authReturnPath } from "../lib/authReturn";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { applyClubFollowIntent } from "../lib/clubFollowIntent";

/** Compact, real follow action for media overlays, separate from the profile link. */
export function FollowAuthor({
  id,
  name,
  onNavigate,
  variant = "button",
}: {
  id: string;
  name: string;
  onNavigate?: () => void;
  variant?: "button" | "badge";
}) {
  const uid = useAuth().session?.user.id;
  if (uid === id) return null;
  return (
    <FollowAuthorControl
      key={`${uid || "guest"}:${id}`}
      id={id}
      name={name}
      uid={uid}
      onNavigate={onNavigate}
      variant={variant}
    />
  );
}

function FollowAuthorControl({
  id,
  name,
  uid,
  onNavigate,
  variant,
}: {
  id: string;
  name: string;
  uid?: string;
  onNavigate?: () => void;
  variant: "button" | "badge";
}) {
  const cache = useQueryClient();
  const next = authReturnPath(usePathname());
  const read = async () => {
    const result = await supabase
      .from("profile_followers")
      .select("id")
      .eq("follower_id", uid!)
      .eq("followed_id", id)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  };
  const query = useQuery({
    queryKey: ["following", uid, id],
    enabled: !!uid,
    queryFn: read,
  });
  const change = useMutation({
    mutationFn: async (intent: {
      following: boolean;
      expectedId: string | null;
    }) => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (!uid || auth.data.user?.id !== uid)
        throw new Error("Votre session a changé. Reconnectez-vous.");
      await applyClubFollowIntent(
        {
          read,
          insert: async () => {
            const result = await supabase
              .from("profile_followers")
              .insert({ follower_id: uid, followed_id: id });
            if (result.error) throw result.error;
          },
          remove: async (followId) => {
            const result = await supabase
              .from("profile_followers")
              .delete()
              .eq("id", followId)
              .eq("follower_id", uid)
              .eq("followed_id", id)
              .select("id");
            if (result.error) throw result.error;
            return result.data.length === 1;
          },
        },
        intent.following,
        intent.expectedId,
      );
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["following", uid, id] }),
        cache.invalidateQueries({ queryKey: ["profile-follows", uid] }),
        cache.invalidateQueries({ queryKey: ["profile-overview", uid] }),
        cache.invalidateQueries({
          queryKey: ["shorts-native", uid, "friends"],
        }),
      ]);
    },
  });
  const busy = !!uid && (query.isPending || change.isPending);
  const onPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (busy || (variant === "badge" && query.data)) return;
    if (!uid) {
      onNavigate?.();
      router.push({ pathname: "/login", params: next ? { next } : {} });
      return;
    }
    if (query.isError) {
      void query.refetch();
      return;
    }
    change.mutate(
      change.isError && change.variables
        ? change.variables
        : { following: !query.data, expectedId: query.data?.id || null },
    );
  };
  if (variant === "badge") {
    const followed = !!query.data;
    const failed = query.isError || change.isError;
    return (
      <View pointerEvents="box-none" style={badgeStyles.position}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            followed
              ? `Vous suivez ${name}`
              : failed
                ? `Réessayer de suivre ${name}`
                : `Suivre ${name}`
          }
          accessibilityState={{
            disabled: busy || followed,
            busy,
            selected: followed,
          }}
          accessibilityHint={
            failed
              ? "Le suivi n’a pas été enregistré. Touchez pour réessayer."
              : undefined
          }
          disabled={busy || followed}
          onPress={onPress}
          style={({ pressed }) => [
            badgeStyles.target,
            pressed && { opacity: 0.7 },
          ]}
        >
          <View
            style={[
              badgeStyles.circle,
              followed && badgeStyles.followed,
              failed && !followed && badgeStyles.failed,
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color="white" />
            ) : followed ? (
              <Check size={15} color="white" strokeWidth={3} />
            ) : failed ? (
              <RotateCw size={14} color="white" />
            ) : (
              <Plus size={17} color="white" strokeWidth={3} />
            )}
          </View>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ flexShrink: 0, gap: 4, maxWidth: 160 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${query.data ? "Ne plus suivre" : "Suivre"} ${name}`}
        accessibilityState={{ selected: !!query.data, disabled: busy }}
        disabled={busy}
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: 44,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.78)",
          borderRadius: 9,
          backgroundColor: "rgba(0,0,0,0.25)",
          opacity: busy || pressed ? 0.65 : 1,
        })}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontFamily: "Inter-SemiBold",
            fontSize: 13,
          }}
        >
          {busy
            ? "…"
            : query.isError || change.isError
              ? "Réessayer"
              : query.data
                ? "Suivi"
                : "Suivre"}
        </Text>
      </Pressable>
      {!!change.isError && (
        <Text
          accessibilityRole="alert"
          style={{ color: "#FFFFFF", fontSize: 11 }}
        >
          Suivi non enregistré.
        </Text>
      )}
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  position: {
    position: "absolute",
    bottom: -20,
    left: "50%",
    marginLeft: -22,
    zIndex: 2,
  },
  target: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "white",
    backgroundColor: "#087EFF",
    alignItems: "center",
    justifyContent: "center",
  },
  followed: { backgroundColor: "#12845E" },
  failed: { backgroundColor: "#C13750" },
});
