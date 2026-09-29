import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { DEFAULT_LOCALE, type SeoLocale } from "../data/geography/locales";

const STORAGE_KEY = "footnation:language:v1";
const IP_LOOKUP_TIMEOUT_MS = 2500;

export type LanguageSource = "saved" | "ip" | "device" | "default" | "manual";

export type AppLanguageCode =
  | "fr"
  | "en"
  | "es"
  | "de"
  | "it"
  | "pt"
  | "hr"
  | "nl"
  | "pl"
  | "ru"
  | "ja"
  | "zh"
  | "ko"
  | "ar"
  | "tr"
  | "uk"
  | "cs"
  | "da"
  | "el"
  | "fi"
  | "hu"
  | "id"
  | "nb"
  | "ro"
  | "sk"
  | "sv"
  | "bg"
  | "et"
  | "lt"
  | "lv"
  | "sl";

export type LanguageOption = {
  code: AppLanguageCode;
  shortCode: string;
  flag: string;
  name: string;
  nativeName: string;
};

type LanguageContextValue = {
  language: AppLanguageCode;
  source: LanguageSource;
  options: LanguageOption[];
  ready: boolean;
  setLanguage: (language: AppLanguageCode) => Promise<void>;
  refreshLanguageFromIp: () => Promise<void>;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    code: "fr",
    shortCode: "FR",
    name: "French",
    nativeName: "Français",
    flag: "🇫🇷",
  },
  {
    code: "en",
    shortCode: "EN",
    name: "English",
    nativeName: "English",
    flag: "🇬🇧",
  },
  {
    code: "es",
    shortCode: "ES",
    name: "Spanish",
    nativeName: "Español",
    flag: "🇪🇸",
  },
  {
    code: "de",
    shortCode: "DE",
    name: "German",
    nativeName: "Deutsch",
    flag: "🇩🇪",
  },
  {
    code: "it",
    shortCode: "IT",
    name: "Italian",
    nativeName: "Italiano",
    flag: "🇮🇹",
  },
  {
    code: "pt",
    shortCode: "PT",
    name: "Portuguese",
    nativeName: "Português",
    flag: "🇵🇹",
  },
  {
    code: "hr",
    shortCode: "HR",
    name: "Croatian",
    nativeName: "Hrvatski",
    flag: "🇭🇷",
  },
  {
    code: "nl",
    shortCode: "NL",
    name: "Dutch",
    nativeName: "Nederlands",
    flag: "🇳🇱",
  },
  {
    code: "pl",
    shortCode: "PL",
    name: "Polish",
    nativeName: "Polski",
    flag: "🇵🇱",
  },
  {
    code: "ru",
    shortCode: "RU",
    name: "Russian",
    nativeName: "Русский",
    flag: "🇷🇺",
  },
  {
    code: "ja",
    shortCode: "JA",
    name: "Japanese",
    nativeName: "日本語",
    flag: "🇯🇵",
  },
  {
    code: "zh",
    shortCode: "ZH",
    name: "Chinese",
    nativeName: "中文",
    flag: "🇨🇳",
  },
  {
    code: "ko",
    shortCode: "KO",
    name: "Korean",
    nativeName: "한국어",
    flag: "🇰🇷",
  },
  {
    code: "ar",
    shortCode: "AR",
    name: "Arabic",
    nativeName: "العربية",
    flag: "🇸🇦",
  },
  {
    code: "tr",
    shortCode: "TR",
    name: "Turkish",
    nativeName: "Türkçe",
    flag: "🇹🇷",
  },
  {
    code: "uk",
    shortCode: "UK",
    name: "Ukrainian",
    nativeName: "Українська",
    flag: "🇺🇦",
  },
  {
    code: "cs",
    shortCode: "CS",
    name: "Czech",
    nativeName: "Čeština",
    flag: "🇨🇿",
  },
  {
    code: "da",
    shortCode: "DA",
    name: "Danish",
    nativeName: "Dansk",
    flag: "🇩🇰",
  },
  {
    code: "el",
    shortCode: "EL",
    name: "Greek",
    nativeName: "Ελληνικά",
    flag: "🇬🇷",
  },
  {
    code: "fi",
    shortCode: "FI",
    name: "Finnish",
    nativeName: "Suomi",
    flag: "🇫🇮",
  },
  {
    code: "hu",
    shortCode: "HU",
    name: "Hungarian",
    nativeName: "Magyar",
    flag: "🇭🇺",
  },
  {
    code: "id",
    shortCode: "ID",
    name: "Indonesian",
    nativeName: "Bahasa Indonesia",
    flag: "🇮🇩",
  },
  {
    code: "nb",
    shortCode: "NB",
    name: "Norwegian",
    nativeName: "Norsk",
    flag: "🇳🇴",
  },
  {
    code: "ro",
    shortCode: "RO",
    name: "Romanian",
    nativeName: "Română",
    flag: "🇷🇴",
  },
  {
    code: "sk",
    shortCode: "SK",
    name: "Slovak",
    nativeName: "Slovenčina",
    flag: "🇸🇰",
  },
  {
    code: "sv",
    shortCode: "SV",
    name: "Swedish",
    nativeName: "Svenska",
    flag: "🇸🇪",
  },
  {
    code: "bg",
    shortCode: "BG",
    name: "Bulgarian",
    nativeName: "Български",
    flag: "🇧🇬",
  },
  {
    code: "et",
    shortCode: "ET",
    name: "Estonian",
    nativeName: "Eesti",
    flag: "🇪🇪",
  },
  {
    code: "lt",
    shortCode: "LT",
    name: "Lithuanian",
    nativeName: "Lietuvių",
    flag: "🇱🇹",
  },
  {
    code: "lv",
    shortCode: "LV",
    name: "Latvian",
    nativeName: "Latviešu",
    flag: "🇱🇻",
  },
  {
    code: "sl",
    shortCode: "SL",
    name: "Slovenian",
    nativeName: "Slovenščina",
    flag: "🇸🇮",
  },
];

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] =
    React.useState<AppLanguageCode>(DEFAULT_LOCALE);
  const [source, setSource] = React.useState<LanguageSource>("default");
  const [ready, setReady] = React.useState(false);

  const applyLanguage = React.useCallback(
    async (nextLanguage: AppLanguageCode, nextSource: LanguageSource) => {
      setLanguageState(nextLanguage);
      setSource(nextSource);
      await AsyncStorage.setItem(STORAGE_KEY, nextLanguage);
    },
    [],
  );

  const refreshLanguageFromIp = React.useCallback(async () => {
    const detected = await detectLanguageFromIp();
    if (detected) {
      await applyLanguage(detected, "ip");
      return;
    }
    const deviceLanguage = detectLanguageFromDevice();
    await applyLanguage(deviceLanguage.language, deviceLanguage.source);
  }, [applyLanguage]);

  React.useEffect(() => {
    let mounted = true;
    async function loadLanguage() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (isAppLanguage(saved)) {
          if (mounted) {
            setLanguageState(saved);
            setSource("saved");
          }
          return;
        }
        const detected = await detectLanguageFromIp();
        if (mounted && detected) {
          setLanguageState(detected);
          setSource("ip");
          await AsyncStorage.setItem(STORAGE_KEY, detected);
          return;
        }
        const fallback = detectLanguageFromDevice();
        if (mounted) {
          setLanguageState(fallback.language);
          setSource(fallback.source);
          await AsyncStorage.setItem(STORAGE_KEY, fallback.language);
        }
      } catch {
        if (mounted) {
          setLanguageState(DEFAULT_LOCALE);
          setSource("default");
        }
      } finally {
        if (mounted) setReady(true);
      }
    }
    void loadLanguage();
    return () => {
      mounted = false;
    };
  }, []);

  const value = React.useMemo<LanguageContextValue>(
    () => ({
      language,
      source,
      options: LANGUAGE_OPTIONS,
      ready,
      setLanguage: (nextLanguage) => applyLanguage(nextLanguage, "manual"),
      refreshLanguageFromIp,
    }),
    [applyLanguage, language, ready, refreshLanguageFromIp, source],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (!context)
    throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

export type TranslationKey =
  | "news.like"
  | "news.comment"
  | "news.share"
  | "notifications.title"
  | "notifications.countUnavailable"
  | "notifications.countUnread"
  | "common.close"
  | "common.retry"
  | "nav.home"
  | "nav.shorts"
  | "nav.search"
  | "nav.profile"
  | "nav.myProfile"
  | "nav.create"
  | "nav.createPost"
  | "nav.createHint"
  | "nav.messages"
  | "home.forYou"
  | "home.network"
  | "home.opportunities"
  | "home.matching"
  | "home.clubs"
  | "home.matches"
  | "home.news"
  | "home.navigation"
  | "home.account"
  | "stories.own"
  | "stories.create"
  | "stories.all"
  | "stories.viewAll"
  | "stories.view"
  | "stories.profile"
  | "stories.profileHint"
  | "stories.unavailable"
  | "news.headline"
  | "news.read"
  | "news.more"
  | "news.loading"
  | "news.unavailable"
  | "translation.show"
  | "translation.original"
  | "translation.hide"
  | "translation.loading"
  | "translation.retry"
  | "translation.unavailable"
  | "translation.quota"
  | "common.search"
  | "common.filter"
  | "common.all"
  | "common.unread"
  | "common.invitations"
  | "common.later"
  | "common.share"
  | "common.copy"
  | "common.other"
  | "common.publish"
  | "common.refine"
  | "common.today"
  | "common.last30days"
  | "common.older"
  | "language.title"
  | "language.close"
  | "language.change"
  | "language.detectIp"
  | "onboarding.badge"
  | "onboarding.defaultTitle"
  | "onboarding.namedTitle"
  | "onboarding.description"
  | "onboarding.profileTitle"
  | "onboarding.teamTitle"
  | "onboarding.teamText"
  | "onboarding.profileText"
  | "onboarding.publishTitle"
  | "onboarding.publishText"
  | "onboarding.opportunitiesTitle"
  | "onboarding.opportunitiesText"
  | "onboarding.matchingTitle"
  | "onboarding.matchingText"
  | "onboarding.inviteTitle"
  | "onboarding.inviteText"
  | "onboarding.completeProfile"
  | "onboarding.invite"
  | "invite.eyebrow"
  | "invite.close"
  | "invite.title"
  | "invite.description1"
  | "invite.description2"
  | "invite.profileBenefit"
  | "invite.signupBenefit"
  | "invite.linkSection"
  | "invite.copyLabel"
  | "invite.shareLabel"
  | "invite.shareSection"
  | "invite.shareHint"
  | "invite.continue"
  | "invite.copyAccessibility"
  | "invite.shareAccessibility"
  | "invite.shareWithChannel"
  | "invite.otherOptions"
  | "messages.accountPicker"
  | "messages.options"
  | "messages.new"
  | "messages.placeholder"
  | "messages.searchAccessibility"
  | "messages.filterAccessibility"
  | "messages.yourNote"
  | "messages.notePlaceholder"
  | "messages.hidden"
  | "messages.pendingOutbox"
  | "messages.clubs"
  | "messages.emptyTitle"
  | "messages.emptyDescription"
  | "notifications.subtitle"
  | "notifications.readAll"
  | "notifications.all"
  | "notifications.unread"
  | "notifications.invitations"
  | "notifications.helper"
  | "notifications.previousInvitations"
  | "notifications.previousNotifications"
  | "notifications.emptyInvitations"
  | "notifications.emptyUnread"
  | "notifications.emptyAll"
  | "notifications.emptyInvitationDescription"
  | "notifications.emptyDescription"
  | "notifications.pendingInvitation"
  | "notifications.read"
  | "notifications.unreadLabel"
  | "opportunities.eyebrow"
  | "opportunities.title"
  | "opportunities.subtitle"
  | "opportunities.publishAd"
  | "opportunities.viewFiltered"
  | "opportunities.searchPlaceholder"
  | "opportunities.searchAccessibility"
  | "opportunities.openFilters"
  | "opportunities.closeFilters"
  | "opportunities.allDepartments"
  | "opportunities.allTypes"
  | "opportunities.allTab"
  | "opportunities.offersTab"
  | "messages.sent"
  | "messages.noResults"
  | "messages.noResultsDescription"
  | "messages.startTitle"
  | "messages.startDescription"
  | "messages.loadOlder"
  | "messages.unreadCount"
  | "opportunities.profileDepartment"
  | "opportunities.profileWanted"
  | "opportunities.department"
  | "opportunities.clearFilters"
  | "opportunities.featured"
  | "opportunities.offer"
  | "opportunities.request"
  | "opportunities.publishedAt"
  | "opportunities.view"
  | "opportunities.emptyTitle"
  | "opportunities.emptyDescription"
  | "opportunities.requestsTab";

type TranslationDictionary = Record<TranslationKey, string>;

const FR_TRANSLATIONS: TranslationDictionary = {
  "news.like": "J’aime cette actualité",
  "news.comment": "Commenter cette actualité",
  "news.share": "Partager cette actualité",
  "notifications.title": "Notifications",
  "notifications.countUnavailable": "Notifications, compteur indisponible",
  "notifications.countUnread": "Notifications, {count} non lues",

  "common.close": "Fermer",
  "common.retry": "Réessayer",
  "nav.home": "Accueil",
  "nav.shorts": "Shorts",
  "nav.search": "Recherche",
  "nav.profile": "Profil",
  "nav.myProfile": "Mon profil",
  "nav.create": "Créer",
  "nav.createPost": "Créer une publication",
  "nav.createHint":
    "Ouvre l’éditeur pour partager une publication, une photo ou une vidéo.",
  "nav.messages": "Messagerie",
  "home.forYou": "Pour vous",
  "home.network": "Mon réseau",
  "home.opportunities": "Opportunités",
  "home.matching": "Matching",
  "home.clubs": "Clubs",
  "home.matches": "Matches",
  "home.news": "Actus",
  "home.navigation": "Navigation de l’accueil",
  "home.account": "Ouvrir mon espace",
  "stories.own": "Votre story",
  "stories.create": "Créer votre story",
  "stories.all": "Voir toutes les stories",
  "stories.viewAll": "Tout voir",
  "stories.view": "Voir la story de {name}",
  "stories.profile": "Voir le profil de {name}",
  "stories.profileHint": "Le nom sous la photo ouvre le profil.",
  "stories.unavailable": "Profils et stories indisponibles pour le moment.",
  "news.headline": "À la une du football",
  "news.read": "Lire cette actualité",
  "news.more": "Lire la suite",
  "news.loading": "Chargement des actualités…",
  "news.unavailable": "Les actualités sont momentanément indisponibles.",
  "translation.show": "Voir la traduction",
  "translation.original": "Voir l’original",
  "translation.hide": "Masquer",
  "translation.loading": "Traduction…",
  "translation.retry": "Réessayer la traduction",
  "translation.unavailable": "Traduction indisponible pour le moment.",
  "translation.quota":
    "Le service de traduction a atteint sa limite. Réessaie plus tard.",

  "common.search": "Rechercher",
  "common.filter": "Filtrer",
  "common.all": "Tous",
  "common.unread": "Non lues",
  "common.invitations": "Invitations",
  "common.later": "Plus tard",
  "common.share": "Partager",
  "common.copy": "Copier",
  "common.other": "Autre",
  "common.publish": "Publier",
  "common.refine": "Affiner",
  "common.today": "AUJOURD’HUI",
  "common.last30days": "30 DERNIERS JOURS",
  "common.older": "PLUS ANCIEN",
  "language.title": "Langue / Language",
  "language.close": "Fermer le choix de langue",
  "language.change": "Changer la langue",
  "language.detectIp": "Détecter avec mon IP",
  "onboarding.badge": "Bienvenue sur FootNation",
  "onboarding.defaultTitle": "Voici comment utiliser l’application",
  "onboarding.namedTitle": "Prêt à jouer, {name} ?",
  "onboarding.description":
    "FootNation fonctionne comme un réseau social du football : publiez, trouvez des opportunités, matchez avec les bons profils et développez votre réseau.",
  "onboarding.profileTitle": "Complète ton profil",
  "onboarding.teamTitle": "Retrouver mon équipe",
  "onboarding.teamText":
    "Accepte le code de ton coach, retrouve ton calendrier et réponds à tes convocations.",
  "onboarding.profileText":
    "Poste, club, niveau, expériences et QR code pour être crédible.",
  "onboarding.publishTitle": "Publie du contenu",
  "onboarding.publishText":
    "Photos, vidéos, shorts ou demandes : les profils actifs ressortent plus.",
  "onboarding.opportunitiesTitle": "Cherche offres et demandes",
  "onboarding.opportunitiesText":
    "Retrouve les essais, recrutements, missions et opportunités.",
  "onboarding.matchingTitle": "Utilise le matching",
  "onboarding.matchingText":
    "Swipe pour découvrir joueurs, clubs et contacts compatibles.",
  "onboarding.inviteTitle": "partage le foot avec mes amis",
  "onboarding.inviteText":
    "Partage ton profil et demande à tes amis de créer leur compte.",
  "onboarding.completeProfile": "Compléter mon profil",
  "onboarding.invite": "Inviter",
  "invite.eyebrow": "PARRAINAGE ACTIVÉ",
  "invite.close": "Fermer l’invitation",
  "invite.title": "partage le foot avec mes amis",
  "invite.description1":
    "Plus on est de passionnés, plus le réseau est utile. Gagne du crédit et débloque des badges à chaque ami inscrit.",
  "invite.description2": "",
  "invite.profileBenefit": "Crédit par ami inscrit",
  "invite.signupBenefit": "Badges Ambassadeur",
  "invite.linkSection": "TON LIEN D’INVITATION PERSONNALISÉ",
  "invite.copyLabel": "Copier",
  "invite.shareLabel": "Partager",
  "invite.shareSection": "PARTAGER EN 1 CLIC",
  "invite.shareHint":
    "Envoie ton lien à tes amis et demande-leur de créer leur compte pour rejoindre ton réseau FootNation.",
  "invite.continue": "Continuer sans inviter",
  "invite.copyAccessibility": "Copier mon lien d’invitation",
  "invite.shareAccessibility": "Partager mon lien d’invitation",
  "invite.shareWithChannel": "Partager mon invitation avec {channel}",
  "invite.otherOptions": "Autres options de partage",
  "messages.accountPicker": "Choisir un compte",
  "messages.options": "Options de messagerie",
  "messages.new": "Nouveau message",
  "messages.placeholder": "Rechercher",
  "messages.searchAccessibility": "Rechercher une conversation",
  "messages.filterAccessibility": "Filtrer les conversations",
  "messages.yourNote": "Votre note",
  "messages.notePlaceholder": "Inspiration nécessaire...",
  "messages.hidden": "Message masqué",
  "messages.pendingOutbox": "Envois en attente",
  "messages.clubs": "Clubs",
  "messages.emptyTitle": "Aucune conversation",
  "messages.emptyDescription":
    "Envoyez un message à un membre pour démarrer votre réseau.",
  "notifications.subtitle": "Activité récente FootNation",
  "notifications.readAll": "Tout lire",
  "notifications.all": "Toutes",
  "notifications.unread": "Non lues",
  "notifications.invitations": "Invitations",
  "notifications.helper":
    "Ouvrez un profil pour accepter ou refuser sa demande.",
  "notifications.previousInvitations": "Invitations précédentes",
  "notifications.previousNotifications": "Notifications précédentes",
  "notifications.emptyInvitations": "Aucune invitation en attente",
  "notifications.emptyUnread": "Aucune notification non lue",
  "notifications.emptyAll": "Vous êtes à jour",
  "notifications.emptyInvitationDescription":
    "Vos nouvelles demandes de connexion apparaîtront ici.",
  "notifications.emptyDescription":
    "Vos nouvelles notifications apparaîtront ici.",
  "notifications.pendingInvitation": "Invitation en attente",
  "notifications.read": "Notification lue",
  "notifications.unreadLabel": "Notification non lue",
  "opportunities.eyebrow": "FOOTNATION MERCATO",
  "opportunities.title": "Offres et demandes football",
  "opportunities.subtitle":
    "Trouvez un club, proposez un essai, recrutez un joueur ou publiez une mission autour du foot.",
  "opportunities.publishAd": "Publier une annonce",
  "opportunities.viewFiltered": "Voir les annonces filtrées",
  "opportunities.searchPlaceholder": "Rechercher une offre ou une demande",
  "opportunities.searchAccessibility": "Rechercher une opportunité",
  "opportunities.openFilters": "Ouvrir les filtres",
  "opportunities.closeFilters": "Fermer les filtres",
  "opportunities.allDepartments": "Tous les départements",
  "opportunities.allTypes": "Toutes",
  "opportunities.allTab": "Tout",
  "opportunities.offersTab": "Offres",
  "messages.sent": "Envoyé",
  "messages.noResults": "Aucune conversation trouvée",
  "messages.noResultsDescription": "Essayez un autre nom ou pseudo.",
  "messages.startTitle": "Vos échanges commencent ici",
  "messages.startDescription":
    "Ouvrez le profil d’une relation pour lui écrire.",
  "messages.loadOlder": "Charger les échanges plus anciens",
  "messages.unreadCount": "messages non lus",
  "opportunities.profileDepartment": "Profil recherché et département",
  "opportunities.profileWanted": "Profil recherché",
  "opportunities.department": "Département",
  "opportunities.clearFilters": "Effacer les filtres",
  "opportunities.featured": "À saisir maintenant",
  "opportunities.offer": "Offre",
  "opportunities.request": "Demande",
  "opportunities.publishedAt": "Publié le",
  "opportunities.view": "Voir",
  "opportunities.emptyTitle": "Aucune opportunité trouvée",
  "opportunities.emptyDescription":
    "Essayez une autre recherche ou publiez votre propre demande.",
  "opportunities.requestsTab": "Demandes",
};

const TRANSLATIONS: Partial<
  Record<AppLanguageCode, Partial<TranslationDictionary>>
> = {
  fr: FR_TRANSLATIONS,
  en: {
    "language.title": "Language",
    "news.like": "Like this news",
    "news.comment": "Comment on this news",
    "news.share": "Share this news",
    "notifications.title": "Notifications",
    "notifications.countUnavailable": "Notifications, count unavailable",
    "notifications.countUnread": "Notifications, {count} unread",

    "common.close": "Close",
    "common.retry": "Try again",
    "nav.home": "Home",
    "nav.shorts": "Shorts",
    "nav.search": "Search",
    "nav.profile": "Profile",
    "nav.myProfile": "My profile",
    "nav.create": "Create",
    "nav.createPost": "Create a post",
    "nav.createHint": "Open the editor to share a post, photo or video.",
    "nav.messages": "Messages",
    "home.forYou": "For you",
    "home.network": "My network",
    "home.opportunities": "Opportunities",
    "home.matching": "Matching",
    "home.clubs": "Clubs",
    "home.matches": "Matches",
    "home.news": "News",
    "home.navigation": "Home navigation",
    "home.account": "Open my account",
    "stories.own": "Your story",
    "stories.create": "Create your story",
    "stories.all": "View all stories",
    "stories.viewAll": "View all",
    "stories.view": "View {name}’s story",
    "stories.profile": "View {name}’s profile",
    "stories.profileHint": "The name below the photo opens the profile.",
    "stories.unavailable": "Profiles and stories are currently unavailable.",
    "news.headline": "Football headlines",
    "news.read": "Read this news",
    "news.more": "Read more",
    "news.loading": "Loading news…",
    "news.unavailable": "News is temporarily unavailable.",
    "translation.show": "See translation",
    "translation.original": "See original",
    "translation.hide": "Hide",
    "translation.loading": "Translating…",
    "translation.retry": "Retry translation",
    "translation.unavailable": "Translation is currently unavailable.",
    "translation.quota":
      "The translation limit has been reached. Try again later.",

    "common.search": "Search",
    "common.filter": "Filter",
    "common.all": "All",
    "common.unread": "Unread",
    "common.invitations": "Invitations",
    "common.later": "Later",
    "common.share": "Share",
    "common.copy": "Copy",
    "common.other": "Other",
    "common.publish": "Publish",
    "common.refine": "Refine",
    "common.today": "TODAY",
    "common.last30days": "LAST 30 DAYS",
    "common.older": "OLDER",
    "language.close": "Close language selector",
    "language.change": "Change language",
    "language.detectIp": "Detect with my IP",
    "onboarding.badge": "Welcome to FootNation",
    "onboarding.defaultTitle": "How to use the app",
    "onboarding.namedTitle": "Ready to play, {name}?",
    "onboarding.description":
      "FootNation works like a football social network: publish, find opportunities, match with the right profiles and grow your network.",
    "onboarding.profileTitle": "Complete your profile",
    "onboarding.teamTitle": "Find my team",
    "onboarding.teamText":
      "Accept your coach’s code, find your calendar and respond to call-ups.",
    "onboarding.profileText":
      "Position, club, level, experiences and QR code to build credibility.",
    "onboarding.publishTitle": "Publish content",
    "onboarding.publishText":
      "Photos, videos, shorts or requests: active profiles stand out more.",
    "onboarding.opportunitiesTitle": "Find offers and requests",
    "onboarding.opportunitiesText":
      "Find trials, recruitment, missions and opportunities.",
    "onboarding.matchingTitle": "Use matching",
    "onboarding.matchingText":
      "Swipe to discover compatible players, clubs and contacts.",
    "onboarding.inviteTitle": "Invite your network",
    "onboarding.inviteText":
      "Share your profile and ask friends to create their account.",
    "onboarding.completeProfile": "Complete my profile",
    "onboarding.invite": "Invite",
    "invite.eyebrow": "REFERRAL ACTIVE",
    "invite.close": "Close invitation",
    "invite.title": "Bring your network\nto FootNation",
    "invite.description1":
      "Share your profile and get friends, teammates, coaches and clubs to sign up.",
    "invite.description2":
      "Each new member makes FootNation stronger and increases your visibility.",
    "invite.profileBenefit": "Your profile circulates",
    "invite.signupBenefit": "Friends sign up",
    "invite.linkSection": "YOUR PERSONAL LINK",
    "invite.copyLabel": "Copy",
    "invite.shareLabel": "Share",
    "invite.shareSection": "GET YOUR NETWORK TO SIGN UP",
    "invite.shareHint":
      "Send your link to friends and ask them to create an account to join your FootNation network.",
    "invite.continue": "I’ll share later",
    "invite.copyAccessibility": "Copy my invitation link",
    "invite.shareAccessibility": "Share my invitation link",
    "invite.shareWithChannel": "Share my invitation with {channel}",
    "invite.otherOptions": "Other sharing options",
    "messages.accountPicker": "Choose an account",
    "messages.options": "Messaging options",
    "messages.new": "New message",
    "messages.placeholder": "Search",
    "messages.searchAccessibility": "Search a conversation",
    "messages.filterAccessibility": "Filter conversations",
    "messages.yourNote": "Your note",
    "messages.notePlaceholder": "Need inspiration...",
    "messages.hidden": "Hidden message",
    "messages.pendingOutbox": "Pending sends",
    "messages.clubs": "Clubs",
    "messages.emptyTitle": "No conversations",
    "messages.emptyDescription":
      "Message a member to start building your network.",
    "notifications.subtitle": "Recent FootNation activity",
    "notifications.readAll": "Mark all read",
    "notifications.all": "All",
    "notifications.unread": "Unread",
    "notifications.invitations": "Invitations",
    "notifications.helper": "Open a profile to accept or reject the request.",
    "notifications.previousInvitations": "Previous invitations",
    "notifications.previousNotifications": "Previous notifications",
    "notifications.emptyInvitations": "No pending invitations",
    "notifications.emptyUnread": "No unread notifications",
    "notifications.emptyAll": "You’re up to date",
    "notifications.emptyInvitationDescription":
      "New connection requests will appear here.",
    "notifications.emptyDescription": "New notifications will appear here.",
    "notifications.pendingInvitation": "Pending invitation",
    "notifications.read": "Read notification",
    "notifications.unreadLabel": "Unread notification",
    "opportunities.eyebrow": "FOOTNATION MERCATO",
    "opportunities.title": "Football offers and requests",
    "opportunities.subtitle":
      "Find a club, offer a trial, recruit a player or publish a football mission.",
    "opportunities.publishAd": "Publish an ad",
    "opportunities.viewFiltered": "View filtered ads",
    "opportunities.searchPlaceholder": "Search an offer or request",
    "opportunities.searchAccessibility": "Search an opportunity",
    "opportunities.openFilters": "Open filters",
    "opportunities.closeFilters": "Close filters",
    "opportunities.allDepartments": "All departments",
    "opportunities.allTypes": "All",
    "opportunities.allTab": "All",
    "opportunities.offersTab": "Offers",
    "messages.sent": "Sent",
    "messages.noResults": "No conversation found",
    "messages.noResultsDescription": "Try another name or username.",
    "messages.startTitle": "Your conversations start here",
    "messages.startDescription": "Open a connection profile to message them.",
    "messages.loadOlder": "Load older conversations",
    "messages.unreadCount": "unread messages",
    "opportunities.profileDepartment": "Target profile and department",
    "opportunities.profileWanted": "Target profile",
    "opportunities.department": "Department",
    "opportunities.clearFilters": "Clear filters",
    "opportunities.featured": "Available now",
    "opportunities.offer": "Offer",
    "opportunities.request": "Request",
    "opportunities.publishedAt": "Published on",
    "opportunities.view": "View",
    "opportunities.emptyTitle": "No opportunities found",
    "opportunities.emptyDescription":
      "Try another search or publish your own request.",
    "opportunities.requestsTab": "Requests",
  },
  es: {
    "language.title": "Idioma",
    "news.like": "Me gusta esta noticia",
    "news.comment": "Comentar esta noticia",
    "news.share": "Compartir esta noticia",
    "notifications.title": "Notificaciones",
    "notifications.countUnavailable": "Notificaciones, contador no disponible",
    "notifications.countUnread": "Notificaciones, {count} sin leer",

    "common.close": "Cerrar",
    "common.retry": "Reintentar",
    "nav.home": "Inicio",
    "nav.shorts": "Shorts",
    "nav.search": "Buscar",
    "nav.profile": "Perfil",
    "nav.myProfile": "Mi perfil",
    "nav.create": "Crear",
    "nav.createPost": "Crear una publicación",
    "nav.createHint":
      "Abre el editor para compartir una publicación, foto o vídeo.",
    "nav.messages": "Mensajes",
    "home.forYou": "Para ti",
    "home.network": "Mi red",
    "home.opportunities": "Oportunidades",
    "home.matching": "Matching",
    "home.clubs": "Clubes",
    "home.matches": "Partidos en directo",
    "home.news": "Noticias",
    "home.navigation": "Navegación de inicio",
    "home.account": "Abrir mi espacio",
    "stories.own": "Tu historia",
    "stories.create": "Crear tu historia",
    "stories.all": "Ver todas las historias",
    "stories.viewAll": "Ver todo",
    "stories.view": "Ver la historia de {name}",
    "stories.profile": "Ver el perfil de {name}",
    "stories.profileHint": "El nombre debajo de la foto abre el perfil.",
    "stories.unavailable":
      "Los perfiles y las historias no están disponibles por el momento.",
    "news.headline": "Actualidad del fútbol",
    "news.read": "Leer esta noticia",
    "news.more": "Leer más",
    "news.loading": "Cargando noticias…",
    "news.unavailable": "Las noticias no están disponibles temporalmente.",
    "translation.show": "Ver traducción",
    "translation.original": "Ver original",
    "translation.hide": "Ocultar",
    "translation.loading": "Traduciendo…",
    "translation.retry": "Reintentar traducción",
    "translation.unavailable":
      "La traducción no está disponible por el momento.",
    "translation.quota":
      "Se ha alcanzado el límite de traducción. Inténtalo más tarde.",

    "common.search": "Buscar",
    "common.filter": "Filtrar",
    "common.all": "Todos",
    "common.unread": "No leídas",
    "common.invitations": "Invitaciones",
    "common.later": "Más tarde",
    "common.share": "Compartir",
    "common.copy": "Copiar",
    "common.other": "Otro",
    "common.publish": "Publicar",
    "common.refine": "Afinar",
    "common.today": "HOY",
    "common.last30days": "ÚLTIMOS 30 DÍAS",
    "common.older": "ANTERIORES",
    "language.close": "Cerrar selector de idioma",
    "language.change": "Cambiar idioma",
    "language.detectIp": "Detectar con mi IP",
    "onboarding.badge": "Bienvenido a FootNation",
    "onboarding.defaultTitle": "Cómo usar la aplicación",
    "onboarding.namedTitle": "¿Listo para jugar, {name}?",
    "onboarding.description":
      "FootNation funciona como una red social de fútbol: publica, encuentra oportunidades, conecta con los perfiles adecuados y desarrolla tu red.",
    "onboarding.profileTitle": "Completa tu perfil",
    "onboarding.profileText":
      "Posición, club, nivel, experiencias y código QR para ganar credibilidad.",
    "onboarding.publishTitle": "Publica contenido",
    "onboarding.publishText":
      "Fotos, vídeos, shorts o solicitudes: los perfiles activos destacan más.",
    "onboarding.opportunitiesTitle": "Busca ofertas y solicitudes",
    "onboarding.opportunitiesText":
      "Encuentra pruebas, fichajes, misiones y oportunidades.",
    "onboarding.matchingTitle": "Usa el matching",
    "onboarding.matchingText":
      "Desliza para descubrir jugadores, clubes y contactos compatibles.",
    "onboarding.inviteTitle": "Invita a tu red",
    "onboarding.inviteText":
      "Comparte tu perfil y pide a tus amigos que creen su cuenta.",
    "onboarding.completeProfile": "Completar mi perfil",
    "onboarding.invite": "Invitar",
    "invite.eyebrow": "REFERIDO ACTIVO",
    "invite.close": "Cerrar invitación",
    "invite.title": "Trae tu red\na FootNation",
    "invite.description1":
      "Comparte tu perfil y haz que amigos, compañeros, entrenadores y clubes se registren.",
    "invite.description2":
      "Cada nuevo miembro fortalece FootNation y aumenta tu visibilidad.",
    "invite.profileBenefit": "Tu perfil circula",
    "invite.signupBenefit": "Tus amigos se registran",
    "invite.linkSection": "TU ENLACE PERSONAL",
    "invite.copyLabel": "Copiar",
    "invite.shareLabel": "Compartir",
    "invite.shareSection": "HAZ QUE TU RED SE REGISTRE",
    "invite.shareHint":
      "Envía tu enlace a tus amigos y pídeles crear una cuenta para unirse a tu red FootNation.",
    "invite.continue": "Compartiré más tarde",
    "invite.copyAccessibility": "Copiar mi enlace de invitación",
    "invite.shareAccessibility": "Compartir mi enlace de invitación",
    "invite.shareWithChannel": "Compartir mi invitación con {channel}",
    "invite.otherOptions": "Otras opciones para compartir",
    "messages.accountPicker": "Elegir una cuenta",
    "messages.options": "Opciones de mensajes",
    "messages.new": "Nuevo mensaje",
    "messages.placeholder": "Buscar",
    "messages.searchAccessibility": "Buscar una conversación",
    "messages.filterAccessibility": "Filtrar conversaciones",
    "messages.yourNote": "Tu nota",
    "messages.notePlaceholder": "Necesito inspiración...",
    "messages.hidden": "Mensaje oculto",
    "messages.pendingOutbox": "Envíos pendientes",
    "messages.clubs": "Clubes",
    "messages.sent": "Enviado",
    "messages.noResults": "No se encontró ninguna conversación",
    "messages.noResultsDescription": "Prueba con otro nombre o usuario.",
    "messages.startTitle": "Tus conversaciones empiezan aquí",
    "messages.startDescription":
      "Abre el perfil de un contacto para escribirle.",
    "messages.loadOlder": "Cargar conversaciones anteriores",
    "messages.unreadCount": "mensajes no leídos",
    "notifications.subtitle": "Actividad reciente de FootNation",
    "notifications.readAll": "Marcar todo leído",
    "notifications.all": "Todas",
    "notifications.unread": "No leídas",
    "notifications.invitations": "Invitaciones",
    "notifications.helper":
      "Abre un perfil para aceptar o rechazar la solicitud.",
    "notifications.previousInvitations": "Invitaciones anteriores",
    "notifications.previousNotifications": "Notificaciones anteriores",
    "notifications.emptyInvitations": "No hay invitaciones pendientes",
    "notifications.emptyUnread": "No hay notificaciones no leídas",
    "notifications.emptyAll": "Estás al día",
    "notifications.emptyInvitationDescription":
      "Tus nuevas solicitudes de conexión aparecerán aquí.",
    "notifications.emptyDescription":
      "Tus nuevas notificaciones aparecerán aquí.",
    "notifications.pendingInvitation": "Invitación pendiente",
    "notifications.read": "Notificación leída",
    "notifications.unreadLabel": "Notificación no leída",
    "opportunities.eyebrow": "FOOTNATION MERCATO",
    "opportunities.title": "Ofertas y solicitudes de fútbol",
    "opportunities.subtitle":
      "Encuentra un club, propone una prueba, recluta un jugador o publica una misión de fútbol.",
    "opportunities.publishAd": "Publicar un anuncio",
    "opportunities.viewFiltered": "Ver anuncios filtrados",
    "opportunities.searchPlaceholder": "Buscar una oferta o solicitud",
    "opportunities.searchAccessibility": "Buscar una oportunidad",
    "opportunities.openFilters": "Abrir filtros",
    "opportunities.closeFilters": "Cerrar filtros",
    "opportunities.allDepartments": "Todos los departamentos",
    "opportunities.allTypes": "Todas",
    "opportunities.allTab": "Todo",
    "opportunities.offersTab": "Ofertas",
    "opportunities.requestsTab": "Solicitudes",
    "opportunities.profileDepartment": "Perfil buscado y departamento",
    "opportunities.profileWanted": "Perfil buscado",
    "opportunities.department": "Departamento",
    "opportunities.clearFilters": "Borrar filtros",
    "opportunities.featured": "Disponibles ahora",
    "opportunities.offer": "Oferta",
    "opportunities.request": "Solicitud",
    "opportunities.publishedAt": "Publicado el",
    "opportunities.view": "Ver",
    "opportunities.emptyTitle": "No se encontraron oportunidades",
    "opportunities.emptyDescription":
      "Prueba otra búsqueda o publica tu propia solicitud.",
  },
  pt: {
    "common.search": "Pesquisar",
    "common.filter": "Filtrar",
    "common.all": "Todos",
    "common.unread": "Não lidas",
    "common.invitations": "Convites",
    "common.later": "Mais tarde",
    "common.share": "Partilhar",
    "common.copy": "Copiar",
    "common.other": "Outro",
    "common.publish": "Publicar",
    "common.refine": "Refinar",
    "common.today": "HOJE",
    "common.last30days": "ÚLTIMOS 30 DIAS",
    "common.older": "ANTERIORES",
    "language.close": "Fechar seleção de idioma",
    "language.change": "Alterar idioma",
    "language.detectIp": "Detetar com o meu IP",
    "onboarding.badge": "Bem-vindo ao FootNation",
    "onboarding.defaultTitle": "Como usar a aplicação",
    "onboarding.namedTitle": "Pronto para jogar, {name}?",
    "onboarding.description":
      "FootNation funciona como uma rede social de futebol: publica, encontra oportunidades, faz matching com os perfis certos e desenvolve a tua rede.",
    "onboarding.profileTitle": "Completa o teu perfil",
    "onboarding.profileText":
      "Posição, clube, nível, experiências e QR code para ganhar credibilidade.",
    "onboarding.publishTitle": "Publica conteúdo",
    "onboarding.publishText":
      "Fotos, vídeos, shorts ou pedidos: os perfis ativos destacam-se mais.",
    "onboarding.opportunitiesTitle": "Procura ofertas e pedidos",
    "onboarding.opportunitiesText":
      "Encontra testes, recrutamentos, missões e oportunidades.",
    "onboarding.matchingTitle": "Usa o matching",
    "onboarding.matchingText":
      "Desliza para descobrir jogadores, clubes e contactos compatíveis.",
    "onboarding.inviteTitle": "Convida a tua rede",
    "onboarding.inviteText":
      "Partilha o teu perfil e pede aos teus amigos para criarem conta.",
    "onboarding.completeProfile": "Completar o meu perfil",
    "onboarding.invite": "Convidar",
    "invite.eyebrow": "CONVITE ATIVO",
    "invite.close": "Fechar convite",
    "invite.title": "Traz a tua rede\npara FootNation",
    "invite.description1":
      "Partilha o teu perfil e faz amigos, colegas, treinadores e clubes registarem-se.",
    "invite.description2":
      "Cada novo membro fortalece FootNation e aumenta a tua visibilidade.",
    "invite.profileBenefit": "O teu perfil circula",
    "invite.signupBenefit": "Os teus amigos entram",
    "invite.linkSection": "O TEU LINK PESSOAL",
    "invite.copyLabel": "Copiar",
    "invite.shareLabel": "Partilhar",
    "invite.shareSection": "FAZ A TUA REDE ENTRAR",
    "invite.shareHint":
      "Envia o teu link aos amigos e pede-lhes para criarem conta e entrarem na tua rede FootNation.",
    "invite.continue": "Partilho mais tarde",
    "invite.copyAccessibility": "Copiar o meu link de convite",
    "invite.shareAccessibility": "Partilhar o meu link de convite",
    "invite.shareWithChannel": "Partilhar o meu convite com {channel}",
    "invite.otherOptions": "Outras opções de partilha",
    "messages.placeholder": "Pesquisar",
    "messages.searchAccessibility": "Pesquisar uma conversa",
    "messages.filterAccessibility": "Filtrar conversas",
    "messages.yourNote": "A tua nota",
    "messages.notePlaceholder": "Preciso de inspiração...",
    "messages.hidden": "Mensagem oculta",
    "messages.pendingOutbox": "Envios pendentes",
    "messages.clubs": "Clubes",
    "messages.sent": "Enviado",
    "messages.noResults": "Nenhuma conversa encontrada",
    "messages.startTitle": "As tuas conversas começam aqui",
    "messages.loadOlder": "Carregar conversas anteriores",
    "messages.unreadCount": "mensagens não lidas",
    "notifications.subtitle": "Atividade recente FootNation",
    "notifications.readAll": "Marcar tudo como lido",
    "notifications.all": "Todas",
    "notifications.unread": "Não lidas",
    "notifications.invitations": "Convites",
    "notifications.emptyAll": "Estás atualizado",
    "opportunities.title": "Ofertas e pedidos de futebol",
    "opportunities.subtitle":
      "Encontra um clube, propõe um teste, recruta um jogador ou publica uma missão de futebol.",
    "opportunities.searchPlaceholder": "Pesquisar uma oferta ou pedido",
    "opportunities.allDepartments": "Todos os departamentos",
    "opportunities.allTypes": "Todas",
    "opportunities.allTab": "Tudo",
    "opportunities.offersTab": "Ofertas",
    "opportunities.requestsTab": "Pedidos",
    "opportunities.offer": "Oferta",
    "opportunities.request": "Pedido",
    "opportunities.publishedAt": "Publicado em",
    "opportunities.view": "Ver",
  },
  ar: {
    "common.search": "بحث",
    "common.filter": "تصفية",
    "common.all": "الكل",
    "common.unread": "غير مقروءة",
    "common.invitations": "الدعوات",
    "common.later": "لاحقًا",
    "common.share": "مشاركة",
    "common.copy": "نسخ",
    "common.publish": "نشر",
    "common.refine": "تحسين",
    "common.today": "اليوم",
    "common.last30days": "آخر 30 يومًا",
    "common.older": "الأقدم",
    "language.close": "إغلاق اختيار اللغة",
    "language.change": "تغيير اللغة",
    "language.detectIp": "اكتشاف عبر عنوان IP",
    "onboarding.badge": "مرحبًا بك في FootNation",
    "onboarding.defaultTitle": "طريقة استخدام التطبيق",
    "onboarding.namedTitle": "جاهز للعب يا {name}؟",
    "onboarding.description":
      "FootNation شبكة اجتماعية لكرة القدم: انشر، ابحث عن فرص، تواصل مع الملفات المناسبة ووسّع شبكتك.",
    "onboarding.completeProfile": "إكمال ملفي",
    "onboarding.invite": "دعوة",
    "invite.title": "اجلب شبكتك\nإلى FootNation",
    "invite.copyLabel": "نسخ",
    "invite.shareLabel": "مشاركة",
    "invite.continue": "سأشارك لاحقًا",
    "invite.shareWithChannel": "مشاركة دعوتي عبر {channel}",
    "messages.placeholder": "بحث",
    "messages.hidden": "رسالة مخفية",
    "messages.sent": "تم الإرسال",
    "notifications.subtitle": "نشاط FootNation الأخير",
    "notifications.readAll": "قراءة الكل",
    "opportunities.title": "عروض وطلبات كرة القدم",
    "opportunities.allTab": "الكل",
    "opportunities.offersTab": "العروض",
    "opportunities.requestsTab": "الطلبات",
    "opportunities.offer": "عرض",
    "opportunities.request": "طلب",
    "opportunities.view": "عرض",
  },
  de: {
    "common.search": "Suchen",
    "common.filter": "Filtern",
    "common.all": "Alle",
    "common.unread": "Ungelesen",
    "common.invitations": "Einladungen",
    "common.later": "Später",
    "common.share": "Teilen",
    "common.copy": "Kopieren",
    "common.publish": "Veröffentlichen",
    "common.refine": "Verfeinern",
    "common.today": "HEUTE",
    "common.last30days": "LETZTE 30 TAGE",
    "common.older": "ÄLTER",
    "language.close": "Sprachauswahl schließen",
    "language.change": "Sprache ändern",
    "language.detectIp": "Mit meiner IP erkennen",
    "onboarding.badge": "Willkommen bei FootNation",
    "onboarding.defaultTitle": "So nutzt du die App",
    "onboarding.namedTitle": "Bereit zu spielen, {name}?",
    "onboarding.description":
      "FootNation funktioniert wie ein Fußball-Netzwerk: veröffentlichen, Chancen finden, passende Profile matchen und dein Netzwerk ausbauen.",
    "onboarding.completeProfile": "Mein Profil vervollständigen",
    "onboarding.invite": "Einladen",
    "invite.title": "Bring dein Netzwerk\nzu FootNation",
    "invite.copyLabel": "Kopieren",
    "invite.shareLabel": "Teilen",
    "invite.continue": "Ich teile später",
    "invite.shareWithChannel": "Meine Einladung mit {channel} teilen",
    "messages.placeholder": "Suchen",
    "messages.hidden": "Ausgeblendete Nachricht",
    "messages.sent": "Gesendet",
    "notifications.subtitle": "Aktuelle FootNation-Aktivität",
    "notifications.readAll": "Alles lesen",
    "opportunities.title": "Fußball-Angebote und Gesuche",
    "opportunities.allTab": "Alle",
    "opportunities.offersTab": "Angebote",
    "opportunities.requestsTab": "Gesuche",
    "opportunities.offer": "Angebot",
    "opportunities.request": "Gesuch",
    "opportunities.view": "Ansehen",
  },
  it: {
    "common.search": "Cerca",
    "common.filter": "Filtra",
    "common.all": "Tutti",
    "common.unread": "Non lette",
    "common.invitations": "Inviti",
    "common.later": "Più tardi",
    "common.share": "Condividi",
    "common.copy": "Copia",
    "common.publish": "Pubblica",
    "common.refine": "Affina",
    "common.today": "OGGI",
    "common.last30days": "ULTIMI 30 GIORNI",
    "common.older": "PIÙ VECCHIE",
    "language.close": "Chiudi selettore lingua",
    "language.change": "Cambia lingua",
    "language.detectIp": "Rileva con il mio IP",
    "onboarding.badge": "Benvenuto su FootNation",
    "onboarding.defaultTitle": "Come usare l’app",
    "onboarding.namedTitle": "Pronto a giocare, {name}?",
    "onboarding.description":
      "FootNation funziona come un social network del calcio: pubblica, trova opportunità, fai matching con i profili giusti e sviluppa la tua rete.",
    "onboarding.completeProfile": "Completa il mio profilo",
    "onboarding.invite": "Invita",
    "invite.title": "Porta la tua rete\nsu FootNation",
    "invite.copyLabel": "Copia",
    "invite.shareLabel": "Condividi",
    "invite.continue": "Condividerò più tardi",
    "invite.shareWithChannel": "Condividi il mio invito con {channel}",
    "messages.placeholder": "Cerca",
    "messages.hidden": "Messaggio nascosto",
    "messages.sent": "Inviato",
    "notifications.subtitle": "Attività recente FootNation",
    "notifications.readAll": "Leggi tutto",
    "opportunities.title": "Offerte e richieste calcio",
    "opportunities.allTab": "Tutto",
    "opportunities.offersTab": "Offerte",
    "opportunities.requestsTab": "Richieste",
    "opportunities.offer": "Offerta",
    "opportunities.request": "Richiesta",
    "opportunities.view": "Vedi",
  },
};

export function useTranslation() {
  const { language } = useLanguage();
  return React.useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const template =
        TRANSLATIONS[language]?.[key] || FR_TRANSLATIONS[key] || key;
      if (!params) return template;
      return Object.entries(params).reduce(
        (text, [param, value]) => text.replaceAll(`{${param}}`, String(value)),
        template,
      );
    },
    [language],
  );
}

