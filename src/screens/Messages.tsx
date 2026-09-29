import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  ArrowLeft,
  ChevronDown,
  Edit3,
  Filter,
  MoreHorizontal,
  Search,
} from "lucide-react-native";
import { useAuth } from "../lib/auth";
import { useConversations } from "../lib/data";
import {
  isActivityOnline,
  readProfilesActivity,
  type ProfileActivity,
} from "../lib/profilePresence";
import { displayName } from "../lib/models";
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

const FILTER_KEYS = ["all", "unread"] as const;

function compactActivityLabel(activity: ProfileActivity | undefined, updatedAt?: number) {
  if (isActivityOnline(activity, updatedAt)) return "En ligne";
  if (!activity?.last_seen_at) return "";
  const date = new Date(activity.last_seen_at);
  const time = date.getTime();
  if (!Number.isFinite(time)) return "";
  const diff = Date.now() - time;
  if (diff < 60_000) return "À l’instant";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  if (hours < 48) return "Hier";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function ConversationAvatar({
  profile,
  online,
  unread,
  size = 62,
  dotSize = 16,
}: {
  profile: Parameters<typeof displayName>[0];
  online: boolean;
  unread?: boolean;
  size?: number;
  dotSize?: number;
}) {
  const styles = useThemedStyles(createMessagesStyles);
  return (
    <View style={[styles.avatarFrame, { width: size + 4, height: size + 4 }]}>
      <Avatar uri={profile?.avatar_url} name={displayName(profile)} size={size} />
      {online ? (
        <View
          accessibilityRole="text"
          accessibilityLabel="En ligne"
          style={[
            styles.onlineDot,
            { width: dotSize, height: dotSize, borderRadius: dotSize / 2 },
          ]}
        />
      ) : unread ? (
        <View
          accessibilityRole="text"
          accessibilityLabel="Message non lu"
          style={styles.unreadDot}
        />
      ) : null}
    </View>
  );
}

export default function Messages() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createMessagesStyles);
  const { session, profile } = useAuth();
  const t = useTranslation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTER_KEYS)[number]>("all");
  const query = useConversations(search, filter === "unread");
  const rows = (query.data?.pages.flat() || []).map(
    (message) =>
      [
        message.sender_id === session?.user.id
          ? message.receiver_id
          : message.sender_id,
        message,
      ] as const,
  );
  const spotlight = useMemo(() => rows.slice(0, 8), [rows]);
  const peerIds = useMemo(() => rows.map(([peer]) => peer), [rows]);
  const activities = useQuery({
    queryKey: ["message-profile-activities", session?.user.id, peerIds.join(",")],
    enabled: !!session?.user.id && peerIds.length > 0,
    refetchInterval: 15000,
    retry: false,
    queryFn: () => readProfilesActivity(session!.user.id, peerIds),
  });
  const activityById: Record<string, ProfileActivity> = activities.data || {};

  return (
    <Screen title="" back={false} scroll={false} header={false}>
      <AuthGate>
        <FlatList
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          data={rows}
          keyExtractor={([id]) => id}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.topBar}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retour"
                  onPress={() =>
                    router.canGoBack() ? router.back() : router.replace("/")
                  }
                  style={styles.backButton}
                >
                  <ArrowLeft size={24} color={colors.ink} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Voir mon profil"
                  onPress={() => router.push("/my-profile")}
                  style={styles.accountButton}
                >
                  <Avatar
                    uri={profile?.avatar_url}
                    name={displayName(profile)}
                    size={32}
                  />
                  <Text
                    style={[styles.accountName, { flexShrink: 1 }]}
                    numberOfLines={1}
                  >
                    {displayName(profile)}
                  </Text>
                  <ChevronDown size={18} color={colors.ink} />
                </Pressable>
                <View style={styles.topActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("messages.new")}
                    onPress={() => router.push("/new-message")}
                    style={styles.iconButton}
                  >
                    <Edit3 size={24} color={colors.ink} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                  <Search size={21} color="rgba(15,24,39,0.48)" />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t("messages.placeholder")}
                    placeholderTextColor="rgba(15,24,39,0.48)"
                    returnKeyType="search"
                    style={styles.searchInput}
                    accessibilityLabel={t("messages.searchAccessibility")}
                  />
                </View>
              </View>

              {spotlight.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.notesRail}
                >
                  {spotlight.map(([peer, message]) => {
                    const profile =
                      message.sender_id === session?.user.id
                        ? message.receiver
                        : message.sender;
                    return (
                      <Pressable
                        key={`note:${peer}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Ouvrir la discussion avec ${displayName(profile)}`}
                        onPress={() => router.push(`/conversation/${peer}`)}
                        style={styles.noteItem}
                      >
                        <ConversationAvatar
                          profile={profile}
                          size={72}
                          dotSize={18}
                          online={isActivityOnline(
                            activityById[peer],
                            activities.dataUpdatedAt,
                          )}
                        />
                        <Text style={styles.noteName} numberOfLines={1}>
                          {displayName(profile)}
                        </Text>
                        {!!compactActivityLabel(
                          activityById[peer],
                          activities.dataUpdatedAt,
                        ) && (
                          <Text
                            style={[
                              styles.noteStatus,
                              isActivityOnline(
                                activityById[peer],
                                activities.dataUpdatedAt,
                              ) && styles.noteStatusOnline,
                            ]}
                            numberOfLines={1}
                          >
                            {compactActivityLabel(
                              activityById[peer],
                              activities.dataUpdatedAt,
                            )}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              <View style={styles.filterTabs}>
                {FILTER_KEYS.map((item) => (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === item }}
                    aria-pressed={filter === item}
                    onPress={() => setFilter(item)}
                    style={[
                      styles.tabPill,
                      filter === item && styles.tabPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        filter === item && styles.tabTextActive,
                      ]}
                    >
                      {item === "all"
                        ? t("common.all")
                        : t("notifications.unread")}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.quickLinks}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("messages.pendingOutbox")}
                  onPress={() => router.push("/message-outbox")}
                  style={styles.quickLink}
                >
                  <Text style={styles.quickLinkText}>
                    {t("messages.pendingOutbox")}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("messages.clubs")}
                  onPress={() => router.push("/club-chat")}
                  style={styles.quickLink}
                >
                  <Text style={styles.quickLinkText}>
                    {t("messages.clubs")}
                  </Text>
                </Pressable>
              </View>

              {query.error && query.data ? (
                <ErrorState
                  error={query.error}
                  retry={() => void query.refetch()}
                />
              ) : null}
            </View>
          }
          renderItem={({ item: [peer, m] }) => {
            const p = m.sender_id === session?.user.id ? m.receiver : m.sender;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${displayName(p)}${m.unread_count > 0 ? `, ${m.unread_count} ${t("messages.unreadCount")}` : ""}`}
                onPress={() => router.push(`/conversation/${peer}`)}
                style={({ pressed }) => [
                  styles.conversationRow,
                  pressed && styles.conversationRowPressed,
                ]}
              >
                <ConversationAvatar
                  profile={p}
                  unread={m.unread_count > 0}
                  online={isActivityOnline(
                    activityById[peer],
                    activities.dataUpdatedAt,
                  )}
                />
                <View style={styles.conversationText}>
                  <View style={styles.conversationTitleRow}>
                    <Text style={styles.conversationName} numberOfLines={1}>
                      {displayName(p)}
                    </Text>
                    {m.unread_count > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {m.unread_count > 99 ? "99+" : String(m.unread_count)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.preview,
                      m.unread_count > 0 && styles.previewUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {m.is_blocked
                      ? t("messages.hidden")
                      : m.content || t("messages.sent")}
                  </Text>
                </View>
              </Pressable>
            );
          }}
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
                  search.trim()
                    ? t("messages.noResults")
                    : t("messages.startTitle")
                }
                description={
                  search.trim()
                    ? t("messages.noResultsDescription")
                    : t("messages.startDescription")
                }
              />
            )
          }
          ListFooterComponent={
            query.hasNextPage ? (
              <Button
                title={t("messages.loadOlder")}
                busy={query.isFetchingNextPage}
                onPress={() => void query.fetchNextPage()}
              />
            ) : null
          }
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
        />
      </AuthGate>
    </Screen>
  );
}

const createMessagesStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
      paddingHorizontal: 16,
      paddingTop: 22,
      paddingBottom: 108,
      gap: 10,
    },
    header: { gap: 18, paddingBottom: 10 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    accountButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      flex: 1,
      minHeight: 44,
    },
    accountName: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "800",
    },
    topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    searchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    searchBox: {
      flex: 1,
      minHeight: 52,
      borderRadius: 13,
      backgroundColor: "#EFF1F6",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      color: colors.ink,
      fontFamily: "Inter-Regular",
      fontSize: 20,
      paddingVertical: 0,
    },
    filterButton: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    filterButtonText: {
      color: colors.blue,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      fontWeight: "800",
    },
    notesRail: { gap: 16, paddingRight: 8, paddingTop: 2 },
    noteItem: { width: 90, alignItems: "center", gap: 5 },
    noteName: {
      color: colors.ink,
      fontFamily: "Inter-Regular",
      fontSize: 15,
      lineHeight: 19,
      maxWidth: 90,
    },
    noteStatus: {
      color: colors.muted,
      fontFamily: "Inter-Bold",
      fontSize: 11,
      lineHeight: 14,
      maxWidth: 90,
    },
    noteStatusOnline: { color: "#16A34A" },
    filterTabs: { flexDirection: "row", gap: 10 },
    tabPill: {
      flex: 1,
      minHeight: 46,
      borderRadius: 10,
      backgroundColor: "#F0F2F7",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    tabPillActive: { backgroundColor: "#E8F0FF" },
    tabText: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 15,
      fontWeight: "800",
    },
    tabTextActive: { color: colors.blue },
    quickLinks: { flexDirection: "row", gap: 10 },
    quickLink: {
      flex: 1,
      minHeight: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    quickLinkText: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "800",
    },
    conversationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      minHeight: 78,
      paddingVertical: 8,
      paddingHorizontal: 2,
      borderRadius: 18,
    },
    conversationRowPressed: { backgroundColor: "rgba(15,24,39,0.05)" },
    avatarFrame: { width: 66, height: 66, justifyContent: "center" },
    unreadDot: {
      position: "absolute",
      right: 0,
      bottom: 4,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: "#EF4444",
      borderWidth: 2,
      borderColor: colors.background,
    },
    onlineDot: {
      position: "absolute",
      right: 0,
      bottom: 4,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: "#2DD36F",
      borderWidth: 2,
      borderColor: colors.background,
    },
    conversationText: { flex: 1, minWidth: 0, gap: 4 },
    conversationTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    conversationName: {
      flex: 1,
      minWidth: 0,
      color: colors.ink,
      fontFamily: "Inter-Regular",
      fontSize: 19,
      lineHeight: 24,
    },
    preview: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 18,
      lineHeight: 23,
    },
    previewUnread: { color: colors.ink, fontFamily: "Inter-Bold" },
    badge: {
      minWidth: 24,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 12,
      backgroundColor: "#EF4444",
      alignItems: "center",
    },
    badgeText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 12,
      fontWeight: "800",
    },
  });
