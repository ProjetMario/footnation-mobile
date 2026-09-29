// Content ported from the site's checked-in geography pages/data; no generated destinations.
interface CountryInfo {
  name: string;
  slug: string;
  nationality: string;
  keywords: string[];
  description: string;
  sections: { title: string; body: string }[];
  faq: { question: string; answer: string }[];
}

export const COUNTRIES: CountryInfo[] = [
  {
    slug: "france",
    name: "France",
    nationality: "Française",
    keywords: [
      "football France",
      "joueurs français",
      "clubs français",
      "recrutement football France",
    ],
    description:
      "Découvrez les joueurs, clubs et opportunités football en France sur FootNation. Le réseau du football amateur et professionnel.",
    sections: [
      {
        title: "Joueurs français visibles par les recruteurs",
        body: "FootNation référence des milliers de profils de joueurs français. Chaque profil comprend poste, niveau, ville, vidéos et statistiques pour faciliter le recrutement.",
      },
      {
        title: "Clubs et centres de formation",
        body: "Des clubs amateurs aux centres de formation professionnels, FootNation cartographie l’écosystème football français et met en relation les acteurs.",
      },
      {
        title: "Recrutement par région et par niveau",
        body: "Filtrez les profils et clubs par département, ville, niveau et catégorie pour cibler vos besoins de recrutement en France.",
      },
    ],
    faq: [
      {
        question: "Comment trouver un joueur en France ?",
        answer:
          "Utilisez la recherche FootNation par poste, ville, niveau et âge pour découvrir les profils de joueurs français.",
      },
      {
        question: "FootNation couvre-t-il tous les niveaux ?",
        answer:
          "Oui, du district au professionnel, en passant par les centres de formation et académies.",
      },
      {
        question: "L’inscription est-elle gratuite ?",
        answer:
          "Oui, créer un profil et consulter le réseau est 100% gratuit. Des options Premium existent.",
      },
    ],
  },
  {
    slug: "espagne",
    name: "Espagne",
    nationality: "Espagnole",
    keywords: [
      "football Espagne",
      "joueurs espagnols",
      "clubs espagnols",
      "La Liga",
    ],
    description:
      "Joueurs et clubs de football en Espagne sur FootNation. Découvrez les talents espagnols et les opportunités de recrutement.",
    sections: [
      {
        title: "Talents espagnols",
        body: "FootNation met en avant les profils de joueurs espagnols avec leurs caractéristiques, postes et niveaux de compétition.",
      },
      {
        title: "Clubs espagnols",
        body: "Des clubs professionnels aux académies régionales, retrouvez les structures football espagnoles sur FootNation.",
      },
      {
        title: "Opportunités internationales",
        body: "Les recruteurs internationaux peuvent contacter directement les joueurs et clubs espagnols référencés.",
      },
    ],
    faq: [
      {
        question: "Comment recruter un joueur espagnol ?",
        answer:
          "Recherchez par ville, poste et niveau sur FootNation puis contactez le joueur via la messagerie sécurisée.",
      },
      {
        question: "FootNation est-il disponible en espagnol ?",
        answer:
          "Oui, la plateforme est disponible en espagnol et dans 6 autres langues.",
      },
      {
        question: "L’inscription est-elle gratuite ?",
        answer:
          "Oui, l’inscription et la consultation du réseau sont gratuites.",
      },
    ],
  },
  {
    slug: "bresil",
    name: "Brésil",
    nationality: "Brésilienne",
    keywords: [
      "football Brésil",
      "joueurs brésiliens",
      "clubs brésiliens",
      "Série A",
    ],
    description:
      "Le football brésilien sur FootNation : joueurs, clubs, académies et opportunités de recrutement au Brésil.",
    sections: [
      {
        title: "Joueurs brésiliens",
        body: "Découvrez les talents brésiliens référencés sur FootNation, de l’amateur au professionnel.",
      },
      {
        title: "Clubs brésiliens",
        body: "Série A, Série B, académies et clubs locaux : retrouvez les structures football brésiliennes.",
      },
      {
        title: "Visibilité mondiale",
        body: "Les profils brésiliens sont traduits et visibles par des recruteurs du monde entier.",
      },
    ],
    faq: [
      {
        question: "Comment trouver un joueur brésilien ?",
        answer:
          "Utilisez les filtres pays, ville et niveau sur FootNation pour repérer les talents brésiliens.",
      },
      {
        question: "FootNation est-il disponible en portugais ?",
        answer: "Oui, la plateforme est disponible en portugais.",
      },
      {
        question: "L’inscription est-elle gratuite ?",
        answer: "Oui, créer un profil et consulter le réseau sont gratuits.",
      },
    ],
  },
];
