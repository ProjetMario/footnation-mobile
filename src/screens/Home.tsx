import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  AppState,
  FlatList,
  ScrollView,
  Platform,
  Pressable,
  Text,
  View,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import type { CellRendererProps } from "@react-native/virtualized-lists";
import { router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { brandIcon } from "../lib/brandAssets";
import { Edit3, Menu, Send } from "lucide-react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { floatingBarSpace } from "../components/FloatingTabBar";
import { setScrollChromeCompact } from "../components/scrollChrome";
import { useAuth } from "../lib/auth";
import { usePosts } from "../lib/data";
import { GuestPreviewBoundary } from "../components/GuestPreviewBoundary";
import { useHiddenPosts } from "../lib/hiddenPosts";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import {
  Button,
  Empty,
  ErrorState,
  IconButton,
  Loading,
  useUIStyles,
  Brand,
} from "../components/ui";
import { StoryRail } from "./Stories";
import { NotificationButton } from "../components/NotificationButton";
import { AccountMenu } from "../components/AccountMenu";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useTranslation } from "../lib/i18n";
import { PublicLanding } from "../components/PublicLanding";
import { SUPPORTERS_ENABLED } from "../lib/supportersConfig";
import { HomeNews } from "../components/HomeNews";
import { MatchTicker } from "../components/MatchTicker";
import { PostCard } from "../components/PostCard";
import { type Post } from "../lib/models";
import { createPageRequestGate, uniqueFeedItems } from "../lib/mediaFeed";
import { useVisibleFeedMedia } from "../lib/useVisibleFeedMedia";
import { feedPageOffset, feedSnapOffsets } from "../lib/feedPaging";
import {
  captureHomeFeedAnchor,
  restoredHomeFeedOffset,
  homeHeaderPostVisible,
  type HomeFeedLayout,
  type HomeFeedAnchor,
} from "../lib/homeFeedLayout";

// RN Web's pagingEnabled also snaps to virtualization spacers. Mark only
// actual pages so unloaded space never becomes a resting position.
const webSnapPage =
  Platform.OS === "web"
    ? ({ scrollSnapAlign: "start", scrollSnapStop: "always" } as ViewStyle)
    : undefined;
const webSnapList =
  Platform.OS === "web"
    ? ({ scrollSnapType: "y mandatory" } as ViewStyle)
    : undefined;

function FeedPageCell({
  children,
  style,
  onLayout,
  onFocusCapture,
  item,
}: CellRendererProps<Post>) {
  return (
    <View
      testID={`feed-page-${item.id}`}
      style={[style, webSnapPage]}
      {...{ onLayout, onFocusCapture }}
    >
      {children}
    </View>
  );
}

export default function Home() {
  return (
    <GuestPreviewBoundary>
      <HomeContent />
    </GuestPreviewBoundary>
  );
}

