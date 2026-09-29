import { Redirect, useLocalSearchParams } from "expo-router";
import NotFound from "./+not-found";
import { geographyPath, resolveGeographyPath } from "../src/lib/geography";
export default function LegacyRoute() {
  const { legacy } = useLocalSearchParams<{ legacy: string }>();
  const match = legacy?.match(/^(clubs-ville|clubs-departement)-(.+)$/);
  const geography = resolveGeographyPath(`/${legacy}`);
  return match ? (
    <Redirect href={`/${match[1]}/${encodeURIComponent(match[2])}`} />
  ) : geography ? (
    <Redirect href={geographyPath(geography.slug, geography.locale)} />
  ) : (
    <NotFound />
  );
}
