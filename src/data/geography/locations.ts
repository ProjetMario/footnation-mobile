// Content ported from the site's checked-in geography pages/data; no generated destinations.
export interface GeoLocation {
  slug: string;
  name: string;
  type: "city" | "country";
  country: string;
  region?: string;
  intro: string;
  /** ISO 3166-1 alpha-2 */
  countryCode?: string;
}

export const GEO_CITIES: GeoLocation[] = [
  {
    slug: "paris",
    name: "Paris",
    type: "city",
    country: "France",
    region: "Île-de-France",
    intro:
      "Le football à Paris est un écosystème dense : clubs amateurs, centres de formation, équipes pros et académies internationales.",
    countryCode: "FR",
  },
  {
    slug: "marseille",
    name: "Marseille",
    type: "city",
    country: "France",
    region: "PACA",
    intro:
      "Marseille, ville de football par excellence, regorge de clubs amateurs, semi-pros et de talents de Ligue 1.",
    countryCode: "FR",
  },
  {
    slug: "lyon",
    name: "Lyon",
    type: "city",
    country: "France",
    region: "Auvergne-Rhône-Alpes",
    intro:
      "Lyon est un terreau majeur du football français, avec un centre de formation de renommée mondiale et un tissu amateur riche.",
    countryCode: "FR",
  },
  {
    slug: "toulouse",
    name: "Toulouse",
    type: "city",
    country: "France",
    region: "Occitanie",
    intro:
      "Toulouse compte de nombreux clubs amateurs et professionnels actifs dans le recrutement et la détection.",
    countryCode: "FR",
  },
  {
    slug: "nice",
    name: "Nice",
    type: "city",
    country: "France",
    region: "PACA",
    intro:
      "Sur la Côte d'Azur, Nice cultive un football amateur dynamique et une équipe pro évoluant en Ligue 1.",
    countryCode: "FR",
  },
  {
    slug: "nantes",
    name: "Nantes",
    type: "city",
    country: "France",
    region: "Pays de la Loire",
    intro:
      "Nantes possède l'un des centres de formation les plus respectés de France et un réseau amateur très actif.",
    countryCode: "FR",
  },
  {
    slug: "strasbourg",
    name: "Strasbourg",
    type: "city",
    country: "France",
    region: "Grand Est",
    intro:
      "Strasbourg est un carrefour football franco-allemand, riche en clubs amateurs et opportunités transfrontalières.",
    countryCode: "FR",
  },
  {
    slug: "montpellier",
    name: "Montpellier",
    type: "city",
    country: "France",
    region: "Occitanie",
    intro:
      "Montpellier compte un tissu amateur dense et une équipe pro qui valorise les jeunes talents.",
    countryCode: "FR",
  },
  {
    slug: "bordeaux",
    name: "Bordeaux",
    type: "city",
    country: "France",
    region: "Nouvelle-Aquitaine",
    intro:
      "Bordeaux est une terre de football historique, avec une académie reconnue et de nombreux clubs amateurs.",
    countryCode: "FR",
  },
  {
    slug: "lille",
    name: "Lille",
    type: "city",
    country: "France",
    region: "Hauts-de-France",
    intro:
      "Lille rayonne avec un club professionnel champion de France et un vivier amateur impressionnant.",
    countryCode: "FR",
  },
  {
    slug: "rennes",
    name: "Rennes",
    type: "city",
    country: "France",
    region: "Bretagne",
    intro:
      "Rennes est une référence pour la formation des jeunes talents et compte de nombreux clubs amateurs.",
    countryCode: "FR",
  },
  {
    slug: "reims",
    name: "Reims",
    type: "city",
    country: "France",
    region: "Grand Est",
    intro:
      "Reims a une longue tradition football, avec un centre de formation reconnu et un tissu amateur dynamique.",
    countryCode: "FR",
  },
  {
    slug: "saint-etienne",
    name: "Saint-Étienne",
    type: "city",
    country: "France",
    region: "Auvergne-Rhône-Alpes",
    intro:
      "Saint-Étienne est une ville de football mythique, riche en clubs amateurs et centres de formation.",
    countryCode: "FR",
  },
  {
    slug: "le-havre",
    name: "Le Havre",
    type: "city",
    country: "France",
    region: "Normandie",
    intro:
      "Le Havre, berceau du football français, possède l'un des centres de formation historiques du pays.",
    countryCode: "FR",
  },
  {
    slug: "toulon",
    name: "Toulon",
    type: "city",
    country: "France",
    region: "PACA",
    intro:
      "Toulon cultive un football amateur compétitif et accueille régulièrement des compétitions de jeunes.",
    countryCode: "FR",
  },
  {
    slug: "grenoble",
    name: "Grenoble",
    type: "city",
    country: "France",
    region: "Auvergne-Rhône-Alpes",
    intro:
      "Grenoble allie nature et football, avec un tissu amateur actif et un club pro évolutif.",
    countryCode: "FR",
  },
  {
    slug: "dijon",
    name: "Dijon",
    type: "city",
    country: "France",
    region: "Bourgogne-Franche-Comté",
    intro:
      "Dijon fédère un riche tissu amateur et un projet professionnel ambitieux.",
    countryCode: "FR",
  },
  {
    slug: "angers",
    name: "Angers",
    type: "city",
    country: "France",
    region: "Pays de la Loire",
    intro:
      "Angers est une ville de football active, avec un club pro stable et de nombreux clubs amateurs.",
    countryCode: "FR",
  },
  {
    slug: "nimes",
    name: "Nîmes",
    type: "city",
    country: "France",
    region: "Occitanie",
    intro:
      "Nîmes possède un héritage football fort, entre Ligue 2 et amateurs passionnés.",
    countryCode: "FR",
  },
  {
    slug: "le-mans",
    name: "Le Mans",
    type: "city",
    country: "France",
    region: "Pays de la Loire",
    intro:
      "Le Mans cultive un football amateur de qualité et reste tourné vers la formation des jeunes.",
    countryCode: "FR",
  },

  // International
  {
    slug: "londres",
    name: "Londres",
    type: "city",
    country: "Royaume-Uni",
    intro:
      "Londres est l'épicentre mondial du football professionnel, avec des dizaines d'académies et de clubs prestigieux.",
    countryCode: "GB",
  },
  {
    slug: "madrid",
    name: "Madrid",
    type: "city",
    country: "Espagne",
    intro:
      "Madrid abrite certains des plus grands clubs du monde et un réseau d'académies de haut niveau.",
    countryCode: "ES",
  },
  {
    slug: "barcelone",
    name: "Barcelone",
    type: "city",
    country: "Espagne",
    intro:
      "Barcelone est synonyme de formation d'excellence, avec La Masia comme référence mondiale.",
    countryCode: "ES",
  },
  {
    slug: "berlin",
    name: "Berlin",
    type: "city",
    country: "Allemagne",
    intro:
      "Berlin connecte amateurs et clubs professionnels dans un écosystème football allemand reconnu.",
    countryCode: "DE",
  },
  {
    slug: "milan",
    name: "Milan",
    type: "city",
    country: "Italie",
    intro:
      "Milan est une capitale du football italien avec des académies historiques.",
    countryCode: "IT",
  },
  {
    slug: "rome",
    name: "Rome",
    type: "city",
    country: "Italie",
    intro:
      "Rome cultive un football passionné, des clubs pros aux académies de jeunes.",
    countryCode: "IT",
  },
  {
    slug: "bruxelles",
    name: "Bruxelles",
    type: "city",
    country: "Belgique",
    intro:
      "Bruxelles est un carrefour européen du football, avec une scène amateur très active.",
    countryCode: "BE",
  },
  {
    slug: "geneve",
    name: "Genève",
    type: "city",
    country: "Suisse",
    intro:
      "Genève allie football amateur et international au cœur de l'Europe.",
    countryCode: "CH",
  },
  {
    slug: "alger",
    name: "Alger",
    type: "city",
    country: "Algérie",
    intro:
      "Alger est le centre du football algérien, avec un vivier de talents reconnu.",
    countryCode: "DZ",
  },
  {
    slug: "casablanca",
    name: "Casablanca",
    type: "city",
    country: "Maroc",
    intro:
      "Casablanca rayonne avec ses grands clubs et son écosystème football marocain.",
    countryCode: "MA",
  },
  {
    slug: "tunis",
    name: "Tunis",
    type: "city",
    country: "Tunisie",
    intro:
      "Tunis est le foyer du football tunisien, avec une scène amateur et professionnelle dynamique.",
    countryCode: "TN",
  },
  {
    slug: "dakar",
    name: "Dakar",
    type: "city",
    country: "Sénégal",
    intro:
      "Dakar est un vivier de talents reconnu mondialement, avec de nombreuses académies.",
    countryCode: "SN",
  },
  {
    slug: "abidjan",
    name: "Abidjan",
    type: "city",
    country: "Côte d'Ivoire",
    intro:
      "Abidjan est une capitale ouest-africaine du football, avec des académies réputées.",
    countryCode: "CI",
  },
  {
    slug: "montreal",
    name: "Montréal",
    type: "city",
    country: "Canada",
    intro: "Montréal connecte football canadien et tradition européenne.",
    countryCode: "CA",
  },
  {
    slug: "new-york",
    name: "New York",
    type: "city",
    country: "États-Unis",
    intro:
      "New York est un hub football américain en pleine croissance, avec des clubs MLS et amateurs.",
    countryCode: "US",
  },
  {
    slug: "porto",
    name: "Porto",
    type: "city",
    country: "Portugal",
    intro:
      "Porto est une référence portugaise pour la formation et la compétition.",
    countryCode: "PT",
  },
  {
    slug: "amsterdam",
    name: "Amsterdam",
    type: "city",
    country: "Pays-Bas",
    intro:
      "Amsterdam est synonyme de football total et d'académies de renommée mondiale.",
    countryCode: "NL",
  },

  // Phase C — new global destinations
  {
    slug: "tokyo",
    name: "Tokyo",
    type: "city",
    country: "Japon",
    intro:
      "Tokyo est le centre du football japonais, avec la J.League et des académies de plus en plus connectées à l'Europe.",
    countryCode: "JP",
  },
  {
    slug: "sao-paulo",
    name: "São Paulo",
    type: "city",
    country: "Brésil",
    intro:
      "São Paulo est un berceau du football brésilien, abritant des clubs historiques comme Corinthians, Palmeiras et São Paulo FC.",
    countryCode: "BR",
  },
  {
    slug: "le-caire",
    name: "Le Caire",
    type: "city",
    country: "Égypte",
    intro:
      "Le Caire est la capitale du football égyptien et africain, avec Al Ahly et Zamalek, les deux clubs les plus titrés du continent.",
    countryCode: "EG",
  },
  {
    slug: "riyad",
    name: "Riyad",
    type: "city",
    country: "Arabie saoudite",
    intro:
      "Riyad est le centre du football saoudien en pleine transformation, avec Al-Hilal, Al-Nassr et l'arrivée de stars mondiales.",
    countryCode: "SA",
  },
  {
    slug: "mumbai",
    name: "Mumbai",
    type: "city",
    country: "Inde",
    intro:
      "Mumbai est le hub football de l'Inde, avec la Indian Super League et un vivier de jeunes talents en croissance rapide.",
    countryCode: "IN",
  },
  {
    slug: "lagos",
    name: "Lagos",
    type: "city",
    country: "Nigéria",
    intro:
      "Lagos est un vivier de talents football nigérians reconnu mondialement, avec des académies qui alimentent les grands clubs européens.",
    countryCode: "NG",
  },
  {
    slug: "buenos-aires",
    name: "Buenos Aires",
    type: "city",
    country: "Argentine",
    intro:
      "Buenos Aires est le temple du football argentin, berceau de clubs légendaires comme Boca Juniors et River Plate.",
    countryCode: "AR",
  },
  {
    slug: "istanbul",
    name: "Istanbul",
    type: "city",
    country: "Turquie",
    intro:
      "Istanbul unit l'Europe et l'Asie dans une passion football dévorante, avec Galatasaray, Fenerbahçe et Beşiktaş.",
    countryCode: "TR",
  },
];

