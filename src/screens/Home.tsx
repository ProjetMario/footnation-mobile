import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  Pressable,
  Text,
  View,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import type { CellRendererProps } from "@react-native/virtualized-lists";
import { router } from "expo-router";
import { Image } from "expo-image";
import {
  BookOpen,
  Briefcase,
  Building2,
  Edit3,
  Heart,
  MapPin,
  Menu,
  Search,
  Send,
  Shield,
  Sparkles,
  Trophy,
  Users,
  Video,
} from "lucide-react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { floatingBarSpace } from "../components/FloatingTabBar";
import { setScrollChromeCompact } from "../components/scrollChrome";
import { useAuth } from "../lib/auth";
import { usePosts } from "../lib/data";
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
import { MatchTicker } from "../components/MatchTicker";
import { NotificationButton } from "../components/NotificationButton";
import { AccountMenu } from "../components/AccountMenu";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLanguage, useTranslation, type LanguageOption } from "../lib/i18n";
import { SiteFooter } from "../components/SiteFooter";
import { HomeNews } from "../components/HomeNews";
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

const pagedVisibility = {
  viewAreaCoveragePercentThreshold: 65,
  minimumViewTime: 150,
};
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

type LandingCopy = {
  audiences: string[];
  profiles: string[];
  searchPills: string[];
  communityCards: { title: string; text: string }[];
  eyebrow: string;
  title: string;
  free: string;
  description: string;
  signup: string;
  login: string;
  explore: string;
  searchTitle: string;
  stats: [string, string][];
  communityKicker: string;
  communityTitle: string;
  clubKicker: string;
  clubTitle: string;
  location: string;
  discoverClubs: string;
  finalTitle: string;
  finalText: string;
  finalButton: string;
};

