import {
  profileSnapshotRequest,
  saveProfileSnapshot,
} from "../lib/profileSave";
import { profileRolesDraft, saveProfileRoles } from "../lib/profileRoles";
import { websiteUrl } from "../lib/websiteUrl";
import { notifyClubChange } from "../lib/notificationEvents";
import { displayName } from "../lib/models";
import { isPlayerProfile } from "../lib/profileAbout";
import { parseJerseyNumber } from "../lib/profileJersey";
import { validEmail } from "../lib/validation";
import { latestAllowedBirthdate, validBirthdate } from "../lib/calendarDate";
import { ProfileAutocompleteField } from "../components/ProfileAutocompleteField";
import { BirthdateField } from "../components/BirthdateField";
import { countryOptions, proClubOptions } from "../lib/profileSelectionOptions";
import { CompactForm, FormDetails } from "../components/CompactForm";
import { ChoiceField } from "../components/ChoiceField";
import { FavoriteClubSupportersPrompt } from "../components/FavoriteClubSupportersPrompt";
import {
  favoriteClubSupportersSuggestion,
  type FavoriteClubSupportersSuggestion,
} from "../lib/favoriteClubSupporters";
import { SUPPORTERS_ENABLED } from "../lib/supportersConfig";
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
  FileText,
  Lock,
  Settings as SettingsIcon,
  UserRound,
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
  ["jersey_number", "Numéro de maillot (facultatif)"],
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
    <Screen title="Paramètres">
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
  const canEditJersey = !!profile && isPlayerProfile(profile);
  const initialized = useRef(false);
  const [baseline, setBaseline] = useState<Record<string, unknown> | null>(
    () => profile as unknown as Record<string, unknown> | null,
  );
  const uploaded = useRef<{
    asset: ImagePicker.ImagePickerAsset;
    upload: Awaited<ReturnType<typeof uploadPhoto>>;
  } | null>(null);
  const [roles, setRoles] = useState("");
  const [focusedTab, setFocusedTab] = useState<string | null>(null);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [confirmReload, setConfirmReload] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [favoriteSupporters, setFavoriteSupporters] =
    useState<FavoriteClubSupportersSuggestion | null>(null);
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
      next[key] =
        typeof p?.[key] === "string" ||
        (key === "jersey_number" && typeof p?.[key] === "number")
          ? String(p[key])
          : "";
    setValues(next);
    setRoles(profileRolesDraft(p));
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
    onMutate: () => setFavoriteSupporters(null),
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
        if (key === "jersey_number") {
          if (canEditJersey)
            payload[key] = parseJerseyNumber(values[key] || "");
        } else if (account !== "personal" || key !== "primary_role")
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
      let saved = await saveProfileSnapshot(
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
      if (account === "personal")
        saved = await saveProfileRoles(saved, baseline || saved, roles);
      const supportersSuggestion = SUPPORTERS_ENABLED
        ? favoriteClubSupportersSuggestion({
            ownerId: session.user.id,
            before: baseline,
            saved,
            editedKeys: Object.keys(payload),
          })
        : null;
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
      await cache.invalidateQueries({
        queryKey: ["native-career-preferences", session.user.id],
      });
      await cache.invalidateQueries({
        queryKey: ["matching-entities", session.user.id],
      });
      setAsset(null);
      return supportersSuggestion;
    },
    onSuccess: async (supportersSuggestion) => {
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
      else setFavoriteSupporters(supportersSuggestion);
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
  ].filter(([key]) => key !== "jersey_number" || canEditJersey);
  const basicFields = selectedFields.filter(([key]) =>
    account === "personal"
      ? [
          "first_name",
          "last_name",
          "username",
          "primary_role",
          "position",
          "jersey_number",
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
    key === "primary_role" ? (
      <View key={key} style={{ gap: 8 }}>
        <ChoiceField
          label="Rôles dans le football"
          value={roles}
          options={roleOptions}
          multiple
          optionalLabel="Aucun rôle"
          disabled={save.isPending || reloading}
          onChange={(value) => {
            save.reset();
            setRoles(value);
          }}
        />
        <Text style={s.small}>
          Plusieurs choix possibles. Le premier rôle sélectionné est votre rôle
          principal.
        </Text>
      </View>
    ) : key === "jersey_number" ? (
      <View key={key} style={{ gap: 8 }}>
        <Field
          label={label}
          value={values[key] || ""}
          keyboardType="number-pad"
          placeholder="Ex. : 10"
          editable={!save.isPending && !reloading}
          onChangeText={(text) => {
            save.reset();
            setValues((v) => ({ ...v, [key]: text }));
          }}
        />
        <Text style={s.small}>
          De 1 à 99. Laissez vide pour retirer le numéro de votre profil.
        </Text>
      </View>
    ) : key === "birthdate" ? (
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
      <CompactForm>
        <View style={styles.tabsWrap}>
          {sectionTabs.map(({ id, label, icon: Icon }) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: section === id }}
              onPress={() => setSection(id)}
              onFocus={() => setFocusedTab(id)}
              onBlur={() => setFocusedTab(null)}
              onHoverIn={() => setHoveredTab(id)}
              onHoverOut={() => setHoveredTab(null)}
              style={({ pressed }) => [
                styles.tabButton,
                (section === id || hoveredTab === id || pressed) &&
                  styles.tabButtonActive,
                focusedTab === id && { borderColor: colors.blue },
              ]}
            >
              <Icon
                size={16}
                color={section === id ? colors.ink : colors.muted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  section === id && styles.tabLabelActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {section === "profile" && (
          <>
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Changer la photo de profil"
                disabled={save.isPending || reloading}
                onPress={() => void pick()}
                style={({ pressed }) => [
                  styles.photoRow,
                  {
                    opacity:
                      save.isPending || reloading ? 0.45 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Avatar
                  uri={asset?.uri || profile?.avatar_url}
                  name={profile?.full_name || ""}
                  size={56}
                />
                <View style={styles.photoCopy}>
                  <Text style={styles.sectionTitle}>
                    {profile?.full_name || "Mon profil"}
                  </Text>
                  <Text style={styles.photoLink}>Changer la photo</Text>
                </View>
              </Pressable>
              {basicFields
                .filter(
                  ([key]) =>
                    ![
                      "primary_role",
                      "position",
                      "jersey_number",
                      "club",
                      "city",
                      "department",
                      "country",
                      "nationality",
                    ].includes(key),
                )
                .map(renderField)}
            </View>
            {account === "personal" && (
              <FormDetails title="Mon football">
                {basicFields
                  .filter(([key]) =>
                    [
                      "primary_role",
                      "position",
                      "jersey_number",
                      "club",
                    ].includes(key),
                  )
                  .map(renderField)}
              </FormDetails>
            )}
            <FormDetails title="Localisation et nationalité">
              {basicFields
                .filter(([key]) =>
                  ["city", "department", "country", "nationality"].includes(
                    key,
                  ),
                )
                .map(renderField)}
            </FormDetails>
            <FormDetails title={`Type de compte · ${accountLabel(account)}`}>
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
            </FormDetails>
          </>
        )}

        {section === "content" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>À propos de moi</Text>
            {contentFields
              .filter(([key]) => ["bio", "birthdate", "gender"].includes(key))
              .map(renderField)}
            <FormDetails title="Parcours et caractéristiques">
              {contentFields
                .filter(
                  ([key]) =>
                    ![
                      "bio",
                      "birthdate",
                      "gender",
                      "favorite_pro_club",
                      "favorite_amateur_club",
                    ].includes(key),
                )
                .map(renderField)}
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
            </FormDetails>
            {account === "personal" && (
              <FormDetails title="Clubs favoris">
                {contentFields
                  .filter(([key]) =>
                    ["favorite_pro_club", "favorite_amateur_club"].includes(
                      key,
                    ),
                  )
                  .map(renderField)}
              </FormDetails>
            )}
          </View>
        )}

        {section === "account" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Compte</Text>
            <Text style={styles.helperText}>
              Connexion, appareils et sécurité.
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
              Choisissez les alertes que vous recevez.
            </Text>
            <Button
              title="Gérer mes notifications"
              onPress={() => router.push("/account-settings")}
            />
          </View>
        )}

        {section === "privacy" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Confidentialité</Text>
            <Text style={styles.helperText}>
              Visibilité du profil et gestion de vos données.
            </Text>
            <Button
              title="Confidentialité et comptes bloqués"
              secondary
              onPress={() => router.push("/account-settings")}
            />
            <Button
              title="Désactiver temporairement"
              secondary
              onPress={() => router.push("/desactivation-compte")}
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
        {save.isSuccess && !!favoriteSupporters && (
          <FavoriteClubSupportersPrompt
            key={favoriteSupporters.ownerId}
            suggestion={favoriteSupporters}
          />
        )}
        {(section === "profile" || section === "content") && (
          <View style={styles.stickyActions}>
            <Button
              title="Enregistrer"
              onPress={() => save.mutate()}
              busy={save.isPending}
              disabled={reloading}
            />
          </View>
        )}
      </CompactForm>
    </AuthGate>
  );
}

function accountLabel(value: string) {
  if (value === "club") return "Club";
  if (value === "business") return "Entreprise / Marque";
  if (value === "institution") return "Institution";
  return "Personnel";
}

const createSettingsStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
      minWidth: 110,
      borderWidth: 1,
      borderColor: "transparent",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    tabButtonActive: { backgroundColor: colors.surface },
    tabLabel: {
      flexShrink: 1,
      color: colors.muted,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "800",
    },
    tabLabelActive: { color: colors.ink },
    card: {
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 16,
    },
    sectionTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      lineHeight: 24,
    },
    photoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingBottom: 4,
    },
    photoCopy: { flex: 1, minWidth: 0, gap: 4 },
    photoLink: {
      color: colors.deepBlue,
      fontFamily: "Inter-Medium",
      fontSize: 14,
      lineHeight: 20,
    },
    helperText: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 20,
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
