import React from "react";
import { Redirect } from "expo-router";

/**
 * Public deep link kept for the SEO/category URL. The Expo app exposes the
 * coach directory through the shared search screen, so this route must not
 * fall through to the generic not-found page.
 */
export default function CoachesRoute() {
  return <Redirect href="/search?q=coach&type=profiles" />;
}
