import React, { useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Globe2, MapPin, ChevronDown, ChevronUp } from "lucide-react-native";
import { useTheme } from "../theme";
import { useAuth } from "../lib/auth";
import { GEO_UI } from "../data/geography/geoUI";
import { LOCALE_LABELS } from "../data/geography/locales";
import {
  GEO_CITIES,
  GEO_COUNTRIES,
  geographyCountries,
  geographyLocation,
  geographyCountry,
  geographyCountryPath,
  geographyPath,
  geographyLocale,
  geographyContent,
  geographyCountrySummary,
  geographyLanguages,
  geographyActions,
  countryCities,
  countryArticle,
  countryCodeForArticle,
  filterGeography,
  type GeoLocation,
  type SeoLocale,
} from "../lib/geography";
import { loadGeographyProfiles } from "../lib/geographyProfiles";
import {
  Avatar,
  Banner,
  Button,
  Chip,
  Empty,
  ErrorState,
  Loading,
  MenuRow,
  Screen,
  SearchField,
  useUIStyles,
} from "../components/ui";

export default function Geography() {
  const s = useUIStyles();
  const { colors } = useTheme();
  const [category, setCategory] = useState<"countries" | "cities">("countries");
  const [search, setSearch] = useState("");
  const rows =
    category === "countries"
      ? filterGeography(geographyCountries, search).map((country) => ({
          key: country.code,
          name: country.name,
          subtitle: `${countryCities(country.code).length} ${countryCities(country.code).length > 1 ? "villes à découvrir" : "ville à découvrir"}`,
          path: geographyCountryPath(country.code),
        }))
      : filterGeography(GEO_CITIES, search).map((city) => ({
          key: city.slug,
          name: city.name,
          subtitle: city.country,
          path: geographyPath(city.slug),
        }));
  return (
    <Screen title="Football dans le monde" scroll={false}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <Banner
              eyebrow="FOOTNATION · DESTINATIONS"
              title="Le football, partout."
              description="Explorez les pays et les villes présentés sur FootNation, leurs cultures football et les guides du site."
            >
              <Globe2 color={colors.blue} size={32} aria-hidden />
            </Banner>
            <View style={[s.row, { flexWrap: "wrap" }]}>
              <Chip
                label="Pays"
                selected={category === "countries"}
                onPress={() => setCategory("countries")}
              />
              <Chip
                label="Villes"
                selected={category === "cities"}
                onPress={() => setCategory("cities")}
              />
            </View>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder={
                category === "countries"
                  ? "Rechercher un pays"
                  : "Rechercher une ville"
              }
            />
            <Text style={s.small}>
              Guides et présentations du site. L’annuaire des clubs consultable
              dans l’application couvre la France.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <MenuRow
              title={item.name}
              subtitle={item.subtitle}
              icon={<MapPin size={22} color={colors.blue} aria-hidden />}
              onPress={() => router.push(item.path)}
            />
          </View>
        )}
        ListEmptyComponent={
          <Empty
            title="Aucune destination trouvée"
            description="Essayez un autre nom parmi les pays et villes présentés."
          />
        }
      />
    </Screen>
  );
}

