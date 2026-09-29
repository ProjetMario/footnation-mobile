import { authReturnPath } from "../lib/authReturn";
import React from "react";
import { router, useLocalSearchParams } from "expo-router";
import { applySignupReferral } from "../lib/referralBackend";
import { Share, Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Banner,
  Button,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
export default function Referral() {
  const params = useLocalSearchParams<{ next?: string }>();
  const next = authReturnPath(params.next);
  return (
    <Screen title="Parrainage">
      <AuthGate>
        <Content />
      </AuthGate>
      {!!next && (
        <Button
          secondary
          title="Continuer vers mon invitation ou le contenu partagé"
          onPress={() => router.replace(next)}
        />
      )}
    </Screen>
  );
}
function Content() {
  const s = useUIStyles();

  const { session } = useAuth();
  const uid = session!.user.id;
  const params = useLocalSearchParams<{ apply?: string }>();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["native-referral", uid, params.apply],
    queryFn: async () => {
      const attribution =
        params.apply === "1"
          ? await applySignupReferral(
              session!.user.user_metadata?.referrer_id,
              uid,
            )
          : null;
      const profile = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", uid)
        .single();
      if (profile.error) throw profile.error;
      const count = await supabase
        .from("profiles")
        .select("id", { head: true, count: "exact" })
        .eq("referred_by", uid);
      if (count.error) throw count.error;
      return {
        code: profile.data.referral_code,
        count: count.count || 0,
        attribution,
      };
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = await supabase
          .from("profiles")
          .select("referral_code")
          .eq("id", uid)
          .single();
        if (current.error) throw current.error;
        if (current.data.referral_code) return;
        const code = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
        let request = supabase
          .from("profiles")
          .update({ referral_code: code })
          .eq("id", uid);
        request =
          current.data.referral_code === null
            ? request.is("referral_code", null)
            : request.eq("referral_code", "");
        const result = await request.select("referral_code").single();
        if (!result.error) return;
        if (!["23505", "PGRST116"].includes(result.error.code))
          throw result.error;
      }
      throw new Error("Impossible de créer le lien. Veuillez réessayer.");
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["native-referral", uid] });
    },
  });
  const share = useMutation({
    mutationFn: async () => {
      if (!query.data?.code) throw new Error("Créez votre lien de parrainage.");
      await Share.share({
        message: `Rejoins-moi sur FootNation ! https://www.foot-nation.com/login?mode=signup&ref=${encodeURIComponent(query.data.code)}`,
      });
    },
  });
  return (
    <>
      <Banner
        eyebrow="PARRAINAGE"
        title="Le foot se partage"
        description="Invite tes amis à rejoindre FootNation et retrouve les inscriptions réalisées grâce à ton lien."
      />
      <Button
        title="Inviter mon réseau"
        onPress={() => router.push("/invite")}
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!query.data?.attribution && (
        <View style={s.card}>
          <Text style={s.text}>
            {query.data.attribution === "invalid"
              ? "Ce code de parrainage est introuvable ou ne peut pas être utilisé pour votre compte."
              : "Votre parrainage est enregistré."}
          </Text>
          <Button
            title="Compléter mon profil"
            onPress={() => router.replace("/settings")}
          />
        </View>
      )}
      {!!query.data && (
        <>
          <View style={s.card}>
            <Text style={s.title}>{query.data.count}</Text>
            <Text style={s.subtitle}>filleuls inscrits</Text>
          </View>
          {query.data.code ? (
            <>
              <Text selectable style={s.text}>
                https://www.foot-nation.com/login?mode=signup&amp;ref=
                {query.data.code}
              </Text>
              <Button
                title="Partager mon lien"
                busy={share.isPending}
                onPress={() => share.mutate()}
              />
            </>
          ) : (
            <Button
              title="Créer mon lien de parrainage"
              busy={create.isPending}
              onPress={() => create.mutate()}
            />
          )}
        </>
      )}
      {!!create.error && <ErrorState error={create.error} />}
      {!!share.error && <ErrorState error={share.error} />}
    </>
  );
}
