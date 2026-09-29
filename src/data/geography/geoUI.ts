// Content ported from the site's checked-in geography pages/data; no generated destinations.
import type { SeoLocale } from "./locales";
export const GEO_UI: Record<
  SeoLocale,
  {
    pageTitleSuffix: string;
    metaSuffix: (name: string) => string;
    h1: (name: string) => string;
    ctaHero: string;
    ctaSecondary: string;
    cardClubsTitle: string;
    cardClubsBody: (name: string) => string;
    cardOppsTitle: string;
    cardOppsBody: (name: string) => string;
    cardRecruitTitle: string;
    cardRecruitBody: (name: string) => string;
    siblingsCity: (country: string) => string;
    siblingsCountry: string;
    siblingLink: (name: string) => string;
    finalH: (name: string) => string;
    finalP: string;
    finalCta: string;
    countryLabel: string;
  }
> = {
  fr: {
    pageTitleSuffix: " : clubs, recrutement, opportunités",
    metaSuffix: (n) =>
      ` Découvrez clubs, recrutement, détections et opportunités à ${n} sur FootNation.`,
    h1: (n) => `Football à ${n}`,
    ctaHero: "Créer mon profil joueur",
    ctaSecondary: "Voir les clubs",
    cardClubsTitle: "Clubs locaux",
    cardClubsBody: (n) =>
      `Retrouvez les clubs amateurs et professionnels de ${n} avec leurs identités, leurs équipes et leurs annonces de recrutement.`,
    cardOppsTitle: "Opportunités",
    cardOppsBody: (n) =>
      `Détections, essais, offres de bénévolat ou postes : les opportunités à ${n} sont publiées en temps réel.`,
    cardRecruitTitle: "Recrutement local",
    cardRecruitBody: (n) =>
      `Joueurs, clubs et recruteurs de ${n} échangent directement via FootNation. Profil visible 24/7.`,
    siblingsCity: (c) => `Autres villes football en ${c}`,
    siblingsCountry: "Explorez d'autres pays",
    siblingLink: (n) => `Football à ${n}`,
    finalH: (n) => `Rejoignez la scène football de ${n}`,
    finalP: "Inscription gratuite. Profil visible auprès des clubs locaux.",
    finalCta: "Créer mon profil",
    countryLabel: "Pays",
  },
  en: {
    pageTitleSuffix: ": clubs, recruitment, opportunities",
    metaSuffix: (n) =>
      ` Discover clubs, recruitment, scouting and opportunities in ${n} on FootNation.`,
    h1: (n) => `Football in ${n}`,
    ctaHero: "Create my player profile",
    ctaSecondary: "Browse clubs",
    cardClubsTitle: "Local clubs",
    cardClubsBody: (n) =>
      `Find amateur and professional clubs in ${n} with their identity, teams and active recruitment posts.`,
    cardOppsTitle: "Opportunities",
    cardOppsBody: (n) =>
      `Scouting, trials, volunteer offers or jobs — opportunities in ${n} are published in real time.`,
    cardRecruitTitle: "Local recruitment",
    cardRecruitBody: (n) =>
      `Players, clubs and scouts in ${n} interact directly via FootNation. Profile visible 24/7.`,
    siblingsCity: (c) => `Other football cities in ${c}`,
    siblingsCountry: "Explore other countries",
    siblingLink: (n) => `Football in ${n}`,
    finalH: (n) => `Join the football scene in ${n}`,
    finalP: "Free signup. Profile visible to local clubs.",
    finalCta: "Create my profile",
    countryLabel: "Country",
  },
  es: {
    pageTitleSuffix: ": clubes, fichajes, oportunidades",
    metaSuffix: (n) =>
      ` Descubre clubes, fichajes, detección y oportunidades en ${n} en FootNation.`,
    h1: (n) => `Fútbol en ${n}`,
    ctaHero: "Crear mi perfil de jugador",
    ctaSecondary: "Ver los clubes",
    cardClubsTitle: "Clubes locales",
    cardClubsBody: (n) =>
      `Encuentra clubes amateurs y profesionales de ${n} con su identidad, equipos y anuncios de fichaje.`,
    cardOppsTitle: "Oportunidades",
    cardOppsBody: (n) =>
      `Detecciones, pruebas, voluntariado o empleo: las oportunidades en ${n} se publican en tiempo real.`,
    cardRecruitTitle: "Reclutamiento local",
    cardRecruitBody: (n) =>
      `Jugadores, clubes y ojeadores de ${n} se comunican directamente vía FootNation. Perfil visible 24/7.`,
    siblingsCity: (c) => `Otras ciudades de fútbol en ${c}`,
    siblingsCountry: "Explora otros países",
    siblingLink: (n) => `Fútbol en ${n}`,
    finalH: (n) => `Únete a la escena futbolística de ${n}`,
    finalP: "Registro gratuito. Perfil visible para los clubes locales.",
    finalCta: "Crear mi perfil",
    countryLabel: "País",
  },
  pt: {
    pageTitleSuffix: ": clubes, recrutamento, oportunidades",
    metaSuffix: (n) =>
      ` Descubra clubes, recrutamento, observação e oportunidades em ${n} na FootNation.`,
    h1: (n) => `Futebol em ${n}`,
    ctaHero: "Criar o meu perfil",
    ctaSecondary: "Ver os clubes",
    cardClubsTitle: "Clubes locais",
    cardClubsBody: (n) =>
      `Encontre clubes amadores e profissionais em ${n} com identidade, equipas e anúncios de recrutamento.`,
    cardOppsTitle: "Oportunidades",
    cardOppsBody: (n) =>
      `Captação, testes, voluntariado ou empregos: as oportunidades em ${n} são publicadas em tempo real.`,
    cardRecruitTitle: "Recrutamento local",
    cardRecruitBody: (n) =>
      `Jogadores, clubes e observadores de ${n} comunicam diretamente via FootNation. Perfil visível 24/7.`,
    siblingsCity: (c) => `Outras cidades de futebol em ${c}`,
    siblingsCountry: "Explorar outros países",
    siblingLink: (n) => `Futebol em ${n}`,
    finalH: (n) => `Junte-se à cena de futebol de ${n}`,
    finalP: "Inscrição gratuita. Perfil visível para os clubes locais.",
    finalCta: "Criar o meu perfil",
    countryLabel: "País",
  },
  de: {
    pageTitleSuffix: ": Vereine, Rekrutierung, Chancen",
    metaSuffix: (n) =>
      ` Entdecken Sie Vereine, Rekrutierung, Scouting und Chancen in ${n} auf FootNation.`,
    h1: (n) => `Fußball in ${n}`,
    ctaHero: "Mein Spielerprofil erstellen",
    ctaSecondary: "Vereine ansehen",
    cardClubsTitle: "Lokale Vereine",
    cardClubsBody: (n) =>
      `Finden Sie Amateur- und Profivereine in ${n} mit Identität, Mannschaften und aktuellen Rekrutierungen.`,
    cardOppsTitle: "Chancen",
    cardOppsBody: (n) =>
      `Sichtungen, Probetraining, Ehrenamt oder Jobs — Chancen in ${n} werden in Echtzeit veröffentlicht.`,
    cardRecruitTitle: "Lokale Rekrutierung",
    cardRecruitBody: (n) =>
      `Spieler, Vereine und Scouts aus ${n} tauschen sich direkt über FootNation aus. Profil 24/7 sichtbar.`,
    siblingsCity: (c) => `Weitere Fußballstädte in ${c}`,
    siblingsCountry: "Andere Länder entdecken",
    siblingLink: (n) => `Fußball in ${n}`,
    finalH: (n) => `Werden Sie Teil der Fußballszene in ${n}`,
    finalP: "Kostenlose Anmeldung. Profil für lokale Vereine sichtbar.",
    finalCta: "Mein Profil erstellen",
    countryLabel: "Land",
  },
  it: {
    pageTitleSuffix: ": club, reclutamento, opportunità",
    metaSuffix: (n) =>
      ` Scopri club, reclutamento, scouting e opportunità a ${n} su FootNation.`,
    h1: (n) => `Calcio a ${n}`,
    ctaHero: "Crea il mio profilo",
    ctaSecondary: "Vedi i club",
    cardClubsTitle: "Club locali",
    cardClubsBody: (n) =>
      `Trova i club amatoriali e professionistici di ${n} con identità, squadre e annunci di reclutamento.`,
    cardOppsTitle: "Opportunità",
    cardOppsBody: (n) =>
      `Scouting, provini, volontariato o lavoro: le opportunità a ${n} sono pubblicate in tempo reale.`,
    cardRecruitTitle: "Reclutamento locale",
    cardRecruitBody: (n) =>
      `Giocatori, club e osservatori di ${n} interagiscono direttamente via FootNation. Profilo visibile 24/7.`,
    siblingsCity: (c) => `Altre città di calcio in ${c}`,
    siblingsCountry: "Esplora altri paesi",
    siblingLink: (n) => `Calcio a ${n}`,
    finalH: (n) => `Unisciti alla scena calcistica di ${n}`,
    finalP: "Iscrizione gratuita. Profilo visibile ai club locali.",
    finalCta: "Crea il mio profilo",
    countryLabel: "Paese",
  },
  ar: {
    pageTitleSuffix: " — أندية وتعاقدات وفرص",
    metaSuffix: (n) =>
      ` اكتشف الأندية والتعاقدات والكشف عن المواهب والفرص في ${n} على FootNation.`,
    h1: (n) => `كرة القدم في ${n}`,
    ctaHero: "إنشاء ملفي كلاعب",
    ctaSecondary: "رؤية الأندية",
    cardClubsTitle: "أندية محلية",
    cardClubsBody: (n) =>
      `اعثر على الأندية الهاوية والاحترافية في ${n} مع هويتها وفرقها وإعلانات التعاقد.`,
    cardOppsTitle: "فرص",
    cardOppsBody: (n) => `تجارب، تطوع أو وظائف: فرص ${n} تُنشر بشكل فوري.`,
    cardRecruitTitle: "التعاقد المحلي",
    cardRecruitBody: (n) =>
      `يتواصل اللاعبون والأندية والكشافون في ${n} مباشرة عبر FootNation. الملف ظاهر على مدار الساعة.`,
    siblingsCity: (c) => `مدن كرة قدم أخرى في ${c}`,
    siblingsCountry: "استكشاف بلدان أخرى",
    siblingLink: (n) => `كرة القدم في ${n}`,
    finalH: (n) => `انضم إلى مشهد كرة القدم في ${n}`,
    finalP: "تسجيل مجاني. ملف مرئي للأندية المحلية.",
    finalCta: "إنشاء ملفي",
    countryLabel: "بلد",
  },
};
