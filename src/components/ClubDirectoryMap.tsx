import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { LocateFixed, MapPin } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { useDebounced } from "../lib/data";
import { useClubMap } from "../lib/useClubMap";
import { distanceKm, filterClubMap, type MapLocation } from "../lib/clubMap";
import type { ClubSearchType } from "../lib/clubSearch";
import { useTheme } from "../theme";
import { Avatar, Button, Chip, Loading, useUIStyles } from "./ui";
import ClubMapCanvas from "./ClubMapCanvas";
import { ClubDirectorySuggestions } from "./ClubDirectorySuggestions";

export function ClubDirectoryMap({
  search,
  department,
  type,
  showMap = true,
}: {
  search: string;
  department: string;
  type: ClubSearchType;
  showMap?: boolean;
}) {
  const { colors } = useTheme();
  const s = useUIStyles();
  const term = useDebounced(search);
  const [location, setLocation] = useState<MapLocation | null>(null);
  const points = useClubMap(showMap || !!location);
  const token = useQuery({
    queryKey: ["club-map-config"],
    enabled: showMap,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } =
        await supabase.functions.invoke("get-mapbox-token");
      if (
        error ||
        typeof data?.token !== "string" ||
        !data.token.startsWith("pk.")
      )
        throw new Error("La carte est temporairement indisponible.");
      return data.token as string;
    },
  });
  const [locating, setLocating] = useState(false),
    [error, setError] = useState("");
  const [radius, setRadius] = useState(50);
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = useMemo(
    () =>
      filterClubMap(
        points.data || [],
        term,
        department,
        type,
        location,
        location ? radius : Infinity,
      ),
    [points.data, term, department, type, location, radius],
  );
  const club = filtered.find((p) => p.id === selected);
  const locate = async () => {
    if (locating) return;
    setLocating(true);
    setError("");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Autorisez la localisation dans les réglages pour afficher les clubs autour de vous. Vous pouvez aussi rechercher une ville.",
        );
      const position = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  "La localisation prend trop de temps. Réessayez ou recherchez votre ville.",
                ),
              ),
            15000,
          );
        }),
      ]);
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setSelected(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Position indisponible. Recherchez votre ville ou réessayez.",
      );
    } finally {
      if (timer) clearTimeout(timer);
      setLocating(false);
    }
  };
  return (
    <View style={{ gap: 12 }}>
      {!showMap && (
        <ClubDirectorySuggestions
          search={search}
          department={department}
          type={type}
          located={!!location}
        />
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <MapPin color={colors.blue} size={18} />
          <Text style={s.h2}>
            {showMap ? "La carte des clubs" : "Clubs à proximité"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Me géolocaliser"
          disabled={locating}
          onPress={() => void locate()}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: colors.accentSoft,
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
          }}
        >
          <LocateFixed size={18} color={colors.blue} />
          <Text style={{ color: colors.blue, fontWeight: "700" }}>
            {locating ? "Localisation…" : "Autour de moi"}
          </Text>
        </Pressable>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      )}
      {!!location && (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {[10, 25, 50, 100].map((km) => (
            <Chip
              key={km}
              label={`${km} km`}
              selected={radius === km}
              onPress={() => setRadius(km)}
            />
          ))}
          <Chip
            label="Partout"
            onPress={() => {
              setLocation(null);
              setSelected(null);
            }}
          />
        </View>
      )}
      {showMap && (
        <View
          style={{
            borderRadius: 20,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {token.isPending ? (
            <View style={{ height: 380, justifyContent: "center" }}>
              <Loading />
            </View>
          ) : token.error ? (
            <View style={{ padding: 22, gap: 12 }}>
              <Text style={s.text}>
                La carte n’a pas pu se charger. La liste des clubs reste
                disponible.
              </Text>
              <Button
                secondary
                title="Réessayer la carte"
                onPress={() => void token.refetch()}
              />
            </View>
          ) : (
            <ClubMapCanvas
              token={token.data!}
              points={filtered}
              location={location}
              focusKey={
                term || department || type !== "all"
                  ? [term, department, type, radius].join(":")
                  : ""
              }
              onSelect={async (id) => setSelected(id)}
              dom={{ style: { height: 380 }, scrollEnabled: false }}
            />
          )}
        </View>
      )}
      {(showMap || !!location) &&
        (points.isPending ? (
          <Text style={s.small}>Chargement des clubs sur la carte…</Text>
        ) : points.isError ? (
          <Button
            secondary
            title="Recharger les clubs de la carte"
            onPress={() => void points.refetch()}
          />
        ) : (
          <Text style={s.small}>
            {filtered.length.toLocaleString("fr-FR")} clubs géolocalisés
            {location ? ` à moins de ${radius} km` : ""} · Bleu : clubs · Violet
            : indoor
          </Text>
        ))}
      {showMap && !!club && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Voir le club ${club.name}`}
          onPress={() => router.push(`/club/${club.id}`)}
          style={[
            s.card,
            { flexDirection: "row", alignItems: "center", gap: 12 },
          ]}
        >
          <Avatar uri={club.logo_url} name={club.name} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[s.text, { fontWeight: "700" }]}>{club.name}</Text>
            <Text style={s.small}>
              {club.city}
              {location ? ` · ${distanceKm(location, club).toFixed(1)} km` : ""}
            </Text>
            <Text style={{ color: colors.blue }}>Voir le club →</Text>
          </View>
        </Pressable>
      )}
      {!!location && (
        <View style={{ gap: 8 }}>
          <Text style={s.h2}>Les plus proches</Text>
          {!points.isPending && !points.isError && !filtered.length && (
            <Text style={s.small}>
              Aucun club dans ce rayon avec ces filtres. Élargissez la distance.
            </Text>
          )}
          {filtered.slice(0, 8).map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => router.push(`/club/${p.id}`)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 12,
              }}
            >
              <Avatar uri={p.logo_url} name={p.name} />
              <View style={{ flex: 1 }}>
                <Text style={[s.text, { fontWeight: "600" }]}>
                  {p.short_name || p.name}
                </Text>
                <Text style={s.small}>{p.city}</Text>
              </View>
              <Text style={{ color: colors.blue, fontWeight: "700" }}>
                {distanceKm(location, p).toFixed(1)} km
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
