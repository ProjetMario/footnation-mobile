import React, { useCallback, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import Animated, {
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useFrameCallback,
  useSharedValue,
  type FrameInfo,
} from "react-native-reanimated";
import {
  ChevronRight,
  Pause,
  Play,
  Radio,
  RotateCcw,
} from "lucide-react-native";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import { useFeaturedMatches } from "../lib/useMatches";
import type { FeaturedMatch } from "../lib/featuredMatches";

function shortDate(date: string) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return parts ? `${parts[3]}/${parts[2]}` : "Date à confirmer";
}

function scoreText(value: number | null) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? String(value)
    : "–";
}

function matchState(item: FeaturedMatch, offline: boolean) {
  if (item.state === "live")
    return item.stale || offline ? "À actualiser" : "LIVE";
  if (item.state === "finished") return `Terminé · ${shortDate(item.date)}`;
  if (item.state === "scheduled") {
    const kickoff = item.match.kickoff_at
      ? new Date(item.match.kickoff_at)
      : null;
    const time =
      kickoff && Number.isFinite(kickoff.getTime())
        ? kickoff.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Horaire à confirmer";
    return `${shortDate(item.date)} · ${time}`;
  }
  return `Statut à confirmer · ${shortDate(item.date)}`;
}

function freshness(item: FeaturedMatch, offline: boolean) {
  const fetched = new Date(item.fetchedAt);
  const updated = Number.isFinite(fetched.getTime())
    ? `Dernière actualisation le ${fetched.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à ${fetched.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`
    : "Dernière actualisation non précisée.";
  return `${offline ? "Données conservées hors connexion. " : item.stale ? "Données à actualiser. " : ""}${updated}`;
}

