import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import {
  BookOpen,
  ExternalLink,
  Shield,
  Users,
  Trophy,
} from "lucide-react-native";
import { useTheme } from "../theme";
import { websiteUrl } from "../lib/websiteUrl";
import { ClubPublicInformation } from "./ClubPublicInformation";
import { ClubAchievements } from "./ClubAchievements";
import { ClubCommunityPanel } from "./ClubCommunityPanel";
import { useClubUIStyles } from "./ClubDesign";

export function ClubAbout({ club }: { club: Record<string, any> }) {
  const s = useClubUIStyles();
  const { colors } = useTheme();
  const [error, setError] = useState("");
  const metadata =
    club.metadata && typeof club.metadata === "object" ? club.metadata : {};
  const text = (...values: unknown[]) =>
    values.find((v) => typeof v === "string" && v.trim()) as string | undefined;
  const description = text(club.description, metadata.description);
  const history = text(club.history, metadata.history, metadata.histoire);
  const founded = text(
    club.founded_date,
    metadata.founded_date,
    metadata.year_founded,
  );
  const open = async (value: string, kind: "web" | "email" | "phone") => {
    setError("");
    try {
      await Linking.openURL(
        kind === "web"
          ? websiteUrl(value)
          : kind === "email"
            ? `mailto:${encodeURIComponent(value)}`
            : `tel:${value.replace(/[^+\d]/g, "")}`,
      );
    } catch {
      setError("Ce lien n’a pas pu être ouvert.");
    }
  };
  return (
    <View style={{ gap: 16 }}>
      <Text accessibilityRole="header" style={s.title}>
        À propos du club
      </Text>
      <View style={s.card}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Shield size={21} color={colors.blue} />
          <Text style={s.h2}>Le club</Text>
        </View>
        <Text style={[s.text, { fontWeight: "700" }]}>{club.name}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {!!club.short_name && club.short_name !== club.name && (
            <Text style={s.small}>{club.short_name}</Text>
          )}
          {!!founded && (
            <Text style={s.small}>Fondé en {founded.slice(0, 4)}</Text>
          )}
          <Text style={s.small}>
            {club.type === "five_center"
              ? "Centre de football à 5"
              : "Club de football"}
          </Text>
          <Text style={s.small}>
            {[club.city, club.department_name || club.department_code]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        {!!description && (
          <Text selectable style={s.text}>
            {description}
          </Text>
        )}
      </View>
      <View style={s.card}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <BookOpen size={21} color={colors.blue} />
          <Text style={s.h2}>Histoire</Text>
        </View>
        <Text selectable style={history ? s.text : s.small}>
          {history || "Le club n’a pas encore renseigné son histoire."}
        </Text>
      </View>
      <ClubPublicInformation club={club} />
      {!!(club.website || club.email || club.phone) && (
        <View style={s.card}>
          <Text style={s.h2}>Coordonnées</Text>
          {[
            ["Site internet", club.website, "web"],
            ["Contacter le club", club.email, "email"],
            ["Téléphone", club.phone, "phone"],
          ].map(
            ([label, value, kind]) =>
              value && (
                <Pressable
                  key={label}
                  accessibilityRole="link"
                  onPress={() =>
                    void open(value, kind as "web" | "email" | "phone")
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    minHeight: 44,
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.text}>{label}</Text>
                    {kind !== "email" && (
                      <Text numberOfLines={1} style={s.small}>
                        {value}
                      </Text>
                    )}
                  </View>
                  <ExternalLink size={17} color={colors.blue} />
                </Pressable>
              ),
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {error}
            </Text>
          )}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Trophy size={21} color={colors.blue} />
        <Text style={s.h2}>Palmarès</Text>
      </View>
      <ClubAchievements id={club.id} legacy={club.achievements?.titles} />
      <View style={s.card}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Users size={21} color={colors.blue} />
          <Text style={s.h2}>Membres du club</Text>
        </View>
        <ClubCommunityPanel
          id={club.id}
          name={club.name}
          mode="members"
          hideHeading
        />
      </View>
    </View>
  );
}
