import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button, Chip, useUIStyles } from "./ui";
import type { Profile } from "../lib/models";
export function ProfileIdentity({ profile }: { profile: Profile }) {
  const s = useUIStyles();

  const label =
    profile.account_type === "club"
      ? "Club"
      : profile.account_type === "business"
        ? "Entreprise / Marque"
        : profile.account_type === "institution"
          ? "Institution"
          : null;
  const clubId = profile.linked_club_id;
  const hasClub =
    !!clubId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      clubId,
    );
  if (!label && profile.is_verified !== true && !hasClub) return null;
  return (
    <View style={{ gap: 10 }}>
      {!!(label || profile.is_verified === true) && (
        <View style={s.row}>
          {!!label && <Chip label={label} />}
          {profile.is_verified === true && <Chip label="Profil vérifié" />}
        </View>
      )}
      {!!hasClub && (
        <Button
          secondary
          title="Voir le club associé"
          onPress={() => router.push(`/club/${clubId}`)}
        />
      )}
    </View>
  );
}