function TeamLogo({
  uri,
  abbreviation,
}: {
  uri?: string | null;
  abbreviation: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const source = uri?.trim() || "";
  const [loaded, setLoaded] = useState("");
  const [failed, setFailed] = useState("");
  const ready = !!source && loaded === source && failed !== source;
  return (
    <View
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.logoBox}
    >
      <Text
        numberOfLines={1}
        style={[styles.teamFallback, { opacity: ready ? 0 : 1 }]}
      >
        {abbreviation}
      </Text>
      {!!(source && failed !== source) && (
        <Image
          key={source}
          source={{ uri: source }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={0}
          onLoad={() => setLoaded(source)}
          onError={() => setFailed(source)}
          style={[styles.logo, { opacity: ready ? 1 : 0 }]}
        />
      )}
    </View>
  );
}

function MatchPill({
  item,
  offline,
  duplicate = false,
}: {
  item: FeaturedMatch;
  offline: boolean;
  duplicate?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { match } = item;
  const home = match.home.name.trim() || "Équipe domicile";
  const away = match.away.name.trim() || "Équipe extérieure";
  const homeScore = scoreText(match.score.home);
  const awayScore = scoreText(match.score.away);
  const state = matchState(item, offline);
  const live = item.state === "live" && !item.stale && !offline;
  const scoreDescription = `${homeScore === "–" ? "Score domicile non renseigné" : `${homeScore} pour ${home}`}, ${awayScore === "–" ? "score extérieur non renseigné" : `${awayScore} pour ${away}`}`;
  return (
    <Pressable
      accessible={!duplicate}
      focusable={!duplicate}
      tabIndex={duplicate ? -1 : 0}
      accessibilityRole="button"
      accessibilityLabel={`${home} contre ${away}. ${scoreDescription}. ${match.tournament.name || "Compétition non précisée"}. ${state}. ${freshness(item, offline)}`}
      accessibilityHint="Ouvre le détail du match."
      onPress={() =>
        router.push(
          `/match/${encodeURIComponent(match.external_match_id)}?date=${encodeURIComponent(item.date)}`,
        )
      }
      style={({ pressed }) => [
        styles.match,
        live ? styles.liveMatch : undefined,
        { opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <View style={styles.teams}>
        <TeamLogo
          uri={match.home.logo}
          abbreviation={
            match.home.shortName?.trim() ||
            home.slice(0, 3).toLocaleUpperCase("fr-FR")
          }
        />
        <Text style={styles.score}>
          {homeScore} – {awayScore}
        </Text>
        <TeamLogo
          uri={match.away.logo}
          abbreviation={
            match.away.shortName?.trim() ||
            away.slice(0, 3).toLocaleUpperCase("fr-FR")
          }
        />
      </View>
      <View style={styles.matchMeta}>
        {!!live && <View style={styles.liveDot} />}
        <Text
          numberOfLines={1}
          style={[styles.state, live ? styles.liveText : undefined]}
        >
          {state}
        </Text>
        <Text numberOfLines={1} style={styles.league}>
          {match.tournament.name}
        </Text>
      </View>
    </Pressable>
  );
}

function StatusPill({
  message,
  loading,
  retry,
}: {
  message: string;
  loading?: boolean;
  retry?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.status}>
      {!!loading && <ActivityIndicator size="small" color={colors.blue} />}
      <Text accessibilityLiveRegion="polite" style={styles.statusText}>
        {message}
      </Text>
      {!!retry && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Réessayer de charger les matchs"
          onPress={retry}
          style={styles.retry}
        >
          <RotateCcw size={18} color={colors.blue} />
        </Pressable>
      )}
    </View>
  );
}

export function MatchTicker({ active = true }: { active?: boolean } = {}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    items,
    loading,
    refreshing,
    unavailable,
    offline,
    incomplete,
    retry,
  } = useFeaturedMatches(active);
  const warning = unavailable
    ? "Service des matchs indisponible."
    : offline
      ? "Hors connexion. Données enregistrées."
      : incomplete
        ? "Certains matchs restent indisponibles."
        : null;
  const openMatches = () => router.push("/matches?source=espn");
  const scrollRef = useAnimatedRef<ScrollView>();
  const offset = useSharedValue(0);
  const period = useSharedValue(0);
  const touching = useSharedValue(false);
  const dragging = useSharedValue(false);
  const momentum = useSharedValue(false);
  const cooldown = useSharedValue(0);
  const autoDriving = useSharedValue(false);
  const [sequenceWidth, setSequenceWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [manualPause, setManualPause] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [screenReader, setScreenReader] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    let mounted = true;
    let motionChanged = false;
    let readerChanged = false;
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        motionChanged = true;
        setReduceMotion(value);
      },
    );
    const reader = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      (value) => {
        readerChanged = true;
        setScreenReader(value);
      },
    );
    const app = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    void Promise.all([
      AccessibilityInfo.isReduceMotionEnabled(),
      // RN Web returns a constant true, not an actual reader detection. Web
      // relies on reduced motion, the pause control and keyboard-focus pause.
      Platform.OS === "web"
        ? Promise.resolve(false)
        : AccessibilityInfo.isScreenReaderEnabled(),
    ])
      .then(([motionValue, readerValue]) => {
        if (!mounted) return;
        if (!motionChanged) setReduceMotion(motionValue);
        if (!readerChanged) setScreenReader(readerValue);
        setPreferencesReady(true);
      })
      .catch(() => {
        // An unavailable accessibility preference leaves the rail stationary.
      });
    return () => {
      mounted = false;
      motion.remove();
      reader.remove();
      app.remove();
    };
  }, []);
  const motionAllowed = preferencesReady && !reduceMotion && !screenReader;
  const canLoop =
    motionAllowed &&
    items.length > 1 &&
    sequenceWidth > viewportWidth + 1 &&
    viewportWidth > 0;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (
        !autoDriving.value ||
        touching.value ||
        dragging.value ||
        momentum.value
      )
        offset.value = Math.max(0, event.contentOffset.x);
    },
    onBeginDrag: () => {
      dragging.value = true;
      autoDriving.value = false;
      cooldown.value = 5000;
    },
    onEndDrag: () => {
      dragging.value = false;
      cooldown.value = 5000;
    },
    onMomentumBegin: () => {
      momentum.value = true;
      autoDriving.value = false;
    },
    onMomentumEnd: () => {
      momentum.value = false;
      cooldown.value = 5000;
    },
  });
  const frame = useFrameCallback(
    useCallback(
      (info: FrameInfo) => {
        "worklet";
        const elapsed = Math.min(info.timeSincePreviousFrame ?? 0, 48);
        if (touching.value || dragging.value || momentum.value) {
          autoDriving.value = false;
          cooldown.value = 5000;
          return;
        }
        if (cooldown.value > 0) {
          autoDriving.value = false;
          cooldown.value = Math.max(0, cooldown.value - elapsed);
          return;
        }
        if (period.value <= 0 || elapsed === 0) return;
        // Both visual copies are identical: modulo wraps onto the same pixels.
        // Native execution stays on the UI thread; Web performs one scroll write.
        const next = (offset.value + elapsed * 0.022) % period.value;
        autoDriving.value = true;
        offset.value = next;
        scrollTo(scrollRef, next, 0, false);
      },
      [
        autoDriving,
        cooldown,
        dragging,
        momentum,
        offset,
        period,
        scrollRef,
        touching,
      ],
    ),
    false,
  );

  useEffect(() => {
    period.value = sequenceWidth;
    if (!canLoop && sequenceWidth > 0 && offset.value >= sequenceWidth) {
      const normalized = offset.value % sequenceWidth;
      autoDriving.value = false;
      offset.value = normalized;
      scrollRef.current?.scrollTo({ x: normalized, y: 0, animated: false });
    }
  }, [autoDriving, canLoop, offset, period, scrollRef, sequenceWidth]);
  useEffect(() => {
    const running =
      canLoop &&
      focused &&
      active &&
      foreground &&
      !manualPause &&
      !hovered &&
      !keyboardFocus;
    frame.setActive(running);
    if (!running) autoDriving.value = false;
    if (!focused || !active || !foreground) {
      touching.value = false;
      dragging.value = false;
      momentum.value = false;
      cooldown.value = 5000;
    }
    return () => {
      frame.setActive(false);
      autoDriving.value = false;
    };
  }, [
    active,
    autoDriving,
    canLoop,
    cooldown,
    dragging,
    focused,
    foreground,
    frame,
    hovered,
    keyboardFocus,
    manualPause,
    momentum,
    touching,
  ]);

  const hold = () => {
    autoDriving.value = false;
    cooldown.value = 5000;
  };
  return (
    <View>
      <View style={styles.ticker}>
        <Pressable
          testID="match-ticker-toggle"
          accessibilityRole="button"
          accessibilityLabel={
            canLoop
              ? manualPause
                ? "Reprendre le défilement automatique des matchs"
                : "Mettre en pause le défilement automatique des matchs"
              : "Tous les matchs"
          }
          accessibilityHint={
            canLoop
              ? "Le bandeau reste défilable au doigt. Le bouton Tous ouvre la liste des matchs."
              : undefined
          }
          onPress={() => {
            if (canLoop) {
              setManualPause((paused) => !paused);
              cooldown.value = 0;
            } else openMatches();
          }}
          style={({ pressed }) => [
            styles.allMatches,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          {canLoop ? (
            manualPause ? (
              <Play size={20} color={colors.blue} />
            ) : (
              <Pause size={20} color={colors.blue} />
            )
          ) : (
            <Radio size={21} color={colors.blue} />
          )}
          <Text style={styles.sectionName}>MATCHS</Text>
        </Pressable>
        <View
          style={styles.rail}
          onPointerEnter={
            Platform.OS === "web"
              ? (event) => {
                  if (event.nativeEvent.pointerType === "mouse") {
                    hold();
                    setHovered(true);
                  }
                }
              : undefined
          }
          onPointerLeave={
            Platform.OS === "web"
              ? (event) => {
                  if (event.nativeEvent.pointerType === "mouse") {
                    hold();
                    setHovered(false);
                  }
                }
              : undefined
          }
          onFocus={() => {
            hold();
            setKeyboardFocus(true);
          }}
          onBlur={() => {
            hold();
            setKeyboardFocus(false);
          }}
          onTouchStart={() => {
            touching.value = true;
            hold();
          }}
          onTouchEnd={() => {
            touching.value = false;
            hold();
          }}
          onTouchCancel={() => {
            touching.value = false;
            hold();
          }}
        >
          <Animated.ScrollView
            ref={scrollRef}
            testID="match-ticker-scroll"
            horizontal
            onLayout={(event) =>
              setViewportWidth(event.nativeEvent.layout.width)
            }
            onScroll={onScroll}
            scrollEventThrottle={16}
            bounces={false}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            style={styles.rail}
            contentContainerStyle={styles.railContent}
          >
            {!!(loading && !offline && items.length === 0) && (
              <StatusPill message="Chargement des matchs…" loading />
            )}
            {!!((!loading || offline) && items.length === 0) && (
              <StatusPill
                message={
                  unavailable
                    ? "Service des matchs indisponible."
                    : offline
                      ? "Hors connexion. Aucun match enregistré."
                      : incomplete
                        ? "Impossible de charger les matchs."
                        : "Aucun match disponible pour le moment."
                }
                retry={retry}
              />
            )}
            <View
              testID="match-ticker-track"
              style={styles.sequence}
              onLayout={(event) =>
                setSequenceWidth(event.nativeEvent.layout.width)
              }
            >
              {items.map((item) => (
                <MatchPill
                  key={`${item.date}:${item.match.external_match_id}`}
                  item={item}
                  offline={offline}
                />
              ))}
            </View>
            {!!canLoop && (
              <View
                testID="match-ticker-copy"
                accessible={false}
                aria-hidden
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.sequence}
              >
                {items.map((item) => (
                  <MatchPill
                    key={`copy:${item.date}:${item.match.external_match_id}`}
                    item={item}
                    offline={offline}
                    duplicate
                  />
                ))}
              </View>
            )}
          </Animated.ScrollView>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voir tous les matchs"
          onPress={openMatches}
          style={({ pressed }) => [styles.more, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={styles.moreText}>Tous</Text>
          <ChevronRight size={15} color={colors.muted} />
        </Pressable>
      </View>
      {!!(items.length > 0 && warning) && (
        <View style={styles.warning}>
          <Text accessibilityLiveRegion="polite" style={styles.warningText}>
            {warning}
          </Text>
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.blue} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Actualiser les matchs"
              onPress={retry}
              style={styles.retry}
            >
              <RotateCcw size={17} color={colors.blue} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ticker: {
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    allMatches: {
      minWidth: 52,
      minHeight: 60,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    sectionName: {
      fontFamily: "Inter-Bold",
      color: colors.ink,
      fontSize: 8,
      lineHeight: 11,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
    rail: { flex: 1 },
    railContent: { alignItems: "center" },
    sequence: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingRight: 8,
    },
    match: {
      width: 196,
      minHeight: 60,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 10,
      paddingVertical: 9,
      justifyContent: "center",
      gap: 6,
    },
    liveMatch: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.danger,
    },
    teams: { flexDirection: "row", alignItems: "center", gap: 7 },
    teamFallback: {
      fontFamily: "Inter-Bold",
      color: colors.ink,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    logoBox: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    logo: { position: "absolute", width: 32, height: 32 },
    score: {
      fontFamily: "Inter-Bold",
      color: colors.navy,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
      flex: 1,
      textAlign: "center",
    },
    matchMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
    liveDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.danger,
    },
    state: {
      fontFamily: "Inter-SemiBold",
      color: colors.muted,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "600",
      flexShrink: 1,
    },
    liveText: { color: colors.danger, fontWeight: "800" },
    league: {
      fontFamily: "Inter-Regular",
      color: colors.muted,
      fontSize: 10,
      lineHeight: 14,
      textAlign: "right",
      flex: 1,
    },
    status: {
      minHeight: 60,
      width: 214,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingLeft: 10,
      paddingRight: 4,
      borderRadius: 14,
      backgroundColor: colors.surfaceRaised,
    },
    statusText: {
      fontFamily: "Inter-Regular",
      flex: 1,
      color: colors.muted,
      fontSize: 11,
      lineHeight: 16,
    },
    retry: {
      minHeight: 44,
      minWidth: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    more: {
      minHeight: 60,
      minWidth: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
    },
    moreText: {
      fontFamily: "Inter-SemiBold",
      color: colors.muted,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "600",
    },
    warning: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingLeft: 12,
      paddingRight: 4,
      backgroundColor: colors.surfaceRaised,
      minHeight: 44,
    },
    warningText: {
      fontFamily: "Inter-Regular",
      flex: 1,
      color: colors.muted,
      fontSize: 11,
      lineHeight: 16,
    },
  });