const landingCopies: Partial<Record<LanguageOption["code"], LandingCopy>> = {
  fr: {
    audiences: [
      "Football Amateur",
      "Football Professionnel",
      "Football Féminin",
      "Football Masculin",
    ],
    profiles: [
      "Fans",
      "Joueurs",
      "Bénévoles",
      "Coachs",
      "Éducateurs",
      "Arbitres",
    ],
    searchPills: [
      "Tout",
      "Clubs",
      "Joueurs",
      "Bénévoles",
      "Éducateurs",
      "Opportunités",
    ],
    communityCards: [
      {
        title: "Crée ton profil foot",
        text: "Présente ton poste, ton club, tes vidéos, ton parcours et tes objectifs.",
      },
      {
        title: "Trouve des clubs",
        text: "Explore les clubs, équipes, opportunités et contacts près de toi.",
      },
      {
        title: "Montre ton niveau",
        text: "Publie tes actions, tes matchs, tes Shorts et ton palmarès.",
      },
      {
        title: "Connecte ton réseau",
        text: "Échange avec joueurs, coachs, dirigeants, recruteurs et passionnés.",
      },
    ],
    eyebrow: "VOTRE RÉSEAU SOCIAL 100% FOOTBALL !",
    title: "Bienvenue dans le 1er réseau des amoureux du FOOT !",
    free: "100% GRATUIT",
    description:
      "FootNation réunit tous les acteurs du football, professionnels et amateurs.",
    signup: "Créer mon profil gratuitement",
    login: "Se connecter",
    explore: "Explorer FootNation",
    searchTitle:
      "Trouve rapidement un joueur, un club, une opportunité ou un réseau.",
    stats: [
      ["+ profils", "Joueurs, coachs, clubs, fans"],
      ["24/7", "Profil visible en continu"],
      ["100%", "Communauté football"],
    ],
    communityKicker: "Communauté",
    communityTitle: "Le vestiaire numérique de tous les amoureux du foot.",
    clubKicker: "Clubs & opportunités",
    clubTitle:
      "Découvre les clubs, matchs, demandes, offres et profils autour de toi.",
    location: "France, Europe et réseau international FootNation",
    discoverClubs: "Découvrir les clubs",
    finalTitle: "Prêt à rejoindre le terrain ?",
    finalText:
      "Crée ton profil, invite ton réseau et commence à publier tes meilleurs moments.",
    finalButton: "Créer mon profil FootNation",
  },
  en: {
    audiences: [
      "Amateur Football",
      "Professional Football",
      "Women’s Football",
      "Men’s Football",
    ],
    profiles: [
      "Fans",
      "Players",
      "Volunteers",
      "Coaches",
      "Educators",
      "Referees",
    ],
    searchPills: [
      "All",
      "Clubs",
      "Players",
      "Volunteers",
      "Educators",
      "Opportunities",
    ],
    communityCards: [
      {
        title: "Create your football profile",
        text: "Show your position, club, videos, journey and goals.",
      },
      {
        title: "Find clubs",
        text: "Explore clubs, teams, opportunities and contacts near you.",
      },
      {
        title: "Show your level",
        text: "Post your plays, matches, Shorts and achievements.",
      },
      {
        title: "Connect your network",
        text: "Chat with players, coaches, managers, recruiters and fans.",
      },
    ],
    eyebrow: "YOUR 100% FOOTBALL SOCIAL NETWORK!",
    title: "Welcome to the first network for football lovers!",
    free: "100% FREE",
    description:
      "FootNation brings together everyone in football, from professionals to amateurs.",
    signup: "Create my profile for free",
    login: "Log in",
    explore: "Explore FootNation",
    searchTitle: "Quickly find a player, club, opportunity or network.",
    stats: [
      ["+ profiles", "Players, coaches, clubs, fans"],
      ["24/7", "Profile always visible"],
      ["100%", "Football community"],
    ],
    communityKicker: "Community",
    communityTitle: "The digital locker room for every football lover.",
    clubKicker: "Clubs & opportunities",
    clubTitle:
      "Discover clubs, matches, requests, offers and profiles around you.",
    location: "France, Europe and the international FootNation network",
    discoverClubs: "Discover clubs",
    finalTitle: "Ready to join the pitch?",
    finalText:
      "Create your profile, invite your network and start sharing your best moments.",
    finalButton: "Create my FootNation profile",
  },
  es: {
    audiences: [
      "Fútbol amateur",
      "Fútbol profesional",
      "Fútbol femenino",
      "Fútbol masculino",
    ],
    profiles: [
      "Fans",
      "Jugadores",
      "Voluntarios",
      "Entrenadores",
      "Educadores",
      "Árbitros",
    ],
    searchPills: [
      "Todo",
      "Clubes",
      "Jugadores",
      "Voluntarios",
      "Educadores",
      "Oportunidades",
    ],
    communityCards: [
      {
        title: "Crea tu perfil de fútbol",
        text: "Presenta tu posición, club, vídeos, trayectoria y objetivos.",
      },
      {
        title: "Encuentra clubes",
        text: "Explora clubes, equipos, oportunidades y contactos cerca de ti.",
      },
      {
        title: "Muestra tu nivel",
        text: "Publica tus jugadas, partidos, Shorts y palmarés.",
      },
      {
        title: "Conecta tu red",
        text: "Habla con jugadores, entrenadores, directivos, reclutadores y fans.",
      },
    ],
    eyebrow: "¡TU RED SOCIAL 100% FÚTBOL!",
    title: "¡Bienvenido a la primera red para amantes del fútbol!",
    free: "100% GRATIS",
    description:
      "FootNation reúne a todos los actores del fútbol, profesionales y amateurs.",
    signup: "Crear mi perfil gratis",
    login: "Iniciar sesión",
    explore: "Explorar FootNation",
    searchTitle: "Encuentra rápidamente un jugador, club, oportunidad o red.",
    stats: [
      ["+ perfiles", "Jugadores, entrenadores, clubes, fans"],
      ["24/7", "Perfil siempre visible"],
      ["100%", "Comunidad fútbol"],
    ],
    communityKicker: "Comunidad",
    communityTitle: "El vestuario digital de todos los amantes del fútbol.",
    clubKicker: "Clubes y oportunidades",
    clubTitle:
      "Descubre clubes, partidos, solicitudes, ofertas y perfiles cerca de ti.",
    location: "Francia, Europa y red internacional FootNation",
    discoverClubs: "Descubrir clubes",
    finalTitle: "¿Listo para entrar al campo?",
    finalText:
      "Crea tu perfil, invita a tu red y empieza a publicar tus mejores momentos.",
    finalButton: "Crear mi perfil FootNation",
  },
  pt: {
    audiences: [
      "Futebol amador",
      "Futebol profissional",
      "Futebol feminino",
      "Futebol masculino",
    ],
    profiles: [
      "Fãs",
      "Jogadores",
      "Voluntários",
      "Treinadores",
      "Educadores",
      "Árbitros",
    ],
    searchPills: [
      "Tudo",
      "Clubes",
      "Jogadores",
      "Voluntários",
      "Educadores",
      "Oportunidades",
    ],
    communityCards: [
      {
        title: "Cria o teu perfil",
        text: "Mostra posição, clube, vídeos, percurso e objetivos.",
      },
      {
        title: "Encontra clubes",
        text: "Explora clubes, equipas, oportunidades e contactos perto de ti.",
      },
      {
        title: "Mostra o teu nível",
        text: "Publica jogadas, jogos, Shorts e conquistas.",
      },
      {
        title: "Liga a tua rede",
        text: "Fala com jogadores, treinadores, dirigentes, recrutadores e fãs.",
      },
    ],
    eyebrow: "A TUA REDE SOCIAL 100% FUTEBOL!",
    title: "Bem-vindo à primeira rede para amantes do futebol!",
    free: "100% GRÁTIS",
    description:
      "FootNation reúne todos os atores do futebol, profissionais e amadores.",
    signup: "Criar perfil grátis",
    login: "Entrar",
    explore: "Explorar FootNation",
    searchTitle:
      "Encontra rapidamente um jogador, clube, oportunidade ou rede.",
    stats: [
      ["+ perfis", "Jogadores, treinadores, clubes, fãs"],
      ["24/7", "Perfil sempre visível"],
      ["100%", "Comunidade futebol"],
    ],
    communityKicker: "Comunidade",
    communityTitle: "O balneário digital de todos os amantes do futebol.",
    clubKicker: "Clubes e oportunidades",
    clubTitle: "Descobre clubes, jogos, pedidos, ofertas e perfis perto de ti.",
    location: "França, Europa e rede internacional FootNation",
    discoverClubs: "Descobrir clubes",
    finalTitle: "Pronto para entrar em campo?",
    finalText:
      "Cria o teu perfil, convida a tua rede e publica os teus melhores momentos.",
    finalButton: "Criar o meu perfil FootNation",
  },
  de: {
    audiences: [
      "Amateurfußball",
      "Profifußball",
      "Frauenfußball",
      "Männerfußball",
    ],
    profiles: [
      "Fans",
      "Spieler",
      "Freiwillige",
      "Trainer",
      "Ausbilder",
      "Schiedsrichter",
    ],
    searchPills: [
      "Alle",
      "Clubs",
      "Spieler",
      "Freiwillige",
      "Ausbilder",
      "Chancen",
    ],
    communityCards: [
      {
        title: "Erstelle dein Fußballprofil",
        text: "Zeige Position, Club, Videos, Laufbahn und Ziele.",
      },
      {
        title: "Finde Clubs",
        text: "Entdecke Clubs, Teams, Chancen und Kontakte in deiner Nähe.",
      },
      {
        title: "Zeige dein Niveau",
        text: "Poste Aktionen, Spiele, Shorts und Erfolge.",
      },
      {
        title: "Verbinde dein Netzwerk",
        text: "Sprich mit Spielern, Trainern, Managern, Scouts und Fans.",
      },
    ],
    eyebrow: "DEIN 100% FUSSBALL-SOZIALNETZWERK!",
    title: "Willkommen im ersten Netzwerk für Fußballfans!",
    free: "100% KOSTENLOS",
    description:
      "FootNation vereint alle Akteure des Fußballs, Profis und Amateure.",
    signup: "Profil kostenlos erstellen",
    login: "Einloggen",
    explore: "FootNation entdecken",
    searchTitle: "Finde schnell Spieler, Clubs, Chancen oder Netzwerke.",
    stats: [
      ["+ Profile", "Spieler, Trainer, Clubs, Fans"],
      ["24/7", "Profil immer sichtbar"],
      ["100%", "Fußball-Community"],
    ],
    communityKicker: "Community",
    communityTitle: "Die digitale Kabine für alle Fußballfans.",
    clubKicker: "Clubs & Chancen",
    clubTitle:
      "Entdecke Clubs, Spiele, Gesuche, Angebote und Profile in deiner Nähe.",
    location: "Frankreich, Europa und internationales FootNation-Netzwerk",
    discoverClubs: "Clubs entdecken",
    finalTitle: "Bereit für den Platz?",
    finalText:
      "Erstelle dein Profil, lade dein Netzwerk ein und teile deine besten Momente.",
    finalButton: "Mein FootNation-Profil erstellen",
  },
  it: {
    audiences: [
      "Calcio amatoriale",
      "Calcio professionistico",
      "Calcio femminile",
      "Calcio maschile",
    ],
    profiles: [
      "Fan",
      "Giocatori",
      "Volontari",
      "Allenatori",
      "Educatori",
      "Arbitri",
    ],
    searchPills: [
      "Tutto",
      "Club",
      "Giocatori",
      "Volontari",
      "Educatori",
      "Opportunità",
    ],
    communityCards: [
      {
        title: "Crea il tuo profilo",
        text: "Mostra ruolo, club, video, percorso e obiettivi.",
      },
      {
        title: "Trova club",
        text: "Esplora club, squadre, opportunità e contatti vicino a te.",
      },
      {
        title: "Mostra il tuo livello",
        text: "Pubblica azioni, partite, Shorts e risultati.",
      },
      {
        title: "Connetti la tua rete",
        text: "Parla con giocatori, allenatori, dirigenti, recruiter e fan.",
      },
    ],
    eyebrow: "IL TUO SOCIAL NETWORK 100% CALCIO!",
    title: "Benvenuto nella prima rete per amanti del calcio!",
    free: "100% GRATIS",
    description:
      "FootNation riunisce tutti gli attori del calcio, professionisti e dilettanti.",
    signup: "Crea gratis il mio profilo",
    login: "Accedi",
    explore: "Esplora FootNation",
    searchTitle: "Trova rapidamente un giocatore, club, opportunità o rete.",
    stats: [
      ["+ profili", "Giocatori, allenatori, club, fan"],
      ["24/7", "Profilo sempre visibile"],
      ["100%", "Community calcio"],
    ],
    communityKicker: "Community",
    communityTitle: "Lo spogliatoio digitale di tutti gli amanti del calcio.",
    clubKicker: "Club e opportunità",
    clubTitle:
      "Scopri club, partite, richieste, offerte e profili intorno a te.",
    location: "Francia, Europa e rete internazionale FootNation",
    discoverClubs: "Scopri i club",
    finalTitle: "Pronto a entrare in campo?",
    finalText:
      "Crea il tuo profilo, invita la tua rete e pubblica i tuoi momenti migliori.",
    finalButton: "Crea il mio profilo FootNation",
  },
  ar: {
    audiences: [
      "كرة قدم للهواة",
      "كرة قدم احترافية",
      "كرة قدم نسائية",
      "كرة قدم رجالية",
    ],
    profiles: ["مشجعون", "لاعبون", "متطوعون", "مدربون", "مربون", "حكام"],
    searchPills: ["الكل", "الأندية", "اللاعبون", "متطوعون", "مربون", "فرص"],
    communityCards: [
      {
        title: "أنشئ ملفك الكروي",
        text: "اعرض مركزك وناديك وفيديوهاتك ومسارك وأهدافك.",
      },
      {
        title: "ابحث عن الأندية",
        text: "استكشف الأندية والفرق والفرص والجهات القريبة منك.",
      },
      {
        title: "أظهر مستواك",
        text: "انشر لقطاتك ومبارياتك وShorts وإنجازاتك.",
      },
      {
        title: "وسّع شبكتك",
        text: "تواصل مع اللاعبين والمدربين والمسؤولين والكشافين والمشجعين.",
      },
    ],
    eyebrow: "شبكتك الاجتماعية لكرة القدم 100%!",
    title: "مرحبًا بك في أول شبكة لعشاق كرة القدم!",
    free: "مجاني 100%",
    description: "يجمع FootNation كل أطراف كرة القدم، المحترفين والهواة.",
    signup: "أنشئ ملفي مجانًا",
    login: "تسجيل الدخول",
    explore: "استكشف FootNation",
    searchTitle: "اعثر بسرعة على لاعب أو نادٍ أو فرصة أو شبكة.",
    stats: [
      ["+ ملفات", "لاعبون، مدربون، أندية، مشجعون"],
      ["24/7", "ملفك ظاهر دائمًا"],
      ["100%", "مجتمع كرة القدم"],
    ],
    communityKicker: "المجتمع",
    communityTitle: "غرفة الملابس الرقمية لكل عشاق كرة القدم.",
    clubKicker: "الأندية والفرص",
    clubTitle: "اكتشف الأندية والمباريات والطلبات والعروض والملفات حولك.",
    location: "فرنسا وأوروبا وشبكة FootNation الدولية",
    discoverClubs: "اكتشاف الأندية",
    finalTitle: "جاهز للنزول إلى الملعب؟",
    finalText: "أنشئ ملفك، ادعُ شبكتك وابدأ بنشر أفضل لحظاتك.",
    finalButton: "إنشاء ملفي على FootNation",
  },
};