function HomeContent() {
  const t = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const s = useUIStyles();
  const { session, loading } = useAuth();
  const canReadFeed = !!session || Platform.OS === "web";
  const insets = useSafeAreaInsets();
  const { height: windowHeight, fontScale } = useWindowDimensions();
  const [pageHeight, setPageHeight] = useState(
    Math.max(1, windowHeight - insets.top),
  );
  const [introHeight, setIntroHeight] = useState(0);
  const [introVisible, setIntroVisible] = useState(true);
  const introVisibleRef = useRef(true);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [focusedNavigation, setFocusedNavigation] = useState<string | null>(
    null,
  );
  const [hoveredNavigation, setHoveredNavigation] = useState<string | null>(
    null,
  );
  const feedTabsScrollRef = useRef<ScrollView>(null);
  const feedTabsOffset = useRef(0);
  const feedTabsDirection = useRef<1 | -1>(1);
  const feedTabsViewport = useRef(0);
  const feedTabsContent = useRef(0);
  const feedTabsPauseUntil = useRef(0);
  const feedTabsTouching = useRef(false);
  const feedTabsDragging = useRef(false);
  const feedTabsMomentum = useRef(false);
  const [railFocused, setRailFocused] = useState(false);
  const [railForeground, setRailForeground] = useState(
    AppState.currentState === "active",
  );
  const [railMotionAllowed, setRailMotionAllowed] = useState(false);
  const pauseFeedTabs = () => {
    feedTabsPauseUntil.current = Date.now() + 5000;
  };
  useFocusEffect(
    useCallback(() => {
      setRailFocused(true);
      return () => {
        setRailFocused(false);
        feedTabsTouching.current = false;
        feedTabsDragging.current = false;
        feedTabsMomentum.current = false;
      };
    }, []),
  );
  useEffect(() => {
    let mounted = true;
    let reduceMotion = true;
    let screenReader = true;
    let motionChanged = false;
    let readerChanged = false;
    const update = () =>
      mounted && setRailMotionAllowed(!reduceMotion && !screenReader);
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        motionChanged = true;
        reduceMotion = value;
        update();
      },
    );
    const reader = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      (value) => {
        readerChanged = true;
        screenReader = value;
        update();
      },
    );
    void Promise.all([
      AccessibilityInfo.isReduceMotionEnabled(),
      Platform.OS === "web"
        ? Promise.resolve(false)
        : AccessibilityInfo.isScreenReaderEnabled(),
    ])
      .then(([motionValue, readerValue]) => {
        // A preference change can arrive before these initial reads resolve.
        if (!motionChanged) reduceMotion = motionValue;
        if (!readerChanged) screenReader = readerValue;
        update();
      })
      .catch(() => {});
    const app = AppState.addEventListener("change", (state) =>
      setRailForeground(state === "active"),
    );
    return () => {
      mounted = false;
      motion.remove();
      reader.remove();
      app.remove();
    };
  }, []);
  const [mode, setMode] = useState<"all" | "network">("all");
  useEffect(() => {
    if (
      !session ||
      !railFocused ||
      !railForeground ||
      !railMotionAllowed ||
      accountMenuOpen ||
      focusedNavigation ||
      hoveredNavigation
    )
      return;
    const timer = setInterval(() => {
      // Never move a target under a held finger or during a manual glide.
      if (
        feedTabsTouching.current ||
        feedTabsDragging.current ||
        feedTabsMomentum.current ||
        Date.now() < feedTabsPauseUntil.current
      )
        return;
      const maximum = Math.max(
        0,
        feedTabsContent.current - feedTabsViewport.current,
      );
      if (maximum < 2) return;
      const next = feedTabsOffset.current + feedTabsDirection.current * 0.45;
      if (next >= maximum) {
        feedTabsDirection.current = -1;
        feedTabsOffset.current = maximum;
      } else if (next <= 0) {
        feedTabsDirection.current = 1;
        feedTabsOffset.current = 0;
      } else {
        feedTabsOffset.current = next;
      }
      feedTabsScrollRef.current?.scrollTo({
        x: feedTabsOffset.current,
        animated: false,
      });
    }, 40);
    return () => clearInterval(timer);
  }, [
    session,
    railFocused,
    railForeground,
    railMotionAllowed,
    accountMenuOpen,
    focusedNavigation,
    hoveredNavigation,
  ]);
  const feed = usePosts(mode);
  const hiddenPosts = useHiddenPosts();
  const allPosts = useMemo(
    () =>
      canReadFeed
        ? uniqueFeedItems(feed.data?.pages).filter(
            (post) => !hiddenPosts.ids.includes(post.id),
          )
        : [],
    [feed.data?.pages, session?.user.id, hiddenPosts.data, canReadFeed],
  );
  const firstPost = allPosts[0];
  const posts = useMemo(() => allPosts.slice(1), [allPosts]);
  const [headerContentHeight, setHeaderContentHeight] = useState(194);
  const [activeNewsIndex, setActiveNewsIndex] = useState(0);
  const [availableNewsCount, setNewsCount] = useState(0);
  const newsCount = mode === "all" ? availableNewsCount : 0;
  const [newsStart, setNewsStart] = useState(0);
  const firstPostHeight = pageHeight;
  const scope = `${session?.user.id || "guest"}:${mode}`;
  const bottomInset = floatingBarSpace(insets.bottom);
  const paged =
    canReadFeed &&
    allPosts.length > 0 &&
    pageHeight / fontScale >= 480 &&
    posts.length === 0;
  const hasFooter =
    canReadFeed &&
    (feed.isFetchingNextPage || feed.isError || feed.hasNextPage);
  const updateIntroVisibility = useCallback(
    (offset: number, height: number) => {
      const visible = homeHeaderPostVisible({
        offset,
        viewportHeight: pageHeight,
        contentStart: headerContentHeight,
        contentEnd: height,
      });
      if (introVisibleRef.current !== visible) {
        introVisibleRef.current = visible;
        setIntroVisible(visible);
      }
      setActiveNewsIndex(
        offset + pageHeight > newsStart &&
          offset < newsStart + newsCount * pageHeight
          ? Math.max(
              0,
              Math.floor((offset + pageHeight * 0.3 - newsStart) / pageHeight),
            )
          : -1,
      );
    },
    [pageHeight, headerContentHeight, posts.length, newsStart, newsCount],
  );
  const list = useRef<FlatList<Post>>(null);
  const scrollOffset = useRef(0);
  const lastChromeOffset = useRef(0);
  const chromeCompact = useRef(false);
  const layout: HomeFeedLayout = {
    scope,
    firstPost,
    posts,
    hasFooter,
    paged,
    pageHeight,
    introHeight,
  };
  const committedLayout = useRef(layout);
  const resizeAnchor = useRef<{
    layout: HomeFeedLayout;
    anchor: HomeFeedAnchor;
  } | null>(null);
  const previousLayout = committedLayout.current;
  const capturedResize = resizeAnchor.current;
  // Capture against the last committed order, before native/CSS layout can
  // adjust the scroll offset in response to new rows or dimensions.
  const anchor =
    capturedResize?.layout.scope === scope
      ? capturedResize.anchor
      : captureHomeFeedAnchor(previousLayout, scrollOffset.current);
  const anchorLayout =
    capturedResize?.layout.scope === scope
      ? capturedResize.layout
      : previousLayout;
  const rememberPage = () => {
    if (resizeAnchor.current) return;
    const current = committedLayout.current;
    resizeAnchor.current = {
      layout: current,
      anchor: captureHomeFeedAnchor(current, scrollOffset.current),
    };
  };
  const measureViewport = ({ nativeEvent }: LayoutChangeEvent) => {
    const next = nativeEvent.layout.height;
    if (
      Number.isFinite(next) &&
      next > 0 &&
      Math.abs(next - pageHeight) > 0.5
    ) {
      rememberPage();
      setPageHeight(next);
    }
  };
  const measureIntro = ({ nativeEvent }: LayoutChangeEvent) => {
    const next = nativeEvent.layout.height;
    if (
      Number.isFinite(next) &&
      next > 0 &&
      Math.abs(next - introHeight) > 0.5
    ) {
      rememberPage();
      setIntroHeight(next);
    }
  };
  useLayoutEffect(() => {
    committedLayout.current = layout;
    if (previousLayout.scope !== scope) {
      scrollOffset.current = 0;
      updateIntroVisibility(0, introHeight);
      resizeAnchor.current = null;
      return; // The list's scope key already remounts it at the intro.
    }
    if (resizeAnchor.current === capturedResize) resizeAnchor.current = null;
    const offset = restoredHomeFeedOffset(anchor, anchorLayout, layout);
    updateIntroVisibility(offset ?? scrollOffset.current, introHeight);
    if (offset === null) return;
    list.current?.scrollToOffset({ offset, animated: false });
    scrollOffset.current = offset;
  }, [
    scope,
    firstPost,
    posts,
    hasFooter,
    pageHeight,
    introHeight,
    paged,
    updateIntroVisibility,
  ]);
  const updateScrollChrome = useCallback((offset: number) => {
    const delta = offset - lastChromeOffset.current;
    let compact = chromeCompact.current;
    if (offset < 24) compact = false;
    else if (delta > 8) compact = true;
    else if (delta < -8) compact = false;
    lastChromeOffset.current = offset;
    if (compact !== chromeCompact.current) {
      chromeCompact.current = compact;
      setScrollChromeCompact(compact);
    }
  }, []);
  useEffect(() => () => setScrollChromeCompact(false), []);
  const backToFeed = useCallback(() => {
    resizeAnchor.current = null;
    list.current?.scrollToOffset({ offset: 0, animated: false });
    scrollOffset.current = 0;
    lastChromeOffset.current = 0;
    chromeCompact.current = false;
    setScrollChromeCompact(false);
    updateIntroVisibility(0, introHeight);
  }, [introHeight, updateIntroVisibility]);
  const visibleFeed = useVisibleFeedMedia<Post>(scope, undefined, true);
  const onViewableItemsChangedRef = useRef(visibleFeed.onViewableItemsChanged);
  onViewableItemsChangedRef.current = visibleFeed.onViewableItemsChanged;
  const stableOnViewableItemsChanged = useRef(
    (info: { viewableItems: { item: Post; isViewable?: boolean }[] }) =>
      onViewableItemsChangedRef.current(info),
  ).current;
  const snapOffsets = useMemo(
    () =>
      [
        ...new Set([
          ...Array.from(
            { length: newsCount },
            (_, i) => newsStart + i * pageHeight,
          ),
          ...feedSnapOffsets(
            posts.length + (hasFooter ? 1 : 0),
            introHeight,
            pageHeight,
          ),
          Math.max(0, introHeight - firstPostHeight),
        ]),
      ].sort((a, b) => a - b),
    [
      posts.length,
      hasFooter,
      introHeight,
      pageHeight,
      firstPostHeight,
      newsCount,
      newsStart,
    ],
  );
  const pageGate = useRef(createPageRequestGate());
  const loadMore = (retry = false) =>
    pageGate.current.run(
      {
        key: `${session?.user.id}:${mode}:${feed.data?.pages.length || 0}:${feed.data?.pages.at(-1)?.at(-1)?.id || ""}`,
        hasNextPage: canReadFeed && feed.hasNextPage,
        isFetching: feed.isFetching,
        isError: feed.isError,
        retry,
      },
      () => feed.fetchNextPage(),
    );
  const top = (
    <View>
      {session ? (
        <StoryRail />
      ) : Platform.OS === "web" ? (
        <View style={{ padding: 16, gap: 10 }}>
          <Text style={s.h2}>Découvrez la communauté FootNation</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Button
              title="Créer mon compte"
              onPress={() => router.push("/signup")}
            />
            <Button
              title="Se connecter"
              secondary
              onPress={() => router.push("/login")}
            />
          </View>
        </View>
      ) : (
        <PublicLanding />
      )}
    </View>
  );
  const navigationHeader = (
    <View style={[styles.header, !session && styles.publicHeader]}>
      <View style={styles.headerActions} pointerEvents="box-none">
        <View style={styles.landingBrandWrap} pointerEvents="none">
          {!session && (
            <Image
              source={brandIcon}
              style={styles.landingHeaderBall}
              contentFit="contain"
              accessibilityLabel="Logo ballon FootNation"
            />
          )}
          <Brand showLogo={!!session} />
        </View>
        <View style={styles.headerRight} pointerEvents="box-none">
          <LanguageSwitcher visibleForGuests compact />
          <IconButton
            label={t("nav.messages")}
            onPress={() => router.navigate("/messages")}
          >
            <Send size={24} color={colors.navy} strokeWidth={1.8} />
          </IconButton>
          <NotificationButton compact />
          <IconButton
            label={t("home.account")}
            onPress={() => setAccountMenuOpen(true)}
          >
            <Menu size={24} color={colors.navy} strokeWidth={1.8} />
          </IconButton>
        </View>
      </View>
      <MatchTicker active={!accountMenuOpen} />
      {!!session && (
        <>
          <View style={styles.feedNavigation}>
            <ScrollView
              ref={feedTabsScrollRef}
              horizontal
              disableScrollViewPanResponder={Platform.OS === "ios"}
              showsHorizontalScrollIndicator={false}
              // Keep the tab rail in one continuous row on iOS, Android and Web.
              // `normal` gives a gentle, controllable glide after a swipe instead
              // of stopping abruptly on touch release.
              decelerationRate="normal"
              bounces
              alwaysBounceHorizontal
              nestedScrollEnabled
              directionalLockEnabled
              scrollEventThrottle={16}
              onLayout={({ nativeEvent }) => {
                feedTabsViewport.current = nativeEvent.layout.width;
              }}
              onContentSizeChange={(width) => {
                feedTabsContent.current = width;
              }}
              onScroll={({ nativeEvent }) => {
                // Resume from the user's position, not the old automatic offset.
                if (
                  feedTabsTouching.current ||
                  feedTabsDragging.current ||
                  feedTabsMomentum.current ||
                  Date.now() < feedTabsPauseUntil.current
                ) {
                  feedTabsOffset.current = Math.max(
                    0,
                    nativeEvent.contentOffset.x,
                  );
                }
              }}
              onScrollBeginDrag={() => {
                feedTabsDragging.current = true;
                pauseFeedTabs();
              }}
              onScrollEndDrag={({ nativeEvent }) => {
                feedTabsDragging.current = false;
                feedTabsOffset.current = Math.max(
                  0,
                  nativeEvent.contentOffset.x,
                );
                pauseFeedTabs();
              }}
              onMomentumScrollBegin={() => {
                feedTabsMomentum.current = true;
              }}
              onMomentumScrollEnd={({ nativeEvent }) => {
                if (feedTabsMomentum.current) {
                  feedTabsMomentum.current = false;
                  feedTabsOffset.current = Math.max(
                    0,
                    nativeEvent.contentOffset.x,
                  );
                  pauseFeedTabs();
                }
              }}
              onTouchStart={() => {
                feedTabsTouching.current = true;
                pauseFeedTabs();
              }}
              onTouchEnd={() => {
                feedTabsTouching.current = false;
                pauseFeedTabs();
              }}
              onTouchCancel={() => {
                feedTabsTouching.current = false;
                pauseFeedTabs();
              }}
              style={styles.feedTabsScroll}
              contentContainerStyle={styles.feedTabs}
              accessibilityRole="tablist"
              accessibilityLabel={t("home.navigation")}
            >
              {(
                [
                  ["all", t("home.forYou")],
                  ["network", t("home.network")],
                  ["/opportunities", t("home.opportunities")],
                  ["/matching", t("home.matching")],
                  ...(SUPPORTERS_ENABLED
                    ? [["/supporters", "Supporters"] as const]
                    : []),
                  ["/live", "Live"],
                  ["/clubs", t("home.clubs")],
                  ["/matches", t("home.matches")],
                  ["/actualites", t("home.news")],
                ] as const
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole={
                    value === "all" || value === "network" ? "tab" : "button"
                  }
                  accessibilityState={
                    value === "all" || value === "network"
                      ? { selected: mode === value }
                      : undefined
                  }
                  aria-selected={
                    value === "all" || value === "network"
                      ? mode === value
                      : undefined
                  }
                  onPress={() => {
                    if (value === "all" || value === "network") setMode(value);
                    else router.push(value);
                  }}
                  onFocus={() => setFocusedNavigation(value)}
                  onBlur={() => setFocusedNavigation(null)}
                  onHoverIn={() => setHoveredNavigation(value)}
                  onHoverOut={() => setHoveredNavigation(null)}
                  style={({ pressed }) => [
                    styles.category,
                    {
                      borderBottomColor:
                        ((value === "all" || value === "network") &&
                          mode === value) ||
                        focusedNavigation === value
                          ? colors.blue
                          : "transparent",
                      backgroundColor:
                        pressed || hoveredNavigation === value
                          ? colors.accentSoft
                          : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      value === mode && {
                        color: colors.deepBlue,
                        fontFamily: "Inter-SemiBold",
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.screen}>
      <AccountMenu
        visible={accountMenuOpen}
        onClose={() => setAccountMenuOpen(false)}
      />
      <View style={{ flex: 1 }} onLayout={measureViewport}>
        {loading ? (
          <Loading />
        ) : (
          <FlatList
            ref={list}
            key={scope}
            testID="home-feed"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            style={[
              styles.feed,
              !session && styles.publicFeed,
              paged ? webSnapList : undefined,
            ]}
            {...(Platform.OS !== "web" && paged
              ? {
                  snapToOffsets: snapOffsets,
                  snapToAlignment: "start" as const,
                  decelerationRate: "fast" as const,
                  disableIntervalMomentum: true,
                }
              : {})}
            data={posts}
            keyExtractor={(p) => p.id}
            renderItem={({ item, index }) => (
              <View style={paged ? { height: pageHeight } : undefined}>
                <PostCard
                  post={item}
                  mediaVisible={
                    !introVisible &&
                    item.id === visibleFeed.visibleVideo &&
                    !accountMenuOpen
                  }
                  pageHeight={paged ? pageHeight : undefined}
                  bottomInset={paged ? bottomInset : 0}
                  onBackToFeed={backToFeed}
                />
              </View>
            )}
            extraData={{
              visibleVideo: visibleFeed.visibleVideo,
              introVisible,
              pageHeight,
              bottomInset,
              accountMenuOpen,
              theme: colors.background,
            }}
            CellRendererComponent={FeedPageCell}
            getItemLayout={
              paged
                ? (_data, index) => ({
                    index,
                    length: pageHeight,
                    offset: feedPageOffset(index, introHeight, pageHeight),
                  })
                : undefined
            }
            onScroll={(event) => {
              scrollOffset.current = event.nativeEvent.contentOffset.y;
              updateIntroVisibility(scrollOffset.current, introHeight);
              updateScrollChrome(scrollOffset.current);
            }}
            scrollEventThrottle={16}
            onViewableItemsChanged={stableOnViewableItemsChanged}
            viewabilityConfig={visibleFeed.viewabilityConfig}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
            updateCellsBatchingPeriod={60}
            ListHeaderComponent={
              <View
                onLayout={measureIntro}
                style={paged ? webSnapPage : undefined}
              >
                <View
                  onLayout={({ nativeEvent }) =>
                    setHeaderContentHeight(nativeEvent.layout.height)
                  }
                >
                  {navigationHeader}
                  {top}
                  {!!session && mode === "all" && (
                    <View
                      onLayout={(event) =>
                        setNewsStart(event.nativeEvent.layout.y)
                      }
                    >
                      <HomeNews
                        activeIndex={activeNewsIndex}
                        pageHeight={pageHeight}
                        bottomInset={bottomInset}
                        onCount={setNewsCount}
                      />
                    </View>
                  )}
                </View>
                {!!(
                  session &&
                  !feed.isPending &&
                  !feed.isError &&
                  allPosts.length <= 2
                ) && <PublishNudge compact={!!firstPost} />}
                {!!firstPost && (
                  <View style={paged ? webSnapPage : undefined}>
                    <PostCard
                      key={firstPost.id}
                      post={firstPost}
                      pageHeight={paged ? firstPostHeight : undefined}
                      bottomInset={paged ? bottomInset : 0}
                      mediaVisible={introVisible && !accountMenuOpen}
                    />
                  </View>
                )}
              </View>
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: !session
                ? insets.bottom
                : paged
                  ? 0
                  : bottomInset + 12,
            }}
            refreshing={
              canReadFeed && feed.isRefetching && !feed.isFetchingNextPage
            }
            onRefresh={() => {
              if (canReadFeed) void feed.refetch();
            }}
            onEndReached={() => {
              void loadMore();
            }}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              canReadFeed && !firstPost ? (
                <View style={{ padding: 20 }}>
                  {feed.isPending ? (
                    <Loading />
                  ) : feed.isError ? (
                    <ErrorState
                      error={feed.error}
                      retry={() => void feed.refetch()}
                    />
                  ) : (
                    <View style={styles.emptyState}>
                      <Empty
                        title="Le terrain est à vous"
                        description="Aucune publication à afficher pour le moment. Publiez votre premier contenu pour apparaître dans le fil."
                      />
                    </View>
                  )}
                </View>
              ) : null
            }
            ListFooterComponent={
              hasFooter ? (
                <View
                  style={[
                    styles.feedFooter,
                    webSnapPage,
                    {
                      minHeight: paged ? pageHeight : undefined,
                      paddingBottom: bottomInset + 16,
                    },
                  ]}
                >
                  {feed.isFetchingNextPage ? (
                    <Loading />
                  ) : feed.isError ? (
                    <ErrorState
                      error={feed.error}
                      retry={() => {
                        if (feed.isFetchNextPageError) void loadMore(true);
                        else void feed.refetch();
                      }}
                    />
                  ) : feed.hasNextPage ? (
                    <Button
                      title="Afficher plus de publications"
                      secondary
                      onPress={() => void loadMore(true)}
                    />
                  ) : null}
                </View>
              ) : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function PublishNudge({ compact = false }: { compact?: boolean }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Créer une publication"
      onPress={() => router.push("/compose/choose")}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.publishNudge,
        compact && styles.publishNudgeCompact,
        {
          borderColor: focused ? colors.blue : colors.border,
          backgroundColor:
            pressed || hovered ? colors.accentSoft : colors.surface,
        },
      ]}
    >
      <Edit3 size={20} color={colors.deepBlue} />
      <Text style={styles.publishNudgeTitle}>Partager un moment</Text>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    publicFeed: { maxWidth: 1080 },
    publicHeader: {
      maxWidth: 1080,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    emptyState: { gap: 18, alignItems: "center", paddingVertical: 20 },
    publishNudge: {
      marginHorizontal: 12,
      marginVertical: 10,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    publishNudgeCompact: { marginBottom: 6 },
    publishNudgeTitle: {
      color: colors.ink,
      fontFamily: "Inter-Medium",
      fontSize: 14,
      lineHeight: 20,
      flexShrink: 1,
    },
    feedNavigation: {
      flexDirection: "row",
      flexWrap: "nowrap",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 4,
      width: "100%",
    },
    feedTabsScroll: { flexGrow: 0, flexShrink: 1, width: "100%" },
    feedTabs: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 2,
      // Keep the content wider than the viewport so the horizontal ScrollView
      // has real overflow to scroll on RN Web as well as native.
      alignSelf: "flex-start",
    },
    discoverButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      minHeight: 44,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1,
    },
    discoverGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingVertical: 10,
    },
    discoverItem: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
    },
    feed: { flex: 1, width: "100%", maxWidth: 600, alignSelf: "center" },
    categories: { flexDirection: "row", gap: 14, paddingRight: 12 },
    category: {
      minHeight: 44,
      minWidth: 44,
      flexShrink: 0,
      justifyContent: "center",
      paddingHorizontal: 10,
      borderBottomWidth: 3,
    },
    categoryText: {
      fontFamily: "Inter-Medium",
      color: colors.muted,
      fontSize: 12,
      fontWeight: "500",
    },
    feedFooter: { padding: 16, justifyContent: "center" },
    welcome: { padding: 20, gap: 18 },
    header: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 2,
      backgroundColor: colors.surface,
      width: "100%",
      maxWidth: 600,
      alignSelf: "center",
      // The feed contains full-screen media with its own stacked controls.
      // Keep the navigation above those siblings for native hit testing too.
      zIndex: 1,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      minHeight: 48,
      zIndex: 1,
    },
    landingBrandWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 1,
    },
    landingHeaderBall: {
      width: 42,
      height: 42,
      borderRadius: 21,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginLeft: "auto",
      flexShrink: 0,
    },
    emptyIcon: {
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 50,
    },
  });
