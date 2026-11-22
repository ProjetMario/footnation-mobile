import { SafeAreaModal as Modal } from "./SafeAreaModal";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bell,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  HelpCircle,
  Info,
  LayoutDashboard,
  LogOut,
  PanelsTopLeft,
  Settings,
  Share2,
  Users,
  UsersRound,
  X,
  Zap,
} from "lucide-react-native";
import { useAuth } from "../lib/auth";
import { PostShareSheet } from "./PostShareSheet";
import { displayName, type Profile } from "../lib/models";
import { signOutCurrentDevice } from "../lib/logout";
import { supabase } from "../lib/supabase";
import { Avatar } from "./ui";
import { SiteFooter } from "./SiteFooter";
import { SUPPORTERS_ENABLED } from "../lib/supportersConfig";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";

type MenuDestination = {
  label: string;
  path: string;
  Icon: typeof Users;
};

const community: MenuDestination[] = [
  ...(SUPPORTERS_ENABLED ? [{ label: "Supporters", path: "/supporters", Icon: UsersRound }] : []),
  { label: "Membres", path: "/search-users", Icon: Users },
  { label: "Clubs", path: "/clubs", Icon: Building2 },
  { label: "Événements", path: "/events", Icon: Calendar },
  { label: "Pages", path: "/pro-pages", Icon: PanelsTopLeft },
  { label: "Groupes", path: "/groups", Icon: UsersRound },
];

export function AccountMenu({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { mode } = useTheme();
  const { session } = useAuth();
  const [sharedProfile, setSharedProfile] = useState<Profile | null>(null);
  useEffect(() => {
    if (visible) Keyboard.dismiss();
    else setSharedProfile(null);
  }, [visible]);
  useEffect(() => setSharedProfile(null), [session?.user.id]);
  if (!visible) return null;
  if (sharedProfile && sharedProfile.id === session?.user.id)
    return (
      <PostShareSheet
        profile={sharedProfile}
        onClose={() => setSharedProfile(null)}
        onNavigate={onClose}
      />
    );
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={onClose}
    >
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <AccountMenuContent
        key={session?.user.id || "guest"}
        onClose={onClose}
        onShare={setSharedProfile}
      />
    </Modal>
  );
}

