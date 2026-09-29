import React, { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { moderateText, MODERATION_ERROR_MESSAGE } from "../lib/moderation";
export default function PostEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen title="Modifier la publication">
      <AuthGate>
        <Load id={id} />
      </AuthGate>
    </Screen>
  );
}
function Load({ id }: { id: string }) {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ["post-editor", id, session!.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id,user_id,content,location,hashtags,image_url,video_url")
        .eq("id", id)
        .eq("user_id", session!.user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  return query.isPending ? (
    <Loading />
  ) : query.error ? (
    <ErrorState error={query.error} />
  ) : (
    <Editor post={query.data} />
  );
}
function Editor({ post }: { post: any }) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const [content, setContent] = useState(post.content || "");
  const [location, setLocation] = useState(post.location || "");
  const [hashtags, setHashtags] = useState((post.hashtags || []).join(" "));
  const [confirm, setConfirm] = useState(false);
  const mutation = useMutation({
    mutationFn: async (remove: boolean) => {
      if (remove) {
        const { error } = await supabase
          .from("posts")
          .delete()
          .eq("id", post.id)
          .eq("user_id", post.user_id)
          .select("id")
          .single();
        if (error) throw error;
        return;
      }
      if (!content.trim() && !post.image_url && !post.video_url)
        throw new Error("La publication ne peut pas être vide.");
      if (!moderateText([content, location, hashtags].join(" ")).isClean)
        throw new Error(MODERATION_ERROR_MESSAGE);
      const tags = [
        ...new Set(
          hashtags
            .split(/\s+/)
            .filter((tag: string) => tag.startsWith("#") && tag.length > 1),
        ),
      ];
      if (tags.length > 10)
        throw new Error("Vous pouvez utiliser maximum 10 hashtags.");
      const { error } = await supabase
        .from("posts")
        .update({
          content: content.trim(),
          location: location.trim() || null,
          hashtags: tags,
        })
        .eq("id", post.id)
        .eq("user_id", post.user_id)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: (_, remove) => {
      void cache.invalidateQueries({ queryKey: ["posts"] });
      void cache.invalidateQueries({ queryKey: ["shorts-native"] });
      void cache.invalidateQueries({ queryKey: ["post", post.id] });
      void cache.invalidateQueries({ queryKey: ["post-editor", post.id] });
      void cache.invalidateQueries({ queryKey: ["saved-posts"] });
      router.replace(remove ? "/" : `/posts/${post.id}`);
    },
  });
  return (
    <>
      <Field
        label="Publication"
        multiline
        value={content}
        onChangeText={setContent}
        maxLength={10000}
      />
      <Field label="Lieu" value={location} onChangeText={setLocation} />
      <Field
        label="Hashtags"
        value={hashtags}
        onChangeText={setHashtags}
        autoCapitalize="none"
      />
      {!!mutation.error && <ErrorState error={mutation.error} />}
      <Button
        title="Enregistrer"
        busy={mutation.isPending}
        onPress={() => mutation.mutate(false)}
      />
      {confirm ? (
        <>
          <Text style={s.text}>
            Supprimer définitivement cette publication et ses commentaires ?
          </Text>
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
          title="Supprimer la publication"
          secondary
          onPress={() => setConfirm(true)}
        />
      )}
    </>
  );
}
