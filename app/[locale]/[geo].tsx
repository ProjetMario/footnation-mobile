import { useLocalSearchParams } from "expo-router";
import { GeographyLocationScreen } from "../../src/screens/Geography";
import { resolveGeographyPath } from "../../src/lib/geography";
import NotFound from "../+not-found";
export default function TranslatedGeographyRoute() {
  const { locale, geo } = useLocalSearchParams<{
    locale: string;
    geo: string;
  }>();
  const destination = resolveGeographyPath(`/${locale}/${geo}`);
  return destination ? (
    <GeographyLocationScreen
      slug={destination.slug}
      locale={destination.locale}
    />
  ) : (
    <NotFound />
  );
}
