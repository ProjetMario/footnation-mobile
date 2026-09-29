import { authEntryPath, authCallbackPath } from "../lib/authReturn";
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, Check } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as AuthSession from "expo-auth-session";
import { useMutation } from "@tanstack/react-query";
import { supabase, requireBackend } from "../lib/supabase";
import { uploadPhoto } from "../lib/media";
import { strongPassword, validEmail } from "../lib/validation";
import { Button, Field, Screen, useUIStyles } from "../components/ui";
import { useTheme } from "../theme";
import { normalizeReferral } from "../lib/referral";
import { useAuth } from "../lib/auth";
import { BirthdateField } from "../components/BirthdateField";
import { latestAllowedBirthdate } from "../lib/calendarDate";
import { signupBirthdateError } from "../lib/memberAccess";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import { socialAuthAttempts } from "../lib/socialAuthAttempt";
type AccountType = "personal" | "club" | "business" | "institution";
type SignupStep = "credentials" | "account" | "profile" | "identity";

type ProfileOption = {
  value: string;
  label: string;
  profileType: string;
  icon: string;
  requiresVerification: boolean;
  description: string;
};

const accountOptions: {
  value: AccountType;
  icon: string;
  label: string;
  description: string;
  role: string;
}[] = [
  {
    value: "personal",
    icon: "👤",
    label: "Pour moi",
    description: "Profil personnel (joueur, fan, entraîneur...)",
    role: "Membre FootNation",
  },
  {
    value: "club",
    icon: "🏟️",
    label: "Club de football",
    description: "Profil officiel d'un club amateur ou pro",
    role: "Club",
  },
  {
    value: "business",
    icon: "🏢",
    label: "Entreprise / Marque",
    description: "Sponsor, équipementier, média, agence...",
    role: "Entreprise / Marque",
  },
  {
    value: "institution",
    icon: "🏛️",
    label: "Institution",
    description: "Fédération, ligue, district, association...",
    role: "Institution",
  },
];

const profileOptions: ProfileOption[] = [
  {
    value: "Joueur amateur",
    label: "Joueur amateur",
    profileType: "amateur",
    icon: "⚽",
    requiresVerification: false,
    description: "Joueur évoluant en club amateur",
  },
  {
    value: "Joueur pro",
    label: "Joueur pro",
    profileType: "pro_player",
    icon: "🏆",
    requiresVerification: true,
    description: "Joueur actuel ou ancien joueur professionnel",
  },
  {
    value: "Joueur indoor (Five)",
    label: "Joueur loisir / Five",
    profileType: "amateur",
    icon: "🎯",
    requiresVerification: false,
    description: "Joueur loisir, five ou indoor",
  },
  {
    value: "Joueur futsal",
    label: "Joueur futsal",
    profileType: "amateur",
    icon: "🥅",
    requiresVerification: false,
    description: "Pratiquant de futsal",
  },
  {
    value: "Joueur corpo",
    label: "Joueur corpo",
    profileType: "amateur",
    icon: "🏢",
    requiresVerification: false,
    description: "Joueur en compétition corporate/entreprise",
  },
  {
    value: "Supporter & fan",
    label: "Supporter & fan",
    profileType: "amateur",
    icon: "📣",
    requiresVerification: false,
    description: "Fan, supporter ou passionné de football",
  },
  {
    value: "Entraîneur pro",
    label: "Entraîneur pro",
    profileType: "pro_coach",
    icon: "📋",
    requiresVerification: true,
    description: "Entraîneur de club professionnel ou sélectionneur",
  },
  {
    value: "Entraîneur",
    label: "Entraîneur amateur / Éducateur",
    profileType: "amateur",
    icon: "🧑‍🏫",
    requiresVerification: false,
    description: "Entraîneur ou éducateur amateur",
  },
  {
    value: "Bénévole",
    label: "Bénévole",
    profileType: "amateur",
    icon: "🙌",
    requiresVerification: false,
    description: "Bénévole au sein d'un club",
  },
  {
    value: "Dirigeant",
    label: "Dirigeant / Président",
    profileType: "director",
    icon: "👔",
    requiresVerification: true,
    description: "Dirigeant ou président de club",
  },
  {
    value: "Arbitre",
    label: "Arbitre",
    profileType: "amateur",
    icon: "🟨",
    requiresVerification: false,
    description: "Arbitre de football",
  },
  {
    value: "Agent",
    label: "Agent / Recruteur",
    profileType: "agent",
    icon: "🤝",
    requiresVerification: true,
    description: "Agent de joueurs ou recruteur professionnel",
  },
  {
    value: "Journaliste",
    label: "Journaliste / Commentateur",
    profileType: "journalist",
    icon: "🎙️",
    requiresVerification: true,
    description: "Journaliste sportif ou commentateur",
  },
  {
    value: "Influenceur",
    label: "Influenceur football",
    profileType: "influencer",
    icon: "📱",
    requiresVerification: true,
    description: "Créateur de contenu football avec audience",
  },
  {
    value: "Investisseur",
    label: "Investisseur",
    profileType: "investor",
    icon: "💰",
    requiresVerification: true,
    description: "Investisseur dans le football",
  },
  {
    value: "Parent",
    label: "Parent",
    profileType: "amateur",
    icon: "👨‍👩‍👧",
    requiresVerification: false,
    description: "Parent d'un joueur ou joueuse",
  },
  {
    value: "Autre",
    label: "Autre profil public",
    profileType: "other",
    icon: "🎯",
    requiresVerification: true,
    description: "Autre personnalité publique du football",
  },
];

