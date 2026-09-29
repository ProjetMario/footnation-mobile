export type ClubField = {
  key: string;
  label: string;
  type?: "text" | "long" | "number" | "boolean" | "date";
  required?: boolean;
  choices?: string[];
};
export type ClubSection = {
  title: string;
  table: string;
  order: string;
  fields: ClubField[];
  readonly?: boolean;
  softDelete?: boolean;
  fffAdminOnly?: boolean;
};
const f = (
  key: string,
  label: string,
  type: ClubField["type"] = "text",
  required = false,
): ClubField => ({ key, label, type, required });
export const clubSections: Record<string, ClubSection> = {
  players: {
    title: "Effectif des joueurs",
    table: "club_players",
    fffAdminOnly: true,
    order: "name",
    softDelete: true,
    fields: [
      f("name", "Nom du joueur", "text", true),
      f("category", "Catégorie", "text", true),
      f("position", "Poste"),
      f("jersey_number", "Numéro de maillot", "number"),
      f("is_active", "Joueur actif", "boolean"),
    ],
  },
  staff: {
    title: "Staff du club",
    table: "club_staff",
    fffAdminOnly: true,
    order: "name",
    softDelete: true,
    fields: [
      f("name", "Nom", "text", true),
      f("role", "Rôle", "text", true),
      f("category", "Catégorie"),
      f("is_active", "Actif", "boolean"),
    ],
  },
  chat: {
    title: "Messagerie interne",
    table: "club_chat_groups",
    order: "updated_at",
    readonly: true,
    fields: [
      f("name", "Groupe"),
      f("group_type", "Type de groupe"),
      f("team_category", "Catégorie"),
      f("updated_at", "Dernière mise à jour", "date"),
    ],
  },
  teams: {
    title: "Équipes",
    table: "teams",
    order: "name",
    fields: [
      f("name", "Nom de l’équipe", "text", true),
      f("category", "Catégorie", "text", true),
      f("age_group", "Tranche d’âge"),
      f("season", "Saison", "text", true),
      f("is_active", "Équipe active", "boolean"),
    ],
  },
  convocations: {
    title: "Convocations",
    table: "club_convocations",
    order: "meeting_date",
    fields: [
      f("title", "Titre", "text", true),
      f("meeting_date", "Rendez-vous", "date", true),
      f("meeting_location", "Lieu du rendez-vous"),
      f("category", "Catégorie"),
      f("description", "Consignes", "long"),
    ],
  },
  matches: {
    title: "Matchs",
    table: "club_matches",
    order: "match_date",
    fields: [
      f("opponent_name", "Adversaire", "text", true),
      f("category", "Catégorie"),
      f("match_date", "Date du match", "date", true),
      f("venue", "Lieu"),
      f("is_home", "À domicile", "boolean"),
      f("competition", "Compétition"),
      f("matchday", "Journée", "number"),
      f("home_score", "Score domicile", "number"),
      f("away_score", "Score extérieur", "number"),
      {
        ...f("status", "Statut"),
        choices: ["scheduled", "live", "finished", "cancelled", "postponed"],
      },
    ],
  },
  palmares: {
    title: "Palmarès",
    table: "club_achievements",
    order: "year",
    fields: [
      f("title", "Titre", "text", true),
      f("competition", "Compétition", "text", true),
      f("year", "Année", "number", true),
      f("category", "Catégorie"),
      f("description", "Description", "long"),
    ],
  },
  news: {
    title: "Actualités du club",
    table: "club_news",
    order: "created_at",
    fields: [
      f("title", "Titre", "text", true),
      f("excerpt", "Résumé", "long"),
      f("content", "Article", "long", true),
      f("is_published", "Publié", "boolean"),
      f("is_pinned", "Épinglé", "boolean"),
    ],
  },
  publications: {
    title: "Publications du club",
    table: "club_publications",
    fffAdminOnly: true,
    order: "created_at",
    fields: [
      f("title", "Titre", "text", true),
      f("content", "Publication", "long", true),
      f("is_published", "Publié", "boolean"),
    ],
  },
  shorts: {
    title: "Shorts du club",
    table: "club_shorts",
    fffAdminOnly: true,
    order: "created_at",
    fields: [
      f("title", "Titre", "text", true),
      f("description", "Description", "long"),
      f("video_url", "Lien de la vidéo", "text", true),
      f("thumbnail_url", "Lien de la couverture"),
      f("is_published", "Publié", "boolean"),
    ],
  },
};
