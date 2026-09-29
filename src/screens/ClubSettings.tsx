import React from "react";
import { Text, View, Switch, Share } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, ErrorState, Loading, useUIStyles } from "../components/ui";
import { supabase } from "../lib/supabase";
import { requireClubAdmin } from "../lib/clubAccess";
import { useAuth } from "../lib/auth";
export default function ClubSettings({ id }: { id: string }) {
  const s = useUIStyles();
  const uid = useAuth().session!.user.id;

  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["club-native-settings", id, uid],
    queryFn: async () => {
      await requireClubAdmin(id, uid);
      const club = await supabase
        .from("fff_clubs")
        .select("name,slug,metadata")
        .eq("id", id)
        .single();
      if (club.error) throw club.error;
      const admin = await supabase.rpc("is_site_admin");
      if (admin.error) throw admin.error;
      return { club: club.data, admin: admin.data === true };
    },
  });
  const change = useMutation({
    mutationFn: async ({
      key,
      value,
    }: {
      key: "is_verified" | "is_suspended";
      value: boolean;
    }) => {
      await requireClubAdmin(id, uid);
      const admin = await supabase.rpc("is_site_admin");
      if (admin.error) throw admin.error;
      if (admin.data !== true)
        throw new Error(
          "Seule l’administration FootNation peut modifier ces statuts.",
        );
      const previous = query.data?.club.metadata?.[key];
      const result = await supabase.rpc("set_native_club_status", {
        p_club_id: id,
        p_key: key,
        p_value: value,
        p_expected: typeof previous === "boolean" ? previous : null,
      });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["club-native-settings", id] });
      void cache.invalidateQueries({ queryKey: ["club", id] });
    },
  });
  const share = useMutation({
    mutationFn: async () => {
      await Share.share({
        message: `Rejoins ${query.data?.club.name} sur FootNation : https://www.foot-nation.com/club/${encodeURIComponent(query.data?.club.slug || id)}`,
      });
    },
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  return (
    <>
      <Text style={s.h2}>{query.data.club.name}</Text>
      {(
        [
          ["is_verified", "Club vérifié"],
          ["is_suspended", "Club suspendu"],
        ] as const
      ).map(([key, label]) => (
        <View key={key} style={[s.card, s.between]}>
          <Text style={s.text}>{label}</Text>
          <Switch
            accessibilityLabel={label}
            value={!!query.data.club.metadata?.[key]}
            disabled={!query.data.admin || change.isPending}
            onValueChange={(value) => change.mutate({ key, value })}
          />
        </View>
      ))}
      {!query.data.admin && (
        <Text style={s.small}>
          Ces statuts sont gérés par l’administration FootNation.
        </Text>
      )}
      {!!change.error && (
        <ErrorState error={change.error} retry={() => void query.refetch()} />
      )}
      <Button
        title="Partager l’invitation au club"
        busy={share.isPending}
        onPress={() => share.mutate()}
      />
      {!!share.error && <ErrorState error={share.error} />}
    </>
  );
}