function isAppLanguage(value: string | null): value is AppLanguageCode {
  return !!value && LANGUAGE_OPTIONS.some((option) => option.code === value);
}

async function detectLanguageFromIp(): Promise<AppLanguageCode | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IP_LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch("https://ipapi.co/json/", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      country_code?: string;
      country?: string;
      languages?: string;
    };
    return languageFromCountry(payload.country_code || payload.country);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function detectLanguageFromDevice(): {
  language: AppLanguageCode;
  source: LanguageSource;
} {
  const nav = globalThis as typeof globalThis & {
    navigator?: { language?: string; languages?: readonly string[] };
  };
  const candidates = [
    nav.navigator?.language,
    ...(nav.navigator?.languages || []),
  ];
  for (const candidate of candidates) {
    const locale = candidate?.slice(0, 2).toLowerCase();
    if (isAppLanguage(locale)) return { language: locale, source: "device" };
  }
  return { language: DEFAULT_LOCALE, source: "default" };
}

function languageFromCountry(countryInput?: string): AppLanguageCode | null {
  const country = countryInput?.trim().toUpperCase();
  if (!country) return null;
  if (
    ["FR", "BE", "CH", "LU", "MC", "CI", "SN", "CM", "MA", "TN", "DZ"].includes(
      country,
    )
  )
    return "fr";
  if (["GB", "US", "IE", "CA", "AU", "NZ", "ZA", "NG", "GH"].includes(country))
    return "en";
  if (
    [
      "ES",
      "MX",
      "AR",
      "CO",
      "CL",
      "PE",
      "UY",
      "PY",
      "BO",
      "EC",
      "VE",
      "CR",
      "DO",
      "GT",
      "HN",
      "NI",
      "PA",
      "SV",
    ].includes(country)
  )
    return "es";
  if (["PT", "BR", "AO", "MZ", "CV"].includes(country)) return "pt";
  if (["DE", "AT", "LI"].includes(country)) return "de";
  if (["IT", "SM", "VA"].includes(country)) return "it";
  if (
    ["SA", "AE", "QA", "KW", "BH", "OM", "EG", "JO", "LB", "IQ"].includes(
      country,
    )
  )
    return "ar";
  return DEFAULT_LOCALE;
}
