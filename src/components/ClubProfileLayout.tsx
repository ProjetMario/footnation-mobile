import React, { useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  ArrowUpRight,
  MapPin,
  Share2,
  Shield,
} from "lucide-react-native";
import { router } from "expo-router";
import { useTheme } from "../theme";
import { findClubEnrichment } from "../lib/clubPublicInformation";
import { publicClubUrl } from "../lib/professionalContact";
import { ClubLogo, useClubBrand, useClubReducedMotion } from "./ClubDesign";
import { ClubFollow } from "./ClubFollow";
import { ClubWebNavigation, ClubSectionNavigation } from "./ClubWebNavigation";

export function ClubProfileLayout({
  club,
  active,
  onSelect,
  onCounter,
  children,
}: {
  club: Record<string, any>;
  active: string;
  onSelect: (key: string) => void;
  onCounter: (key: string) => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const brand = useClubBrand();
  const reduced = useClubReducedMotion();
  const { width, height } = useWindowDimensions();
  const wide = width >= 700;
  const scroll = useRef<ScrollView>(null);
  const heroHeight = useRef(0);
  const offset = useRef(0);
  const [compact, setCompact] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [shareError, setShareError] = useState(false);
  const displayName = club.short_name || club.name;
  const district =
    findClubEnrichment(club)?.data?.club?.district || club.district;
  const location = [club.city || district, club.department_code]
    .filter(Boolean)
    .join(" · ");
  const selectSection = (key: string) => {
    Keyboard.dismiss();
    onSelect(key);
    if (offset.current > heroHeight.current)
      scroll.current?.scrollTo({
        y: heroHeight.current,
        animated: !reduced,
      });
  };
  const share = async () => {
    setShareError(false);
    try {
      await Share.share({
        title: club.name,
        message: `${club.name} sur FootNation\n${publicClubUrl({ id: club.id, slug: club.slug })}`,
      });
    } catch {
      setShareError(true);
    }
  };
  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        }}
      >
        <View style={[styles.bound, styles.header]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/clubs")
            }
            style={styles.iconButton}
          >
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              gap: 10,
              alignItems: "center",
            }}
          >
            {compact && (
              <ClubLogo uri={club.logo_url} name={club.name} size={32} />
            )}
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: "Inter-SemiBold",
                color: colors.ink,
                fontSize: 14,
              }}
            >
              {compact ? displayName : "Le club"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Partager le club"
            onPress={() => void share()}
            style={styles.iconButton}
          >
            <Share2 size={20} color={colors.ink} />
          </Pressable>
        </View>
        {shareError && (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: colors.danger, padding: 12, textAlign: "center" }}
          >
            Le partage n’a pas pu s’ouvrir. Réessayez.
          </Text>
        )}
      </View>
      <ScrollView
        ref={scroll}
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        scrollEventThrottle={32}
        onScroll={(event) => {
          offset.current = event.nativeEvent.contentOffset.y;
          const next = offset.current > heroHeight.current - 60;
          setCompact((old) => (old === next ? old : next));
        }}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.bound, { paddingBottom: 40 }]}
      >
        <View
          onLayout={(event) => {
            heroHeight.current = event.nativeEvent.layout.height;
          }}
          style={[
            styles.hero,
            {
              marginTop: wide ? 20 : 0,
              borderTopLeftRadius: wide ? 24 : 0,
              borderTopRightRadius: wide ? 24 : 0,
            },
          ]}
        >
          <LinearGradient
            colors={[brand.hero, brand.heroEnd]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {!!club.cover_image_url && !coverFailed ? (
            <>
              <Image
                source={{ uri: club.cover_image_url }}
                contentFit="cover"
                onError={() => setCoverFailed(true)}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={["rgba(8,18,30,0.36)", "rgba(8,18,30,0.96)"]}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View
                style={[styles.orbit, { borderColor: `${brand.accent}66` }]}
              />
              <View
                style={[
                  styles.orbit,
                  {
                    width: 300,
                    height: 300,
                    right: -85,
                    top: 25,
                    borderColor: "rgba(255,255,255,0.06)",
                  },
                ]}
              />
              <View
                style={{
                  position: "absolute",
                  left: 24,
                  top: 28,
                  bottom: 24,
                  width: 2,
                  backgroundColor: `${brand.accent}55`,
                }}
              />
            </View>
          )}
          <View style={{ padding: wide ? 36 : 24, gap: 24 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
            >
              <Shield size={13} color="#AABBCB" />
              <Text style={styles.eyebrow}>FOOTNATION · CLUB</Text>
            </View>
            <View
              style={{
                flexDirection: wide ? "row" : "column",
                alignItems: wide ? "center" : "flex-start",
                gap: wide ? 26 : 18,
              }}
            >
              <View style={styles.logoFrame}>
                <ClubLogo
                  uri={club.logo_url}
                  name={club.name}
                  size={wide ? 104 : 84}
                />
              </View>
              <View
                style={{
                  flex: wide ? 1 : undefined,
                  width: wide ? undefined : "100%",
                  gap: 12,
                }}
              >
                <Text
                  accessibilityRole="header"
                  style={[
                    styles.name,
                    { fontSize: wide ? 34 : 27, lineHeight: wide ? 41 : 33 },
                  ]}
                >
                  {displayName}
                </Text>
                {!!location && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <MapPin size={15} color="#BECBD8" />
                    <Text style={styles.subtitle}>{location}</Text>
                  </View>
                )}
                {(!!club.level || !!club.founded_date) && (
                  <View
                    style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
                  >
                    {[
                      club.level,
                      club.founded_date
                        ? `Depuis ${String(club.founded_date).slice(0, 4)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .map((label) => (
                        <View key={label} style={styles.pill}>
                          <Text style={styles.pillText}>{label}</Text>
                        </View>
                      ))}
                  </View>
                )}
              </View>
            </View>
            <View
              style={{
                flexDirection: wide ? "row" : "column",
                alignItems: wide ? "center" : "stretch",
                gap: 10,
              }}
            >
              <View style={{ minWidth: 160 }}>
                <ClubFollow id={club.id} name={club.name} compact />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Je représente ce club"
                onPress={() => router.push(`/club-claim?clubId=${club.id}`)}
                style={({ pressed }) => [
                  styles.claim,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={styles.claimText}>Je représente ce club</Text>
                <ArrowUpRight size={17} color="#D4DFE9" />
              </Pressable>
            </View>
          </View>
          <ClubWebNavigation
            section="stats"
            id={club.id}
            name={club.name}
            active={active}
            onSelect={onCounter}
          />
        </View>
        <View
          style={{
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderColor: colors.border,
          }}
        >
          <ClubWebNavigation
            id={club.id}
            name={club.name}
            active={active}
            onSelect={selectSection}
          />
          <ClubSectionNavigation active={active} onSelect={selectSection} />
        </View>
        <View
          style={{
            padding: wide ? 24 : 16,
            gap: 24,
            minHeight: Math.max(400, height - 122),
          }}
        >
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bound: { width: "100%", maxWidth: 960, alignSelf: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    minHeight: 56,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  hero: { backgroundColor: "#08121E", overflow: "hidden" },
  orbit: {
    position: "absolute",
    width: 480,
    height: 480,
    right: -130,
    top: -90,
    borderRadius: 240,
    borderWidth: 1,
  },
  eyebrow: {
    color: "#AABBCB",
    fontFamily: "Inter-SemiBold",
    fontSize: 10,
    letterSpacing: 2,
  },
  logoFrame: {
    padding: 5,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  name: { fontFamily: "Inter-Bold", color: "#FFFFFF", letterSpacing: -0.8 },
  subtitle: {
    color: "#BECBD8",
    fontSize: 13,
    fontFamily: "Inter-Regular",
    flexShrink: 1,
    lineHeight: 20,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
  },
  pillText: { color: "#D4DFE9", fontFamily: "Inter-Regular", fontSize: 11 },
  claim: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  claimText: { fontFamily: "Inter-Regular", fontSize: 13, color: "#D4DFE9" },
});
