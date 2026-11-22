import type { LanguageOption } from "../lib/i18n";

export type LandingCopy = {
  title: string;
  titleAccent: string;
  description: string;
  signup: string;
  login: string;
  explore: string;
  videoTitle: string;
  watchVideo: string;
  joinTitle: string;
  joinDescription: string;
};

export const publicLandingCopies: Partial<
  Record<LanguageOption["code"], LandingCopy>
> & { fr: LandingCopy } = {
  fr: {
    title: "Le réseau social",
    titleAccent: "100 % football.",
    description:
      "Joueurs, clubs, coachs et passionnés : retrouvez-vous sur FootNation pour partager vos moments, développer votre réseau et trouver de nouvelles opportunités.",
    signup: "Créer mon profil gratuitement",
    login: "Se connecter",
    explore: "Découvrir FootNation",
    videoTitle: "FootNation en vidéo",
    watchVideo: "Voir sur YouTube",
    joinTitle: "À vous de jouer.",
    joinDescription:
      "Rejoignez la communauté et faites vivre votre passion du foot.",
  },
  en: {
    title: "The social network",
    titleAccent: "100% football.",
    description:
      "Players, clubs, coaches and fans: come together on FootNation to share your moments, grow your network and discover new opportunities.",
    signup: "Create my free profile",
    login: "Log in",
    explore: "Discover FootNation",
    videoTitle: "FootNation on video",
    watchVideo: "Watch on YouTube",
    joinTitle: "Your turn to play.",
    joinDescription:
      "Join the community and bring your passion for football to life.",
  },
  es: {
    title: "La red social",
    titleAccent: "100 % fútbol.",
    description:
      "Jugadores, clubes, entrenadores y aficionados: conecta en FootNation para compartir tus momentos, ampliar tu red y encontrar nuevas oportunidades.",
    signup: "Crear mi perfil gratis",
    login: "Iniciar sesión",
    explore: "Descubrir FootNation",
    videoTitle: "FootNation en vídeo",
    watchVideo: "Ver en YouTube",
    joinTitle: "Te toca jugar.",
    joinDescription: "Únete a la comunidad y vive tu pasión por el fútbol.",
  },
  pt: {
    title: "A rede social",
    titleAccent: "100% futebol.",
    description:
      "Jogadores, clubes, treinadores e adeptos: juntem-se no FootNation para partilhar momentos, alargar a vossa rede e encontrar novas oportunidades.",
    signup: "Criar o meu perfil grátis",
    login: "Entrar",
    explore: "Descobrir o FootNation",
    videoTitle: "FootNation em vídeo",
    watchVideo: "Ver no YouTube",
    joinTitle: "Agora é a tua vez.",
    joinDescription: "Junta-te à comunidade e vive a tua paixão pelo futebol.",
  },
  de: {
    title: "Das soziale Netzwerk",
    titleAccent: "100 % Fußball.",
    description:
      "Spieler, Vereine, Trainer und Fans: Teilt eure Momente auf FootNation, erweitert euer Netzwerk und entdeckt neue Möglichkeiten.",
    signup: "Kostenloses Profil erstellen",
    login: "Einloggen",
    explore: "FootNation entdecken",
    videoTitle: "FootNation im Video",
    watchVideo: "Auf YouTube ansehen",
    joinTitle: "Jetzt bist du dran.",
    joinDescription:
      "Werde Teil der Community und lebe deine Fußballleidenschaft.",
  },
  it: {
    title: "Il social network",
    titleAccent: "100% calcio.",
    description:
      "Giocatori, club, allenatori e appassionati: incontratevi su FootNation per condividere momenti, ampliare la vostra rete e trovare nuove opportunità.",
    signup: "Crea il mio profilo gratis",
    login: "Accedi",
    explore: "Scopri FootNation",
    videoTitle: "FootNation in video",
    watchVideo: "Guarda su YouTube",
    joinTitle: "Ora tocca a te.",
    joinDescription:
      "Unisciti alla community e vivi la tua passione per il calcio.",
  },
  ar: {
    title: "شبكة اجتماعية",
    titleAccent: "لكرة القدم بالكامل.",
    description:
      "لاعبون وأندية ومدربون وعشاق كرة القدم: التقوا على FootNation لمشاركة لحظاتكم وتوسيع شبكة علاقاتكم واكتشاف فرص جديدة.",
    signup: "أنشئ ملفي مجانًا",
    login: "تسجيل الدخول",
    explore: "اكتشف FootNation",
    videoTitle: "FootNation بالفيديو",
    watchVideo: "شاهد على YouTube",
    joinTitle: "حان دورك.",
    joinDescription: "انضم إلى المجتمع وعش شغفك بكرة القدم.",
  },
};
