import React, { useMemo } from "react";
import { SvgXml } from "react-native-svg";
import { profileQrSvg, type QRProfile } from "../lib/profileQr";

export function PersonalizedQR({
  profile,
  size = 300,
}: {
  profile: QRProfile;
  size?: number;
}) {
  const xml = useMemo(
    () => profileQrSvg(profile),
    [
      profile.id,
      profile.username,
      profile.full_name,
      profile.primary_role,
      profile.account_type,
      profile.avatar_url,
    ],
  );
  return xml ? (
    <SvgXml
      xml={xml}
      width={size}
      height={(size * 360) / 320}
      accessibilityRole="image"
      accessibilityLabel={`QR code personnalisé de ${profile.full_name || profile.username || "FootNation"}`}
    />
  ) : null;
}