function AccountMenuContent({
  onClose,
  onShare,
}: {
  onClose: () => void;
  onShare: (profile: Profile) => void;
}) {
  const { colors, mode } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const ownProfile = profile?.id === uid ? profile : null;
  const name = ownProfile
    ? displayName(ownProfile)
    : uid
      ? "Mon compte"
      : "Bienvenue sur FootNation";
  const { width, fontScale } = useWindowDimensions();
  const drawerWidth = Math.min(420, Math.max(0, width - 24));
  const [contentWidth, setContentWidth] = useState(drawerWidth);
  const oneColumn = contentWidth < 320 || fontScale > 1.2;
  const [active, setActive] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );
  const [footerOpen, setFooterOpen] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  const views = useQuery({
    queryKey: ["native-profile-views-count", uid],
    enabled: !!uid && active,
    queryFn: async ({ signal }) => {
      const { count, error } = await supabase
        .from("profile_views")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", uid!)
        .abortSignal(signal);
      if (error) throw error;
      return count;
    },
  });
  const notifications = useQuery({
    queryKey: ["notifications", uid, "unread-count"],
    enabled: !!uid && active,
    staleTime: 0,
    refetchInterval: active ? 30_000 : false,
    queryFn: async ({ signal }) => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", uid!)
        .eq("read", false)
        .abortSignal(signal);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error("Connexion requise.");
      await signOutCurrentDevice(uid);
    },
    onSuccess: () => {
      onClose();
      router.replace("/");
    },
  });
  const navigate = (path: string) => {
    onClose();
    router.push(path);
  };
  const viewCount = views.data;
  const unreadCount = notifications.data;
  const metricUnavailable = views.isError || views.isPaused;

  const shortcut = ({ label, path, Icon }: MenuDestination) => (
    <MenuAction
      key={path}
      label={label}
      Icon={Icon}
      onPress={() => navigate(path)}
      half={!oneColumn}
    />
  );

  return (
    <View style={styles.overlay}>
      <Pressable
        accessible={false}
        importantForAccessibility="no"
        onPress={onClose}
        style={styles.scrim}
      />
      <SafeAreaView
        edges={["top", "right", "bottom", "left"]}
        style={[styles.drawer, { width: drawerWidth }]}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
      >
        <View
          style={styles.content}
          onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}
        >
          <ScrollView
            showsVerticalScrollIndicator
            indicatorStyle={mode === "dark" ? "white" : "black"}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: 8, paddingBottom: 20 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                uid ? `Voir mon profil, ${name}` : "Se connecter à FootNation"
              }
              onPress={() => navigate(uid ? "/my-profile" : "/login")}
              style={({ pressed }) => [
                styles.identity,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Avatar uri={ownProfile?.avatar_url} name={name} size={44} />
              <View style={styles.identityText}>
                <Text accessibilityRole="header" style={styles.name}>
                  {name}
                </Text>
                <Text style={styles.membership}>
                  {uid ? "Voir mon profil" : "Se connecter"}
                </Text>
              </View>
            </Pressable>

            {!!uid && (
              <View style={styles.statsSection}>
                <View style={styles.statsRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      viewCount === 0
                        ? "0 vues, découvrir le Matching"
                        : typeof viewCount === "number"
                          ? `${viewCount} vue${viewCount > 1 ? "s" : ""} de mon profil, voir les visiteurs`
                          : "Voir les visiteurs de mon profil, compteur indisponible"
                    }
                    onPress={() =>
                      navigate(viewCount === 0 ? "/matching" : "/profile-views")
                    }
                    style={({ pressed }) => [
                      styles.viewsButton,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <LinearGradient
                      colors={["#0967FF", "#7A2CFF", "#FF174D"]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.viewsPill}
                    >
                      <Eye size={17} color={colors.white} strokeWidth={1.9} />
                      <Text style={styles.viewsValue}>
                        {typeof viewCount === "number"
                          ? viewCount.toLocaleString("fr-FR")
                          : "—"}{" "}
                        {viewCount === 1 ? "vue" : "vues"}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ouvrir mes opportunités"
                    onPress={() => navigate("/my-opportunities")}
                    style={({ pressed }) => [
                      styles.viewsButton,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <LinearGradient
                      colors={["#0967FF", "#7A2CFF", "#FF174D"]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.viewsPill}
                    >
                      <Briefcase
                        size={17}
                        color={colors.white}
                        strokeWidth={1.9}
                      />
                      <Text style={styles.viewsValue}>Opportunités</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
                {!!metricUnavailable && (
                  <Text accessibilityLiveRegion="polite" style={styles.hint}>
                    Compteur indisponible.
                  </Text>
                )}
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.grid}>
                <MenuAction
                  label="Partager"
                  accessibilityLabel="Partager mon profil"
                  Icon={Share2}
                  half={!oneColumn}
                  tinted
                  disabled={logout.isPending || (!!uid && !ownProfile)}
                  onPress={() =>
                    ownProfile ? onShare(ownProfile) : navigate("/login")
                  }
                />
                <MenuAction
                  label="Inviter"
                  accessibilityLabel="Inviter mon réseau"
                  Icon={Users}
                  half={!oneColumn}
                  tinted
                  onPress={() => navigate("/invite")}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Mon espace
              </Text>
              <View style={styles.grid}>
                {!uid &&
                  shortcut({
                    label: "Opportunités",
                    path: "/my-opportunities",
                    Icon: Briefcase,
                  })}
                {shortcut({ label: "Matching", path: "/matching", Icon: Zap })}
                {shortcut({
                  label: "Mon réseau",
                  path: "/network",
                  Icon: Users,
                })}
                <MenuAction
                  label="Notifications"
                  Icon={Bell}
                  half={!oneColumn}
                  accessibilityLabel={
                    typeof unreadCount === "number" && unreadCount > 0
                      ? `Notifications, ${unreadCount} non lues`
                      : notifications.isError
                        ? "Notifications, compteur indisponible"
                        : "Notifications"
                  }
                  badge={
                    uid && typeof unreadCount === "number" && unreadCount > 0
                      ? unreadCount.toLocaleString("fr-FR")
                      : undefined
                  }
                  onPress={() => navigate("/notifications")}
                />
                {shortcut({
                  label: "Mon CV",
                  path: "/cv-football",
                  Icon: FileText,
                })}
                {!!uid && shortcut({
                  label: "Mes clubs administrés",
                  path: "/club-dashboard",
                  Icon: Building2,
                })}
                {shortcut({
                  label: "Tous les outils",
                  path: "/more",
                  Icon: LayoutDashboard,
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Communauté
              </Text>
              <View style={styles.grid}>{community.map(shortcut)}</View>
            </View>

            <View style={styles.footer}>
              <MenuAction
                label="Aide"
                accessibilityLabel="FAQ et aide"
                Icon={HelpCircle}
                plain
                onPress={() => navigate("/help")}
              />
              <MenuAction
                label="Infos & liens"
                accessibilityLabel="Infos et liens FootNation"
                Icon={Info}
                plain
                expanded={footerOpen}
                onPress={() => setFooterOpen((value) => !value)}
              />
              {footerOpen && <SiteFooter />}
              <MenuAction
                label="Paramètres"
                Icon={Settings}
                plain
                onPress={() => navigate("/settings")}
              />
              <MenuAction
                label={uid ? "Déconnexion" : "Se connecter"}
                Icon={LogOut}
                plain
                danger={!!uid}
                busy={logout.isPending}
                disabled={logout.isPending}
                onPress={() => (uid ? logout.mutate() : navigate("/login"))}
              />
              {!!logout.isError && (
                <Text accessibilityRole="alert" style={styles.error}>
                  La déconnexion a échoué. Réessayez.
                </Text>
              )}
            </View>
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer le menu du compte"
            onPress={onClose}
            style={({ pressed }) => [
              styles.close,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <X size={22} color={colors.muted} strokeWidth={1.8} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function MenuAction({
  label,
  accessibilityLabel,
  Icon,
  onPress,
  half = false,
  tinted = false,
  plain = false,
  danger = false,
  busy = false,
  disabled = false,
  expanded,
  badge,
}: {
  label: string;
  accessibilityLabel?: string;
  Icon: typeof Users;
  onPress: () => void;
  half?: boolean;
  tinted?: boolean;
  plain?: boolean;
  danger?: boolean;
  busy?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  badge?: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const color = danger ? colors.danger : tinted ? colors.deepBlue : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{
        disabled,
        busy,
        ...(expanded === undefined ? {} : { expanded }),
      }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.action,
        {
          width: half ? "48.5%" : "100%",
          backgroundColor:
            tinted || hovered || pressed
              ? colors.accentSoft
              : plain
                ? "transparent"
                : colors.background,
          borderColor: focused ? colors.blue : "transparent",
          opacity: disabled ? 0.55 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Icon
          size={19}
          color={
            danger ? colors.danger : tinted ? colors.deepBlue : colors.muted
          }
          strokeWidth={1.8}
        />
      )}
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      {!!badge && <Text style={styles.badge}>{badge}</Text>}
      {expanded !== undefined ? (
        <ChevronDown
          size={16}
          color={colors.muted}
          style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
        />
      ) : plain && !danger ? (
        <ChevronRight size={16} color={colors.muted} />
      ) : null}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, alignItems: "flex-end" },
    scrim: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(7,12,25,0.50)",
    },
    drawer: { flex: 1, backgroundColor: colors.surface },
    content: { flex: 1 },
    scrollContent: { paddingBottom: 16 },
    close: {
      position: "absolute",
      top: 12,
      right: 8,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    identity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 80,
      paddingLeft: 18,
      paddingRight: 56,
      paddingVertical: 16,
    },
    identityText: { flex: 1, gap: 2 },
    name: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 16,
      lineHeight: 22,
      fontWeight: "700",
    },
    membership: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 18,
    },
    statsSection: { paddingHorizontal: 18, paddingBottom: 4, gap: 6 },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 10,
    },
    viewsButton: { alignSelf: "flex-start", maxWidth: "100%" },
    viewsPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 14,
      paddingVertical: 8,
      minHeight: 44,
      borderRadius: 24,
    },
    viewsValue: {
      color: colors.white,
      fontFamily: "Inter-SemiBold",
      fontSize: 13,
      lineHeight: 20,
      fontWeight: "600",
      flexShrink: 1,
    },
    section: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
    sectionTitle: {
      color: colors.muted,
      fontFamily: "Inter-SemiBold",
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "600",
      letterSpacing: 0.5,
      paddingHorizontal: 4,
      marginTop: 4,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 6,
    },
    action: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderWidth: 2,
      borderRadius: 12,
    },
    actionLabel: {
      fontFamily: "Inter-Medium",
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "500",
      flex: 1,
    },
    badge: {
      color: colors.deepBlue,
      backgroundColor: colors.accentSoft,
      borderRadius: 10,
      paddingHorizontal: 5,
      fontFamily: "Inter-SemiBold",
      fontSize: 11,
      lineHeight: 18,
      flexShrink: 1,
    },
    footer: {
      marginTop: 16,
      paddingTop: 8,
      marginHorizontal: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 2,
    },
    hint: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 18,
    },
    error: {
      color: colors.danger,
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 18,
    },
  });
