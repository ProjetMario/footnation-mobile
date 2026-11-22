import { levels, positions, ages, benefits } from "./careerOptions";

export type GoalDefinition = {
  objectives: string[];
  target: string | null;
  sport?: boolean;
  player?: boolean;
  paid?: boolean;
  genericLevels?: boolean;
  functions?: string[];
};
const player: GoalDefinition = {
  objectives: [
    "Devenir professionnel",
    "Rejoindre un club amateur",
    "Monter de niveau",
    "Trouver des essais",
    "Rejoindre un centre de formation",
  ],
  target: "amateur",
  sport: true,
  player: true,
  paid: true,
};
const leisure: GoalDefinition = {
  objectives: [
    "Rejoindre une équipe",
    "Trouver un club",
    "Participer à une compétition",
    "Progresser dans ma pratique",
  ],
  target: "joueur_loisir",
  sport: true,
  player: true,
  genericLevels: true,
};
export const careerRoles: Record<string, GoalDefinition> = {
  "Joueur amateur": player,
  "Joueur pro": { ...player, target: "joueur_pro" },
  "Joueur loisir": leisure,
  "Joueur indoor (Five)": { ...leisure, target: "centre_indoor" },
  "Joueur corpo": { ...leisure, target: "foot_corpo" },
  "Joueur futsal": leisure,
  Entraîneur: {
    objectives: [
      "Entraîner en professionnel",
      "Entraîner en amateur",
      "Rejoindre un staff",
      "Devenir entraîneur principal",
      "Devenir adjoint",
      "Me former",
    ],
    target: "entraineur",
    sport: true,
    paid: true,
    functions: [
      "Entraîneur principal",
      "Adjoint",
      "Entraîneur des gardiens",
      "Préparateur physique",
      "Analyste vidéo",
    ],
  },
  Éducateur: {
    objectives: [
      "Encadrer une catégorie",
      "Rejoindre une école de football",
      "Rejoindre une structure amateur",
      "Rejoindre une structure professionnelle",
      "Me former",
    ],
    target: "educateur",
    sport: true,
    paid: true,
    functions: [
      "Éducateur",
      "Responsable de catégorie",
      "Responsable école de football",
    ],
  },
  Agent: {
    objectives: [
      "Représenter des joueurs",
      "Rejoindre une agence",
      "Développer des partenariats avec des clubs",
      "Me former au métier",
    ],
    target: "agent",
    paid: true,
  },
  Arbitre: {
    objectives: [
      "Débuter dans l’arbitrage",
      "Progresser de niveau",
      "Rejoindre une structure",
      "Trouver une formation",
    ],
    target: "arbitre",
    sport: true,
    genericLevels: true,
    paid: true,
  },
  Bénévole: {
    objectives: ["Trouver une mission ponctuelle", "M’engager régulièrement"],
    target: "benevole",
    functions: [
      "Événements",
      "Accueil",
      "Logistique",
      "Communication",
      "Accompagnement",
    ],
  },
  Dirigeant: {
    objectives: [
      "Rejoindre un projet de club",
      "Développer un projet",
      "Trouver des partenaires",
      "Renforcer une équipe dirigeante",
    ],
    target: "dirigeant",
  },
  Président: {
    objectives: [
      "Développer mon club",
      "Trouver des partenaires",
      "Renforcer une équipe dirigeante",
    ],
    target: "president",
  },
  "Passionné(e)": {
    objectives: [
      "Rejoindre une communauté",
      "Participer à des événements",
      "Contribuer à un projet football",
    ],
    target: "passionne",
  },
  "Supporter & fan": {
    objectives: [
      "Rejoindre une communauté",
      "Participer à des événements",
      "Contribuer à un projet football",
    ],
    target: "supporter",
  },
  Parent: {
    objectives: [
      "Trouver un club pour mon enfant",
      "Trouver un stage",
      "Trouver un accompagnement",
    ],
    target: "parent",
  },
  Club: {
    objectives: [
      "Développer mes équipes",
      "Rechercher des joueurs",
      "Rechercher du staff",
      "Rechercher des bénévoles",
      "Trouver des partenaires",
    ],
    target: null,
    sport: true,
  },
  "Entreprise / Marque": {
    objectives: [
      "Trouver des clubs partenaires",
      "Soutenir un projet",
      "Proposer une collaboration",
      "Rechercher des ambassadeurs",
    ],
    target: "entreprise",
  },
  Institution: {
    objectives: [
      "Développer un programme",
      "Trouver des structures partenaires",
      "Organiser des actions",
      "Organiser des formations",
    ],
    target: "ligue_district",
  },
};
export type GoalValues = {
  objective: string;
  environment: string;
  level: string;
  position: string;
  category: string;
  zone: string;
  zoneCity: string;
  zoneDepartment: string;
  mobility: string;
  mobilityRadiusKm: string;
  internationalCountries: string;
  availability: string;
  description: string;
  salary: string;
  benefits: string;
};
export const emptyGoal: GoalValues = {
  objective: "",
  environment: "",
  level: "",
  position: "",
  category: "",
  zone: "",
  zoneCity: "",
  zoneDepartment: "",
  mobility: "",
  mobilityRadiusKm: "",
  internationalCountries: "",
  availability: "",
  description: "",
  salary: "",
  benefits: "",
};

