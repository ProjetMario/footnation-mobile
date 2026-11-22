import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Check } from "lucide-react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { authReturnPath } from "../lib/authReturn";
import { normalizeReferral } from "../lib/referral";
import {
  completeSocialSignup,
  getSocialSignupStatus,
  postAuthDestination,
  selectedSignupRoles,
  socialSignupError,
  type SocialSignupValues,
} from "../lib/socialOnboarding";
import { uploadPhoto } from "../lib/media";
import { roleOptions } from "../lib/networkOptions";
import { BirthdateField } from "../components/BirthdateField";
import { ChoiceField } from "../components/ChoiceField";
import { Button, Field, Loading, Screen, useUIStyles } from "../components/ui";
import { useTheme } from "../theme";

const accountOptions = [
  {
    value: "personal",
    label: "Pour moi",
    icon: "👤",
    description: "Profil personnel (joueur, fan, entraîneur...)",
  },
  {
    value: "club",
    label: "Club de football",
    icon: "🏟️",
    description: "Profil officiel d'un club amateur ou pro",
  },
  {
    value: "business",
    label: "Entreprise / Marque",
    icon: "🏢",
    description: "Sponsor, équipementier, média, agence...",
  },
  {
    value: "institution",
    label: "Institution",
    icon: "🏛️",
    description: "Fédération, ligue, district, association...",
  },
];

type CompletionStep = "account" | "profile" | "identity";

export default function SocialSignup() {
  const { session, loading, memberAccess } = useAuth();
  const params = useLocalSearchParams<{ next?: string; ref?: string }>();
  const s = useUIStyles();
  if (loading)
    return (
      <Screen title="Votre profil">
        <Loading />
      </Screen>
    );
  if (!session)
    return (
      <Screen title="Votre profil">
        <Text style={s.text}>
          Reconnectez-vous pour terminer votre inscription.
        </Text>
        <Button
          title="Se connecter"
          onPress={() =>
            router.replace({
              pathname: "/login",
              params: {
                next: authReturnPath(params.next) || "/",
                ref: normalizeReferral(params.ref) || "",
              },
            })
          }
        />
      </Screen>
    );
  if (memberAccess?.state === "underage") return <Redirect href="/" />;
  return <CompletionForm key={session.user.id} userId={session.user.id} />;
}

