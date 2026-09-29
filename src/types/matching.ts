// Types pour le système de matching intelligent

export type EntityType = "profile" | "club";

export type SwipeDirection = "left" | "right" | "super";

// Rôles pour le matching
export type MatchingRole =
  "joueur" | "coach" | "benevole" | "club" | "entreprise";

// Interface de base pour les entités matchables
export interface MatchableEntity {
  id: string;
  entity_type: EntityType;
  name: string;
  avatar_url: string | null;
  location: {
    city: string | null;
    department: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  compatibility_score: number;
}

// Profil utilisateur pour le matching
export interface MatchingProfile extends MatchableEntity {
  entity_type: "profile";
  full_name: string | null;
  primary_role: string | null;
  secondary_roles?: string[] | null;
  position: string | null;
  highest_level: string | null;
  bio: string | null;
  birthdate: string | null;
  availability?: string | null;
  is_premium: boolean | null;
  is_online?: boolean;
  created_at: string;
  // Joueur spécifique
  strong_foot?: string | null;
  // Coach spécifique
  licenses?: string[] | null;
  experience_years?: number | null;
}

// Club pour le matching
export interface MatchingClub extends MatchableEntity {
  entity_type: "club";
  division: string | null;
  competition_level: string | null;
  recruiting_status: boolean | null;
  recruiting_positions: RecruitingPosition[] | null;
  age_category: string[] | null;
  logo_url: string | null;
  stadium_name: string | null;
  youth_academy: boolean | null;
  women_team: boolean | null;
  project_description?: string | null;
  benefits?: ClubBenefits | null;
  // Popularité et vérification
  followers_count?: number | null;
  social_media_followers?: Record<string, number> | null;
  is_verified?: boolean | null;
}

// Poste recherché par un club
export interface RecruitingPosition {
  position: string;
  level: string;
  age_category?: string;
  urgent?: boolean;
  description?: string;
}

// Avantages proposés par un club
export interface ClubBenefits {
  salary_range?: { min: number; max: number };
  equipment?: boolean;
  transport?: boolean;
  housing?: boolean;
  other?: string[];
}

// Union type pour toutes les entités matchables
export type MatchableItem = MatchingProfile | MatchingClub;

// Filtres de matching
export interface MatchFilters {
  profileGroup?: "players" | "agents";
  entityType?: EntityType | "all";
  role?: string;
  level?: string;
  department?: string;
  position?: string;
  ageCategory?: string;
  availability?: string;
  maxDistance?: number;
  recruitingOnly?: boolean;
}

// Résultat d'un swipe
export interface SwipeResult {
  isMatch: boolean;
  matchId?: string;
  matchedEntity?: MatchableItem;
}

// Match créé
export interface MatchRecord {
  id: string;
  user1_id: string;
  user1_type: EntityType;
  user2_id: string;
  user2_type: EntityType;
  compatibility_score: number;
  status: "active" | "archived" | "blocked";
  created_at: string;
  other_entity?: MatchableItem;
}

// Critères de scoring pour l'algorithme
export interface ScoringCriteria {
  distance: number; // 0-20 points
  positionMatch: number; // 0-25 points
  levelMatch: number; // 0-20 points
  availability: number; // 0-15 points
  activity: number; // 0-10 points
  profileComplete: number; // 0-10 points
  popularity: number; // 0-15 points (nouveau)
}

// Configuration de l'algorithme de matching
export const SCORING_WEIGHTS = {
  DISTANCE: 20,
  POSITION_MATCH: 25,
  LEVEL_MATCH: 20,
  AVAILABILITY: 15,
  ACTIVITY: 10,
  PROFILE_COMPLETE: 10,
  POPULARITY: 15, // Nouveau poids pour la popularité
} as const;

// Niveaux de compétition ordonnés (du plus haut au plus bas)
export const COMPETITION_LEVELS = [
  "Ligue 1",
  "Ligue 2",
  "National",
  "National 2",
  "National 3",
  "Régional 1",
  "Régional 2",
  "Régional 3",
  "Départemental 1",
  "Départemental 2",
  "Départemental 3",
  "Départemental 4",
  "Départemental 5",
  "Futsal / Loisirs",
] as const;

// Catégories d'âge
export const AGE_CATEGORIES = [
  "Senior",
  "U19",
  "U17",
  "U15",
  "U13",
  "U11",
  "U9",
  "U7",
] as const;

// Positions de football
export const FOOTBALL_POSITIONS = [
  "Gardien",
  "Défenseur central",
  "Latéral droit",
  "Latéral gauche",
  "Milieu défensif",
  "Milieu central",
  "Milieu offensif",
  "Ailier droit",
  "Ailier gauche",
  "Attaquant",
  "Avant-centre",
] as const;