/** ISO 3166 countries and territories, displayed in French when supported. */
const internationalCountryCodes =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );
const regionNames = new Intl.DisplayNames(["fr"], { type: "region" });
export const internationalCountries = internationalCountryCodes.map(
  (code) => regionNames.of(code) || code,
);
export function profileCareerRoles(profile: {
  account_type?: string;
  primary_role?: string;
  secondary_roles?: string[];
}) {
  const org = (
    {
      club: "Club",
      business: "Entreprise / Marque",
      institution: "Institution",
    } as Record<string, string>
  )[profile.account_type || ""];
  return org
    ? [org]
    : [
        ...new Set(
          [profile.primary_role, ...(profile.secondary_roles || [])].filter(
            (r): r is string => !!r && !!careerRoles[r],
          ),
        ),
      ];
}
export function goalLevels(role: string, environment: string): string[] {
  if (careerRoles[role]?.genericLevels)
    return ["Local", "Régional", "National", "International"];
  if (environment === "Professionnel")
    return ["Ligue 1", "Ligue 2", "Autre championnat professionnel"];
  if (environment === "Amateur")
    return levels.filter((l) => l !== "Ligue 1" && l !== "Ligue 2");
  return [...levels, "Autre championnat"];
}
export function goalFields(role: string) {
  const d = careerRoles[role];
  return {
    positions: d.player ? positions : d.functions || [],
    categories: d.sport && role !== "Arbitre" ? ages : [],
  };
}
export function legacyGoal(
  profile: Record<string, unknown>,
  role: string,
): GoalValues {
  const d = careerRoles[role];
  return {
    ...emptyGoal,
    environment: d.sport
      ? profile.target_competition_level === "professional"
        ? "Professionnel"
        : profile.target_competition_level === "amateur"
          ? "Amateur"
          : ""
      : "",
    level: d.sport ? String(profile.target_level || "") : "",
    position: d.player ? String(profile.target_position || "") : "",
    category: d.sport ? String(profile.target_age_category || "") : "",
    salary: d.paid ? String(profile.desired_salary ?? "") : "",
    benefits:
      d.paid && Array.isArray(profile.desired_benefits)
        ? profile.desired_benefits
            .map((key) => benefits[String(key)] || String(key))
            .join(", ")
        : "",
  };
}
export function goalPreview(role: string, v: GoalValues) {
  const d = careerRoles[role];
  const zone = [v.zoneCity || v.zone, v.zoneDepartment]
    .filter(Boolean)
    .join(" · ");
  const mobility = [
    v.mobility,
    v.mobilityRadiusKm && `${v.mobilityRadiusKm} km`,
  ]
    .filter(Boolean)
    .join(" · ");
  const details = [
    ["Cadre", d.sport ? v.environment : ""],
    ["Niveau souhaité", d.sport ? v.level : ""],
    ["Poste / fonction", goalFields(role).positions.length ? v.position : ""],
    ["Catégorie", goalFields(role).categories.length ? v.category : ""],
    ["Zone recherchée", zone],
    ["Mobilité", mobility],
    ["Pays ciblés", v.internationalCountries],
    ["Disponibilité", v.availability],
    ["Rémunération souhaitée (€/mois)", d.paid ? v.salary : ""],
    ["Avantages souhaités", d.paid ? v.benefits : ""],
  ];
  return {
    title: `${role} — ${v.objective}`,
    description: [
      v.objective,
      ...details
        .filter(([, value]) => value)
        .map(([label, value]) => `${label} : ${value}`),
      v.description.trim(),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
export function validateGoal(role: string, v: GoalValues): string | null {
  if (!careerRoles[role]?.objectives.includes(v.objective))
    return "Choisissez votre objectif.";
  if (v.salary && !/^[0-9]+([.][0-9]{1,2})?$/.test(v.salary))
    return "Indiquez une rémunération valide.";
  if (v.mobilityRadiusKm && !/^[0-9]+$/.test(v.mobilityRadiusKm))
    return "Indiquez un kilométrage valide.";
  if (v.description.length > 3000)
    return "La description est limitée à 3 000 caractères.";
  return null;
}

export function selectObjective(v: GoalValues, objective: string): GoalValues {
  const environment = /professionnel/.test(objective)
    ? "Professionnel"
    : /amateur/.test(objective)
      ? "Amateur"
      : v.environment;
  return {
    ...v,
    objective,
    environment,
    level: environment === v.environment ? v.level : "",
  };
}
