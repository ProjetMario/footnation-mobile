/** Shared lexical rules for comments. Short words require whole-word boundaries. */
const forbiddenWords = [
  "bordel",
  "salaud",
  "salauds",
  "idiotes",
  "imbeciles",
  "debiles",
  "abrutie",
  "abruties",
  "petasses",
  "pouffiasses",
  "putains",
  "merdes",
  "enculees",
  "batardes",
  "pede",
  "pedes",
  "ta gueule",
  "fuckers",
  "fucked",
  "fucks",
  "shitty",
  "shits",
  "assholes",
  "cunts",
  "dickheads",
  "bastards",
  "motherfuckers",
  "motherfucking",
  "whore",
  "whores",
  "slut",
  "sluts",
  "idiot",
  "idiote",
  "idiots",
  "imbecile",
  "debile",
  "abruti",
  "abrutis",
  "tocard",
  "tocards",
  "petasse",
  "pouffiasse",
  "con",
  "conne",
  "cons",
  "connes",
  "connard",
  "connards",
  "connasse",
  "connasses",
  "connerie",
  "conneries",
  "merde",
  "merdique",
  "putain",
  "pute",
  "putes",
  "salope",
  "salopes",
  "salopard",
  "salopards",
  "encule",
  "encules",
  "enculee",
  "enculer",
  "batard",
  "batards",
  "batarde",
  "fdp",
  "ntm",
  "nique",
  "niquer",
  "niquetamere",
  "ta gueule",
  "ferme ta gueule",
  "va te faire foutre",
  "trou du cul",
  "trouduc",
  "couille",
  "couilles",
  "bite",
  "bites",
  "chier",
  "fuck",
  "fucking",
  "fucker",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "bitches",
  "asshole",
  "cunt",
  "dickhead",
  "bastard",
  "nigger",
  "niggers",
  "nigga",
  "faggot",
  "faggots",
  "bougnoule",
  "bougnoules",
  "bamboula",
  "chinetoque",
  "je vais te tuer",
  "i will kill you",
] as const;
const normalized = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(
      /[01345789@$]/g,
      (char) =>
        ({
          "0": "o",
          "1": "i",
          "3": "e",
          "4": "a",
          "5": "s",
          "7": "t",
          "8": "b",
          "9": "g",
          "@": "a",
          $: "s",
        })[char]!,
    );
const pattern = new RegExp(
  `(^|[^a-z])(${forbiddenWords
    .map((word) =>
      word.length <= 3
        ? word
        : word.replaceAll(" ", "").split("").join("[^a-z]*"),
    )
    .join("|")})([^a-z]|$)`,
);
export const COMMENT_MODERATION_MESSAGE =
  "Les insultes et les mots grossiers ne sont pas autorisés. Reformulez votre commentaire.";
export function commentTextRejected(content: string): boolean {
  return pattern.test(normalized(content));
}

/** Map both the local check and database trigger to the same safe feedback. */
export function isCommentModerationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const failure = error as { code?: string; hint?: string; message?: string };
  return (
    failure.message === COMMENT_MODERATION_MESSAGE ||
    (failure.code === "22023" &&
      (failure.hint === "COMMENT_MODERATION" ||
        failure.message?.includes("expression interdite") === true))
  );
}
