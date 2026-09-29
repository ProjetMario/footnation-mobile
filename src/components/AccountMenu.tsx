import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Eye,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  PanelsTopLeft,
  Settings,
  Share2,
  Sparkles,
  Users,
  UsersRound,
  X,
  Zap,
} from "lucide-react-native";
import { useAuth } from "../lib/auth";
import { displayName } from "../lib/models";
import { signOutCurrentDevice } from "../lib/logout";
import { supabase } from "../lib/supabase";
import { Avatar } from "./ui";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";

type MenuDestination = {
  label: string;
  path: string;
  Icon: typeof Users;
};

const shortcuts: MenuDestination[] = [
  { label: "Membres", path: "/search-users", Icon: Users },
  { label: "Clubs", path: "/clubs", Icon: Building2 },
  { label: "Événements", path: "/events", Icon: Calendar },
  { label: "Page", path: "/pro-pages", Icon: PanelsTopLeft },
  { label: "Groupes", path: "/groups", Icon: UsersRound },
  { label: "Mon CV", path: "/cv-football", Icon: FileText },
  { label: "FAQ & Aide", path: "/help", Icon: HelpCircle },
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
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);
  if (!visible) return null;
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
      <AccountMenuContent key={session?.user.id || "guest"} onClose={onClose} />
    </Modal>
  );
}

