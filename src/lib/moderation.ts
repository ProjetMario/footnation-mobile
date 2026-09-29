/**
 * Simple client-side text moderation.
 *
 * Scans the supplied text for insults, slurs, sexually explicit terms,
 * racist/sexist language and other offensive content.
 *
 * This is a first line of defence: it is easy for a motivated user to bypass
 * (leetspeak, spaces, etc.). Consider complementing with server-side checks
 * or a service like Perspective API for sensitive content.
 */

const LEET_REPLACEMENTS: Record<string, string> = {
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "0": "o",
  "8": "b",
  "9": "g",
  "€": "e",
  "@": "a",
  $: "s",
  "&": "et",
};

// Lowercased, accent-stripped list.
// Words shorter than 5 chars are matched only against whole tokens to reduce
// false positives (e.g. "con" should not flag "concert").
const BAD_WORDS: string[] = [
  // French insults / vulgarities
  "con",
  "connard",
  "connasse",
  "conasse",
  "conne",
  "connerie",
  "conneries",
  "conards",
  "connards",
  "connasses",
  "salope",
  "salopes",
  "salopard",
  "salopards",
  "saloperie",
  "putain",
  "putains",
  "pute",
  "putes",
  "pouffiasse",
  "pouffiasse",
  "fille de pute",
  "fils de pute",
  "fdp",
  "batard",
  "batarde",
  "batarde",
  "batards",
  "encule",
  "enculer",
  "encules",
  "enculee",
  "enculees",
  "enculez",
  "ntm",
  "nique",
  "niquer",
  "niques",
  "niquez",
  "niquetamere",
  "niquetamer",
  "merde",
  "merdes",
  "merdique",
  "foutre",
  "foutres",
  "fous",
  "fouteur",
  "fouteuse",
  "chiure",
  "chier",
  "chie",
  "chies",
  "chiez",
  "chiennasse",
  "chienne",
  "chiennes",
  "encule",
  "trou du cul",
  "trouduc",
  "trouduc",
  "pédale",
  "pedale",
  "pd",
  "pdedale",
  "tapette",
  "tarlouze",
  "tafiole",
  "tocard",
  "tocarde",
  "tocards",
  "gouine",
  "gouines",
  "travelo",
  "travelos",
  "pouf",
  "pouffe",
  "gros con",
  "grosse con",
  "grosse pute",
  "garce",
  "garces",
  "catin",
  "catins",
  "ordure",
  "ordures",
  "vaurien",
  "vauriens",
  "vaure",
  "petasse",
  "petasses",
  "pétasse",
  "racaille",
  "racailles",
  "canaille",
  "canailles",
  "salaud",
  "salauds",
  "salopiaud",
  "salopiauds",
  "bougnoule",
  "bougnoul",
  "bougne",
  "babtou",
  "renoi",
  "rebeu",
  "chinetoque",
  "chingchong",
  "niak",
  "youpin",
  "feuj",
  "bamboula",
  "négr",
  "negre",
  "negro",
  "nègre",
  "négro",
  "négroide",
  "negroide",
  "sales juif",
  "sale juif",
  "sales arabes",
  "sale arabe",
  "sales noir",
  "sale noir",
  "sales noirs",
  "gros porc",
  "grosse vache",
  "gros lard",
  "gros tas",
  "tafiole",
  "pede",
  "pédé",
  "pdede",
  "pde",
  // English vulgarities / slurs
  "fuck",
  "fucking",
  "fucker",
  "fuckers",
  "fucked",
  "fucks",
  "shit",
  "shitty",
  "shits",
  "bitch",
  "bitches",
  "asshole",
  "assholes",
  "ass",
  "dick",
  "dicks",
  "dickhead",
  "dickheads",
  "cunt",
  "cunts",
  "pussy",
  "pussies",
  "motherfucker",
  "motherfuckers",
  "motherfucking",
  "bastard",
  "bastards",
  "damn",
  "damned",
  "hell",
  "whore",
  "whores",
  "slut",
  "sluts",
  "retard",
  "retards",
  "retarded",
  "idiot",
  "idiots",
  "stupid",
  "moron",
  "morons",
  "nigga",
  "niggas",
  "nigger",
  "niggers",
  "chink",
  "chinks",
  "fag",
  "fags",
  "faggot",
  "faggots",
  "dyke",
  "dykes",
  "tranny",
  "trannies",
  "kike",
  "kikes",
  "spic",
  "spics",
  "wetback",
  "wetbacks",
  "beaner",
  "beaners",
  "gook",
  "gooks",
  "raghead",
  "ragheads",
  "towelhead",
  "towelheads",
  // Sexual / explicit
  "penis",
  "vagin",
  "vagina",
  "cul",
  "anus",
  "sexual",
  "sexuelle",
  "porn",
  "porno",
  "pornographie",
  "baise",
  "baiser",
  "baises",
  "baisez",
  "suce",
  "sucer",
  "sucette",
  "suceuses",
  "bite",
  "bites",
  "queue",
  "queues",
  "couilles",
  "couille",
  "couillons",
  "couillon",
  "couillonne",
  "bite",
  // Add more words here as needed
];

const SHORT_WORDS = new Set(BAD_WORDS.filter((w) => w.length < 5));
const LONG_WORDS = BAD_WORDS.filter((w) => w.length >= 5);

function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function replaceLeet(str: string): string {
  return str
    .split("")
    .map((char) => (LEET_REPLACEMENTS[char] ? LEET_REPLACEMENTS[char] : char))
    .join("");
}

function normalize(str: string): string {
  return removeDiacritics(str.toLowerCase()).replace(/[^a-z0-9]/g, "");
}

function normalizeForMatch(str: string): string {
  return normalize(replaceLeet(str));
}

function tokenize(text: string): string[] {
  return text
    .split(/[^a-zA-ZÀ-ÖØ-öø-ÿ0-9_]+/)
    .map((token) => normalizeForMatch(token))
    .filter((token) => token.length > 0);
}

/**
 * Returns `isClean: false` and the list of matched bad words if the text
 * contains forbidden language.
 */
export function moderateText(text: string): {
  isClean: boolean;
  flagged: string[];
} {
  if (!text || typeof text !== "string") {
    return { isClean: true, flagged: [] };
  }

  const tokens = tokenize(text);
  const cleaned = normalizeForMatch(text);
  const flagged = new Set<string>();

  for (const word of SHORT_WORDS) {
    if (tokens.some((token) => token === word)) {
      flagged.add(word);
    }
  }

  for (const word of LONG_WORDS) {
    if (cleaned.includes(word)) {
      flagged.add(word);
    }
  }

  return {
    isClean: flagged.size === 0,
    flagged: Array.from(flagged),
  };
}

export const MODERATION_ERROR_MESSAGE =
  "Votre contenu contient des propos inappropriés (insultes, injures, racismes, sexismes, contenu sexuel...). Merci de le modifier avant de le publier.";