const searchPillIcons = [
  Search,
  Building2,
  Users,
  Heart,
  BookOpen,
  Briefcase,
] as const;
const communityIcons = [Users, Building2, Trophy, Shield] as const;

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
  const t = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const s = useUIStyles();
  const { session, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, fontScale } = useWindowDimensions();
  const [pageHeight, setPageHeight] = useState(
    Math.max(1, windowHeight - insets.top),
  );
  const [introHeight, setIntroHeight] = useState(0);
  const [introVisible, setIntroVisible] = useState(true);
  const introVisibleRef = useRef(true);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mode, setMode] = useState<"all" | "network">("all");
  const feed = usePosts(mode);
  const hiddenPosts = useHiddenPosts();
  const allPosts = useMemo(
    () =>
      session
        ? uniqueFeedItems(feed.data?.pages).filter(
            (post) => !hiddenPosts.ids.includes(post.id),
          )
        : [],
    [feed.data?.pages, session?.user.id, hiddenPosts.data],
  );
  const firstPost = allPosts[0];
  const posts = useMemo(() => allPosts.slice(1), [allPosts]);
  const [headerContentHeight, setHeaderContentHeight] = useState(194);
  const [matchHeight, setMatchHeight] = useState(90);
  const [activeNewsIndex, setActiveNewsIndex] = useState(0);
  const [availableNewsCount, setNewsCount] = useState(0);
  const newsCount = mode === "all" ? availableNewsCount : 0;
  const [newsStart, setNewsStart] = useState(0);
  const [scoresVisible, setScoresVisible] = useState(false);
  const firstPostHeight = pageHeight;
  const scope = `${session?.user.id || "guest"}:${mode}`;
  const bottomInset = floatingBarSpace(insets.bottom);
  // Intro content has its own space; its height must not disable the feed layout.
  const minimumCardHeight = bottomInset + 240 * fontScale;
  const paged =
    !!session &&
    allPosts.length > 0 &&
    pageHeight / fontScale >= 480 &&
    (posts.length === 0 || pageHeight - matchHeight >= minimumCardHeight);
  const hasFooter =
    !!session && (feed.isFetchingNextPage || feed.isError || feed.hasNextPage);
  const updateIntroVisibility = useCallback(
    (offset: number, height: number) => {
      const visible = homeHeaderPostVisible({
        offset,
        viewportHeight: pageHeight,
        contentStart: headerContentHeight,
        contentEnd: height - (posts.length === 0 ? matchHeight : 0),
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
      const scoresTop = posts.length === 0 ? height - matchHeight : height;
      const scoresOnscreen =
        height > 0 &&
        offset + pageHeight > scoresTop &&
        offset < scoresTop + matchHeight;
      setScoresVisible((previous) =>
        previous === scoresOnscreen ? previous : scoresOnscreen,
      );
    },
    [
      pageHeight,
      headerContentHeight,
      posts.length,
      matchHeight,
      newsStart,
      newsCount,
    ],
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
  const visibleFeed = useVisibleFeedMedia<Post>(scope, pagedVisibility, true);
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
          Math.max(
            0,
            introHeight -
              firstPostHeight -
              (posts.length === 0 ? matchHeight : 0),
          ),
        ]),
      ].sort((a, b) => a - b),
    [
      posts.length,
      hasFooter,
      introHeight,
      pageHeight,
      firstPostHeight,
      matchHeight,
      newsCount,
      newsStart,
    ],
  );
  const pageGate = useRef(createPageRequestGate());
  const loadMore = (retry = false) =>
    pageGate.current.run(
      {
        key: `${session?.user.id}:${mode}:${feed.data?.pages.length || 0}:${feed.data?.pages.at(-1)?.at(-1)?.id || ""}`,
        hasNextPage: !!session && feed.hasNextPage,
        isFetching: feed.isFetching,
        isError: feed.isError,
        retry,
      },
      () => feed.fetchNextPage(),
    );
  const top = <View>{!session ? <PublicLanding /> : <StoryRail />}</View>;
  const navigationHeader = (
    <View style={styles.header}>
      <View style={styles.headerActions}>
        <View style={styles.landingBrandWrap}>
          {!session && (
            <Image
              source={require("../../assets/brand/app-icon.png")}
              style={styles.landingHeaderBall}
              contentFit="contain"
              accessibilityLabel="Logo ballon FootNation"
            />
          )}
          <Brand showLogo={!!session} />
        </View>
        <View style={styles.headerRight}>
          <LanguageSwitcher visibleForGuests compact />
          {!!session && (
            <>
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
            </>
          )}
        </View>
      </View>
      {!!session && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
          accessibilityRole="tablist"
          accessibilityLabel={t("home.navigation")}
        >
          {(
            [
              ["all", t("home.forYou"), null],
              ["network", t("home.network"), null],
              ["opportunities", t("home.opportunities"), "/opportunities"],
              ["matching", t("home.matching"), "/matching"],
              ["live", "Live", "/live"],
              ["clubs", t("home.clubs"), "/clubs"],
              ["matches", t("home.matches"), "/matches"],
              ["news", t("home.news"), "/actualites"],
            ] as const
          ).map(([value, label, href]) => {
            const selected = !href && mode === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                aria-selected={selected}
                onPress={() => {
                  if (href) router.push(href);
                  else setMode(value);
                }}
                style={({ pressed }) => [
                  styles.category,
                  {
                    borderBottomColor: selected ? colors.blue : "transparent",
                    opacity: pressed ? 0.65 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selected
                      ? {
                          color: colors.deepBlue,
                          fontFamily: "Inter-SemiBold",
                          fontWeight: "600",
                        }
                      : undefined,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
            style={[styles.feed, paged ? webSnapList : undefined]}
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
                {index === 0 && (
                  <View
                    onLayout={({ nativeEvent }) =>
                      setMatchHeight(nativeEvent.layout.height)
                    }
                  >
                    <MatchTicker active={scoresVisible && !accountMenuOpen} />
                  </View>
                )}
                <PostCard
                  post={item}
                  mediaVisible={
                    !introVisible &&
                    item.id === visibleFeed.visibleVideo &&
                    !accountMenuOpen
                  }
                  pageHeight={
                    paged
                      ? Math.max(
                          1,
                          pageHeight - (index === 0 ? matchHeight : 0),
                        )
                      : undefined
                  }
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
              matchHeight,
              scoresVisible,
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
                {!!(firstPost && posts.length === 0) && (
                  <View
                    onLayout={({ nativeEvent }) =>
                      setMatchHeight(nativeEvent.layout.height)
                    }
                  >
                    <MatchTicker active={scoresVisible && !accountMenuOpen} />
                  </View>
                )}
              </View>
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: paged ? 0 : bottomInset + 12,
            }}
            refreshing={
              !!session && feed.isRefetching && !feed.isFetchingNextPage
            }
            onRefresh={() => {
              if (session) void feed.refetch();
            }}
            onEndReached={() => {
              void loadMore();
            }}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              session && !firstPost ? (
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
              hasFooter || session ? (
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
                  {!!session && <SiteFooter />}
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
  return (
    <View style={[styles.publishNudge, compact && styles.publishNudgeCompact]}>
      <View style={styles.publishNudgeIcon}>
        <Sparkles size={24} color={colors.white} />
      </View>
      <View style={styles.publishNudgeCopy}>
        <Text style={styles.publishNudgeTitle}>Montre ton football</Text>
        <Text style={styles.publishNudgeText}>
          Une photo, une vidéo ou une demande suffit pour lancer ton profil et
          attirer les bons contacts.
        </Text>
        <View style={styles.publishNudgeActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Créer une publication"
            onPress={() => router.push("/compose")}
            style={({ pressed }) => [
              styles.publishPrimary,
              { opacity: pressed ? 0.78 : 1 },
            ]}
          >
            <Edit3 size={16} color={colors.white} />
            <Text style={styles.publishPrimaryText}>Publier</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Publier une vidéo courte"
            onPress={() => router.push("/shorts/create")}
            style={({ pressed }) => [
              styles.publishSecondary,
              { opacity: pressed ? 0.78 : 1 },
            ]}
          >
            <Video size={16} color={colors.blue} />
            <Text style={styles.publishSecondaryText}>Short</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function PublicLanding() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { language } = useLanguage();
  const copy = landingCopies[language] || landingCopies.fr!;
  const [audienceIndex, setAudienceIndex] = useState(0);
  useEffect(() => {
    setAudienceIndex(0);
    const interval = setInterval(() => {
      setAudienceIndex((current) => (current + 1) % copy.audiences.length);
    }, 5200);
    return () => clearInterval(interval);
  }, [copy.audiences.length, language]);
  return (
    <View style={styles.publicLanding}>
      <View style={styles.heroShell}>
        <View style={styles.heroGlowPrimary} />
        <View style={styles.heroGlowSecondary} />
        <View style={styles.heroCard}>
          <Text accessibilityRole="header" style={styles.heroTitle}>
            {copy.title}
          </Text>
          <View
            style={styles.profileRail}
            accessibilityLabel="Profils FootNation"
          >
            {copy.profiles.map((label) => (
              <View key={label} style={styles.profilePill}>
                <Text style={styles.profilePillText}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.heroBadgeRow}>
            <Text style={styles.freeBadge}>{copy.free}</Text>
            <View style={styles.liveDot} />
            <Text style={styles.audienceText}>
              {copy.audiences[audienceIndex]}
            </Text>
          </View>
          <Text style={styles.heroDescription}>{copy.description}</Text>
          <View style={styles.heroActions}>
            <Button
              title={copy.signup}
              onPress={() => router.push("/signup")}
            />
            <Button
              title={copy.login}
              secondary
              onPress={() => router.push("/login")}
            />
          </View>
        </View>
      </View>

      <View style={styles.searchCard}>
        <Text style={styles.sectionKicker}>{copy.explore}</Text>
        <Text style={styles.sectionTitle}>{copy.searchTitle}</Text>
        <View style={styles.searchGrid}>
          {copy.searchPills.map((label, index) => {
            const Icon = searchPillIcons[index];
            const route = [
              "/search",
              "/clubs",
              "/search-users",
              "/matching",
              "/matching",
              "/opportunities",
            ][index];
            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={`Explorer ${label}`}
                onPress={() => router.push(route)}
                style={({ pressed }) => [
                  styles.searchPill,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Icon size={17} color={colors.white} />
                <Text style={styles.searchPillText}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.statsRow}>
        {copy.stats.map(([value, label]) => (
          <View key={value} style={styles.statCard}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionKicker}>{copy.communityKicker}</Text>
        <Text style={styles.sectionTitle}>{copy.communityTitle}</Text>
        <View style={styles.communityGrid}>
          {copy.communityCards.map(({ title, text }, index) => {
            const Icon = communityIcons[index];
            return (
              <View key={title} style={styles.communityCard}>
                <View style={styles.communityIcon}>
                  <Icon size={22} color={colors.white} />
                </View>
                <Text style={styles.communityTitle}>{title}</Text>
                <Text style={styles.communityText}>{text}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.clubPreview}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={styles.sectionKicker}>{copy.clubKicker}</Text>
          <Text style={styles.clubTitle}>{copy.clubTitle}</Text>
          <View style={styles.locationLine}>
            <MapPin size={16} color={colors.neon} />
            <Text style={styles.locationText}>{copy.location}</Text>
          </View>
        </View>
        <Button
          title={copy.discoverClubs}
          secondary
          onPress={() => router.push("/clubs")}
        />
      </View>

      <View style={styles.finalCta}>
        <Text style={styles.finalTitle}>{copy.finalTitle}</Text>
        <Text style={styles.finalText}>{copy.finalText}</Text>
        <Button
          title={copy.finalButton}
          onPress={() => router.push("/signup")}
        />
      </View>

      <SiteFooter />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    publicLanding: {
      gap: 18,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 28,
      backgroundColor: "#06111D",
    },
    heroShell: {
      position: "relative",
      overflow: "hidden",
      borderRadius: 30,
      backgroundColor: "#071429",
      borderWidth: 1,
      borderColor: "rgba(8,124,255,0.28)",
      shadowColor: "#087CFF",
      shadowOpacity: 0.22,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 16 },
      elevation: 6,
    },
    heroGlowPrimary: {
      position: "absolute",
      top: -90,
      left: -60,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: "rgba(8,124,255,0.28)",
    },
    heroGlowSecondary: {
      position: "absolute",
      right: -80,
      bottom: -80,
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: "rgba(255,71,87,0.16)",
    },
    heroCard: {
      padding: 20,
      gap: 16,
      alignItems: "center",
    },
    heroEyebrow: {
      color: "rgba(255,255,255,0.66)",
      fontFamily: "Inter-SemiBold",
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.9,
      textAlign: "center",
    },
    heroImage: {
      width: "100%",
      height: 180,
      maxWidth: 360,
      shadowColor: "#087CFF",
      shadowOpacity: 0.6,
      shadowRadius: 28,
    },
    heroTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 32,
      lineHeight: 38,
      fontWeight: "900",
      textAlign: "center",
      letterSpacing: -1.1,
    },
    profileRail: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
    },
    profilePill: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: "rgba(255,255,255,0.08)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
    },
    profilePillText: {
      color: "rgba(255,255,255,0.86)",
      fontFamily: "Inter-SemiBold",
      fontSize: 12,
      fontWeight: "700",
    },
    heroBadgeRow: {
      alignSelf: "stretch",
      flexWrap: "wrap",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      borderRadius: 26,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: "rgba(8,24,38,0.78)",
      borderWidth: 1,
      borderColor: "rgba(8,124,255,0.34)",
      shadowColor: "#087CFF",
      shadowOpacity: 0.24,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    freeBadge: {
      flexShrink: 0,
      overflow: "hidden",
      borderRadius: 999,
      paddingHorizontal: 13,
      paddingVertical: 7,
      color: colors.white,
      backgroundColor: colors.blue,
      fontFamily: "Inter-Bold",
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    liveDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.blue,
    },
    audienceText: {
      flexBasis: "100%",
      textAlign: "center",
      color: colors.red,
      fontFamily: "Inter-Bold",
      fontSize: 29,
      lineHeight: 35,
      fontWeight: "900",
      letterSpacing: -0.4,
      flexShrink: 1,
    },
    heroDescription: {
      color: "rgba(255,255,255,0.74)",
      fontFamily: "Inter-Regular",
      fontSize: 15,
      lineHeight: 23,
      textAlign: "center",
    },
    heroActions: {
      width: "100%",
      gap: 10,
    },
    searchCard: {
      borderRadius: 24,
      padding: 18,
      gap: 14,
      backgroundColor: "#081826",
      borderWidth: 1,
      borderColor: "rgba(8,124,255,0.22)",
    },
    sectionKicker: {
      color: colors.neon,
      fontFamily: "Inter-Bold",
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    sectionTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 21,
      lineHeight: 28,
      fontWeight: "900",
      letterSpacing: -0.4,
    },
    searchGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    searchPill: {
      minHeight: 44,
      borderRadius: 999,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.blue,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
    },
    searchPillText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 13,
      fontWeight: "800",
    },
    statsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    statCard: {
      flex: 1,
      minWidth: 108,
      borderRadius: 20,
      padding: 14,
      backgroundColor: "#081826",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
    },
    statValue: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 22,
      fontWeight: "900",
    },
    statLabel: {
      color: "rgba(255,255,255,0.62)",
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
    },
    sectionBlock: {
      gap: 14,
      borderRadius: 24,
      padding: 18,
      backgroundColor: "#071429",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
    },
    communityGrid: {
      gap: 12,
    },
    communityCard: {
      borderRadius: 20,
      padding: 16,
      gap: 9,
      backgroundColor: "rgba(255,255,255,0.06)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
    },
    communityIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.blue,
    },
    communityTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 17,
      fontWeight: "900",
    },
    communityText: {
      color: "rgba(255,255,255,0.66)",
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 20,
    },
    clubPreview: {
      gap: 14,
      borderRadius: 24,
      padding: 18,
      backgroundColor: "#0C1F34",
      borderWidth: 1,
      borderColor: "rgba(8,124,255,0.22)",
    },
    clubTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 22,
      lineHeight: 29,
      fontWeight: "900",
    },
    locationLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      flexWrap: "wrap",
    },
    locationText: {
      flex: 1,
      color: "rgba(255,255,255,0.68)",
      fontFamily: "Inter-Regular",
      fontSize: 13,
      lineHeight: 19,
    },
    finalCta: {
      gap: 12,
      borderRadius: 26,
      padding: 20,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: "rgba(8,124,255,0.18)",
    },
    finalTitle: {
      color: "#101828",
      fontFamily: "Inter-Bold",
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "900",
    },
    finalText: {
      color: "#667085",
      fontFamily: "Inter-Regular",
      fontSize: 15,
      lineHeight: 22,
    },
    emptyState: { gap: 18, alignItems: "center", paddingVertical: 20 },
    publishNudge: {
      marginHorizontal: 12,
      marginVertical: 12,
      borderRadius: 26,
      padding: 18,
      flexDirection: "row",
      gap: 14,
      backgroundColor: "#071429",
      borderWidth: 1,
      borderColor: "rgba(8,124,255,0.28)",
      shadowColor: "#071429",
      shadowOpacity: 0.22,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    publishNudgeCompact: { marginBottom: 6 },
    publishNudgeIcon: {
      width: 48,
      height: 48,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.blue,
    },
    publishNudgeCopy: { flex: 1, minWidth: 0, gap: 8 },
    publishNudgeTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 19,
      lineHeight: 25,
      fontWeight: "900",
    },
    publishNudgeText: {
      color: "rgba(255,255,255,0.72)",
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 20,
    },
    publishNudgeActions: { flexDirection: "row", gap: 9, flexWrap: "wrap" },
    publishPrimary: {
      minHeight: 40,
      borderRadius: 14,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      backgroundColor: colors.blue,
    },
    publishPrimaryText: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "900",
    },
    publishSecondary: {
      minHeight: 40,
      borderRadius: 14,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      backgroundColor: colors.white,
    },
    publishSecondaryText: {
      color: colors.blue,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "900",
    },
    feed: { flex: 1, width: "100%", maxWidth: 600, alignSelf: "center" },
    categories: { flexDirection: "row", gap: 14, paddingRight: 12 },
    category: {
      minHeight: 44,
      minWidth: 44,
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
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      minHeight: 48,
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
