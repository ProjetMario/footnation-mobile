import React from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react-native";
import { useAuth } from "../lib/auth";
import { useDebounced, useProfile } from "../lib/data";
import { supabase } from "../lib/supabase";
import { clubSearchFilter, type ClubSearchType } from "../lib/clubSearch";
import {
  clubDirectoryColumns,
  loadRelatedClubs,
  matchesDirectoryClub,
  profileDepartment,
  uniqueDirectoryClubs,
} from "../lib/clubDiscovery";
import type { Club } from "../lib/models";
import { Avatar, useUIStyles } from "./ui";
import { useTheme } from "../theme";

export function ClubDirectorySuggestions({
  search,
  department,
  type,
  located,
}: {
  search: string;
  department: string;
  type: ClubSearchType;
  located: boolean;
}) {
  const { profile: authProfile, session } = useAuth();
  const profileQuery = useProfile(session?.user.id);
  const profile = profileQuery.data || authProfile;
  const s = useUIStyles();
  const { colors } = useTheme();
  const term = useDebounced(search);
  const currentProfile = profile?.id === session?.user.id ? profile : null;
  const related = useQuery({
    queryKey: [
      "my-followed-clubs",
      session?.user.id,
      "directory",
      currentProfile?.linked_club_id,
      currentProfile?.club,
      currentProfile?.favorite_pro_club,
      currentProfile?.favorite_amateur_club,
    ],
    enabled: !!currentProfile,
    queryFn: ({ signal }) => loadRelatedClubs(currentProfile!, signal),
  });
  const city = currentProfile?.city?.trim() || "";
  const localDepartment = profileDepartment(currentProfile?.department);
  const nearby = useQuery({
    queryKey: [
      "club-directory-sector",
      city,
      localDepartment,
      term,
      department,
      type,
    ],
    enabled: !located && !!(city || localDepartment),
    queryFn: async ({ signal }) => {
      const read = async (byCity: boolean) => {
        let q = supabase
          .from("fff_clubs")
          .select(clubDirectoryColumns)
          .order("name")
          .order("id")
          .limit(8)
          .abortSignal(signal);
        if (byCity) q = q.ilike("city", city.replace(/[%_\\]/g, "\\$&"));
        if (department || localDepartment)
          q = q.eq("department_code", department || localDepartment);
        const filter = clubSearchFilter(term, type);
        if (filter) q = q.or(filter);
        const { data, error } = await q;
        if (error) throw error;
        return data as Club[];
      };
      const [town, area] = await Promise.all([
        city ? read(true) : [],
        localDepartment && (!department || department === localDepartment)
          ? read(false)
          : [],
      ]);
      return uniqueDirectoryClubs(town, area);
    },
  });
  const linked = (related.data || []).filter((club) =>
    matchesDirectoryClub(club, term, department, type),
  );
  const local = (nearby.data || [])
    .filter((club) => !linked.some((row) => row.id === club.id))
    .slice(0, 6);
  const row = (club: Club, label: string) => (
    <Pressable
      key={club.id}
      accessibilityRole="button"
      accessibilityLabel={`${club.name}, ${label}`}
      onPress={() => router.push(`/club/${club.id}`)}
      style={[
        s.card,
        { padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
      ]}
    >
      <Avatar uri={club.logo_url} name={club.name} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[s.text, { fontWeight: "700" }]}>
          {club.short_name || club.name}
        </Text>
        <Text style={s.small}>
          {[club.city, club.department_code].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.blue} />
    </Pressable>
  );
  return (
    <View style={{ gap: 12 }}>
      {!!linked.length && (
        <View style={{ gap: 9 }}>
          <Text style={s.h2}>Vos clubs</Text>
          <Text style={s.small}>Vos clubs suivis, favoris et rattachés.</Text>
          {linked.slice(0, 8).map((club) => row(club, "Vos clubs"))}
          {linked.length > 8 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/my-followed-clubs")}
            >
              <Text style={{ color: colors.blue }}>Voir mes clubs suivis</Text>
            </Pressable>
          )}
        </View>
      )}
      {!located && !!local.length && (
        <View style={{ gap: 9 }}>
          <Text style={s.h2}>Dans votre secteur</Text>
          <Text style={s.small}>
            {[city, localDepartment].filter(Boolean).join(" · ")} · d’après
            votre profil
          </Text>
          {local.map((club) => row(club, "Dans votre secteur"))}
        </View>
      )}
      {!!related.error && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void related.refetch()}
        >
          <Text style={s.small}>Recharger vos clubs</Text>
        </Pressable>
      )}
      {!located && !!nearby.error && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void nearby.refetch()}
        >
          <Text style={s.small}>Recharger les clubs de votre secteur</Text>
        </Pressable>
      )}
    </View>
  );
}