function CompletionForm({ userId }: { userId: string }) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const { reload, requestNetworkInvite } = useAuth();
  const params = useLocalSearchParams<{ next?: string; ref?: string }>();
  const next = authReturnPath(params.next);
  const referral = normalizeReferral(params.ref);
  const [values, setValues] = useState<SocialSignupValues>({
    fullName: "",
    username: "",
    birthdate: "",
    accountType: "personal",
    role: "",
    acceptedTerms: true,
  });
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [birthdateDeclared, setBirthdateDeclared] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<CompletionStep>("account");
  const pending = useRef(false);
  const active = useRef(true);
  const [avatarAsset, setAvatarAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [avatarWarning, setAvatarWarning] = useState("");
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    let valid = true;
    setLoading(true);
    setError("");
    void getSocialSignupStatus(userId)
      .then((status) => {
        if (!valid) return;
        if (!status.required) {
          router.replace(next || postAuthDestination);
          return;
        }
        setValues((previous) => ({
          ...previous,
          fullName: previous.fullName || status.fullName,
          username: previous.username || status.username,
          birthdate: status.birthdate || previous.birthdate,
          accountType: ready ? previous.accountType : status.accountType,
          role: previous.role || status.role,
        }));
        setBirthdateDeclared(!!status.birthdate);
        setReady(true);
      })
      .catch((reason) => {
        if (valid) setError(reason.message);
      })
      .finally(() => {
        if (valid) setLoading(false);
      });
    return () => {
      valid = false;
    };
  }, [userId, retry, next, referral]);
  const change = <K extends keyof SocialSignupValues>(
    key: K,
    value: SocialSignupValues[K],
  ) => setValues((previous) => ({ ...previous, [key]: value }));
  const goBackStep = () => {
    if (busy) return;
    if (step === "identity") {
      setStep(values.accountType === "personal" ? "profile" : "account");
      return;
    }
    if (step === "profile") {
      setStep("account");
      return;
    }
    router.canGoBack() ? router.back() : router.replace("/");
  };
  async function complete() {
    if (pending.current) return;
    const invalid = socialSignupError(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await completeSocialSignup(userId, values, referral);
      const roles = selectedSignupRoles(values.role);
      if (values.accountType === "personal" && roles.length > 1) {
        await supabase
          .from("profiles")
          .update({ secondary_roles: roles.slice(1) })
          .eq("id", userId);
      }
      if (avatarAsset) {
        try {
          const uploaded = await uploadPhoto(avatarAsset, "avatars", userId);
          await supabase.auth.updateUser({
            data: { avatar_url: uploaded.url },
          });
          await supabase
            .from("profiles")
            .update({ avatar_url: uploaded.url })
            .eq("id", userId);
        } catch {
          setAvatarWarning(
            "Le profil est créé. La photo pourra être ajoutée depuis le profil.",
          );
        }
      }
      await reload();
      const current = await supabase.auth.getSession();
      if (
        !current.error &&
        current.data.session?.user.id === userId &&
        active.current
      ) {
        requestNetworkInvite(current.data.session);
        router.replace(next || postAuthDestination);
      }
    } catch (reason) {
      if (active.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Réessayez dans un instant.",
        );
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }
  if (loading)
    return (
      <Screen title="Créer mon profil gratuitement" onBack={goBackStep}>
        <Loading />
      </Screen>
    );
  if (!ready)
    return (
      <Screen title="Créer mon profil gratuitement" onBack={goBackStep}>
        {!!error && (
          <Text accessibilityRole="alert" style={s.text}>
            {error}
          </Text>
        )}
        <Button
          title="Réessayer"
          onPress={() => setRetry((value) => value + 1)}
        />
        <Button
          title="Obtenir de l’aide"
          secondary
          onPress={() => router.push("/help")}
        />
      </Screen>
    );
  if (step === "account")
    return (
      <Screen title="Créer mon profil gratuitement" onBack={goBackStep}>
        <Text style={[s.subtitle, socialStyles.center]}>
          Choisissez le type de compte que vous souhaitez créer.
        </Text>
        <View style={{ gap: 14 }}>
          {accountOptions.map((option) => {
            const selected = values.accountType === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={`${option.label}. ${option.description}`}
                accessibilityState={{ selected }}
                disabled={busy}
                onPress={() => {
                  change(
                    "accountType",
                    option.value as SocialSignupValues["accountType"],
                  );
                  setStep(option.value === "personal" ? "profile" : "identity");
                }}
                style={({ pressed }) => [
                  socialStyles.optionCard,
                  {
                    backgroundColor: selected
                      ? colors.accentSoft
                      : colors.surface,
                    borderColor: selected ? colors.blue : colors.border,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text allowFontScaling={false} style={socialStyles.optionIcon}>
                  {option.icon}
                </Text>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[s.h2, socialStyles.optionTitle]}>
                    {option.label}
                  </Text>
                  <Text style={s.subtitle}>{option.description}</Text>
                </View>
                {selected && (
                  <View
                    style={[
                      socialStyles.checkDot,
                      { backgroundColor: colors.blue },
                    ]}
                  >
                    <Check size={18} color={colors.white} strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </Screen>
    );
  if (step === "profile")
    return (
      <Screen title="Créer mon profil gratuitement" onBack={goBackStep}>
        <Text style={[s.h2, socialStyles.center]}>
          Quel profil vous correspond ?
        </Text>
        <Text style={[s.subtitle, socialStyles.center]}>
          Choisissez un ou plusieurs rôles dans le football.
        </Text>
        <ChoiceField
          label="Vos rôles dans le football"
          value={values.role}
          options={roleOptions}
          optional={false}
          multiple
          disabled={busy}
          onChange={(value) => change("role", value)}
        />
        <Text style={s.small}>
          Vous pouvez sélectionner plusieurs rôles. Le premier choisi sera votre
          rôle principal.
        </Text>
        <Button
          title="Continuer"
          disabled={!selectedSignupRoles(values.role).length}
          onPress={() => setStep("identity")}
        />
        <Button title="Retour" secondary onPress={() => setStep("account")} />
      </Screen>
    );
  return (
    <Screen title="Créer mon profil gratuitement" onBack={goBackStep}>
      <View
        style={[
          socialStyles.completionHero,
          {
            backgroundColor: colors.accentSoft,
            borderColor: colors.blue,
          },
        ]}
      >
        <Text style={[socialStyles.heroBadge, { color: colors.blue }]}>
          Dernière étape
        </Text>
        <Text style={[s.h2, socialStyles.heroTitle]}>
          Terminez votre inscription
        </Text>
        <Text style={[s.subtitle, socialStyles.heroText]}>
          Complétez ces infos pour accéder aux Shorts, publier et rejoindre la
          communauté FootNation.
        </Text>
      </View>
      <>
        <View style={socialStyles.avatarBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              avatarAsset
                ? "Changer la photo de profil"
                : "Ajouter une photo de profil"
            }
            disabled={busy}
            onPress={() =>
              void ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                base64: true,
                quality: 0.8,
                allowsEditing: true,
                aspect: [1, 1],
              })
                .then((result) => {
                  setAvatarWarning("");
                  if (!result.canceled) setAvatarAsset(result.assets[0]);
                })
                .catch(() =>
                  setAvatarWarning("Impossible d’ouvrir la photothèque."),
                )
            }
            style={({ pressed }) => [
              socialStyles.avatarButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: pressed || busy ? 0.65 : 1,
              },
            ]}
          >
            {avatarAsset?.uri ? (
              <Image
                source={{ uri: avatarAsset.uri }}
                style={socialStyles.avatarImage}
              />
            ) : (
              <Text
                style={[socialStyles.avatarFallback, { color: colors.blue }]}
              >
                +
              </Text>
            )}
          </Pressable>
          <Text style={s.small}>
            Photo facultative. Vous pourrez la modifier plus tard.
          </Text>
        </View>
        {!!avatarWarning && (
          <Text accessibilityRole="alert" style={s.small}>
            {avatarWarning}
          </Text>
        )}
        <Field
          label={
            values.accountType === "personal"
              ? "Prénom et nom"
              : "Nom du club ou de l’organisation"
          }
          value={values.fullName}
          onChangeText={(value) => change("fullName", value)}
          editable={!busy}
          maxLength={120}
          autoComplete="name"
        />
        <Field
          label="Pseudo"
          value={values.username}
          onChangeText={(value) =>
            change("username", value.toLowerCase().replace(/^@+/, ""))
          }
          editable={!busy}
          maxLength={30}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
        />
        <BirthdateField
          label={
            values.accountType === "personal"
              ? "Votre date de naissance"
              : "Votre date de naissance (responsable du compte)"
          }
          value={values.birthdate}
          onChange={(value) => change("birthdate", value)}
          disabled={busy || birthdateDeclared}
          minAge={13}
        />
        <Text style={s.small}>
          FootNation est accessible dès 13 ans. Vérifiez votre date : elle ne
          pourra pas être modifiée ici.
        </Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{
            checked: values.acceptedTerms,
            disabled: busy,
          }}
          {...(Platform.OS === "web"
            ? { "aria-checked": values.acceptedTerms }
            : {})}
          disabled={busy}
          onPress={() => change("acceptedTerms", !values.acceptedTerms)}
          style={({ pressed }) => [
            socialStyles.termsCard,
            {
              backgroundColor: values.acceptedTerms
                ? colors.accentSoft
                : colors.surface,
              borderColor: values.acceptedTerms ? colors.blue : colors.border,
              opacity: pressed || busy ? 0.72 : 1,
            },
          ]}
        >
          <View
            style={[
              socialStyles.termsCheck,
              {
                backgroundColor: values.acceptedTerms
                  ? colors.blue
                  : colors.surfaceRaised,
                borderColor: values.acceptedTerms ? colors.blue : colors.border,
              },
            ]}
          >
            {values.acceptedTerms && (
              <Check size={17} color={colors.white} strokeWidth={3} />
            )}
          </View>
          <Text style={[s.text, socialStyles.termsText]}>
            J’accepte les conditions d’utilisation et j’ai pris connaissance de
            la politique de confidentialité.
          </Text>
        </Pressable>
        <View style={socialStyles.legalLinks}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => router.push("/cgu")}
          >
            <Text style={[socialStyles.legalLink, { color: colors.blue }]}>
              Conditions d’utilisation
            </Text>
          </Pressable>
          <Text style={[s.small, { color: colors.muted }]}>•</Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => router.push("/politique-confidentialite")}
          >
            <Text style={[socialStyles.legalLink, { color: colors.blue }]}>
              Politique de confidentialité
            </Text>
          </Pressable>
        </View>
      </>
      {!!error && (
        <Text accessibilityRole="alert" style={s.text}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Terminer mon inscription"
        accessibilityState={{ disabled: loading || busy, busy }}
        aria-disabled={loading || busy}
        aria-busy={busy}
        disabled={loading || busy}
        onPress={() => void complete()}
        style={({ pressed }) => [
          socialStyles.finishCta,
          {
            backgroundColor: colors.blue,
            opacity: loading || busy ? 0.55 : pressed ? 0.86 : 1,
          },
        ]}
      >
        {busy ? (
          <Text style={socialStyles.finishTitle}>Finalisation...</Text>
        ) : (
          <>
            <Text style={socialStyles.finishTitle}>
              ⚽ Terminer mon inscription
            </Text>
            <Text style={socialStyles.finishSubtitle}>
              Accéder aux Shorts et commencer sur FootNation
            </Text>
          </>
        )}
      </Pressable>
      <Button
        title="Retour"
        secondary
        disabled={busy}
        onPress={() =>
          setStep(values.accountType === "personal" ? "profile" : "account")
        }
      />
      <Button
        title="Obtenir de l’aide"
        secondary
        disabled={busy}
        onPress={() => router.push("/help")}
      />
      <Button
        title="Supprimer mon compte"
        secondary
        disabled={busy}
        onPress={() => router.push("/suppression-compte")}
      />
      <Button
        title="Se déconnecter"
        secondary
        disabled={busy}
        onPress={() => {
          void supabase.auth.signOut({ scope: "local" }).then((result) => {
            if (result.error) setError("La déconnexion a échoué. Réessayez.");
            else router.replace("/login");
          });
        }}
      />
    </Screen>
  );
}

const socialStyles = StyleSheet.create({
  center: { textAlign: "center" },
  completionHero: {
    borderWidth: 2,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 8,
  },
  heroBadge: {
    alignSelf: "flex-start",
    fontFamily: "Inter-Bold",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  heroTitle: { fontSize: 27 },
  heroText: { lineHeight: 25 },
  avatarBlock: {
    alignItems: "center",
    gap: 10,
  },
  avatarButton: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    fontSize: 44,
    fontWeight: "800",
    lineHeight: 50,
  },
  termsCard: {
    minHeight: 68,
    borderWidth: 2,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  termsCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  termsText: { flex: 1, fontWeight: "700" },
  legalLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 4,
  },
  legalLink: {
    fontFamily: "Inter-Bold",
    fontSize: 14,
    fontWeight: "800",
  },
  finishCta: {
    minHeight: 96,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 18,
    shadowColor: "#0064D8",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.26,
    shadowRadius: 22,
    elevation: 8,
  },
  finishTitle: {
    color: "#FFFFFF",
    fontFamily: "Inter-Bold",
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
  },
  finishSubtitle: {
    color: "rgba(255,255,255,0.84)",
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 7,
    textAlign: "center",
  },
  optionCard: {
    minHeight: 138,
    borderWidth: 2,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  optionIcon: { fontSize: 40, width: 54, textAlign: "center" },
  optionTitle: { fontSize: 23 },
  checkDot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
