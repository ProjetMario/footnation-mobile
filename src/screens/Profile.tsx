import { PagedMediaViewer } from "../components/PagedMediaViewer";
import { PostCard } from "../components/PostCard";
import { PostShareSheet } from "../components/PostShareSheet";
import { ProfileAbout } from "../components/ProfileAbout";
import { ProfileCoverEditor } from "../components/ProfileCoverEditor";
import { ProfileStoryAvatar } from "../components/ProfileStoryAvatar";
import { ProfileStoryBubbles } from "../components/ProfileStoryBubbles";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FlatList,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Building2,
  Camera,
  ChevronRight,
  QrCode,
  Edit3,
  Eye,
  Grid3X3,
  MapPin,
  Menu,
  MoreHorizontal,
  PlaySquare,
  Settings,
  Share2,
  Shirt,
  Sparkles,
  SquareUserRound,
} from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../lib/auth";
import { useProfileOverview } from "../lib/profileOverview";
import {
  ProfileClubs,
  ProfileShorts,
  useProfileClubs,
} from "../components/ProfileSections";
import { usePosts, useProfile } from "../lib/data";
import { supabase } from "../lib/supabase";
import {
  isActivityOnline,
  lastActivityLabel,
  useProfileActivity,
} from "../lib/profilePresence";
import { searchPattern } from "../lib/data";
import { publicProfileName } from "../lib/publicTalent";
import { notifyProfileView } from "../lib/notificationEvents";
import {
  Avatar,
  Button,
  Empty,
  ErrorState,
  IconButton,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { ProfileActions } from "../components/ProfileActions";
import { MediaTile } from "../components/MediaGrid";
import { AuthGate } from "../components/AuthGate";
import { AccountMenu } from "../components/AccountMenu";
import {
  signature,
  useTheme,
  useThemedStyles,
  type ThemeColors,
} from "../theme";
import { displayName, type Profile as ProfileModel } from "../lib/models";


function latestIsoDate(values: (string | null | undefined)[]) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;
}