function normalizedUsername(value: string) {
  return value.replace(/^@+/, "").trim();
}

export default function Signup() {
  const { colors } = useTheme();
  const s = useUIStyles();

  const { requestNetworkInvite, session } = useAuth();
  const params = useLocalSearchParams<{
    ref?: string;
    next?: string;
    teamInvite?: string;
  }>();
  const next = authEntryPath(params);
  const pending = useRef(false);
  const lastNameRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const referralRef = useRef<TextInput>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [referral, setReferral] = useState(normalizeReferral(params.ref) || "");
  const [showReferral, setShowReferral] = useState(
    Boolean(normalizeReferral(params.ref)),
  );
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [accept, setAccept] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credentialError, setCredentialError] = useState("");
  const [checkingCredentials, setCheckingCredentials] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);
  const [confirmationFeedback, setConfirmationFeedback] = useState("");
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [birthdate, setBirthdate] = useState(latestAllowedBirthdate());
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [profileOption, setProfileOption] = useState<ProfileOption>(
    profileOptions[0],
  );
  const [avatarAsset, setAvatarAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [avatarWarning, setAvatarWarning] = useState("");
  const [step, setStep] = useState<SignupStep>("credentials");
  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
  };
  function signupRedirectTo() {
    return AuthSession.makeRedirectUri({
      scheme: "com.footnation.app",
      path: "auth/callback",
      queryParams: { invite: "1", ...(next ? { next } : {}) },
    });
  }
  async function resendConfirmationEmail() {
    if (resendingConfirmation || !validEmail(email)) return;
    setConfirmationFeedback("");
    setResendingConfirmation(true);
    try {
      requireBackend();
      await socialAuthAttempts.beginEmail();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: signupRedirectTo() },
      });
      if (error) throw error;
      setConfirmationFeedback(
        "E-mail renvoyé. Ouvrez le lien reçu pour confirmer votre compte.",
      );
    } catch (e) {
      setConfirmationFeedback(
        e instanceof Error
          ? e.message
          : "Impossible de renvoyer l’e-mail pour le moment.",
      );
    } finally {
      setResendingConfirmation(false);
    }
  }
  async function continueFromCredentials() {
    if (
      checkingCredentials ||
      socialBusy ||
      !accept ||
      !strongPassword(password) ||
      !validEmail(email) ||
      (!!referral.trim() && !normalizeReferral(referral))
    )
      return;
    setCredentialError("");
    setCheckingCredentials(true);
    try {
      requireBackend();
      await socialAuthAttempts.beginEmail();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (data.session) {
        const current = await supabase.auth.getSession();
        if (current.error) throw current.error;
        if (current.data.session?.user.id !== data.session.user.id) return;
        if (next !== "/suppression-compte") requestNetworkInvite(data.session);
        router.replace(next || "/");
        return;
      }
      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes("email not confirmed")) {
          setCredentialError(
            "Ce compte existe déjà. Confirmez votre e-mail, puis connectez-vous.",
          );
          return;
        }
        if (!message.includes("invalid login credentials")) {
          setCredentialError(
            error.message || "Impossible de vérifier le compte pour le moment.",
          );
          return;
        }
      }
      setStep("account");
    } catch (e) {
      setCredentialError(
        e instanceof Error
          ? e.message
          : "Impossible de vérifier le compte pour le moment.",
      );
    } finally {
      setCheckingCredentials(false);
    }
  }
  async function pickAvatar() {
    try {
      setAvatarWarning("");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!result.canceled) setAvatarAsset(result.assets[0]);
    } catch {
      setAvatarWarning("Impossible d’ouvrir la photothèque.");
    }
  }
  const signup = useMutation({
    mutationFn: async () => {
      pending.current = true;
      try {
        requireBackend();
        const dateError = signupBirthdateError(birthdate);
        if (dateError) throw new Error(dateError);
        if (
          !accept ||
          !firstName.trim() ||
          !lastName.trim() ||
          !normalizedUsername(username) ||
          !strongPassword(password) ||
          !validEmail(email) ||
          (referral.trim() && !normalizeReferral(referral))
        )
          throw new Error("Vérifiez les informations du formulaire.");
        await socialAuthAttempts.beginEmail();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: signupRedirectTo(),
            data: {
              cgu_accepted: true,
              cgu_version: "1.0",
              birthdate,
              account_type: accountType,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              username: normalizedUsername(username),
              full_name: `${firstName.trim()} ${lastName.trim()}`,
              primary_role:
                accountType === "personal" ? profileOption.value : undefined,
              profile_type:
                accountType === "personal"
                  ? profileOption.profileType
                  : undefined,
              ...(normalizeReferral(referral)
                ? { referrer_id: normalizeReferral(referral) }
                : {}),
            },
          },
        });
        if (error) {
          const message = error.message.toLowerCase();
          if (
            message.includes("already registered") ||
            message.includes("already exists") ||
            message.includes("user already")
          )
            throw new Error(
              "Ce compte existe déjà. Connectez-vous avec cet e-mail ou utilisez mot de passe oublié.",
            );
          throw error;
        }
        if (data.session) {
          const current = await supabase.auth.getSession();
          if (current.error) throw current.error;
          if (current.data.session?.user.id !== data.session.user.id) return;
          if (avatarAsset) {
            try {
              const uploaded = await uploadPhoto(
                avatarAsset,
                "avatars",
                data.session.user.id,
              );
              await supabase.auth.updateUser({
                data: { avatar_url: uploaded.url },
              });
              await supabase
                .from("profiles")
                .update({ avatar_url: uploaded.url })
                .eq("id", data.session.user.id);
            } catch {
              setAvatarWarning(
                "Le compte est créé. La photo pourra être ajoutée depuis le profil.",
              );
            }
          }
          if (next !== "/suppression-compte")
            requestNetworkInvite(data.session);
          router.replace(
            authCallbackPath(false, !!normalizeReferral(referral), next),
          );
        } else {
          setEmailConfirmationSent(true);
          setConfirmationFeedback(
            "Nous venons d’envoyer un lien de confirmation. Ouvrez votre boîte mail pour activer le compte.",
          );
        }
      } finally {
        pending.current = false;
      }
    },
  });
  if (emailConfirmationSent)
    return (
      <Screen title="Confirmer mon e-mail">
        <View style={signupStyles.header}>
          <Text
            accessibilityRole="header"
            style={[s.title, signupStyles.title]}
          >
            Vérifiez votre e-mail
          </Text>
        </View>
        <View style={[s.card, { alignItems: "center" }]}>
          <Text style={signupStyles.confirmationIcon}>✉️</Text>
          <Text style={[s.h2, signupStyles.center]}>
            Confirmez votre inscription
          </Text>
          <Text style={[s.text, signupStyles.center]}>
            Nous avons envoyé un lien à{" "}
            <Text style={signupStyles.confirmationEmail}>{email.trim()}</Text>.
            Ouvrez ce lien pour activer votre compte FootNation.
          </Text>
          <Text style={[s.small, signupStyles.center]}>
            Si vous ne voyez rien, vérifiez aussi vos spams ou courriers
            indésirables.
          </Text>
        </View>
        {confirmationFeedback ? (
          <Text style={signupStyles.feedbackText}>{confirmationFeedback}</Text>
        ) : null}
        <Button
          title="Renvoyer l’e-mail"
          secondary
          busy={resendingConfirmation}
          disabled={resendingConfirmation}
          onPress={() => void resendConfirmationEmail()}
        />
        <Button
          title="J’ai confirmé, me connecter"
          onPress={() =>
            router.replace({
              pathname: "/login",
              params: next ? { next } : {},
            })
          }
        />
      </Screen>
    );
  if (session && next?.startsWith("/member/invitations"))
    return (
      <Screen title="Invitation d’équipe">
        <Text style={s.subtitle}>
          Votre compte est connecté. Retrouvez l’invitation de votre coach pour
          rejoindre son équipe.
        </Text>
        <Button
          title="Ouvrir mon invitation d’équipe"
          onPress={() => router.replace(next)}
        />
      </Screen>
    );
  if (step === "credentials")
    return (
      <Screen title="Créer mon profil gratuitement">
        <View style={signupStyles.header}>
          <Text
            accessibilityRole="header"
            style={[s.title, signupStyles.title]}
          >
            Créez votre compte FootNation
          </Text>
          <View
            accessible
            accessibilityLabel="Étape 1 sur 4"
            style={signupStyles.progressRow}
          >
            <View style={[signupStyles.progressDot, signupStyles.progressOn]} />
            {[1, 2, 3].map((dot) => (
              <View
                key={dot}
                style={[
                  signupStyles.progressDot,
                  { backgroundColor: colors.surfaceRaised },
                ]}
              />
            ))}
          </View>
        </View>

        <View style={signupStyles.intro}>
          <Text style={[s.h2, signupStyles.center]}>
            Commencez votre inscription
          </Text>
        </View>

        <SocialAuthButtons
          next={next}
          referral={referral}
          intent="signup"
          disabled={checkingCredentials || signup.isPending}
          onBusyChange={setSocialBusy}
        />
        <Field
          label="Adresse e-mail"
          inputRef={emailRef}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!signup.isPending && !socialBusy}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        {!!(email.trim() && !validEmail(email)) && (
          <Text style={signupStyles.errorText}>
            Entrez une adresse e-mail complète, par exemple nom@gmail.com.
          </Text>
        )}
        <View>
          <Text style={s.label}>Mot de passe</Text>
          <View
            style={[
              s.input,
              signupStyles.passwordInputRow,
              signup.isPending && { opacity: 0.55 },
            ]}
          >
            <TextInput
              ref={passwordRef}
              accessibilityLabel="Mot de passe"
              accessibilityHint="Au moins 8 caractères avec majuscules, minuscules et chiffres."
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!signup.isPending && !socialBusy}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => referralRef.current?.focus()}
              style={signupStyles.passwordInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                showPassword
                  ? "Masquer le mot de passe"
                  : "Afficher le mot de passe"
              }
              accessibilityState={{ disabled: signup.isPending || socialBusy }}
              disabled={signup.isPending || socialBusy}
              onPress={() => setShowPassword((visible) => !visible)}
              style={({ pressed }) => [
                signupStyles.passwordToggle,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text
                style={[
                  signupStyles.passwordToggleText,
                  { color: colors.blue },
                ]}
              >
                {showPassword ? "Masquer" : "Voir"}
              </Text>
            </Pressable>
          </View>
        </View>
        <View
          accessible
          accessibilityLabel={`Mot de passe : ${
            passwordChecks.length
              ? "8 caractères validés"
              : "8 caractères requis"
          }, ${
            passwordChecks.upper ? "majuscule validée" : "majuscule requise"
          }, ${
            passwordChecks.lower ? "minuscule validée" : "minuscule requise"
          }, ${passwordChecks.number ? "chiffre validé" : "chiffre requis"}`}
          style={signupStyles.passwordRules}
        >
          {[
            ["8 caractères minimum", passwordChecks.length],
            ["1 majuscule", passwordChecks.upper],
            ["1 minuscule", passwordChecks.lower],
            ["1 chiffre", passwordChecks.number],
          ].map(([label, valid]) => (
            <Text
              key={String(label)}
              style={[
                signupStyles.passwordRule,
                { color: valid ? "#047857" : colors.muted },
              ]}
            >
              {valid ? "✓" : "○"} {label}
            </Text>
          ))}
        </View>
        {showReferral ? (
          <View style={signupStyles.referralBox}>
            <Field
              label="Code de parrainage"
              inputRef={referralRef}
              value={referral}
              onChangeText={setReferral}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!signup.isPending && !socialBusy}
              returnKeyType="done"
              maxLength={36}
            />
            {!!(!!referral.trim() && !normalizeReferral(referral)) && (
              <Text style={s.small}>
                Le code doit contenir 6 lettres ou chiffres, ou l’identifiant du
                parrain.
              </Text>
            )}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter un code de parrainage facultatif"
            onPress={() => setShowReferral(true)}
            style={({ pressed }) => [
              signupStyles.referralLink,
              { opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={[s.small, { color: colors.blue }]}>
              J’ai un code de parrainage
            </Text>
          </Pressable>
        )}
        <View style={[s.row, { alignItems: "flex-start" }]}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="J’accepte les Conditions Générales d’Utilisation."
            accessibilityState={{
              checked: accept,
              disabled: signup.isPending || socialBusy,
            }}
            disabled={signup.isPending || socialBusy}
            onPress={() => setAccept(!accept)}
            style={{
              minWidth: 44,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                flexShrink: 0,
                borderWidth: 2,
                borderRadius: 6,
                borderColor: colors.blue,
                backgroundColor: accept ? "#0064D8" : colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {!!accept && (
                <Check size={17} color={colors.white} strokeWidth={3} />
              )}
            </View>
          </Pressable>
          <View style={{ flex: 1, paddingTop: 12 }}>
            <Text style={s.text}>J’accepte les</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/documents/legal")}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text
                style={[
                  s.text,
                  signupStyles.inlineLink,
                  { color: colors.blue },
                ]}
              >
                Conditions Générales d’Utilisation
              </Text>
            </Pressable>
          </View>
        </View>
        {credentialError ? (
          <Text style={signupStyles.errorText}>{credentialError}</Text>
        ) : null}
        <Button
          title="Continuer"
          onPress={() => void continueFromCredentials()}
          busy={checkingCredentials}
          disabled={
            checkingCredentials ||
            socialBusy ||
            !accept ||
            !strongPassword(password) ||
            !validEmail(email) ||
            (!!referral.trim() && !normalizeReferral(referral))
          }
        />
        <Button
          title="J’ai déjà un compte"
          secondary
          disabled={socialBusy || checkingCredentials}
          onPress={() =>
            router.replace({
              pathname: "/login",
              params: {
                ...(next ? { next } : {}),
                ...(normalizeReferral(referral)
                  ? { ref: normalizeReferral(referral)! }
                  : {}),
              },
            })
          }
        />
      </Screen>
    );
  if (step === "account")
    return (
      <Screen title="Créer mon profil gratuitement">
        <View style={signupStyles.header}>
          <Text
            accessibilityRole="header"
            style={[s.title, signupStyles.title]}
          >
            Configurez votre profil FootNation
          </Text>
          <View
            accessible
            accessibilityLabel="Étape 2 sur 4"
            style={signupStyles.progressRow}
          >
            <View style={[signupStyles.progressDot, signupStyles.progressOn]} />
            <View style={[signupStyles.progressDot, signupStyles.progressOn]} />
            <View
              style={[
                signupStyles.progressDot,
                { backgroundColor: colors.surfaceRaised },
              ]}
            />
            <View
              style={[
                signupStyles.progressDot,
                { backgroundColor: colors.surfaceRaised },
              ]}
            />
          </View>
        </View>

        <View style={signupStyles.intro}>
          <Text style={[s.h2, signupStyles.center]}>
            Pour qui créez-vous ce profil ?
          </Text>
          <Text style={[s.subtitle, signupStyles.center]}>
            Choisissez le type de compte que vous souhaitez créer.
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          {accountOptions.map((option) => {
            const selected = accountType === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={`${option.label}. ${option.description}`}
                accessibilityState={{ selected }}
                onPress={() => {
                  setAccountType(option.value);
                  setStep(option.value === "personal" ? "profile" : "identity");
                }}
                style={({ pressed }) => [
                  signupStyles.optionCard,
                  {
                    backgroundColor: selected
                      ? colors.accentSoft
                      : colors.surface,
                    borderColor: selected ? colors.blue : colors.border,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text
                  accessible={false}
                  allowFontScaling={false}
                  style={signupStyles.optionIcon}
                >
                  {option.icon}
                </Text>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[s.h2, signupStyles.optionTitle]}>
                    {option.label}
                  </Text>
                  <Text style={s.subtitle}>{option.description}</Text>
                </View>
                {!!selected && (
                  <View
                    accessible={false}
                    style={[
                      signupStyles.checkDot,
                      { backgroundColor: colors.blue },
                    ]}
                  >
                    <Check size={16} color={colors.white} strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Button
          title="Retour"
          secondary
          onPress={() => setStep("credentials")}
        />
        <Button
          title="J’ai déjà un compte"
          secondary
          onPress={() =>
            router.replace({
              pathname: "/login",
              params: {
                ...(next ? { next } : {}),
                ...(normalizeReferral(referral)
                  ? { ref: normalizeReferral(referral)! }
                  : {}),
              },
            })
          }
        />
      </Screen>
    );
  if (step === "profile")
    return (
      <Screen title="Créer mon profil gratuitement">
        <View style={signupStyles.header}>
          <Text
            accessibilityRole="header"
            style={[s.title, signupStyles.title]}
          >
            Configurez votre profil FootNation
          </Text>
          <View
            accessible
            accessibilityLabel="Étape 3 sur 4"
            style={signupStyles.progressRow}
          >
            <View style={[signupStyles.progressDot, signupStyles.progressOn]} />
            <View style={[signupStyles.progressDot, signupStyles.progressOn]} />
            <View style={[signupStyles.progressDot, signupStyles.progressOn]} />
            <View
              style={[
                signupStyles.progressDot,
                { backgroundColor: colors.surfaceRaised },
              ]}
            />
          </View>
        </View>

        <View style={signupStyles.intro}>
          <Text style={[s.h2, signupStyles.center]}>
            Quel profil vous correspond ?
          </Text>
          <Text style={[s.subtitle, signupStyles.center]}>
            Choisissez parmi les 17 profils. Les personnalités publiques
            pourront demander une vérification.
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          {profileOptions.map((option) => {
            const selected = profileOption.value === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={`${option.label}. ${option.description}${
                  option.requiresVerification
                    ? ". Badge vérifié disponible"
                    : ""
                }`}
                accessibilityState={{ selected }}
                onPress={() => {
                  setProfileOption(option);
                  setStep("identity");
                }}
                style={({ pressed }) => [
                  signupStyles.optionCard,
                  {
                    backgroundColor: selected
                      ? colors.accentSoft
                      : colors.surface,
                    borderColor: selected ? colors.blue : colors.border,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text
                  accessible={false}
                  allowFontScaling={false}
                  style={signupStyles.optionIcon}
                >
                  {option.icon}
                </Text>
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={signupStyles.optionHeader}>
                    <Text style={[s.h2, signupStyles.optionTitle]}>
                      {option.label}
                    </Text>
                    {!!option.requiresVerification && (
                      <View
                        accessible={false}
                        style={[
                          signupStyles.verifyBadge,
                          { backgroundColor: colors.accentSoft },
                        ]}
                      >
                        <Text
                          style={[
                            s.small,
                            signupStyles.verifyBadgeText,
                            { color: colors.blue },
                          ]}
                        >
                          ✓ Badge vérifié disponible
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.subtitle}>{option.description}</Text>
                </View>
                {!!selected && (
                  <View
                    accessible={false}
                    style={[
                      signupStyles.checkDot,
                      { backgroundColor: colors.blue },
                    ]}
                  >
                    <Check size={16} color={colors.white} strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Button title="Retour" secondary onPress={() => setStep("account")} />
      </Screen>
    );
  return (
    <Screen title="Créer mon profil gratuitement">
      <View style={signupStyles.header}>
        <Text accessibilityRole="header" style={[s.title, signupStyles.title]}>
          Configurez votre profil FootNation
        </Text>
        <View
          accessible
          accessibilityLabel="Étape 4 sur 4"
          style={signupStyles.progressRow}
        >
          <View style={[signupStyles.progressDot, signupStyles.progressOn]} />
          <View style={[signupStyles.progressDot, signupStyles.progressOn]} />
          <View style={[signupStyles.progressDot, signupStyles.progressOn]} />
          <View style={[signupStyles.progressDot, signupStyles.progressOn]} />
        </View>
      </View>
      <Button
        title="Modifier mon profil"
        secondary
        onPress={() =>
          setStep(accountType === "personal" ? "profile" : "account")
        }
      />
      <Text accessibilityRole="header" style={s.title}>
        Rejoignez les amoureux du FOOT !
      </Text>
      <View style={signupStyles.avatarBlock}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="Photo de profil"
          style={[
            signupStyles.avatarPreview,
            { borderColor: colors.blue, backgroundColor: colors.accentSoft },
          ]}
        >
          {avatarAsset?.uri ? (
            <Image
              source={{ uri: avatarAsset.uri }}
              style={signupStyles.avatarImage}
              contentFit="cover"
            />
          ) : (
            <Text
              accessible={false}
              allowFontScaling={false}
              style={[signupStyles.avatarFallback, { color: colors.blue }]}
            >
              👤
            </Text>
          )}
          <View
            accessible={false}
            style={[
              signupStyles.avatarCamera,
              { backgroundColor: colors.blue, borderColor: colors.surface },
            ]}
          >
            <Camera size={18} color={colors.white} strokeWidth={2.5} />
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text style={s.h2}>Photo de profil</Text>
          <Text style={s.subtitle}>
            Ajoutez une photo pour être reconnu plus facilement par les clubs et
            votre réseau.
          </Text>
          <Button
            title={avatarAsset ? "Changer la photo" : "Ajouter une photo"}
            secondary
            onPress={pickAvatar}
          />
          {!!avatarWarning && (
            <Text
              accessibilityRole="alert"
              style={[s.small, { color: colors.danger }]}
            >
              {avatarWarning}
            </Text>
          )}
        </View>
      </View>
      <Field
        label="Prénom"
        value={firstName}
        onChangeText={setFirstName}
        autoComplete="given-name"
        autoCorrect={false}
        editable={!signup.isPending}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => lastNameRef.current?.focus()}
      />
      <Field
        label="Nom"
        inputRef={lastNameRef}
        value={lastName}
        onChangeText={setLastName}
        autoComplete="family-name"
        autoCorrect={false}
        editable={!signup.isPending}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => usernameRef.current?.focus()}
      />
      <Field
        label="Nom d’utilisateur"
        inputRef={usernameRef}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoComplete="username"
        autoCorrect={false}
        editable={!signup.isPending}
        returnKeyType="next"
      />
      <BirthdateField
        value={birthdate}
        onChange={setBirthdate}
        disabled={signup.isPending}
      />
      <Text style={s.small}>FootNation est accessible dès 13 ans.</Text>
      {!!(birthdate.length === 10 && signupBirthdateError(birthdate)) && (
        <Text
          accessibilityRole="alert"
          style={[s.small, { color: colors.danger }]}
        >
          {signupBirthdateError(birthdate)}
        </Text>
      )}
      {!!signup.isError && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ color: colors.danger }}
        >
          {signup.error.message}
        </Text>
      )}
      {signup.isSuccess ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={s.text}
        >
          Vérifiez votre boîte e-mail pour confirmer votre inscription.
        </Text>
      ) : (
        <Button
          title="Créer mon compte"
          onPress={() => {
            if (!pending.current) {
              pending.current = true;
              signup.mutate();
            }
          }}
          busy={signup.isPending}
          disabled={
            !!signupBirthdateError(birthdate) ||
            !firstName.trim() ||
            !lastName.trim() ||
            !normalizedUsername(username) ||
            !accept ||
            !strongPassword(password) ||
            !validEmail(email) ||
            (!!referral.trim() && !normalizeReferral(referral))
          }
        />
      )}
      <Button
        title="J’ai déjà un compte"
        secondary
        onPress={() =>
          router.replace({
            pathname: "/login",
            params: {
              ...(next ? { next } : {}),
              ...(normalizeReferral(referral)
                ? { ref: normalizeReferral(referral)! }
                : {}),
            },
          })
        }
      />
    </Screen>
  );
}

const signupStyles = StyleSheet.create({
  header: {
    alignItems: "center",
    gap: 18,
  },
  title: {
    textAlign: "center",
    maxWidth: 360,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  progressDot: {
    width: 56,
    height: 10,
    borderRadius: 999,
  },
  progressOn: {
    backgroundColor: "#087CFF",
  },
  intro: {
    alignItems: "center",
    gap: 8,
  },
  center: {
    textAlign: "center",
  },
  passwordInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 0,
  },
  passwordInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    fontFamily: "Inter-Regular",
    fontSize: 16,
    color: "#101828",
  },
  passwordToggle: {
    minWidth: 64,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  passwordToggleText: {
    fontFamily: "Inter-Bold",
    fontSize: 14,
    fontWeight: "900",
  },
  passwordRules: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 6,
  },
  passwordRule: {
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  inlineLink: {
    fontFamily: "Inter-Bold",
    fontWeight: "900",
    textDecorationLine: "underline",
  },
  referralLink: {
    alignSelf: "flex-start",
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  referralBox: {
    gap: 8,
    opacity: 0.82,
  },
  errorText: {
    textAlign: "center",
    color: "#DC2626",
    fontFamily: "Inter-Bold",
    fontSize: 14,
    lineHeight: 20,
  },
  feedbackText: {
    textAlign: "center",
    color: "#475569",
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    lineHeight: 21,
  },
  confirmationIcon: {
    fontSize: 42,
    lineHeight: 48,
  },
  confirmationEmail: {
    fontFamily: "Inter-Bold",
    fontWeight: "900",
  },
  avatarBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5EAF0",
  },
  avatarPreview: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 98,
    height: 98,
    borderRadius: 49,
  },
  avatarFallback: {
    fontSize: 44,
  },
  avatarCamera: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  optionCard: {
    minHeight: 104,
    borderWidth: 2,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  optionIcon: {
    width: 42,
    textAlign: "center",
    fontSize: 28,
  },
  optionTitle: {
    fontSize: 20,
    lineHeight: 25,
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  verifyBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 220,
  },
  verifyBadgeText: {
    fontWeight: "700",
  },
  checkDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
