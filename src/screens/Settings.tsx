import {
  profileSnapshotRequest,
  saveProfileSnapshot,
} from "../lib/profileSave";
import { websiteUrl } from "../lib/websiteUrl";
import { notifyClubChange } from "../lib/notificationEvents";
import { displayName } from "../lib/models";
import { validEmail } from "../lib/validation";
import { latestAllowedBirthdate, validBirthdate } from "../lib/calendarDate";
import { ProfileAutocompleteField } from "../components/ProfileAutocompleteField";
import { BirthdateField } from "../components/BirthdateField";
import { countryOptions, proClubOptions } from "../lib/profileSelectionOptions";
import { ChoiceField } from "../components/ChoiceField";
import { roleOptions, departmentOptions } from "../lib/networkOptions";
import {
  genderOptions,
  levelOptions,
  businessSectorOptions,
  institutionTypeOptions,
  institutionLevelOptions,
  positionOptions,
  competenceSuggestions,
} from "../lib/profileOptions";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { authReturnPath } from "../lib/authReturn";
import { profilePrefill } from "../lib/profilePrefill";
import {
  Bell,
  Camera,
  FileText,
  Lock,
  LogOut,
  Settings as SettingsIcon,
  UserRound,
  Upload,
} from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { signOutCurrentDevice } from "../lib/logout";
import { uploadPhoto } from "../lib/media";
import {
  Avatar,
  Button,
  Chip,
  ErrorState,
  Field,
  Screen,
  useUIStyles,
} from "../components/ui";
import { AuthGate } from "../components/AuthGate";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
const choices: Record<string, { value: string; label: string }[]> = {
  primary_role: roleOptions,
  favorite_pro_club: proClubOptions,
  position: positionOptions,
  country: countryOptions,
  nationality: countryOptions,
  department: departmentOptions,
  gender: genderOptions,
  highest_level: levelOptions.map((value) => ({ value, label: value })),
  business_sector: businessSectorOptions,
  institution_type: institutionTypeOptions,
  institution_level: institutionLevelOptions,
};
const common = [
  ["username", "Nom d’utilisateur"],
  ["bio", "À propos"],
  ["city", "Ville"],
  ["department", "Département"],
  ["country", "Pays de résidence"],
  ["nationality", "Nationalité"],
];
const personal = [
  ["first_name", "Prénom"],
  ["last_name", "Nom"],
  ["primary_role", "Rôle dans le football"],
  ["position", "Poste"],
  ["club", "Club actuel"],
  ["highest_level", "Plus haut niveau"],
  ["gender", "Genre"],
  ["birthdate", "Date de naissance (AAAA-MM-JJ)"],
  ["favorite_pro_club", "Club professionnel favori"],
  ["favorite_amateur_club", "Club amateur favori"],
  ["height", "Taille"],
  ["weight", "Poids"],
  ["strong_foot", "Pied fort"],
  ["technical_skills", "Qualités techniques"],
  ["characteristics", "Points forts"],
];
const organizations: Record<string, string[][]> = {
  club: [
    ["club_official_name", "Nom officiel du club"],
    ["club_year_founded", "Année de création"],
    ["club_colors", "Couleurs du club"],
    ["club_website", "Site internet"],
    ["club_phone", "Téléphone"],
    ["club_address", "Adresse"],
  ],
  business: [
    ["business_name", "Nom de l’entreprise"],
    ["business_sector", "Secteur d’activité"],
    ["business_description", "Présentation de l’entreprise"],
    ["business_website", "Site internet"],
    ["business_email", "Email professionnel"],
    ["business_phone", "Téléphone"],
    ["business_address", "Adresse"],
  ],
  institution: [
    ["institution_name", "Nom de l’institution"],
    ["institution_type", "Type d’institution"],
    ["institution_level", "Niveau"],
    ["institution_description", "Présentation de l’institution"],
    ["institution_email", "Email"],
    ["institution_phone", "Téléphone"],
    ["institution_address", "Adresse"],
  ],
};
function sessionAccountType(value: unknown) {
  switch (value) {
    case "club":
    case "business":
    case "institution":
      return value;
    default:
      return "personal";
  }
}
export default function Settings() {
  const { session } = useAuth();
  return (
    <Screen title="Votre profil">
      <ProfileEditor key={session?.user.id || "guest"} />
    </Screen>
  );
}
function ProfileEditor() {
  const params = useLocalSearchParams<{ next?: string; section?: string }>();
  const returnTo = authReturnPath(params.next);
  const { colors } = useTheme();
  const styles = useThemedStyles(createSettingsStyles);
  const s = useUIStyles();
  const {
    session,
    profile,
    reload,
    loading,
    error: authError,
    networkInviteRequest,
  } = useAuth();
  const cache = useQueryClient();
  const initialized = useRef(false);
  const [baseline, setBaseline] = useState<Record<string, unknown> | null>(
    () => profile as unknown as Record<string, unknown> | null,
  );
  const uploaded = useRef<{
    asset: ImagePicker.ImagePickerAsset;
    upload: Awaited<ReturnType<typeof uploadPhoto>>;
  } | null>(null);
  const [confirmReload, setConfirmReload] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({}),
    [account, setAccount] = useState("personal"),
    [section, setSection] = useState<
      "profile" | "account" | "content" | "notifications" | "privacy"
    >(params.section === "content" ? "content" : "profile"),
    [skills, setSkills] = useState(""),
    [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null),
    [localError, setLocalError] = useState("");
  useEffect(() => {
    if (params.section === "profile" || params.section === "content")
      setSection(params.section);
  }, [params.section]);
  useEffect(() => {
    if (!initialized.current && session && !loading && !authError) {
      initialized.current = true;
      setBaseline(profile as unknown as Record<string, unknown> | null);
    }
  }, [session, loading, authError, profile]);
  useEffect(() => {
    const p = profilePrefill(baseline, session?.user.user_metadata);
    const next: Record<string, string> = {};
    for (const [key] of [
      ...common,
      ...personal,
      ...Object.values(organizations).flat(),
    ])
      next[key] = typeof p?.[key] === "string" ? (p[key] as string) : "";
    setValues(next);
    setAccount(
      typeof p?.account_type === "string"
        ? p.account_type
        : sessionAccountType(session?.user.user_metadata?.account_type),
    );
    setSkills(Array.isArray(p?.skills) ? p.skills.join(", ") : "");
  }, [baseline, revision]);
  async function pick() {
    try {
      setLocalError("");
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!r.canceled) {
        save.reset();
        setAsset(r.assets[0]);
      }
    } catch {
      setLocalError("Impossible d’ouvrir la photothèque.");
    }
  }
  const save = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Connexion requise");
      const user = await supabase.auth.getUser();
      if (user.error) throw user.error;
      if (user.data.user?.id !== session.user.id)
        throw new Error("La session a changé.");
      if (!["personal", "club", "business", "institution"].includes(account))
        throw new Error("Choisissez un type de compte.");
      const selected =
        account === "personal" ? personal : organizations[account] || personal;
      const payload: Record<string, unknown> = {
        id: session.user.id,
        account_type: account,
        skills: skills
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      };
      for (const [key] of [...common, ...selected])
        payload[key] = values[key]?.trim() || null;
      if (
        account === "personal" &&
        (!values.first_name?.trim() ||
          !values.last_name?.trim() ||
          !values.username?.trim())
      )
        throw new Error(
          "Renseignez votre prénom, votre nom et votre nom d’utilisateur.",
        );
      if (
        account === "club" &&
        (!values.club_official_name?.trim() || !values.bio?.trim())
      )
        throw new Error(
          "Renseignez le nom officiel et la présentation du club.",
        );
      if (account === "business" && !values.business_name?.trim())
        throw new Error("Renseignez le nom de votre entreprise.");
      if (account === "institution" && !values.institution_name?.trim())
        throw new Error("Renseignez le nom de votre institution.");
      if (
        account === "personal" &&
        values.birthdate &&
        (!validBirthdate(values.birthdate.trim()) ||
          values.birthdate.trim() > latestAllowedBirthdate(new Date(), 13))
      )
        throw new Error("L’utilisateur doit avoir au moins 13 ans.");
      for (const [key] of selected) {
        const value = values[key]?.trim();
        if (value && key.endsWith("_website")) payload[key] = websiteUrl(value);
        if (value && key.endsWith("_email") && !validEmail(value))
          throw new Error("Vérifiez votre adresse e-mail professionnelle.");
      }
      payload.username =
        values.username?.replace(/^@+/, "").trim() ||
        session.user.id.slice(0, 8);
      payload.full_name =
        account === "personal"
          ? `${values.first_name.trim()} ${values.last_name.trim()}`
          : values[
              account === "club"
                ? "club_official_name"
                : account === "business"
                  ? "business_name"
                  : "institution_name"
            ]?.trim();
      if (account !== "personal")
        payload.primary_role =
          account === "club"
            ? "Club"
            : account === "business"
              ? "Entreprise / Marque"
              : "Institution";
      if (asset && uploaded.current?.asset !== asset)
        uploaded.current = {
          asset,
          upload: await uploadPhoto(asset, "avatars", session.user.id),
        };
      if (asset && uploaded.current)
        payload.avatar_url = uploaded.current.upload.url;
      const saved = await saveProfileSnapshot(
        {
          read: async () => {
            const r = await supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .maybeSingle();
            if (r.error) throw r.error;
            return r.data;
          },
          insert: async (row) => {
            const r = await supabase
              .from("profiles")
              .insert(row)
              .select("*")
              .single();
            if (r.error) throw r.error;
            return r.data;
          },
          update: async (row, original) => {
            const r = await supabase.rpc(
              "update_native_profile_snapshot",
              profileSnapshotRequest(row, original),
            );
            if (r.error) {
              if (r.error.code === "40001")
                throw new Error(
                  "Votre profil a changé ou n’est plus accessible. Rechargez le formulaire avant de réessayer.",
                );
              throw r.error;
            }
            return r.data;
          },
        },
        payload,
        baseline,
      );
      if (profile && typeof payload.club === "string")
        void notifyClubChange({
          profileId: session.user.id,
          profileName: displayName(saved),
          previousClub: typeof profile.club === "string" ? profile.club : null,
          nextClub: typeof saved.club === "string" ? saved.club : null,
        });
      setBaseline(saved);
      uploaded.current = null;
      await reload();
      await cache.invalidateQueries({ queryKey: ["profile"] });
      setAsset(null);
    },
    onSuccess: async () => {
      const current = await supabase.auth.getSession();
      if (
        !session ||
        current.error ||
        current.data.session?.user.id !== session.user.id
      )
        return;
      if (returnTo) router.replace(returnTo);
      else if (!profile || networkInviteRequest?.userId === session?.user.id)
        router.replace("/my-profile");
    },
  });
  const logout = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Connexion requise.");
      await signOutCurrentDevice(session.user.id);
    },
    onSuccess: () => router.replace("/"),
    onError: (error) =>
      setLocalError(
        error instanceof Error
          ? error.message
          : "La déconnexion a échoué. Réessayez.",
      ),
  });
  const selectedFields = [
    ...(account === "personal" ? personal : organizations[account] || personal),
    ...common,
  ];
  const basicFields = selectedFields.filter(([key]) =>
    account === "personal"
      ? [
          "first_name",
          "last_name",
          "username",
          "primary_role",
          "position",
          "club",
          "city",
          "department",
          "country",
          "nationality",
        ].includes(key)
      : [
          "username",
          "bio",
          "city",
          "department",
          "country",
          "nationality",
          ...(organizations[account] || []).map(([key]) => key),
        ].includes(key),
  );
  const contentFields = selectedFields.filter(
    ([key]) => !basicFields.some(([basicKey]) => basicKey === key),
  );
  const sectionTabs = [
    { id: "profile", label: "Profil", icon: UserRound },
    { id: "account", label: "Compte", icon: SettingsIcon },
    { id: "content", label: "Contenu", icon: FileText },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Confidentialité", icon: Lock },
  ] as const;
  const renderField = ([key, label]: string[]) =>
    key === "birthdate" ? (
      <View key={key} style={{ gap: 8 }}>
        <BirthdateField
          label="Date de naissance"
          value={values[key] || ""}
          minAge={13}
          disabled={save.isPending || reloading}
          onChange={(text) => {
            save.reset();
            setValues((v) => ({ ...v, [key]: text }));
          }}
        />
        <Text style={s.small}>
          L’utilisateur doit avoir au moins 13 ans pour accéder à FootNation.
        </Text>
      </View>
    ) : ["city", "club", "favorite_amateur_club"].includes(key) ? (
      <ProfileAutocompleteField
        key={key}
        kind={key === "city" ? "city" : "club"}
        label={label}
        value={values[key] || ""}
        country={values.country}
        disabled={save.isPending || reloading}
        onChange={(text) => {
          save.reset();
          setValues((v) => ({ ...v, [key]: text }));
        }}
        onSelect={(item) => {
          if (key === "city" && item.department)
            setValues((v) => ({ ...v, department: item.department! }));
        }}
      />
    ) : choices[key] ? (
      <ChoiceField
        key={key}
        label={label}
        value={values[key] || ""}
        options={choices[key]}
        disabled={save.isPending || reloading}
        onChange={(text) => {
          save.reset();
          setValues((v) => ({ ...v, [key]: text }));
        }}
      />
    ) : (
      <Field
        key={key}
        label={label}
        value={values[key] || ""}
        onChangeText={(text) => {
          save.reset();
          setValues((v) => ({ ...v, [key]: text }));
        }}
        editable={!save.isPending && !reloading}
        multiline={
          key === "bio" ||
          key.endsWith("description") ||
          key === "technical_skills"
        }
        maxLength={key === "bio" || key.endsWith("description") ? 3000 : 250}
        autoCapitalize={
          key.includes("email") || key.includes("website") || key === "username"
            ? "none"
            : "sentences"
        }
      />
    );
  return (
    <AuthGate allowIncomplete>
      <View style={styles.headerBlock}>
        <Text style={styles.pageTitle}>Paramètres</Text>
        <Text style={styles.profileName}>
          {profile?.full_name || "FootNation"}
        </Text>
        <Text style={styles.profileRole}>{accountLabel(account)}</Text>
      </View>

      <View style={styles.tabsWrap}>
        {sectionTabs.map(({ id, label, icon: Icon }) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: section === id }}
            onPress={() => setSection(id)}
            style={[styles.tabButton, section === id && styles.tabButtonActive]}
          >
            <Icon
              size={16}
              color={section === id ? colors.ink : colors.muted}
            />
            <Text
              style={[styles.tabLabel, section === id && styles.tabLabelActive]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {section === "profile" && (
        <>
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Camera size={24} color={colors.ink} />
              <Text style={styles.sectionTitle}>Photo de profil</Text>
            </View>
            <View style={styles.photoRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Modifier la photo"
                disabled={save.isPending || reloading}
                onPress={() => void pick()}
              >
                <Avatar
                  uri={asset?.uri || profile?.avatar_url}
                  name={profile?.full_name || ""}
                  size={104}
                />
              </Pressable>
              <View style={styles.photoCopy}>
                <Text style={styles.helperText}>
                  Choisis une photo pour ton profil.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Changer la photo de profil"
                  onPress={() => void pick()}
                  disabled={save.isPending || reloading}
                  style={({ pressed }) => [
                    styles.uploadButton,
                    {
                      opacity:
                        save.isPending || reloading ? 0.45 : pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  <Upload size={18} color={colors.blue} />
                  <Text style={styles.uploadButtonText}>Changer la photo</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Type de compte</Text>
            <View style={styles.accountTypes}>
              {[
                ["personal", "Personnel"],
                ["club", "Club"],
                ["business", "Entreprise / Marque"],
                ["institution", "Institution"],
              ].map(([value, label]) => (
                <Chip
                  key={value}
                  label={label}
                  selected={account === value}
                  disabled={save.isPending || reloading}
                  onPress={() => {
                    save.reset();
                    setAccount(value);
                  }}
                />
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Informations de base</Text>
            {basicFields.map(renderField)}
          </View>
        </>
      )}

      {section === "content" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contenu et identité football</Text>
          {contentFields.map(renderField)}
          <ChoiceField
            label="Compétences"
            value={skills}
            options={competenceSuggestions.map((value) => ({
              value,
              label: value,
            }))}
            multiple
            allowCustom
            optionalLabel="Non renseigné"
            disabled={save.isPending || reloading}
            onChange={(text) => {
              save.reset();
              setSkills(text);
            }}
          />
        </View>
      )}

      {section === "account" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Compte</Text>
          <Text style={styles.helperText}>
            Gérez l’email, le mot de passe, les appareils et la suppression du
            compte.
          </Text>
          <Button
            title="Compte et confidentialité"
            secondary
            onPress={() => router.push("/account-settings")}
          />
          {confirmReload ? (
            <>
              <Text style={s.text}>
                Abandonner les modifications et recharger votre profil ?
              </Text>
              <Button
                title="Confirmer le rechargement"
                busy={reloading}
                disabled={save.isPending}
                onPress={() =>
                  void (async () => {
                    setReloading(true);
                    setLocalError("");
                    try {
                      const user = await supabase.auth.getUser();
                      if (user.error) throw user.error;
                      if (user.data.user?.id !== session?.user.id)
                        throw new Error("La session a changé.");
                      const r = await supabase
                        .from("profiles")
                        .select("*")
                        .eq("id", session!.user.id)
                        .maybeSingle();
                      if (r.error) throw r.error;
                      setBaseline(r.data);
                      setRevision((value) => value + 1);
                      setAsset(null);
                      uploaded.current = null;
                      setConfirmReload(false);
                      save.reset();
                    } catch (e) {
                      setLocalError(
                        e instanceof Error
                          ? e.message
                          : "Impossible de recharger votre profil.",
                      );
                    } finally {
                      setReloading(false);
                    }
                  })()
                }
              />
              <Button
                title="Garder mes modifications"
                secondary
                disabled={reloading}
                onPress={() => setConfirmReload(false)}
              />
            </>
          ) : (
            <Button
              title="Recharger le formulaire"
              secondary
              disabled={save.isPending || reloading}
              onPress={() => setConfirmReload(true)}
            />
          )}
          <Button
            title="Se déconnecter"
            busy={logout.isPending}
            disabled={save.isPending || reloading}
            secondary
            onPress={() => {
              setLocalError("");
              logout.mutate();
            }}
          />
        </View>
      )}

      {section === "notifications" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Text style={styles.helperText}>
            Gérez les notifications email, push et les alertes visibles dans
            l’application.
          </Text>
          <Button
            title="Ouvrir les préférences de notification"
            onPress={() => router.push("/account-settings")}
          />
        </View>
      )}

      {section === "privacy" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Confidentialité</Text>
          <Text style={styles.helperText}>
            Contrôlez la visibilité de votre profil, les comptes bloqués et la
            suppression de vos données.
          </Text>
          <Button
            title="Confidentialité et comptes bloqués"
            secondary
            onPress={() => router.push("/account-settings")}
          />
          <Button
            title="Supprimer mon compte"
            secondary
            onPress={() => router.push("/suppression-compte")}
          />
        </View>
      )}

      {!!save.isError && <ErrorState error={save.error} />}
      {!!localError && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {localError}
        </Text>
      )}
      {!!save.isSuccess && (
        <Text style={styles.success}>Profil enregistré.</Text>
      )}
      <View style={styles.stickyActions}>
        <Button
          title="Enregistrer mon profil"
          onPress={() => save.mutate()}
          busy={save.isPending}
          disabled={reloading}
        />
      </View>
    </AuthGate>
  );
}

function accountLabel(value: string) {
  if (value === "club") return "Club";
  if (value === "business") return "Entreprise / Marque";
  if (value === "institution") return "Institution";
  return "Utilisateur FootNation";
}

const createSettingsStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    headerBlock: { gap: 10, paddingTop: 10, paddingBottom: 8 },
    pageTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 38,
      lineHeight: 46,
      fontWeight: "900",
    },
    profileName: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 22,
      lineHeight: 29,
    },
    profileRole: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 17,
      lineHeight: 24,
    },
    tabsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      borderRadius: 20,
      backgroundColor: colors.surfaceRaised,
      padding: 6,
      marginBottom: 4,
    },
    tabButton: {
      minHeight: 44,
      borderRadius: 14,
      paddingHorizontal: 12,
      flexGrow: 1,
      flexBasis: "30%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    tabButtonActive: {
      backgroundColor: colors.white,
      shadowColor: "#101828",
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2,
    },
    tabLabel: {
      color: colors.muted,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "800",
    },
    tabLabelActive: { color: colors.ink },
    card: {
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 16,
      shadowColor: "#101828",
      shadowOpacity: 0.07,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 3,
    },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    sectionTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 26,
      lineHeight: 32,
      fontWeight: "900",
    },
    photoRow: { flexDirection: "row", alignItems: "center", gap: 18 },
    photoCopy: { flex: 1, minWidth: 0, gap: 12 },
    helperText: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 17,
      lineHeight: 24,
    },
    uploadButton: {
      minHeight: 46,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.blue,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
    },
    uploadButtonText: {
      color: colors.blue,
      fontFamily: "Inter-Bold",
      fontSize: 16,
      fontWeight: "900",
    },
    accountTypes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    success: {
      color: colors.success,
      fontFamily: "Inter-Bold",
      fontSize: 16,
      fontWeight: "800",
    },
    stickyActions: { paddingBottom: 8 },
  });
