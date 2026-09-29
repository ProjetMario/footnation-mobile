import React from "react";
import { Pressable, Text, View } from "react-native";
import { Bookmark } from "lucide-react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useTheme } from "../theme";
import { useUIStyles } from "./ui";
export function SavePost({
  postId,
  onDark = false,
  labeled = false,
  onSaved,
}: {
  postId: string;
  onDark?: boolean;
  labeled?: boolean;
  onSaved?: () => void;
}) {
  const { colors } = useTheme();
  const s = useUIStyles();
  const { session } = useAuth();
  const uid = session?.user.id;
  const cache = useQueryClient();
  const saved = useQuery({
    queryKey: ["saved-status", uid, postId],
    enabled: !!uid,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_posts")
        .select("id")
        .eq("user_id", uid!)
        .eq("post_id", postId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  const change = useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error("Connexion requise");
      const { error } = saved.data
        ? await supabase
            .from("saved_posts")
            .delete()
            .eq("user_id", uid)
            .eq("post_id", postId)
        : await supabase.from("saved_posts").insert({
            user_id: uid,
            post_id: postId,
            collection_name: "default",
          });
      if (error) throw error;
      return !saved.data;
    },
    onSuccess: async (value) => {
      cache.setQueryData(["saved-status", uid, postId], value);
      await cache.invalidateQueries({ queryKey: ["saved-posts", uid] });
      onSaved?.();
    },
  });
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          saved.isError
            ? "Réessayer de charger les favoris"
            : saved.data
              ? "Retirer des favoris"
              : "Enregistrer la publication"
        }
        accessibilityState={{
          selected: !!saved.data,
          disabled: !uid || saved.isPending || change.isPending,
        }}
        disabled={!uid || saved.isPending || change.isPending}
        onPress={() => {
          if (saved.isError) void saved.refetch();
          else change.mutate();
        }}
        style={({ pressed }) => ({
          minWidth: 44,
          flexDirection: "row",
          gap: 12,
          paddingHorizontal: labeled ? 16 : 0,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          opacity:
            !uid || saved.isPending || change.isPending
              ? 0.45
              : pressed
                ? 0.6
                : 1,
        })}
      >
        <Bookmark
          size={26}
          color={saved.data ? colors.blue : onDark ? colors.white : colors.ink}
          fill={saved.data ? colors.blue : "transparent"}
          strokeWidth={1.8}
        />
        {!!labeled && (
          <Text style={s.text}>
            {saved.data ? "Retirer des favoris" : "Enregistrer"}
          </Text>
        )}
      </Pressable>
      {!!(saved.isError || change.isError) && (
        <Text
          accessibilityRole="alert"
          style={[s.small, { color: onDark ? "#FFD5DB" : colors.danger }]}
        >
          {saved.isError ? "Réessayer" : "Réessayez"}
        </Text>
      )}
    </View>
  );
}
