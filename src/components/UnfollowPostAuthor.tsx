import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Button, ErrorState } from "./ui";

export function UnfollowPostAuthor({
  id,
  onDone,
}: {
  id: string;
  onDone(): void;
}) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const cache = useQueryClient();
  const following = useQuery({
    queryKey: ["following", uid, id],
    enabled: !!uid && uid !== id,
    queryFn: async () => {
      const result = await supabase
        .from("profile_followers")
        .select("id")
        .eq("follower_id", uid!)
        .eq("followed_id", id)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const remove = useMutation({
    mutationFn: async (expectedId: string) => {
      const auth = await supabase.auth.getUser();
      if (auth.error || auth.data.user?.id !== uid)
        throw new Error("Votre session a changé. Rouvrez la publication.");
      const result = await supabase
        .from("profile_followers")
        .delete()
        .eq("id", expectedId)
        .eq("follower_id", uid!)
        .eq("followed_id", id);
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      cache.setQueryData(["following", uid, id], null);
      await cache.invalidateQueries({ queryKey: ["profile-follows", uid] });
      onDone();
    },
  });
  return (
    <>
      {!!following.data && (
        <Button
          title="Ne plus suivre"
          secondary
          busy={remove.isPending}
          onPress={() => remove.mutate(following.data!.id)}
        />
      )}
      {!!following.error && (
        <ErrorState
          error={following.error}
          retry={() => void following.refetch()}
        />
      )}
      {!!remove.error && <ErrorState error={remove.error} />}
    </>
  );
}