async function readLatestPublicProfileActivity(profileId: string) {
  const latestFrom = async (table: "posts" | "shorts" | "stories" | "opportunities") => {
    const result = await supabase
      .from(table)
      .select("created_at")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) return null;
    return (result.data as { created_at?: string | null } | null)?.created_at || null;
  };
  const rows = await Promise.all([
    latestFrom("posts"),
    latestFrom("shorts"),
    latestFrom("stories"),
    latestFrom("opportunities"),
  ]);
  return latestIsoDate(rows);
}
export default function Profile({ tab = false }: { tab?: boolean } = {}) {
  const { colors } = useTheme();
  const s = useUIStyles();
  const profileStyles = useThemedStyles(createProfileStyles);
  const params = useLocalSearchParams<{ id: string }>();
  const { session, profile: authProfile } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const id = tab ? session?.user.id : params.id || session?.user.id;
  const profile = useProfile(id);
  const ownProfile = id === session?.user.id;
  const sessionProfile = useMemo(() => {
    if (!ownProfile || !session) return null;
    const meta = session.user.user_metadata || {};
    const firstName =
      typeof meta.first_name === "string" ? meta.first_name : null;
    const lastName = typeof meta.last_name === "string" ? meta.last_name : null;
    const fullName =
      typeof meta.full_name === "string" && meta.full_name.trim()
        ? meta.full_name.trim()
        : [firstName, lastName].filter(Boolean).join(" ").trim() ||
          session.user.email?.split("@")[0] ||
          "Membre FootNation";
    const username =
      typeof meta.username === "string" && meta.username.trim()
        ? meta.username.trim()
        : session.user.email?.split("@")[0] || null;
    return {
      id: session.user.id,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      username,
      avatar_url: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
      account_type:
        typeof meta.account_type === "string" ? meta.account_type : "personal",
      primary_role:
        typeof meta.primary_role === "string" ? meta.primary_role : null,
      birthdate: typeof meta.birthdate === "string" ? meta.birthdate : null,
      is_verified: false,
    } as ProfileModel;
  }, [ownProfile, session]);
  const profileData =
    profile.data ?? (ownProfile ? (authProfile ?? sessionProfile) : null);
  const visibleProfileId = profileData?.id ?? id;
  const [selectedSection, setSelectedSection] = useState<
    "posts" | "videos" | "clubs" | "about"
  >("posts");
  const posts = usePosts(
    "all",
    visibleProfileId,
    selectedSection === "videos" ? "video" : "all",
  );
  const { counts, views } = useProfileOverview(visibleProfileId, !!profileData);
  const showPosts = selectedSection === "posts";
  const profileClubs = useProfileClubs(id, profileData?.linked_club_id);
  const activity = useProfileActivity(visibleProfileId, !!profileData);
  const publicActivity = useQuery({
    queryKey: ["profile-public-activity", visibleProfileId],
    enabled: !!profileData && !!visibleProfileId,
    staleTime: 60000,
    queryFn: () => readLatestPublicProfileActivity(visibleProfileId!),
  });
  const online = isActivityOnline(activity.data, activity.dataUpdatedAt);
  const profileDataDates = profileData as
    | { last_seen_at?: string | null; updated_at?: string | null; created_at?: string | null }
    | null;
  const profileLastActivitySource = latestIsoDate([
    activity.data?.last_seen_at,
    publicActivity.data,
    profileDataDates?.last_seen_at,
    profileDataDates?.updated_at,
    profileDataDates?.created_at,
  ]);
  const profileActivityLabel = online
    ? "En ligne"
    : lastActivityLabel(profileLastActivitySource) || "Dernière activité inconnue";
  const hasClub =
    !!profileData?.linked_club_id ||
    !!profileClubs.data?.club ||
    !!profileClubs.data?.teams.length;
  useEffect(() => {
    const viewerId = session?.user.id;
    if (!viewerId || !visibleProfileId || viewerId === visibleProfileId || !profileData) return;
    void notifyProfileView({
      profileId: visibleProfileId,
      viewerId,
      viewerName: authProfile ? displayName(authProfile) : null,
    });
  }, [authProfile, profileData, session?.user.id, visibleProfileId]);
  useEffect(() => {
    if (selectedSection === "clubs" && !hasClub) setSelectedSection("posts");
  }, [selectedSection, hasClub]);
  const feedScope = `${session?.user.id || "guest"}:${visibleProfileId || "profile"}`;
  const publicUrl = visibleProfileId
    ? `https://www.foot-nation.com/qr/${encodeURIComponent(visibleProfileId)}`
    : "https://www.foot-nation.com";
  const loadedPosts = posts.data?.pages.flat() || [];
  const accountLabel =
    profileData?.account_type === "club"
      ? "Club"
      : profileData?.account_type === "business"
        ? "Entreprise / Marque"
        : profileData?.account_type === "institution"
          ? "Institution"
          : profileData?.primary_role || "Membre FootNation";
  const [shareOpen, setShareOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [openedPost, setOpenedPost] = useState<string | null>(null);
  const profileCounts = {
    posts: Math.max(counts.data?.posts ?? 0, loadedPosts.length),
    followers: counts.data?.followers ?? 0,
    following: counts.data?.following ?? 0,
  };
  const showProfileStats =
    profileCounts.posts > 0 ||
    profileCounts.followers > 0 ||
    profileCounts.following > 0;
  const shareProfile = () => setShareOpen(true);
  const openProfileClub = async () => {
    if (!profileData?.club) return;
    if (profileData.linked_club_id) {
      router.push(`/club/${profileData.linked_club_id}`);
      return;
    }
    const result = await supabase
      .from("fff_clubs")
      .select("id")
      .or(
        `name.ilike.${searchPattern(profileData.club)},short_name.ilike.${searchPattern(profileData.club)}`,
      )
      .order("name")
      .limit(1)
      .maybeSingle();
    if (result.data?.id) router.push(`/club/${result.data.id}`);
    else router.push(`/search?type=clubs&q=${encodeURIComponent(profileData.club)}`);
  };
  return (
    <Screen title="Profil" header={!tab} back={!tab} scroll={false}>
      <AuthGate>
        {profile.isPending && !profileData ? (
          <Loading />
        ) : profile.isError && !profileData ? (
          <View style={s.content}>
            <ErrorState
              error={profile.error}
              retry={() => void profile.refetch()}
            />
          </View>
        ) : !profileData ? (
          <Empty
            title={
              ownProfile ? "Finalisez votre profil" : "Profil indisponible"
            }
            description={
              ownProfile
                ? "Ajoutez vos informations pour afficher votre profil FootNation."
                : "Ce profil n’existe pas ou n’est pas public."
            }
            action={
              ownProfile ? (
                <Button
                  title="Configurer mon profil"
                  onPress={() => router.push("/profile-setup")}
                />
              ) : undefined
            }
          />
        ) : (
          <FlatList
            key={`${feedScope}:grid`}
            numColumns={3}
            data={showPosts ? loadedPosts : []}
            contentContainerStyle={profileStyles.list}
            showsVerticalScrollIndicator={false}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <View style={{ width: "33.333333%", padding: 1 }}>
                <MediaTile
                  item={{
                    id: item.id,
                    title: item.content,
                    image: item.image_url,
                    video: item.video_url,
                  }}
                  onPress={() => setOpenedPost(item.id)}
                />
              </View>
            )}
            initialNumToRender={12}
            maxToRenderPerBatch={6}
            windowSize={5}
            updateCellsBatchingPeriod={60}
            ListHeaderComponent={
              <View style={profileStyles.header}>
                <View style={profileStyles.hero}>
                  {profileData.cover_image_url || profileData.avatar_url ? (
                    <Image
                      source={{
                        uri:
                          profileData.cover_image_url ||
                          profileData.avatar_url ||
                          "",
                      }}
                      style={profileStyles.heroImage}
                      contentFit="cover"
                    />
                  ) : (
                    <LinearGradient
                      colors={["#06111D", "#0B1B33", "#201050"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={profileStyles.heroImage}
                    />
                  )}
                  <LinearGradient
                    colors={[
                      "rgba(2, 6, 23, 0.20)",
                      "rgba(2, 6, 23, 0.56)",
                      "rgba(2, 6, 23, 0.96)",
                    ]}
                    style={profileStyles.heroOverlay}
                  />
                  <View style={profileStyles.heroActions}>
                    {ownProfile ? (
                      <IconButton
                        label="Paramètres du profil"
                        onPress={() => router.push("/settings")}
                      >
                        <Settings size={23} color={colors.white} />
                      </IconButton>
                    ) : (
                      <View style={profileStyles.heroActionSpacer} />
                    )}
                    <View style={profileStyles.heroRightActions}>
                      <IconButton
                        label="Partager le profil"
                        onPress={shareProfile}
                      >
                        <Share2 size={22} color={colors.white} />
                      </IconButton>
                      <IconButton
                        label="Plus d’options"
                        onPress={() => setAccountMenuOpen(true)}
                      >
                        <MoreHorizontal size={24} color={colors.white} />
                      </IconButton>
                    </View>
                  </View>
                  {ownProfile && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Modifier la couverture"
                      onPress={() => setCoverOpen(true)}
                      style={({ pressed }) => ({
                        alignSelf: "flex-end",
                        marginRight: 20,
                        marginTop: 6,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 7,
                        minHeight: 36,
                        paddingHorizontal: 12,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.25)",
                        backgroundColor: pressed
                          ? "rgba(255,255,255,0.25)"
                          : "rgba(255,255,255,0.1)",
                      })}
                    >
                      <Camera size={15} color="white" />
                      <Text
                        style={{
                          color: "white",
                          fontFamily: "Inter-Medium",
                          fontSize: 12,
                        }}
                      >
                        Modifier la couverture
                      </Text>
                    </Pressable>
                  )}
                  <View style={profileStyles.heroIdentity}>
                    <ProfileStoryAvatar
                      key={profileData.id}
                      profile={profileData}
                    />
                    <View style={profileStyles.heroNameRow}>
                      <Text style={profileStyles.heroName}>
                        {publicProfileName(profileData!)}
                      </Text>
                      {profileData.is_verified === true && (
                        <View style={profileStyles.verifiedDot}>
                          <Text style={profileStyles.verifiedText}>✓</Text>
                        </View>
                      )}
                    </View>
                    <Text style={profileStyles.heroSubtitle} numberOfLines={2}>
                      {[
                        profileData.position || profileData.primary_role,
                        profileData.highest_level,
                        [profileData.city, profileData.department]
                          .filter(Boolean)
                          .join(", "),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                    {!!(!ownProfile && profileActivityLabel) && (
                      <View style={profileStyles.activityLine}>
                        <View
                          accessibilityRole="text"
                          accessibilityLabel={online ? "En ligne" : "Hors ligne"}
                          style={[
                            profileStyles.activityDot,
                            {
                              backgroundColor: online
                                ? "#1CC75C"
                                : "rgba(255,255,255,0.55)",
                            },
                          ]}
                        />
                        <Text style={profileStyles.activityText}>
                          {profileActivityLabel}
                        </Text>
                      </View>
                    )}
                    {!!(ownProfile && typeof views.data === "number") && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Voir les visites de mon profil"
                        onPress={() => router.push("/profile-views")}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.82 : 1,
                        })}
                      >
                        <LinearGradient
                          colors={["#0967FF", "#7A2CFF", "#FF174D"]}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          style={[profileStyles.heroViewsPill, { minHeight: 44 }]}
                        >
                          <Eye size={15} color={colors.white} />
                          <Text style={profileStyles.heroViewsText}>
                            {views.data} {views.data === 1 ? "vue" : "vues"}
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    )}
                    {ownProfile ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Éditer le profil"
                        onPress={() => router.push("/settings")}
                        style={({ pressed }) => [
                          profileStyles.heroEditButton,
                          { opacity: pressed ? 0.82 : 1 },
                        ]}
                      >
                        <Text style={profileStyles.heroEditText}>
                          Éditer le profil
                        </Text>
                      </Pressable>
                    ) : id ? (
                      <ProfileActions id={id} variant="hero" />
                    ) : null}
                  </View>
                  {showProfileStats && (
                    <View style={profileStyles.heroStatsRow}>
                      <ProfileStat
                        value={profileCounts.posts}
                        label="Publications"
                        onPress={() => setSelectedSection("posts")}
                      />
                      <ProfileStat
                        value={profileCounts.followers}
                        label="FootLovers"
                        onPress={() =>
                          router.push(
                            `/followers?profileId=${visibleProfileId}&direction=followers`,
                          )
                        }
                      />
                      <ProfileStat
                        value={profileCounts.following}
                        label="Abonnements"
                        onPress={() =>
                          router.push(
                            `/followers?profileId=${visibleProfileId}&direction=following`,
                          )
                        }
                      />
                    </View>
                  )}
                </View>
                <View style={profileStyles.identity}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        backgroundColor: colors.accentSoft,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 8,
                      }}
                    >
                      {profileData.account_type === "personal" ||
                      !profileData.account_type ? (
                        <Shirt size={13} color={colors.blue} />
                      ) : (
                        <Building2 size={13} color={colors.blue} />
                      )}
                      <Text
                        style={{
                          fontFamily: "Inter-SemiBold",
                          fontSize: 12,
                          color: colors.blue,
                        }}
                      >
                        {accountLabel}
                      </Text>
                    </View>
                    {!!profileData.club && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Voir ${profileData.club}`}
                        onPress={() => void openProfileClub()}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                          minHeight: 36,
                          justifyContent: "center",
                          flexShrink: 1,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            color: colors.ink,
                            fontSize: 13,
                            fontFamily: "Inter-SemiBold",
                          }}
                        >
                          {profileData.club}
                        </Text>
                        <ChevronRight size={15} color={colors.blue} />
                      </Pressable>
                    )}
                  </View>
                  {!!(profileData.position || profileData.highest_level) && (
                    <Text
                      style={{
                        color: colors.muted,
                        fontFamily: "Inter-Regular",
                        fontSize: 13,
                        lineHeight: 20,
                      }}
                    >
                      {[profileData.position, profileData.highest_level]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  )}
                  {!!profileData.bio && (
                    <Text
                      style={{
                        color: colors.ink,
                        fontFamily: "Inter-Regular",
                        fontSize: 14,
                        lineHeight: 22,
                      }}
                    >
                      {profileData.bio}
                    </Text>
                  )}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      paddingTop: 8,
                      marginTop: 2,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      {!!(profileData.city || profileData.department) && (
                        <>
                          <MapPin size={14} color={colors.muted} />
                          <Text
                            numberOfLines={2}
                            style={[s.small, { flexShrink: 1 }]}
                          >
                            {[profileData.city, profileData.department]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        </>
                      )}
                    </View>
                    <IconButton
                      label="Voir le QR code du profil"
                      onPress={() => router.push(`/profile-qr?id=${id}`)}
                    >
                      <QrCode size={19} color={colors.muted} />
                    </IconButton>
                    <IconButton
                      label={
                        ownProfile
                          ? "Partager mon profil"
                          : "Partager ce profil"
                      }
                      onPress={shareProfile}
                    >
                      <Share2 size={19} color={colors.muted} />
                    </IconButton>
                  </View>
                </View>
                <ProfileStoryBubbles
                  key={`bubbles:${profileData.id}`}
                  profileId={profileData.id}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[
                    profileStyles.profileTabs,
                    { flexGrow: 1 },
                  ]}
                >
                  {(
                    [
                      ["posts", "Publications", Grid3X3],
                      ["videos", "Shorts", PlaySquare],
                      ["clubs", "Clubs", Shirt],
                      ["about", "À propos", SquareUserRound],
                    ] as const
                  )
                    .filter(([section]) => section !== "clubs" || hasClub)
                    .map(([section, label, Icon]) => (
                      <ProfileTabIcon
                        key={section}
                        active={selectedSection === section}
                        label={label}
                        onPress={() => setSelectedSection(section)}
                        icon={
                          <Icon
                            size={22}
                            color={
                              selectedSection === section
                                ? colors.ink
                                : colors.muted
                            }
                          />
                        }
                      />
                    ))}
                </ScrollView>
                {!!(selectedSection === "clubs" && visibleProfileId) && (
                  <ProfileClubs
                    profileId={visibleProfileId}
                    linkedClubId={profileData.linked_club_id}
                  />
                )}
                {!!(selectedSection === "videos" && visibleProfileId) && (
                  <ProfileShorts profileId={visibleProfileId} />
                )}
                {selectedSection === "about" && (
                  <ProfileAbout profile={profileData} ownProfile={ownProfile} />
                )}
              </View>
            }
            ListEmptyComponent={
              !showPosts ? null : posts.isPending ? (
                <Loading />
              ) : posts.isError ? (
                <ErrorState
                  error={posts.error}
                  retry={() => void posts.refetch()}
                />
              ) : (
                <View style={s.content}>
                  <Empty
                    title="Aucune publication"
                    description={
                      ownProfile
                        ? "Partage ton premier moment de football avec ton réseau."
                        : "Les publications de ce membre apparaîtront ici."
                    }
                    action={
                      ownProfile ? (
                        <Button
                          title="Créer une publication"
                          onPress={() => router.push("/compose")}
                        />
                      ) : undefined
                    }
                  />
                </View>
              )
            }
            onEndReached={() => {
              if (showPosts && posts.hasNextPage && !posts.isFetchingNextPage)
                void posts.fetchNextPage();
            }}
          />
        )}
      </AuthGate>
      {!!openedPost && (
        <PagedMediaViewer
          items={loadedPosts}
          initialKey={openedPost}
          keyFor={(item) => item.id}
          onClose={() => setOpenedPost(null)}
          onLoadMore={() => {
            if (posts.hasNextPage && !posts.isFetchingNextPage)
              void posts.fetchNextPage();
          }}
          loadingMore={posts.isFetchingNextPage}
          renderItem={(post, visible, height) => (
            <PostCard
              post={post}
              mediaVisible={visible}
              pageHeight={height}
              onBackToFeed={() => setOpenedPost(null)}
            />
          )}
        />
      )}
      {shareOpen && !!profileData && (
        <PostShareSheet
          profile={profileData}
          onClose={() => setShareOpen(false)}
        />
      )}
      {coverOpen && ownProfile && !!profileData && (
        <ProfileCoverEditor
          key={profileData.id}
          profile={profileData}
          onClose={() => setCoverOpen(false)}
        />
      )}
      <AccountMenu
        visible={accountMenuOpen}
        onClose={() => setAccountMenuOpen(false)}
      />
    </Screen>
  );
}
function ProfileTabIcon({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const profileStyles = useThemedStyles(createProfileStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      accessibilityLabel={label}
      style={[
        profileStyles.profileTab,
        { minWidth: 84, minHeight: 60, paddingHorizontal: 10, gap: 4 },
        active && profileStyles.profileTabActive,
      ]}
    >
      {icon}
      <Text
        style={{
          color: active ? colors.ink : colors.muted,
          fontSize: 12,
          fontFamily: "Inter-SemiBold",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function ProfileStat({
  value,
  label,
  onPress,
}: {
  value?: number | null;
  label: string;
  onPress: () => void;
}) {
  const profileStyles = useThemedStyles(createProfileStyles);
  const count = typeof value === "number" ? value : 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${count} ${label}`}
      onPress={onPress}
      style={[profileStyles.stat, { minHeight: 48 }]}
    >
      <Text style={profileStyles.statValue}>{count}</Text>
      <Text style={profileStyles.statLabel}>{label}</Text>
    </Pressable>
  );
}
function ProfilePublishNudge() {
  const { colors } = useTheme();
  const profileStyles = useThemedStyles(createProfileStyles);
  return (
    <View style={profileStyles.publishNudge}>
      <View style={profileStyles.publishNudgeIcon}>
        <Sparkles size={22} color={colors.white} />
      </View>
      <View style={profileStyles.publishNudgeText}>
        <Text style={profileStyles.publishNudgeTitle}>
          Publiez votre premier contenu
        </Text>
        <Text style={profileStyles.publishNudgeDescription}>
          Présente-toi ou partage un souvenir de ton dernier match avec ton
          réseau.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Créer ma première publication"
          onPress={() => router.push("/compose")}
          style={({ pressed }) => [
            profileStyles.publishNudgeButton,
            { opacity: pressed ? 0.78 : 1 },
          ]}
        >
          <Edit3 size={17} color={colors.white} />
          <Text style={profileStyles.publishNudgeButtonText}>
            Créer ma première publication
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProfileGradientAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  const profileStyles = useThemedStyles(createProfileStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        profileStyles.actionButton,
        { opacity: pressed ? 0.78 : 1 },
      ]}
    >
      <LinearGradient
        colors={signature}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={profileStyles.actionGradient}
      >
        {icon}
        <Text style={profileStyles.actionGradientText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}
function ProfileOutlineAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  const profileStyles = useThemedStyles(createProfileStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        profileStyles.actionOutline,
        { opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {icon}
      <Text style={profileStyles.actionOutlineText}>{label}</Text>
    </Pressable>
  );
}
const createProfileStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    list: {
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
      paddingBottom: 32,
    },
    header: {
      width: "100%",
      backgroundColor: colors.background,
    },
    hero: {
      minHeight: 330,
      paddingBottom: 20,
      overflow: "hidden",
      backgroundColor: "#06111D",
    },
    heroImage: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: "100%",
      height: "100%",
      opacity: 0.95,
    },
    heroOverlay: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    heroActions: {
      paddingTop: 14,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    heroActionSpacer: { width: 44, height: 44 },
    heroRightActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    heroIdentity: {
      alignItems: "center",
      paddingHorizontal: 22,
      paddingTop: 18,
      gap: 12,
    },
    heroAvatarWrap: {
      width: 104,
      height: 104,
      borderRadius: 52,
      padding: 7,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.18)",
    },
    heroOnlineDot: {
      position: "absolute",
      right: 8,
      bottom: 10,
      width: 19,
      height: 19,
      borderRadius: 10,
      borderWidth: 3,
      borderColor: "#06111D",
      backgroundColor: "#22C77A",
    },
    activityLine: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: -2,
      opacity: 0.82,
    },
    activityDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    activityText: {
      color: "rgba(255,255,255,0.72)",
      fontFamily: "Inter-Medium",
      fontSize: 11,
      fontWeight: "600",
    },
    heroNameRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    heroName: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "800",
      textAlign: "center",
      flexShrink: 1,
    },
    verifiedDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.blue,
    },
    verifiedText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 13,
      lineHeight: 16,
      fontWeight: "800",
    },
    heroSubtitle: {
      color: "rgba(255,255,255,0.78)",
      fontFamily: "Inter-SemiBold",
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
      textAlign: "center",
    },
    heroBadges: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: 10,
    },
    heroLevelPill: {
      minHeight: 32,
      borderRadius: 16,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(220,252,231,0.95)",
    },
    heroLevelText: {
      color: "#15803D",
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "700",
    },
    heroViewsPill: {
      minHeight: 32,
      borderRadius: 16,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    heroViewsText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "700",
    },
    heroEditButton: {
      width: "100%",
      maxWidth: 340,
      minHeight: 54,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.96)",
      marginTop: 8,
    },
    heroEditText: {
      color: "#111827",
      fontFamily: "Inter-Bold",
      fontSize: 15,
      fontWeight: "800",
    },
    heroStatsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      gap: 10,
      paddingTop: 16,
      paddingHorizontal: 22,
      marginTop: 8,
    },
    identity: {
      marginHorizontal: 14,
      marginVertical: 14,
      padding: 16,
      gap: 7,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.blue,
      shadowOpacity: 0.035,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 5 },
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 18,
    },
    avatarStack: { width: 106, height: 106 },
    avatarRing: {
      width: 106,
      height: 106,
      borderRadius: 53,
      padding: 4,
    },
    avatarInner: {
      flex: 1,
      borderRadius: 49,
      padding: 6,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    onlineDot: {
      position: "absolute",
      right: 2,
      bottom: 10,
      width: 23,
      height: 23,
      borderRadius: 12,
      borderWidth: 3,
      borderColor: colors.surface,
      backgroundColor: "#22C77A",
    },
    profileMain: { flex: 1, minWidth: 0, gap: 9 },
    nameLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      flexWrap: "wrap",
    },
    name: {
      color: colors.navy,
      fontFamily: "Inter-Bold",
      fontSize: 24,
      lineHeight: 29,
      fontWeight: "700",
      flexShrink: 1,
    },
    levelPill: {
      minHeight: 34,
      borderRadius: 17,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#DDFBEA",
    },
    levelText: {
      color: "#0E7A46",
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "700",
    },
    viewsPill: {
      alignSelf: "flex-start",
      minHeight: 34,
      borderRadius: 17,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      backgroundColor: "#C026D3",
    },
    viewsText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "700",
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      gap: 10,
      paddingTop: 2,
    },
    stat: { alignItems: "center", flex: 1, gap: 3 },
    statValue: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 23,
      lineHeight: 29,
      fontWeight: "800",
    },
    statLabel: {
      color: "rgba(255,255,255,0.68)",
      fontFamily: "Inter-Regular",
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
    },
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
      paddingTop: 4,
    },
    profileTypeBadge: {
      minHeight: 35,
      borderRadius: 18,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      backgroundColor: "#F3E8FF",
    },
    profileTypeText: {
      color: "#7E22CE",
      fontFamily: "Inter-Bold",
      fontSize: 13,
      fontWeight: "700",
    },
    club: {
      color: colors.deepBlue,
      fontFamily: "Inter-SemiBold",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
      flexShrink: 1,
    },
    role: {
      color: colors.ink,
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 21,
    },
    location: { flexDirection: "row", alignItems: "center", gap: 5 },
    bioText: {
      color: colors.ink,
      fontFamily: "Inter-Regular",
      fontSize: 16,
      lineHeight: 24,
    },
    qrCard: {
      alignItems: "center",
      alignSelf: "center",
      width: "100%",
      maxWidth: 430,
      marginTop: 8,
      paddingTop: 18,
      paddingBottom: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      shadowColor: colors.navy,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2,
    },
    qrHandle: {
      position: "absolute",
      top: 9,
      zIndex: 1,
      minHeight: 30,
      borderRadius: 15,
      paddingHorizontal: 14,
      justifyContent: "center",
      backgroundColor: "#3FE35F",
    },
    qrHandleText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 12,
      fontWeight: "700",
    },
    qrFrame: {
      marginTop: 12,
      borderRadius: 24,
      borderWidth: 11,
      borderColor: "#3FE35F",
      padding: 9,
      backgroundColor: colors.white,
    },
    qrFooter: {
      marginTop: -4,
      minHeight: 30,
      borderRadius: 15,
      paddingHorizontal: 18,
      paddingTop: 6,
      overflow: "hidden",
      color: colors.white,
      backgroundColor: "#3FE35F",
      fontFamily: "Inter-Bold",
      fontSize: 12,
      fontWeight: "700",
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      paddingTop: 8,
    },
    actionButton: { flex: 1, minWidth: 0, minHeight: 52, borderRadius: 26 },
    actionGradient: {
      flex: 1,
      minHeight: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
    },
    actionGradientText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "700",
      flexShrink: 1,
      textAlign: "center",
    },
    actionOutline: {
      flex: 1,
      minWidth: 0,
      minHeight: 52,
      borderRadius: 26,
      borderWidth: 2,
      borderColor: colors.blue,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
    },
    actionOutlineText: {
      color: colors.blue,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "700",
      flexShrink: 1,
      textAlign: "center",
    },
    opportunityCallout: {
      marginHorizontal: 18,
      marginBottom: 18,
      padding: 20,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "#D9E7FF",
      gap: 10,
      backgroundColor: "#F4F8FF",
    },
    calloutTitle: {
      color: colors.navy,
      fontFamily: "Inter-Bold",
      fontSize: 21,
      lineHeight: 28,
      fontWeight: "800",
    },
    calloutText: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 15,
      lineHeight: 23,
    },
    calloutMeta: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      paddingTop: 2,
    },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    metaText: {
      color: colors.muted,
      fontFamily: "Inter-SemiBold",
      fontSize: 13,
      fontWeight: "600",
    },
    requestButton: {
      alignSelf: "flex-start",
      marginTop: 8,
      minHeight: 50,
      borderRadius: 25,
      paddingHorizontal: 26,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.blue,
    },
    requestButtonText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 15,
      fontWeight: "700",
      flexShrink: 1,
    },
    publishNudge: {
      marginHorizontal: 18,
      marginBottom: 18,
      borderRadius: 22,
      padding: 18,
      flexDirection: "row",
      gap: 14,
      backgroundColor: "#071429",
      borderWidth: 1,
      borderColor: "rgba(8,124,255,0.32)",
      shadowColor: "#071429",
      shadowOpacity: 0.2,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    publishNudgeIcon: {
      width: 46,
      height: 46,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.blue,
    },
    publishNudgeText: { flex: 1, minWidth: 0, gap: 8 },
    publishNudgeTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "900",
    },
    publishNudgeDescription: {
      color: "rgba(255,255,255,0.72)",
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 20,
    },
    publishNudgeButton: {
      alignSelf: "flex-start",
      minHeight: 44,
      borderRadius: 15,
      paddingHorizontal: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.blue,
    },
    publishNudgeButtonText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "900",
    },
    newStoryBlock: {
      alignSelf: "flex-start",
      marginLeft: 18,
      marginBottom: 20,
      alignItems: "center",
      gap: 8,
    },
    newStoryCircle: {
      width: 78,
      height: 78,
      borderRadius: 39,
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    newStoryPlus: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 34,
      lineHeight: 38,
    },
    newStoryLabel: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 19,
    },
    profileTabs: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    profileTab: {
      flex: 1,
      minHeight: 58,
      alignItems: "center",
      justifyContent: "center",
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    profileTabActive: {
      borderBottomColor: colors.blue,
    },
    identityCard: {
      marginHorizontal: 18,
      marginTop: 20,
      marginBottom: 16,
      padding: 18,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 18,
      backgroundColor: colors.surface,
      shadowColor: colors.navy,
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    recommendationCard: {
      marginHorizontal: 18,
      marginBottom: 16,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      shadowColor: colors.navy,
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    recommendationScore: {
      color: colors.navy,
      fontFamily: "Inter-Bold",
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "800",
    },
    recommendationScale: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 16,
    },
    recommendationLabel: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 17,
    },
    recommendationDivider: {
      width: 1,
      height: 46,
      backgroundColor: colors.border,
    },
    sectionLabel: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
    },
    publications: {
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      marginBottom: 4,
    },
    publicationsTitle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 52,
    },
    publicationsUnderline: { height: 2, width: 106, borderRadius: 2 },
  });
