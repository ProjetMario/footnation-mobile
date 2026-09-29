import * as AuthSession from "expo-auth-session";
import { accountChangePayload } from "../lib/accountChange";
import { router } from "expo-router";
import React, { useState } from "react";
import { useTheme } from "../theme";
import { Switch, Text, View } from "react-native";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  pushDeviceAvailable,
  pushDeviceAvailabilityMessage,
  registerPushDevice,
  unregisterPushDevice,
} from "../lib/pushDevice";
import { changePushPreference } from "../lib/pushPreference";
import { AuthGate } from "../components/AuthGate";
import { AppearanceSettings } from "../components/AppearanceSettings";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import {
  Button,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
const preferences = {
  email_notifications: "Notifications par email",
  push_notifications: "Notifications push",
  profile_visibility: "Profil public",
};
export default function AccountSettings() {
  const { session } = useAuth();
  return (
    <Screen title="Compte et confidentialité">
      <AppearanceSettings />
      <LanguageSwitcher />
      <AuthGate>
        <Settings key={session?.user.id || "guest"} />
      </AuthGate>
    </Screen>
  );
}
function Settings() {
  const { colors } = useTheme();
  const s = useUIStyles();

  const { session } = useAuth();
  const uid = session!.user.id;
  const cache = useQueryClient();
  const [email, setEmail] = useState(session!.user.email || "");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  async function requireCurrentUser() {
    const r = await supabase.auth.getUser();
    if (r.error) throw r.error;
    if (r.data.user?.id !== uid)
      throw new Error("La session a changé. Rechargez cet écran.");
    return r.data.user;
  }
  const [unblock, setUnblock] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["user-preferences", uid],
    queryFn: async () => {
      await requireCurrentUser();
      const { data, error } = await supabase
        .from("user_preferences")
        .select("email_notifications,push_notifications,profile_visibility")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  async function savePreference(key: keyof typeof preferences, value: boolean) {
    await requireCurrentUser();
    const { error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: uid, [key]: value }, { onConflict: "user_id" })
      .select("user_id")
      .single();
    if (error) throw error;
  }
  const pref = useMutation({
    mutationFn: async ({
      key,
      value,
    }: {
      key: keyof typeof preferences;
      value: boolean;
    }) => {
      if (key !== "push_notifications") {
        await savePreference(key, value);
        return;
      }
      await changePushPreference(value, {
        save: (next) => savePreference(key, next),
        register: () => registerPushDevice(uid),
        unregister: () => unregisterPushDevice(uid),
      });
    },
    onSuccess: (_, change) => {
      if (change.key === "profile_visibility") void cache.invalidateQueries();
    },
    onSettled: () =>
      cache.invalidateQueries({ queryKey: ["user-preferences", uid] }),
  });
  const account = useMutation({
    mutationFn: async (kind: "email" | "password") => {
      const payload = accountChangePayload(kind, email, password, repeat);
      const user = await requireCurrentUser();
      if (
        kind === "email" &&
        "email" in payload &&
        payload.email === user.email
      )
        throw new Error("Cette adresse est déjà celle du compte.");
      const { data, error } = await supabase.auth.updateUser(
        payload,
        kind === "email"
          ? {
              emailRedirectTo: AuthSession.makeRedirectUri({
                scheme: "com.footnation.app",
                path: "auth/callback",
              }),
            }
          : undefined,
      );
      if (error) throw error;
      return {
        kind,
        confirmationRequired:
          kind === "email" && data.user?.email !== payload.email,
      };
    },
    onSuccess: (result) => {
      if (result.kind === "password") {
        setPassword("");
        setRepeat("");
      }
    },
  });
  const blocks = useInfiniteQuery({
    queryKey: ["my-blocks", uid],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      await requireCurrentUser();
      const { data, error } = await supabase
        .from("user_blocks")
        .select("id,blocked_id,created_at")
        .eq("blocker_id", uid)
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (error) throw error;
      if (!data.length) return [];
      const profiles = await supabase
        .from("profiles")
        .select("id,full_name,username")
        .in(
          "id",
          data.map((b) => b.blocked_id),
        );
      if (profiles.error) throw profiles.error;
      return data.map((b) => ({
        ...b,
        name:
          profiles.data.find((p) => p.id === b.blocked_id)?.full_name ||
          profiles.data.find((p) => p.id === b.blocked_id)?.username ||
          "Compte indisponible",
      }));
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await requireCurrentUser();
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("id", id)
        .eq("blocker_id", uid)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      setUnblock(null);
      void cache.invalidateQueries();
    },
  });
  return (
    <>
      <Text style={s.h2}>Préférences</Text>
      <Button
        title="Mes signalements"
        secondary
        onPress={() => router.push("/my-reports")}
      />
      <Button
        title="Supprimer mon compte"
        secondary
        onPress={() => router.push("/suppression-compte")}
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        Object.entries(preferences).map(([key, label]) => (
          <View key={key} style={[s.card, s.between]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.text}>{label}</Text>
              {key === "push_notifications" && (
                <Text style={s.small}>
                  {pushDeviceAvailabilityMessage} Vos notifications restent
                  toujours consultables dans l’application.
                </Text>
              )}
              {key === "profile_visibility" && (
                <Text style={s.small}>
                  Désactivé : seuls vous et les administrateurs FootNation
                  pouvez consulter votre profil. Vos publications restent
                  accessibles selon leurs propres règles de visibilité.
                </Text>
              )}
            </View>
            <Switch
              trackColor={{ false: colors.border, true: colors.blue }}
              thumbColor={colors.white}
              accessibilityLabel={label}
              value={query.data?.[key as keyof typeof preferences] ?? true}
              disabled={
                pref.isPending ||
                pref.isError ||
                query.isFetching ||
                (key === "push_notifications" &&
                  !pushDeviceAvailable &&
                  query.data?.push_notifications === false)
              }
              onValueChange={(value) =>
                pref.mutate({ key: key as keyof typeof preferences, value })
              }
            />
          </View>
        ))
      )}
      {!!pref.error && (
        <View style={{ gap: 10 }}>
          <ErrorState error={pref.error} />
          <Button
            title="Réessayer la même préférence"
            busy={pref.isPending}
            onPress={() => {
              if (pref.variables) pref.mutate(pref.variables);
            }}
          />
          <Button
            title="Annuler et actualiser les préférences"
            secondary
            disabled={pref.isPending}
            onPress={() => {
              pref.reset();
              void query.refetch();
            }}
          />
        </View>
      )}
      <View style={s.card}>
        <Text style={s.h2}>Adresse email</Text>
        <Field
          label="Nouvelle adresse email"
          value={email}
          onChangeText={(value) => {
            account.reset();
            setEmail(value);
          }}
          editable={!account.isPending}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Button
          title="Demander le changement d’email"
          busy={account.isPending}
          disabled={email.trim() === session!.user.email}
          onPress={() => account.mutate("email")}
        />
      </View>
      <View style={s.card}>
        <Text style={s.h2}>Mot de passe</Text>
        <Text style={s.small}>
          Au moins 8 caractères, une majuscule, une minuscule et un chiffre.
        </Text>
        <Field
          label="Nouveau mot de passe"
          value={password}
          onChangeText={(value) => {
            account.reset();
            setPassword(value);
          }}
          editable={!account.isPending}
          secureTextEntry
          autoCapitalize="none"
        />
        <Field
          label="Confirmer le mot de passe"
          value={repeat}
          onChangeText={(value) => {
            account.reset();
            setRepeat(value);
          }}
          editable={!account.isPending}
          secureTextEntry
          autoCapitalize="none"
        />
        <Button
          title="Changer mon mot de passe"
          busy={account.isPending}
          disabled={!password || !repeat}
          onPress={() => account.mutate("password")}
        />
      </View>
      {!!account.error && <ErrorState error={account.error} />}
      {!!account.isSuccess && (
        <Text style={s.text}>
          {account.data?.kind === "email"
            ? account.data.confirmationRequired
              ? "Demande enregistrée. Consultez votre nouvelle adresse email et, si demandé, votre adresse actuelle pour confirmer le changement."
              : "Adresse email modifiée."
            : "Mot de passe modifié."}
        </Text>
      )}
      <Text style={s.h2}>Comptes bloqués</Text>
      <Button
        title="Actualiser les comptes bloqués"
        secondary
        busy={blocks.isFetching}
        disabled={remove.isPending}
        onPress={() => void blocks.refetch()}
      />
      {blocks.isPending ? (
        <Loading />
      ) : blocks.error ? (
        <ErrorState error={blocks.error} />
      ) : !blocks.data.pages.flat().length ? (
        <Empty title="Aucun compte bloqué" />
      ) : (
        blocks.data.pages.flat().map((b) => (
          <View style={s.card} key={b.id}>
            <Text style={s.text}>{b.name}</Text>
            {unblock === b.id ? (
              <>
                <Text style={s.small}>
                  Autoriser à nouveau les interactions avec ce compte ?
                </Text>
                <Button
                  title="Confirmer le déblocage"
                  busy={remove.isPending}
                  onPress={() => remove.mutate(b.id)}
                />
                <Button
                  title="Annuler"
                  secondary
                  disabled={remove.isPending}
                  onPress={() => setUnblock(null)}
                />
              </>
            ) : (
              <Button
                title="Débloquer"
                secondary
                disabled={remove.isPending}
                onPress={() => {
                  remove.reset();
                  setUnblock(b.id);
                }}
              />
            )}
          </View>
        ))
      )}
      {!!remove.error && <ErrorState error={remove.error} />}
      {!!blocks.hasNextPage && (
        <Button
          title="Voir plus"
          busy={blocks.isFetchingNextPage}
          onPress={() => void blocks.fetchNextPage()}
        />
      )}
    </>
  );
}
