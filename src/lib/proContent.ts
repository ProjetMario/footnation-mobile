export type ProField = {
  key: string;
  label: string;
  kind?: "long" | "number" | "boolean" | "date" | "urls";
  required?: boolean;
  defaultValue?: string | boolean;
  options?: [string, string][];
};
const f = (
  key: string,
  label: string,
  kind?: ProField["kind"],
  required = false,
): ProField => ({ key, label, kind, required });
export const proContent: Record<
  string,
  { table: string; title: string; fields: ProField[] }
> = {
  posts: {
    table: "pro_page_posts",
    title: "Publication",
    fields: [
      f("content", "Texte", "long", true),
      f("media_urls", "Liens des médias, un par ligne", "urls"),
      {
        ...f("type", "Type"),
        options: [
          ["post", "Publication"],
          ["announcement", "Annonce"],
          ["event", "Événement"],
          ["match_result", "Résultat"],
        ],
      },
      { ...f("published", "Publié", "boolean"), defaultValue: true },
      f("pinned", "Épinglé", "boolean"),
      f("event_date", "Date de l’événement", "date"),
      f("event_location", "Lieu"),
    ],
  },
  teams: {
    table: "pro_page_teams",
    title: "Équipe",
    fields: [
      f("name", "Nom", undefined, true),
      f("category", "Catégorie"),
      f("season", "Saison"),
      f("coach_name", "Entraîneur"),
      f("coach_email", "Email de l’entraîneur"),
      f("coach_phone", "Téléphone de l’entraîneur"),
      f("logo_url", "Lien du logo"),
      f("description", "Description", "long"),
    ],
  },
  matches: {
    table: "pro_page_matches",
    title: "Match",
    fields: [
      f("opponent", "Adversaire", undefined, true),
      f("opponent_logo_url", "Logo de l’adversaire"),
      { ...f("is_home", "À domicile", "boolean"), defaultValue: true },
      f("match_date", "Date", "date", true),
      f("location", "Lieu"),
      f("competition", "Compétition"),
      f("round", "Tour / journée"),
      f("score_home", "Score domicile", "number"),
      f("score_away", "Score extérieur", "number"),
      {
        ...f("status", "Statut"),
        options: [
          ["upcoming", "À venir"],
          ["live", "En cours"],
          ["finished", "Terminé"],
          ["cancelled", "Annulé"],
          ["postponed", "Reporté"],
        ],
      },
      f("notes", "Notes", "long"),
      f("stream_url", "Lien de diffusion"),
      f("video_highlight_url", "Lien du résumé"),
    ],
  },
  media: {
    table: "pro_page_media",
    title: "Média",
    fields: [
      f("url", "Lien du média", undefined, true),
      f("thumbnail_url", "Lien de la miniature"),
      {
        ...f("type", "Format"),
        options: [
          ["photo", "Photo"],
          ["video", "Vidéo"],
        ],
      },
      f("title", "Titre"),
      f("description", "Description", "long"),
      f("album", "Album"),
      f("is_featured", "À la une", "boolean"),
    ],
  },
  players: {
    table: "pro_page_team_players",
    title: "Joueur / staff",
    fields: [
      f("name", "Nom", undefined, true),
      f("number", "Numéro", "number"),
      f("position", "Poste"),
      f("photo_url", "Lien de la photo"),
      f("birthdate", "Date de naissance (AAAA-MM-JJ)"),
      f("nationality", "Nationalité"),
      f("is_staff", "Membre du staff", "boolean"),
      f("staff_role", "Rôle du staff"),
    ],
  },
};
