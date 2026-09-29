import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
export default function QRAction() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  return <Redirect href={`/profile/${encodeURIComponent(profileId)}`} />;
}