export const GEO_COUNTRIES: GeoLocation[] = [
  {
    slug: "france",
    name: "France",
    type: "country",
    country: "France",
    intro:
      "La France compte plus de 14 000 clubs amateurs et une tradition football majeure. FootNation y est implantée nationalement.",
    countryCode: "FR",
  },
  {
    slug: "royaume-uni",
    name: "Royaume-Uni",
    type: "country",
    country: "Royaume-Uni",
    intro:
      "Le Royaume-Uni est le berceau du football moderne, avec une pyramide compétitive unique.",
    countryCode: "GB",
  },
  {
    slug: "espagne",
    name: "Espagne",
    type: "country",
    country: "Espagne",
    intro: "L'Espagne brille par sa formation et ses clubs de classe mondiale.",
    countryCode: "ES",
  },
  {
    slug: "italie",
    name: "Italie",
    type: "country",
    country: "Italie",
    intro: "L'Italie cultive une culture tactique et un football historique.",
    countryCode: "IT",
  },
  {
    slug: "allemagne",
    name: "Allemagne",
    type: "country",
    country: "Allemagne",
    intro:
      "L'Allemagne dispose de l'un des systèmes de formation les plus structurés au monde.",
    countryCode: "DE",
  },
  {
    slug: "belgique",
    name: "Belgique",
    type: "country",
    country: "Belgique",
    intro:
      "La Belgique offre un écosystème football francophone et flamand de très haut niveau.",
    countryCode: "BE",
  },
  {
    slug: "suisse",
    name: "Suisse",
    type: "country",
    country: "Suisse",
    intro:
      "La Suisse combine multiculturalisme football et formation rigoureuse.",
    countryCode: "CH",
  },
  {
    slug: "algerie",
    name: "Algérie",
    type: "country",
    country: "Algérie",
    intro:
      "L'Algérie est une nation football majeure d'Afrique du Nord avec un vivier exceptionnel.",
    countryCode: "DZ",
  },
  {
    slug: "maroc",
    name: "Maroc",
    type: "country",
    country: "Maroc",
    intro: "Le Maroc rayonne sur la scène football africaine et mondiale.",
    countryCode: "MA",
  },
  {
    slug: "tunisie",
    name: "Tunisie",
    type: "country",
    country: "Tunisie",
    intro: "La Tunisie cultive une scène football active et compétitive.",
    countryCode: "TN",
  },
  {
    slug: "senegal",
    name: "Sénégal",
    type: "country",
    country: "Sénégal",
    intro: "Le Sénégal est une terre de talents et d'académies de référence.",
    countryCode: "SN",
  },
  {
    slug: "cote-d-ivoire",
    name: "Côte d'Ivoire",
    type: "country",
    country: "Côte d'Ivoire",
    intro:
      "La Côte d'Ivoire forme régulièrement des stars mondiales du football.",
    countryCode: "CI",
  },
  {
    slug: "canada",
    name: "Canada",
    type: "country",
    country: "Canada",
    intro:
      "Le Canada développe un football de plus en plus structuré, MLS et académies.",
    countryCode: "CA",
  },
  {
    slug: "etats-unis",
    name: "États-Unis",
    type: "country",
    country: "États-Unis",
    intro: "Les États-Unis voient leur football croître à grande vitesse.",
    countryCode: "US",
  },
  {
    slug: "portugal",
    name: "Portugal",
    type: "country",
    country: "Portugal",
    intro:
      "Le Portugal est célèbre pour la qualité de sa formation et ses grands clubs.",
    countryCode: "PT",
  },
  {
    slug: "pays-bas",
    name: "Pays-Bas",
    type: "country",
    country: "Pays-Bas",
    intro:
      "Les Pays-Bas perpétuent la tradition du football total et de la formation d'élite.",
    countryCode: "NL",
  },
];

export const ALL_GEO: GeoLocation[] = [...GEO_CITIES, ...GEO_COUNTRIES];

export const findGeoBySlug = (slug: string) =>
  ALL_GEO.find((g) => g.slug === slug);
