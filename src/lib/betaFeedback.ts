export const feedbackCategories = {
  bug: "Un problème",
  friction: "Une difficulté",
  idea: "Une idée",
} as const;
export const feedbackAreas = {
  account: "Connexion et compte",
  feed: "Fil et navigation",
  media: "Photos et vidéos",
  messages: "Messagerie",
  team: "Mon club et mon équipe",
  opportunities: "Opportunités",
  profile: "Profil",
  other: "Autre",
} as const;
export const feedbackStatuses = {
  new: "Nouveaux",
  reviewing: "En cours",
  resolved: "Résolus",
} as const;
export type FeedbackCategory = keyof typeof feedbackCategories;
export type FeedbackArea = keyof typeof feedbackAreas;
export type FeedbackStatus = keyof typeof feedbackStatuses;
export type FeedbackInput = {
  category: FeedbackCategory;
  area: FeedbackArea;
  message: string;
  platform: string;
  appVersion: string;
};
export type BetaFeedback = {
  id: string;
  category: FeedbackCategory;
  area: FeedbackArea;
  message: string;
  platform: string;
  app_version: string;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
};

/** A finite metadata contract: no URLs, identifiers or diagnostic dumps. */
export function normalizeFeedback(input: FeedbackInput): FeedbackInput {
  const message = input.message.trim();
  if (
    !Object.hasOwn(feedbackCategories, input.category) ||
    !Object.hasOwn(feedbackAreas, input.area)
  )
    throw new Error("Choisissez un type de retour et une rubrique.");
  if (Array.from(message).length < 10 || Array.from(message).length > 2000)
    throw new Error("Décrivez votre retour en 10 à 2 000 caractères.");
  if (!["ios", "android", "web"].includes(input.platform))
    throw new Error("Cette plateforme n’est pas prise en charge.");
  if (!/^[A-Za-z0-9.+_-]{1,40}$/.test(input.appVersion))
    throw new Error("La version de l’application est indisponible.");
  return {
    category: input.category,
    area: input.area,
    message,
    platform: input.platform,
    appVersion: input.appVersion,
  };
}
