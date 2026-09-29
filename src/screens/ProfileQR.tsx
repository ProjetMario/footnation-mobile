import React, { useState } from "react";
import { Share, Text, View, useWindowDimensions } from "react-native";
import { PersonalizedQR } from "../components/PersonalizedQR";
import { profileQrUrl } from "../lib/profileQr";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../lib/auth";
import { useProfile } from "../lib/data";
import { displayName } from "../lib/models";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Button,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
export default function ProfileQR() {
  return (
    <Screen title="Mon QR code FootNation">
      <AuthGate>
        <Card />
      </AuthGate>
    </Screen>
  );
}
function Card() {
  const s = useUIStyles();
  const { width } = useWindowDimensions();
  const qrSize = Math.min(260, width - 88);

  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const profileId = id || session!.user.id;
  const profile = useProfile(profileId);
  const [error, setError] = useState<unknown>(null);
  const url = profileQrUrl({ id: profileId });
  if (profile.isPending) return <Loading />;
  if (profile.error) return <ErrorState error={profile.error} />;
  if (!profile.data) return <Text style={s.text}>Profil indisponible.</Text>;
  return (
    <>
      <View style={[s.card, { alignItems: "center", gap: 16 }]}>
        <Avatar
          uri={profile.data?.avatar_url}
          name={displayName(profile.data)}
          size={76}
        />
        <Text style={s.h2}>{displayName(profile.data)}</Text>
        <PersonalizedQR profile={profile.data} size={qrSize} />
        <Text style={[s.text, { textAlign: "center" }]}>
          Faites scanner ce code pour retrouver votre profil et rejoindre votre
          réseau.
        </Text>
      </View>
      <Button
        title="Partager mon profil"
        onPress={() => {
          setError(null);
          void Share.share({
            title: "Profil FootNation",
            message: `${displayName(profile.data)} sur FootNation\n${url}`,
          }).catch(setError);
        }}
      />
      <Button
        title="Voir le profil"
        secondary
        onPress={() => router.push(`/profile/${profileId}`)}
      />
      {!!error && <ErrorState error={error} />}
    </>
  );
}
