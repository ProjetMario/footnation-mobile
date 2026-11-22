import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowRight, Eye, Sparkles } from "lucide-react-native";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useTheme, type ThemeColors } from "../theme";
export default function ProfileViews() {
  return (
    <Screen title="Vues de mon profil">
      <AuthGate>
        <Views />
      </AuthGate>
    </Screen>
  );
}
function Views() {
  const s = useUIStyles();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const { session } = useAuth();
  const query = useInfiniteQuery({
    queryKey: ["native-profile-viewers", session!.user.id],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const views = await supabase
        .from("profile_views")
        .select("id,viewer_id,viewed_at", { count: "exact" })
        .eq("profile_id", session!.user.id)
        .order("viewed_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (views.error) throw views.error;
      let profiles: any[] = [];
      if (views.data.length) {
        const response = await supabase
          .from("profiles")
          .select("id,full_name,username,avatar_url,position,club")
          .in("id", [...new Set(views.data.map((view) => view.viewer_id))]);
        if (response.error) throw response.error;
        profiles = response.data;
      }
      return {
        total: views.count,
        rows: views.data.map((view) => ({
          ...view,
          viewer: profiles.find((p) => p.id === view.viewer_id),
        })),
      };
    },
    getNextPageParam: (last, pages) =>
      last.rows.length === 30 ? pages.length * 30 : undefined,
  });
  const rows = query.data?.pages.flatMap((page) => page.rows) ?? [];
  const total = query.data?.pages[0].total ?? 0;
  const latest = rows[0]?.viewed_at
    ? formatRelative(rows[0].viewed_at)
    : "Aucune vue";
  return (
    <>
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!query.data && (
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Eye size={26} color={colors.white} strokeWidth={2.6} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>Audience du profil</Text>
            <Text style={styles.heroTitle}>{total} vues</Text>
            <Text style={styles.heroSubtitle}>Dernière visite : {latest}</Text>
          </View>
          <View style={styles.sparkBadge}>
            <Sparkles size={16} color={colors.blue} strokeWidth={2.4} />
            <Text style={styles.sparkText}>Live</Text>
          </View>
        </View>
      )}
      {!!rows.length && (
        <View style={styles.list}>
          {rows.map((view) => (
            <ProfileViewRow key={view.id} view={view} styles={styles} />
          ))}
        </View>
      )}
      {!!(query.data && !query.data.pages[0].rows.length) && (
        <Empty title="Aucune visite enregistrée" />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Charger la suite"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}

function ProfileViewRow({
  view,
  styles,
}: {
  view: {
    id: string;
    viewer_id: string;
    viewed_at: string;
    viewer?: {
      full_name?: string | null;
      username?: string | null;
      avatar_url?: string | null;
      position?: string | null;
      club?: string | null;
    } | null;
  };
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useTheme();
  const name =
    view.viewer?.full_name || view.viewer?.username || "Membre FootNation";
  const subtitle =
    [view.viewer?.position, view.viewer?.club].filter(Boolean).join(" · ") ||
    "A consulté votre profil";
  return (
    <Pressable
      accessibilityRole={view.viewer ? "button" : undefined}
      accessibilityLabel={
        view.viewer ? `Voir le profil de ${name}` : "Profil indisponible"
      }
      disabled={!view.viewer}
      onPress={() => router.push(`/profile/${view.viewer_id}`)}
      style={({ pressed }) => [
        styles.rowCard,
        pressed && { transform: [{ scale: 0.992 }], opacity: 0.86 },
      ]}
    >
      <View style={styles.avatarWrap}>
        <Avatar uri={view.viewer?.avatar_url} name={name} size={62} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          <Text style={styles.timeBadge}>{formatRelative(view.viewed_at)}</Text>
        </View>
        <Text numberOfLines={1} style={styles.role}>
          {subtitle}
        </Text>
        <Text style={styles.absoluteDate}>
          {formatFullDate(view.viewed_at)}
        </Text>
      </View>
      <View style={styles.chevron}>
        <ArrowRight size={20} color={colors.muted} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

function formatFullDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date inconnue";
  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "à l’instant";
  if (diffMs < hour)
    return `il y a ${Math.max(1, Math.floor(diffMs / minute))} min`;
  if (diffMs < day) return `il y a ${Math.floor(diffMs / hour)} h`;
  if (diffMs < 7 * day) return `il y a ${Math.floor(diffMs / day)} j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    hero: {
      borderRadius: 28,
      padding: 22,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#101828",
      shadowOpacity: 0.08,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 3,
    },
    heroIcon: {
      width: 58,
      height: 58,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.blue,
    },
    eyebrow: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    heroTitle: {
      color: colors.navy,
      fontSize: 38,
      fontWeight: "900",
      lineHeight: 44,
    },
    heroSubtitle: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "600",
      marginTop: 3,
    },
    sparkBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.accentSoft,
    },
    sparkText: {
      color: colors.blue,
      fontSize: 12,
      fontWeight: "800",
    },
    list: {
      gap: 12,
    },
    rowCard: {
      minHeight: 94,
      borderRadius: 24,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarWrap: {
      width: 70,
      height: 70,
      borderRadius: 35,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    name: {
      flex: 1,
      minWidth: 0,
      color: colors.navy,
      fontSize: 17,
      fontWeight: "800",
    },
    role: {
      color: colors.ink,
      opacity: 0.76,
      fontSize: 14,
      fontWeight: "600",
    },
    absoluteDate: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "600",
    },
    timeBadge: {
      overflow: "hidden",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      color: colors.blue,
      backgroundColor: colors.accentSoft,
      fontSize: 12,
      fontWeight: "800",
    },
    chevron: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceRaised,
    },
  });