function AccountMenuContent({ onClose }: { onClose: () => void }) {
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
  const oneColumn = contentWidth < 340 || fontScale > 1.2;
  const [active, setActive] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");
  const sharePending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
  const shareProfile = async () => {
    if (!uid) {
      navigate("/login");
      return;
    }
    if (sharePending.current || logout.isPending) return;
    sharePending.current = true;
    setSharing(true);
    setShareError("");
    setShareFeedback("");
    const url = `https://www.foot-nation.com/qr/${encodeURIComponent(uid)}`;
    const message = `${ownProfile ? displayName(ownProfile) : "Mon profil"} sur FootNation\n${url}`;
    try {
      const result = await Share.share({
        title: "Profil FootNation",
        message,
      });
      if (!mounted.current || result?.action === Share.dismissedAction) return;
      // RN Web resolves undefined after navigator.share succeeds.
      if (Platform.OS === "web" || result?.action === Share.sharedAction)
        onClose();
    } catch (error) {
      if (
        !mounted.current ||
        (error instanceof Error && error.name === "AbortError")
      )
        return;
      if (Platform.OS === "web") {
        try {
          if (!(await Clipboard.setStringAsync(message)))
            throw new Error("Copy failed");
          if (mounted.current)
            setShareFeedback(
              "Message et lien copiés. Colle-les dans l’application de ton choix.",
            );
          return;
        } catch {
          // Keep the menu available so the user can try sharing again.
        }
      }
      if (mounted.current)
        setShareError("Le partage du profil n’a pas pu s’ouvrir. Réessayez.");
    } finally {
      sharePending.current = false;
      if (mounted.current) setSharing(false);
    }
  };
  const viewCount = views.data;
  const unreadCount = notifications.data;
  const metricUnavailable = views.isError || views.isPaused;

  const shortcut = (
    { label, path, Icon }: MenuDestination,
    fullWidth = false,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={() => navigate(path)}
      style={({ pressed }) => [
        styles.shortcut,
        {
          width: oneColumn || fullWidth ? "100%" : "48.4%",
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <Icon size={21} color={colors.blue} strokeWidth={1.8} />
      <Text style={styles.shortcutLabel}>{label}</Text>
    </Pressable>
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
            contentContainerStyle={styles.scrollContent}
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
              <View style={styles.avatarRing}>
                <Avatar uri={ownProfile?.avatar_url} name={name} size={52} />
              </View>
              <View style={styles.identityText}>
                <Text accessibilityRole="header" style={styles.name}>
                  {name}
                </Text>
                <Text style={styles.membership}>
                  {uid ? "Membre FootNation" : "Ton réseau 100 % football"}
                </Text>
              </View>
            </Pressable>

            {!!uid && (
              <View style={styles.statsSection}>
                <View style={styles.statsRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      typeof viewCount === "number"
                        ? `${viewCount} vue${viewCount > 1 ? "s" : ""} de mon profil, voir les visiteurs`
                        : "Voir les visiteurs de mon profil, compteur indisponible"
                    }
                    onPress={() => navigate("/profile-views")}
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
                      <Eye size={18} color={colors.white} strokeWidth={1.9} />
                      <Text style={styles.viewsValue}>
                        {typeof viewCount === "number"
                          ? viewCount.toLocaleString("fr-FR")
                          : "—"}{" "}
                        {viewCount === 1 ? "vue" : "vues"}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
                {!!metricUnavailable && (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={styles.statsHint}
                  >
                    Certains compteurs sont momentanément indisponibles.
                  </Text>
                )}
              </View>
            )}

            <View style={styles.actionsSection}>
              <View style={styles.invitationCard}>
                <Sparkles size={23} color={colors.deepBlue} strokeWidth={1.8} />
                <View style={styles.invitationText}>
                  <Text style={styles.invitationTitle}>
                    Invite ton réseau sur FootNation
                  </Text>
                  <Text style={styles.invitationDescription}>
                    Envoie ton profil à tes amis, coéquipiers, coachs et clubs.
                    Demande-leur de s’inscrire pour créer ton vrai réseau
                    football.
                  </Text>
                </View>
              </View>

              <View style={styles.mainActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Partager mon profil"
                  accessibilityState={{
                    busy: sharing,
                    disabled: sharing || logout.isPending,
                  }}
                  disabled={sharing || logout.isPending}
                  onPress={() => void shareProfile()}
                  style={({ pressed }) => ({
                    opacity:
                      sharing || logout.isPending ? 0.6 : pressed ? 0.8 : 1,
                  })}
                >
                  <View style={[styles.primaryAction, styles.shareAction]}>
                    <View style={styles.actionLeading}>
                      {sharing ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Share2
                          size={22}
                          color={colors.white}
                          strokeWidth={1.9}
                        />
                      )}
                      <Text style={styles.actionLabel}>Partager</Text>
                    </View>
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>
                        Partage ton profil !
                      </Text>
                    </View>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigate("/invite")}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <View style={[styles.primaryAction, styles.inviteAction]}>
                    <View style={styles.actionLeading}>
                      <Users
                        size={22}
                        color={colors.deepBlue}
                        strokeWidth={1.9}
                      />
                      <Text
                        style={[styles.actionLabel, styles.inviteActionLabel]}
                      >
                        Inviter mon réseau
                      </Text>
                    </View>
                    <View
                      style={[styles.actionBadge, styles.inviteActionBadge]}
                    >
                      <Text
                        style={[
                          styles.actionBadgeText,
                          styles.inviteActionLabel,
                        ]}
                      >
                        Fais-les s’inscrire !
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>
              {!!shareError && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {shareError}
                </Text>
              )}
              {!!shareFeedback && (
                <Text accessibilityLiveRegion="polite" style={styles.statsHint}>
                  {shareFeedback}
                </Text>
              )}

              <View style={styles.shortcutGrid}>
                {shortcuts.map((destination, index) =>
                  shortcut(destination, index === shortcuts.length - 1),
                )}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ouvrir le matching FootNation"
                onPress={() => navigate("/matching")}
                style={({ pressed }) => [
                  styles.matchingShortcut,
                  { opacity: pressed ? 0.82 : 1 },
                ]}
              >
                <View style={styles.matchingIcon}>
                  <Zap size={24} color={colors.white} strokeWidth={2} />
                </View>
                <View style={styles.matchingText}>
                  <Text style={styles.matchingTitle}>Matching intelligent</Text>
                  <Text style={styles.matchingDescription}>
                    Découvre les joueurs, clubs et opportunités compatibles avec
                    ton profil.
                  </Text>
                </View>
                <View style={styles.matchingBadge}>
                  <Text style={styles.matchingBadgeText}>Swipe</Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.navigationSection}>
              {shortcut(
                { label: "Mon réseau", path: "/network", Icon: Users },
                true,
              )}
              {shortcut(
                { label: "Matching", path: "/matching", Icon: Zap },
                true,
              )}
              {shortcut(
                {
                  label: "Opportunités",
                  path: "/opportunities",
                  Icon: Briefcase,
                },
                true,
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  typeof unreadCount === "number" && unreadCount > 0
                    ? `Notifications, ${unreadCount} non lues`
                    : notifications.isError
                      ? "Notifications, compteur indisponible"
                      : "Notifications"
                }
                onPress={() => navigate("/notifications")}
                style={({ pressed }) => [
                  styles.shortcut,
                  styles.notificationRow,
                  { opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <View style={styles.notificationLeading}>
                  <Bell size={22} color={colors.blue} strokeWidth={1.8} />
                  <Text style={styles.shortcutLabel}>Notifications</Text>
                </View>
                {!!(
                  uid &&
                  typeof unreadCount === "number" &&
                  unreadCount > 0
                ) && (
                  <Text style={styles.unread}>
                    {unreadCount.toLocaleString("fr-FR")} non lue
                    {unreadCount > 1 ? "s" : ""}
                  </Text>
                )}
              </Pressable>
              {shortcut(
                {
                  label: "Tous mes outils",
                  path: "/more",
                  Icon: LayoutDashboard,
                },
                true,
              )}
            </View>

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigate("/settings")}
                style={({ pressed }) => [
                  styles.footerButton,
                  styles.settingsButton,
                  { opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <Settings size={18} color={colors.muted} strokeWidth={1.8} />
                <Text style={styles.settingsLabel}>Paramètres</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  busy: logout.isPending,
                  disabled: logout.isPending || sharing,
                }}
                disabled={logout.isPending || sharing}
                onPress={() => (uid ? logout.mutate() : navigate("/login"))}
                style={({ pressed }) => [
                  styles.footerButton,
                  styles.logoutButton,
                  {
                    opacity:
                      logout.isPending || sharing ? 0.6 : pressed ? 0.65 : 1,
                  },
                ]}
              >
                {logout.isPending ? (
                  <ActivityIndicator color={colors.danger} />
                ) : (
                  <LogOut size={18} color={colors.danger} strokeWidth={1.8} />
                )}
                <Text style={styles.logoutLabel}>
                  {uid ? "Déconnexion" : "Se connecter"}
                </Text>
              </Pressable>
              {!!logout.isError && (
                <Text accessibilityRole="alert" style={styles.error}>
                  La déconnexion a échoué. Vérifie ta connexion et réessaie.
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
            <X size={24} color={colors.muted} strokeWidth={1.8} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, alignItems: "flex-end" },
    scrim: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: "rgba(7,12,25,0.60)",
    },
    drawer: { flex: 1, backgroundColor: colors.surface },
    content: { flex: 1 },
    scrollContent: { paddingBottom: 12 },
    close: {
      position: "absolute",
      top: 7,
      right: 7,
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
      minHeight: 106,
      paddingLeft: 20,
      paddingRight: 54,
      paddingVertical: 22,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatarRing: {
      borderWidth: 2,
      borderColor: colors.blue,
      padding: 2,
      borderRadius: 32,
    },
    identityText: { flex: 1, gap: 5 },
    name: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "700",
    },
    membership: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 13,
      lineHeight: 19,
    },
    statsSection: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 10,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    statsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 10,
    },
    viewsPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 14,
      paddingVertical: 9,
      minHeight: 44,
      borderRadius: 24,
      maxWidth: "100%",
    },
    viewsButton: { maxWidth: "100%", flexShrink: 1 },
    viewsValue: {
      color: colors.white,
      fontFamily: "Inter-SemiBold",
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
      flexShrink: 1,
    },
    statsHint: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 18,
    },
    actionsSection: {
      padding: 20,
      gap: 18,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    invitationCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 11,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.accentSoft,
      borderRadius: 15,
      padding: 14,
    },
    invitationText: { flex: 1, gap: 5 },
    invitationTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 15,
      lineHeight: 21,
      fontWeight: "700",
    },
    invitationDescription: {
      color: colors.ink,
      fontFamily: "Inter-Regular",
      fontSize: 13,
      lineHeight: 19,
    },
    mainActions: { gap: 9 },
    primaryAction: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 10,
      minHeight: 58,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    actionLeading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 110,
    },
    actionLabel: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 15,
      lineHeight: 21,
      fontWeight: "700",
      flexShrink: 1,
    },
    actionBadge: {
      maxWidth: "100%",
      borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.12)",
      paddingHorizontal: 9,
      paddingVertical: 5,
      flexShrink: 1,
    },
    actionBadgeText: {
      color: colors.white,
      fontFamily: "Inter-SemiBold",
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "600",
      textAlign: "center",
    },
    shortcutGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 9,
    },
    shortcut: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      minHeight: 49,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13,
      backgroundColor: colors.surface,
    },
    shortcutLabel: {
      color: colors.ink,
      fontFamily: "Inter-Medium",
      fontSize: 15,
      lineHeight: 21,
      fontWeight: "500",
      flexShrink: 1,
    },
    matchingShortcut: {
      minHeight: 104,
      borderRadius: 22,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      backgroundColor: "#111827",
      overflow: "hidden",
      shadowColor: "#111827",
      shadowOpacity: 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    matchingIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.blue,
    },
    matchingText: { flex: 1, minWidth: 0, gap: 4 },
    matchingTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "800",
    },
    matchingDescription: {
      color: "rgba(255,255,255,0.68)",
      fontFamily: "Inter-Regular",
      fontSize: 13,
      lineHeight: 18,
    },
    matchingBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: "rgba(139,92,246,0.25)",
      borderWidth: 1,
      borderColor: "rgba(167,139,250,0.45)",
    },
    matchingBadgeText: {
      color: "#C4B5FD",
      fontFamily: "Inter-Bold",
      fontSize: 12,
      fontWeight: "800",
    },
    navigationSection: {
      padding: 20,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    notificationRow: { flexWrap: "wrap", justifyContent: "space-between" },
    notificationLeading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flexShrink: 1,
    },
    unread: {
      color: colors.deepBlue,
      fontFamily: "Inter-Bold",
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      flexShrink: 1,
    },
    footer: { paddingHorizontal: 20, paddingTop: 18, gap: 10 },
    footerButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      minHeight: 46,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 13,
      borderWidth: 1,
    },
    settingsButton: {
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
    },
    settingsLabel: {
      color: colors.ink,
      fontFamily: "Inter-SemiBold",
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
      flexShrink: 1,
    },
    logoutButton: {
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
    },
    logoutLabel: {
      color: colors.danger,
      fontFamily: "Inter-SemiBold",
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
      flexShrink: 1,
    },
    error: {
      color: colors.danger,
      fontFamily: "Inter-Regular",
      fontSize: 13,
      lineHeight: 19,
    },
    shareAction: { backgroundColor: "#0064D8" },
    inviteAction: {
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inviteActionLabel: { color: colors.deepBlue },
    inviteActionBadge: { backgroundColor: colors.surface },
  });