function Unavailable() {
  return (
    <Screen title="Destination introuvable">
      <Empty title="Cette destination n’est pas présentée" />
      <Button
        title="Explorer les pays et villes"
        onPress={() => router.replace("/countries")}
      />
    </Screen>
  );
}
export function GeographyLocationScreen({
  slug: forcedSlug,
  locale: forcedLocale,
}: { slug?: string; locale?: SeoLocale } = {}) {
  const params = useLocalSearchParams<{ slug?: string; lang?: string }>();
  const slug = forcedSlug || params.slug || "";
  const location = geographyLocation(slug);
  const locale = forcedLocale || geographyLocale(params.lang);
  return location ? (
    <LocationContent
      key={`${slug}/${locale}`}
      location={location}
      locale={locale}
    />
  ) : (
    <Unavailable />
  );
}
function LocationContent({
  location,
  locale,
}: {
  location: GeoLocation;
  locale: SeoLocale;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const content = geographyContent(location, locale);
  const ui = GEO_UI[locale];
  const languages = geographyLanguages(location.slug);
  const textDirection = {
    writingDirection: locale === "ar" ? ("rtl" as const) : ("ltr" as const),
    textAlign: locale === "ar" ? ("right" as const) : ("left" as const),
  };
  const related =
    location.type === "city"
      ? countryCities(location.countryCode!).filter(
          (entry) => entry.slug !== location.slug,
        )
      : GEO_COUNTRIES.filter((entry) => entry.slug !== location.slug);
  return (
    <Screen title={content.name}>
      <View style={[s.card, { gap: 14 }]}>
        <MapPin color={colors.blue} size={30} aria-hidden />
        <Text style={s.small}>
          {[location.country, location.region].filter(Boolean).join(" · ")}
        </Text>
        <Text
          accessibilityRole="header"
          style={[
            s.h2,
            { fontSize: 28, lineHeight: 36, fontFamily: "Inter-Bold" },
            textDirection,
          ]}
        >
          {content.h1 || ui.h1(content.name)}
        </Text>
        <Text style={[s.text, textDirection]}>{content.intro}</Text>
        {!content.translated && (
          <Text style={s.small}>
            Cette présentation est disponible en français.
          </Text>
        )}
      </View>
      {languages.length > 1 && (
        <View style={{ gap: 8 }}>
          <Text style={s.label}>Langue du contenu</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {languages.map((language) => (
              <Chip
                key={language}
                label={LOCALE_LABELS[language].nativeName}
                selected={locale === language}
                onPress={() =>
                  router.replace(geographyPath(location.slug, language))
                }
              />
            ))}
          </ScrollView>
        </View>
      )}
      <View style={{ gap: 12 }}>
        <Text style={s.small}>Présentation du site FootNation</Text>
        {[
          { title: ui.cardClubsTitle, body: ui.cardClubsBody(content.name) },
          { title: ui.cardOppsTitle, body: ui.cardOppsBody(content.name) },
          {
            title: ui.cardRecruitTitle,
            body: ui.cardRecruitBody(content.name),
          },
        ].map((section) => (
          <View key={section.title} style={s.card}>
            <Text accessibilityRole="header" style={[s.h2, textDirection]}>
              {section.title}
            </Text>
            <Text style={[s.text, textDirection]}>{section.body}</Text>
          </View>
        ))}
      </View>
      <GeographyAccess />
      <View style={s.card}>
        <MenuRow
          title={`${ui.countryLabel} · ${location.country}`}
          subtitle="Présentation et villes à découvrir"
          onPress={() =>
            router.push(geographyCountryPath(location.countryCode!))
          }
        />
      </View>
      {related.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text accessibilityRole="header" style={[s.h2, textDirection]}>
            {location.type === "city"
              ? ui.siblingsCity(location.country)
              : ui.siblingsCountry}
          </Text>
          {related.map((entry) => (
            <MenuRow
              key={entry.slug}
              title={geographyContent(entry, locale).name}
              onPress={() =>
                router.push(
                  geographyPath(
                    entry.slug,
                    geographyLanguages(entry.slug).includes(locale)
                      ? locale
                      : "fr",
                  ),
                )
              }
            />
          ))}
        </View>
      )}
      <View style={s.card}>
        <Text accessibilityRole="header" style={[s.h2, textDirection]}>
          {ui.finalH(content.name)}
        </Text>
        <Text style={[s.text, textDirection]}>{ui.finalP}</Text>
        <ProfileAction label={ui.finalCta} />
      </View>
    </Screen>
  );
}

function ProfileAction({ label = "Créer mon profil" }: { label?: string }) {
  const { session } = useAuth();
  return (
    <Button
      title={session ? "Mon profil" : label}
      onPress={() => router.push(session ? "/my-profile" : "/signup")}
    />
  );
}
function GeographyAccess() {
  const s = useUIStyles();
  return (
    <View style={[s.card, { gap: 12 }]}>
      <Text accessibilityRole="header" style={s.h2}>
        Explorer FootNation
      </Text>
      <Text style={s.small}>
        L’annuaire des clubs couvre la France. Le réseau et les opportunités
        s’ouvrent sans filtre de pays ou de ville.
      </Text>
      {geographyActions().map((action) => (
        <Button
          key={action.path}
          title={action.label}
          secondary
          onPress={() => router.push(action.path)}
        />
      ))}
    </View>
  );
}

