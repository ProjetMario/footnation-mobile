import React from "react";
import { Redirect } from "expo-router";

/** Keep the public deep link usable inside the Expo web app. */
export default function FindAClubRoute() {
  return <Redirect href="/clubs" />;
}
