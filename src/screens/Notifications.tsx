import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useConnections } from "../lib/data";
import { useAuth } from "../lib/auth";
import { displayName } from "../lib/models";
import { supabase } from "../lib/supabase";
import { notificationPath } from "../lib/notificationPath";
import { Bell, Cake, CheckCheck, Eye, FileText, MapPin, PlaySquare, Radio, Repeat2, UserPlus } from "lucide-react-native";
import {
  Avatar,
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
} from "../components/ui";
import { AuthGate } from "../components/AuthGate";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import { useTranslation } from "../lib/i18n";
type NotificationItem = {
  kind: "item";
  id: string;
  content: string;
  created_at: string;
  read: boolean;
  link: string | null;
  sender_id?: string | null;
  metadata?: Record<string, unknown> | null;
  avatar: string | null;
  name: string;
  invitation: boolean;
  section: string;
  type?: string | null;
};
type NotificationSectionRow = {
  kind: "section";
  id: string;
  title: string;
};
export default function Notifications() {
  const { session } = useAuth();
  return <NotificationsContent key={session?.user.id || "anonymous"} />;
}
function NotificationsContent() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createNotificationStyles);
  const t = useTranslation();

  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const cache = useQueryClient();
  const [view, setView] = useState<"all" | "unread" | "invitations">("all");
  const unreadOnly = view === "unread";
  const invitations = useConnections("pending");
  const mark = useMutation({
    mutationFn: async (item: { id: string; link: string | null }) => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (!uid || auth.data.user?.id !== uid)
        throw new Error("Votre session a changé. Rechargez les notifications.");
      const result = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", item.id)
        .eq("receiver_id", uid)
        .select("id")
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data)
        throw new Error(
          "Cette notification n’est plus accessible. Actualisez la liste.",
        );
      return notificationPath(item.link);
    },
    onSuccess: (link) => {
      void cache.invalidateQueries({ queryKey: ["notifications", uid] });
    },
  });
  const markAll = useMutation({
    mutationFn: async () => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (!uid || auth.data.user?.id !== uid)
        throw new Error("Votre session a changé. Rechargez les notifications.");
      const result = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("receiver_id", uid)
        .eq("read", false)
        .select("id");
      if (result.error) throw result.error;
      return result.data?.length || 0;
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["notifications", uid] });
    },
  });
  const notifications = useInfiniteQuery({
    initialPageParam: 0,
    queryKey: ["notifications", session?.user.id, unreadOnly],
    enabled: !!session,
    queryFn: async ({ pageParam }) => {
      let request = supabase
        .from("notifications")
        .select("id,content,created_at,link,type,read,sender_id,metadata")
        .eq("receiver_id", session!.user.id);
      if (unreadOnly) request = request.eq("read", false);
      const { data, error } = await request
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const query = view === "invitations" ? invitations : notifications;
  useFocusEffect(
    useCallback(() => {
      if (uid) void query.refetch();
    }, [uid, query.refetch]),
  );
  const rows: NotificationItem[] =
    view === "invitations"
      ? (invitations.data?.pages.flat() || []).map((item) => ({
          kind: "item" as const,
          id: item.connection_id,
          content: `${item.other_full_name || item.other_username || "Un membre"} vous a envoyé une demande de connexion`,
          created_at: item.created_at,
          read: false,
          link: `/profile/${item.other_profile_id}`,
          avatar: item.other_avatar_url,
          name: item.other_full_name || item.other_username || "Membre",
          invitation: true,
          section: notificationSection(item.created_at, t),
        }))
      : (notifications.data?.pages.flat() || []).map((item) => ({
          kind: "item" as const,
          ...item,
          avatar: null,
          name: "",
          invitation: false,
          section: notificationSection(item.created_at, t),
        }));
  const listRows = withSectionHeaders(rows);
  return (
    <Screen title="" back scroll={false}>
      <AuthGate>
        <FlatList
          style={styles.screen}
          contentContainerStyle={styles.content}
          data={listRows}
          keyExtractor={(x) => x.id}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <View style={styles.titleBlock}>
                  <Text style={styles.title}>
                    {profile ? displayName(profile) : "Votre activité"}
                  </Text>
                  <Text style={styles.subtitle}>
                    {t("notifications.subtitle")}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("notifications.readAll")}
                  disabled={markAll.isPending || view === "invitations"}
                  onPress={() => markAll.mutate()}
                  style={({ pressed }) => [
                    styles.readAllButton,
                    {
                      opacity: pressed
                        ? 0.72
                        : view === "invitations"
                          ? 0.45
                          : 1,
                    },
                  ]}
                >
                  <CheckCheck size={24} color={colors.white} />
                  <Text style={styles.readAllText}>
                    {t("notifications.readAll")}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.filters}>
                {(
                  [
                    ["all", t("notifications.all")],
                    ["unread", t("notifications.unread")],
                    ["invitations", t("notifications.invitations")],
                  ] as const
                ).map(([key, label]) => (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: view === key }}
                    onPress={() => setView(key)}
                    style={[
                      styles.filterPill,
                      view === key && styles.filterPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        view === key && styles.filterTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {view === "invitations" && (
                <Text style={styles.helperText}>
                  {t("notifications.helper")}
                </Text>
              )}
              {!!mark.error && <ErrorState error={mark.error} />}
              {!!markAll.error && <ErrorState error={markAll.error} />}
              {!!(query.error && query.data) && (
                <ErrorState
                  error={query.error}
                  retry={() => void query.refetch()}
                />
              )}
            </View>
          }
          renderItem={({ item }) =>
            item.kind === "section" ? (
              <Text style={styles.sectionTitle}>{item.title}</Text>
            ) : (
              <Pressable
                style={styles.notificationCard}
                accessibilityRole="button"
                accessibilityLabel={`${item.invitation ? t("notifications.pendingInvitation") : item.read ? t("notifications.read") : t("notifications.unreadLabel")} : ${item.content}`}
                onPress={() => {
                  const path = notificationTargetPath(item);
                  if (path) router.push(path);
                  if (!item.read && !item.invitation) mark.mutate(item);
                }}
              >
                <View style={styles.notificationRow}>
                  <View style={styles.avatarWrap}>
                    <Avatar
                      uri={item.avatar}
                      name={item.name || item.content}
                      size={58}
                    />
                    {!!(!item.read && !item.invitation) && (
                      <View style={styles.unreadDot} />
                    )}
                  </View>
                  <View style={styles.notificationText}>
                    <View style={styles.messageLine}>
                      {notificationIcon(item)}
                      <Text style={styles.messageText}>
                        {item.name ? (
                          <Text style={styles.messageStrong}>{item.name} </Text>
                        ) : null}
                        {cleanNotificationContent(item.content, item.name)}
                      </Text>
                    </View>
                    <Text style={styles.timeText}>
                      {relativeNotificationTime(item.created_at)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            )
          }
          ListFooterComponent={
            query.hasNextPage ? (
              <Button
                title={
                  view === "invitations"
                    ? t("notifications.previousInvitations")
                    : t("notifications.previousNotifications")
                }
                busy={query.isFetchingNextPage}
                onPress={() => void query.fetchNextPage()}
              />
            ) : null
          }
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
          ListEmptyComponent={
            query.isPending ? (
              <Loading />
            ) : query.isError ? (
              <ErrorState
                error={query.error}
                retry={() => void query.refetch()}
              />
            ) : (
              <Empty
                title={
                  view === "invitations"
                    ? t("notifications.emptyInvitations")
                    : unreadOnly
                      ? t("notifications.emptyUnread")
                      : t("notifications.emptyAll")
                }
                description={
                  view === "invitations"
                    ? t("notifications.emptyInvitationDescription")
                    : t("notifications.emptyDescription")
                }
              />
            )
          }
        />
      </AuthGate>
    </Screen>
  );
}

function notificationSection(
  value: string,
  t: ReturnType<typeof useTranslation>,
) {
  const date = new Date(value);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start30 = new Date(startToday);
  start30.setDate(start30.getDate() - 30);
  if (date >= startToday) return t("common.today");
  if (date >= start30) return t("common.last30days");
  return t("common.older");
}
function withSectionHeaders(
  rows: NotificationItem[],
): (NotificationItem | NotificationSectionRow)[] {
  const result: (NotificationItem | NotificationSectionRow)[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!seen.has(row.section)) {
      seen.add(row.section);
      result.push({
        kind: "section",
        id: `section:${row.section}`,
        title: row.section,
      });
    }
    result.push(row);
  }
  return result;
}

function notificationTargetPath(item: NotificationItem) {
  if (isConnectionAcceptedNotification(item)) {
    const profileId =
      validProfileId(item.sender_id) ||
      validProfileId(item.metadata?.profile_id) ||
      validProfileId(item.metadata?.actor_id) ||
      validProfileId(item.metadata?.sender_id);
    if (profileId) return `/profile/${profileId}`;
  }
  return notificationPath(item.link);
}

function notificationIcon(item: NotificationItem) {
  const type = (item.type || "").toLowerCase();
  if (item.invitation || type === "connection_request")
    return <UserPlus size={18} color="#67E8F9" />;
  if (type === "profile_view") return <Eye size={18} color="#60A5FA" />;
  if (type.includes("birthday") || type.includes("anniversary"))
    return <Cake size={18} color="#FBBF24" />;
  if (type === "live_started" || type.includes("live"))
    return <Radio size={18} color="#F43F5E" />;
  if (type === "new_short") return <PlaySquare size={18} color="#A78BFA" />;
  if (type === "new_story" || type === "story_expired")
    return <Bell size={18} color="#38BDF8" />;
  if (type === "new_post" || type === "publication_published")
    return <FileText size={18} color="#34D399" />;
  if (type === "club_changed") return <Repeat2 size={18} color="#2DD4BF" />;
  return <MapPin size={18} color="#67E8F9" />;
}

function isConnectionAcceptedNotification(item: NotificationItem) {
  const type = (item.type || "").toLowerCase();
  return (
    [
      "connection_accepted",
      "connection.accepted",
      "accepted_connection",
      "native_connection_accepted",
    ].includes(type) ||
    /accept[ée] votre demande de connexion/i.test(item.content)
  );
}

function validProfileId(value: unknown) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}
function cleanNotificationContent(content: string, name: string) {
  if (!name) return content;
  const trimmed = content.trim();
  return trimmed.startsWith(name) ? trimmed.slice(name.length).trim() : trimmed;
}
function relativeNotificationTime(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  const diff = Math.max(0, Date.now() - time);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "IL Y A MOINS D’UNE MINUTE";
  if (diff < hour) return `IL Y A ${Math.floor(diff / minute)} MIN`;
  if (diff < day) return `IL Y A ${Math.floor(diff / hour)} H`;
  return `IL Y A ${Math.floor(diff / day)} JOURS`;
}

const createNotificationStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#050505" },
    content: {
      paddingHorizontal: 12,
      paddingTop: 24,
      paddingBottom: 104,
      gap: 14,
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
    },
    header: { gap: 20, marginBottom: 14 },
    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    titleBlock: { flex: 1, minWidth: 0, gap: 8 },
    title: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 30,
      lineHeight: 36,
      fontWeight: "800",
    },
    subtitle: {
      color: "rgba(255,255,255,0.46)",
      fontFamily: "Inter-Regular",
      fontSize: 18,
      lineHeight: 24,
    },
    readAllButton: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 8,
    },
    readAllText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "800",
    },
    filters: {
      flexDirection: "row",
      gap: 10,
      flexWrap: "wrap",
    },
    filterPill: {
      minHeight: 42,
      borderRadius: 15,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#141414",
    },
    filterPillActive: { backgroundColor: colors.white },
    filterText: {
      color: "rgba(255,255,255,0.66)",
      fontFamily: "Inter-Bold",
      fontSize: 13,
      fontWeight: "700",
    },
    filterTextActive: { color: "#050505" },
    helperText: {
      color: "rgba(255,255,255,0.52)",
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 20,
    },
    sectionTitle: {
      color: "rgba(255,255,255,0.54)",
      fontFamily: "Inter-Bold",
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "800",
      marginTop: 16,
      marginBottom: 6,
    },
    notificationCard: {
      borderRadius: 28,
      paddingVertical: 18,
      paddingHorizontal: 20,
      backgroundColor: "#151515",
    },
    notificationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 18,
    },
    avatarWrap: {
      width: 66,
      height: 66,
      borderRadius: 33,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#242424",
    },
    unreadDot: {
      position: "absolute",
      right: 1,
      top: 3,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: "#EF4444",
    },
    notificationText: { flex: 1, minWidth: 0, gap: 8 },
    messageLine: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
    },
    messageText: {
      flex: 1,
      minWidth: 0,
      color: "rgba(255,255,255,0.68)",
      fontFamily: "Inter-Regular",
      fontSize: 18,
      lineHeight: 25,
    },
    messageStrong: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontWeight: "800",
    },
    timeText: {
      color: "rgba(255,255,255,0.38)",
      fontFamily: "Inter-Bold",
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "800",
    },
  });