export function GeographyCountryScreen({
  code: forcedCode,
  articleSlug,
}: { code?: string; articleSlug?: string } = {}) {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const selected = articleSlug
    ? countryCodeForArticle(articleSlug)
    : forcedCode || code || "";
  const country = geographyCountry(selected || "");
  return country ? (
    <CountryContent key={country.code} code={country.code} />
  ) : (
    <Unavailable />
  );
}
export function GeographyArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  return <GeographyCountryScreen articleSlug={slug || "invalid"} />;
}
function CountryContent({ code }: { code: string }) {
  const s = useUIStyles();
  const { session } = useAuth();
  const country = geographyCountry(code)!;
  const article = countryArticle(code);
  const location = GEO_COUNTRIES.find((entry) => entry.countryCode === code);
  const cities = countryCities(code);
  const profiles = useQuery({
    queryKey: ["geography-profiles", session?.user.id, article?.slug],
    enabled: !!article,
    queryFn: ({ signal }) =>
      loadGeographyProfiles(article!.slug, session?.user.id, signal),
  });
  return (
    <Screen title={country.name}>
      <Banner
        eyebrow="LE FOOTBALL DANS LE MONDE"
        title={`Football · ${country.name}`}
        description={
          location?.intro ||
          article?.description ||
          `Découvrez les villes de ${country.name} présentées sur FootNation.`
        }
      />
      {!!(article && location) && (
        <Text style={s.text}>{article.description}</Text>
      )}
      <Text accessibilityRole="header" style={s.h2}>
        Villes à découvrir
      </Text>
      <View style={s.card}>
        {cities.map((city) => (
          <MenuRow
            key={city.slug}
            title={city.name}
            subtitle={city.region}
            onPress={() => router.push(geographyPath(city.slug))}
          />
        ))}
      </View>
      {!!location && (
        <Button
          title={`Lire la présentation de ${country.name}`}
          secondary
          onPress={() => router.push(geographyPath(location.slug))}
        />
      )}
      {!!article && (
        <>
          <Text accessibilityRole="header" style={s.h2}>
            Le dossier FootNation
          </Text>
          <Text style={s.small}>
            Présentation et questions fréquentes reprises du site.
          </Text>
          <GeographyQuestion
            question="Synthèse du site (anglais)"
            answer={geographyCountrySummary(article).join("\n\n")}
          />
          {article.sections.map((section) => (
            <View key={section.title} style={s.card}>
              <Text accessibilityRole="header" style={s.h2}>
                {section.title}
              </Text>
              <Text style={s.text}>{section.body}</Text>
            </View>
          ))}
          <Text accessibilityRole="header" style={s.h2}>
            Profils publiés · nationalité{" "}
            {article.nationality.toLocaleLowerCase("fr-FR")}
          </Text>
          <Text style={s.small}>
            La nationalité déclarée ne représente pas le pays de résidence.
            Cette sélection présente jusqu’à 24 profils publics.
          </Text>
          {profiles.isPending ? (
            <Loading />
          ) : profiles.error ? (
            <ErrorState
              error={profiles.error}
              retry={() => void profiles.refetch()}
            />
          ) : profiles.data?.length ? (
            <View style={{ gap: 12 }}>
              {profiles.data.map((profile) => {
                const name =
                  profile.full_name || profile.username || "Profil FootNation";
                return (
                  <Pressable
                    key={profile.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Consulter le profil public de ${name}`}
                    onPress={() =>
                      router.push(
                        `/talent/${encodeURIComponent(profile.slug || profile.id)}`,
                      )
                    }
                    style={[s.card, s.row, { minHeight: 64 }]}
                  >
                    <Avatar uri={profile.avatar_url} name={name} />
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <Text style={s.h2}>{name}</Text>
                      <Text style={s.small}>
                        {[
                          profile.position || profile.primary_role,
                          profile.city,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Empty
              title="Aucun profil public trouvé"
              description="Aucun profil correspondant à cette nationalité n’est disponible dans cette sélection."
            />
          )}
          <Text accessibilityRole="header" style={s.h2}>
            Questions fréquentes
          </Text>
          <Text style={s.small}>
            Les langues proposées dans ce parcours concernent les guides de
            villes. L’interface de l’application reste en français.
          </Text>
          {article.faq.map((entry) => (
            <GeographyQuestion
              key={entry.question}
              question={entry.question}
              answer={entry.answer}
            />
          ))}
        </>
      )}
      <GeographyAccess />
      <ProfileAction />
      <Button
        title="Tous les pays et villes"
        secondary
        onPress={() => router.push("/countries")}
      />
    </Screen>
  );
}
function GeographyQuestion({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const Icon = expanded ? ChevronUp : ChevronDown;
  return (
    <View style={s.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={question}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={() => setExpanded(!expanded)}
        style={[s.row, { minHeight: 44 }]}
      >
        <Text style={[s.text, { flex: 1, fontFamily: "Inter-SemiBold" }]}>
          {question}
        </Text>
        <Icon color={colors.muted} size={20} aria-hidden />
      </Pressable>
      {!!expanded && <Text style={s.text}>{answer}</Text>}
    </View>
  );
}
