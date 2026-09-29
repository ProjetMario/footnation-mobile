import { useMemo, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import {
  findClubEnrichment,
  textValue,
  parseFacilities,
  buildAddress,
  clubShirtColors,
} from "../lib/clubPublicInformation";
import {
  Building2,
  ExternalLink,
  MapPin,
  Palette,
  Shield,
} from "lucide-react-native";
import { useTheme } from "../theme";

export function ClubPublicInformation({ club }: { club: Record<string, any> }) {
  const { colors } = useTheme();
  const [cardWidth, setCardWidth] = useState(0);
  const enrichment = useMemo(
    () => findClubEnrichment(club),
    [club.id, club.external_id, club.fff_affiliation_number, club.name],
  );
  const enrichedClub = enrichment?.data?.club || null;
  const metadata =
    club.metadata && typeof club.metadata === "object" ? club.metadata : {};

  const identityRows = useMemo(() => {
    const rows = [
      [
        "N° affiliation",
        textValue(
          enrichedClub?.fff_affiliation_number,
          metadata.fff_affiliation_number,
          metadata.numero_affiliation,
          club.fff_affiliation_number,
          /^\d{5,6}$/.test(String(club.external_id || ""))
            ? club.external_id
            : null,
        ),
      ],
      [
        "Ligue",
        textValue(
          enrichedClub?.league,
          metadata.league,
          metadata.ligue,
          club.league,
        ),
      ],
      [
        "District",
        textValue(enrichedClub?.district, metadata.district, club.district),
      ],
    ] as Array<[string, string | null]>;
    return rows
      .filter((row): row is [string, string] => Boolean(row[1]))
      .map(([label, value]) => ({ label, value }));
  }, [
    club.external_id,
    club.fff_affiliation_number,
    club.league,
    club.district,
    enrichedClub,
    metadata,
  ]);

  const colorsLabel = clubShirtColors(club).join(", ");
  const address = buildAddress(club, enrichedClub?.full_address);
  const facilities = useMemo(
    () =>
      parseFacilities(
        enrichment?.data?.facilities?.length
          ? enrichment.data!.facilities
          : club.infrastructure,
      ),
    [club.infrastructure, enrichment],
  );

  return (
    <View
      onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: 20,
        overflow: "hidden",
      }}
    >
      {
        <InfoSection
          title="Identité"
          icon={<Shield size={22} color={colors.blue} />}
          iconBackground={colors.accentSoft}
        >
          <View style={{ gap: 10 }}>
            {!identityRows.length && !colorsLabel && (
              <Text style={{ color: colors.muted }}>
                Informations non renseignées.
              </Text>
            )}
            {identityRows.map(({ label, value }) => (
              <InfoRow key={label} label={label} value={String(value)} />
            ))}
            {!!colorsLabel && (
              <InfoRow
                label="Couleurs"
                value={colorsLabel}
                icon={<Palette size={15} color={colors.blue} />}
              />
            )}
          </View>
        </InfoSection>
      }

      {
        <InfoSection
          title="Adresse"
          icon={<MapPin size={22} color={colors.blue} />}
          iconBackground={colors.accentSoft}
          separated
        >
          <Text
            selectable
            style={{
              color: colors.ink,
              fontSize: 15,
              lineHeight: 23,
              fontFamily: "Inter-Regular",
            }}
          >
            {address || "Adresse non renseignée."}
          </Text>
          {!!address && (
            <MapLink query={address} label="Voir sur Google Maps" />
          )}
        </InfoSection>
      }

      {
        <InfoSection
          title={
            facilities.length
              ? `Installations (${facilities.length})`
              : "Installations"
          }
          icon={<Building2 size={22} color={colors.blue} />}
          iconBackground={colors.accentSoft}
          separated
        >
          {!facilities.length && (
            <Text style={{ color: colors.muted }}>
              Aucune installation renseignée.
            </Text>
          )}
          <View style={{ gap: 12, flexDirection: "row", flexWrap: "wrap" }}>
            {facilities.map((facility, index) => (
              <View
                key={`${facility.name || "installation"}:${index}`}
                style={{
                  width: cardWidth >= 560 ? "48%" : "100%",
                  flexGrow: cardWidth >= 560 ? 1 : 0,
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 14,
                  gap: 8,
                }}
              >
                {!!facility.name && (
                  <Text
                    selectable
                    style={{
                      color: colors.ink,
                      fontSize: 15,
                      fontFamily: "Inter-SemiBold",
                    }}
                  >
                    {facility.name}
                  </Text>
                )}
                {!!facility.additional_info && (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    {facility.additional_info}
                  </Text>
                )}
                {!!facility.full_address && (
                  <View style={{ gap: 6 }}>
                    <Text
                      selectable
                      style={{
                        color: colors.muted,
                        fontSize: 13,
                        lineHeight: 19,
                      }}
                    >
                      {facility.full_address}
                    </Text>
                    <MapLink query={facility.full_address} compact />
                  </View>
                )}
              </View>
            ))}
          </View>
        </InfoSection>
      }
    </View>
  );
}

function InfoSection({
  title,
  icon,
  iconBackground,
  separated,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  iconBackground: string;
  separated?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        padding: 22,
        gap: 16,
        borderTopWidth: separated ? 1 : 0,
        borderTopColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: iconBackground,
          }}
        >
          {icon}
        </View>
        <Text
          accessibilityRole="header"
          style={{ color: colors.ink, fontSize: 19, fontFamily: "Inter-Bold" }}
        >
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderColor: colors.border,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon}
        <Text
          style={{
            color: colors.muted,
            fontSize: 13,
            fontFamily: "Inter-Regular",
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        selectable
        style={{
          color: colors.ink,
          fontSize: 14,
          fontFamily: "Inter-SemiBold",
          flex: 1,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function MapLink({
  query,
  label = "Voir sur Google Maps",
  compact,
}: {
  query: string;
  label?: string;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() =>
        void Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            query,
          )}`,
        )
      }
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        opacity: pressed ? 0.75 : 1,
        alignSelf: "flex-start",
        minHeight: 44,
      })}
    >
      <ExternalLink size={compact ? 15 : 16} color={colors.blue} />
      <Text
        style={{
          color: colors.blue,
          fontSize: compact ? 13 : 15,
          fontFamily: "Inter-SemiBold",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
