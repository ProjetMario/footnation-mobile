import { ProfileInfoLink } from "./ProfileInfo";
import { profileInfoActions } from "../lib/profileInfoActions";
import { ProfessionalContactButton } from "./ProfessionalContactButton";
import React, { useState } from "react";
import { Linking, Text, View } from "react-native";
import type { Profile } from "../lib/models";
import { websiteUrl } from "../lib/websiteUrl";
import {
  businessSectorOptions,
  institutionTypeOptions,
  institutionLevelOptions,
} from "../lib/profileOptions";
import { Button, ErrorState, useUIStyles } from "./ui";
const fields: Record<string, [keyof Profile, string][]> = {
  club: [
    ["club_official_name", "Nom officiel"],
    ["club_year_founded", "Année de création"],
    ["club_colors", "Couleurs"],
    ["club_address", "Adresse"],
    ["club_phone", "Téléphone"],
    ["club_email", "E-mail du club"],
  ],
  business: [
    ["business_name", "Entreprise"],
    ["business_description", "Présentation"],
    ["business_sector", "Secteur"],
    ["business_address", "Adresse"],
    ["business_email", "E-mail professionnel"],
    ["business_phone", "Téléphone"],
  ],
  institution: [
    ["institution_name", "Institution"],
    ["institution_description", "Présentation"],
    ["institution_type", "Type"],
    ["institution_level", "Niveau"],
    ["institution_address", "Adresse"],
    ["institution_email", "E-mail"],
    ["institution_phone", "Téléphone"],
  ],
};
const labels: Record<string, { value: string; label: string }[]> = {
  business_sector: businessSectorOptions,
  institution_type: institutionTypeOptions,
  institution_level: institutionLevelOptions,
};
export function OrganizationDetails({
  profile,
  ownProfile = false,
}: {
  profile: Profile;
  ownProfile?: boolean;
}) {
  const s = useUIStyles();

  const [error, setError] = useState<Error | null>(null);
  const type = profile.account_type || "personal";
  const rows = (fields[type] || []).filter(
    ([key]) =>
      profile[key] !== null &&
      profile[key] !== undefined &&
      String(profile[key]).trim(),
  );
  const website =
    type === "club"
      ? profile.club_website
      : type === "business"
        ? profile.business_website
        : null;
  if (!rows.length && !website) return null;
  return (
    <View style={s.card}>
      <Text style={s.h2}>L’organisation</Text>
      {rows.map(([key, label]) => (
        <View key={key} style={{ gap: 4 }}>
          <ProfileInfoLink
            info={{
              label,
              value:
                (labels[key] || []).find((item) => item.value === profile[key])
                  ?.label || String(profile[key]),
              actions: profileInfoActions(
                profile,
                "organization",
                label,
                String(profile[key]),
                ownProfile,
              ),
            }}
          >
            <Text style={s.small}>{label}</Text>
            <Text style={s.text}>
              {key === "business_sector" ||
              key === "institution_type" ||
              key === "institution_level"
                ? (labels[key] || []).find(
                    (item) => item.value === profile[key],
                  )?.label || String(profile[key])
                : String(profile[key])}
            </Text>
          </ProfileInfoLink>
          {!!["club_phone", "business_phone", "institution_phone"].includes(
            key,
          ) && (
            <ProfessionalContactButton
              kind="phone"
              value={String(profile[key])}
            />
          )}
          {!!["club_email", "business_email", "institution_email"].includes(
            key,
          ) && (
            <ProfessionalContactButton
              kind="email"
              value={String(profile[key])}
            />
          )}
          {!![
            "club_address",
            "business_address",
            "institution_address",
          ].includes(key) && (
            <ProfessionalContactButton
              kind="address"
              value={String(profile[key])}
            />
          )}
        </View>
      ))}
      {!!website && (
        <>
          <ProfileInfoLink
            info={{
              label: "Site internet",
              value: website,
              actions: profileInfoActions(
                profile,
                "organization",
                "Site internet",
                website,
                ownProfile,
              ),
            }}
          >
            <Text style={s.text}>{website}</Text>
          </ProfileInfoLink>
          <Button
            secondary
            title="Visiter le site internet"
            onPress={() => {
              setError(null);
              try {
                void Linking.openURL(websiteUrl(website)).catch((e: Error) =>
                  setError(e),
                );
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e
                    : new Error("Impossible d’ouvrir ce lien."),
                );
              }
            }}
          />
        </>
      )}
      {!!error && <ErrorState error={error} />}
    </View>
  );
}
