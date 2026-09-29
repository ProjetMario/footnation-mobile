// Algorithme de compatibilité intelligent pour le matching

import {
  MatchableItem,
  MatchingProfile,
  MatchingClub,
  ScoringCriteria,
  SCORING_WEIGHTS,
  COMPETITION_LEVELS,
} from "../types/matching";

// Calcule la distance entre deux points GPS (formule de Haversine)
export function calculateDistance(
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined,
): number | null {
  if (
    [lat1, lon1, lat2, lon2].some(
      (value) => value == null || !Number.isFinite(value),
    )
  )
    return null;
  lat1 = lat1!;
  lon1 = lon1!;
  lat2 = lat2!;
  lon2 = lon2!;

  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Score de distance (0-20 points)
export function scoreDistance(
  currentUser: {
    latitude?: number | null;
    longitude?: number | null;
    department?: string | null;
  },
  target: MatchableItem,
): number {
  const distance = calculateDistance(
    currentUser.latitude,
    currentUser.longitude,
    target.location.latitude,
    target.location.longitude,
  );

  // Si on a les coordonnées GPS
  if (distance !== null) {
    if (distance <= 10) return SCORING_WEIGHTS.DISTANCE; // 20 points
    if (distance <= 25) return 18;
    if (distance <= 50) return 15;
    if (distance <= 100) return 10;
    if (distance <= 200) return 5;
    return 0;
  }

  // Fallback sur le département
  if (currentUser.department && target.location.department) {
    if (currentUser.department === target.location.department) {
      return 15; // Même département
    }
    // On pourrait ajouter une logique pour départements voisins
    return 5;
  }

  return 0;
}

// Score de compatibilité poste/besoin (0-25 points)
export function scorePositionMatch(
  currentUser: MatchingProfile,
  target: MatchableItem,
): number {
  // Si le target est un club
  if (target.entity_type === "club") {
    const club = target as MatchingClub;
    if (!club.recruiting_positions || club.recruiting_positions.length === 0) {
      return 5; // Club sans postes spécifiques = match générique
    }

    const userPosition = currentUser.position?.toLowerCase();
    const userRole = currentUser.primary_role?.toLowerCase();

    // Vérifier si le club recherche le poste du joueur
    for (const pos of club.recruiting_positions) {
      if (pos.position?.toLowerCase() === userPosition) {
        return pos.urgent ? SCORING_WEIGHTS.POSITION_MATCH : 22; // 25 ou 22 points
      }
    }

    // Vérifier si le club recherche le rôle (coach, bénévole, etc.)
    if (userRole?.includes("entraîneur") || userRole?.includes("coach")) {
      return 15;
    }
    if (userRole?.includes("bénévole")) {
      return 12;
    }

    return 5; // Pas de match direct mais club qui recrute
  }

  // Si le target est un profil
  const profile = target as MatchingProfile;

  // Même rôle = bon match
  if (currentUser.primary_role === profile.primary_role) {
    return 20;
  }

  // Rôles complémentaires
  const complementaryRoles: Record<string, string[]> = {
    "Joueur amateur": ["Entraîneur", "Bénévole", "Dirigeant"],
    "Joueur pro": ["Agent", "Entraîneur"],
    Entraîneur: ["Joueur amateur", "Joueur pro", "Bénévole"],
    Bénévole: ["Dirigeant", "Entraîneur"],
    Dirigeant: ["Bénévole", "Entraîneur", "Président"],
  };

  const userRole = currentUser.primary_role || "";
  if (complementaryRoles[userRole]?.includes(profile.primary_role || "")) {
    return 18;
  }

  return 8; // Match générique
}

// Score de niveau sportif (0-20 points)
export function scoreLevelMatch(
  currentUser: MatchingProfile,
  target: MatchableItem,
): number {
  const userLevel = currentUser.highest_level;
  let targetLevel: string | null = null;

  if (target.entity_type === "club") {
    targetLevel =
      (target as MatchingClub).competition_level ||
      (target as MatchingClub).division;
  } else {
    targetLevel = (target as MatchingProfile).highest_level;
  }

  if (!userLevel || !targetLevel) return 10; // Score neutre si pas d'info

  const userIndex = COMPETITION_LEVELS.indexOf(userLevel as any);
  const targetIndex = COMPETITION_LEVELS.indexOf(targetLevel as any);

  if (userIndex === -1 || targetIndex === -1) return 10;

  const diff = Math.abs(userIndex - targetIndex);

  if (diff === 0) return SCORING_WEIGHTS.LEVEL_MATCH; // 20 points - même niveau
  if (diff === 1) return 18; // Niveau adjacent
  if (diff === 2) return 15;
  if (diff <= 4) return 10;
  return 5; // Niveaux très différents
}

// Score de disponibilité (0-15 points)
export function scoreAvailability(
  currentUser: MatchingProfile,
  target: MatchableItem,
): number {
  // Pour l'instant, on donne un score basé sur le statut de recrutement pour les clubs
  if (target.entity_type === "club") {
    const club = target as MatchingClub;
    if (club.recruiting_status) {
      return SCORING_WEIGHTS.AVAILABILITY; // 15 points
    }
    return 5;
  }

  // Pour les profils, on pourrait vérifier la disponibilité
  // Pour l'instant, score neutre
  return 10;
}

// Score d'activité sur la plateforme (0-10 points)
export function scoreActivity(target: MatchableItem): number {
  if (target.entity_type === "profile") {
    const profile = target as MatchingProfile;
    const createdAt = new Date(profile.created_at);
    const now = new Date();
    const daysSinceCreation =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    // Profils récents = plus actifs (hypothèse)
    if (daysSinceCreation <= 7) return SCORING_WEIGHTS.ACTIVITY; // 10 points
    if (daysSinceCreation <= 30) return 8;
    if (daysSinceCreation <= 90) return 6;
    return 4;
  }

  // Pour les clubs, on pourrait vérifier la date de dernière mise à jour
  return 7;
}

// Score de profil complété (0-10 points)
export function scoreProfileComplete(target: MatchableItem): number {
  let score = 0;
  const maxScore = SCORING_WEIGHTS.PROFILE_COMPLETE;

  if (target.entity_type === "profile") {
    const profile = target as MatchingProfile;
    if (profile.avatar_url) score += 2;
    if (profile.bio) score += 2;
    if (profile.position) score += 2;
    if (profile.highest_level) score += 2;
    if (profile.location.city || profile.location.department) score += 2;
  } else {
    const club = target as MatchingClub;
    if (club.logo_url || club.avatar_url) score += 2;
    if (club.division || club.competition_level) score += 2;
    if (club.recruiting_positions && club.recruiting_positions.length > 0)
      score += 3;
    if (club.location.city) score += 2;
    if (club.benefits) score += 1;
  }

  return Math.min(score, maxScore);
}

// Score de popularité (0-15 points) - pour les clubs uniquement
export function scorePopularity(target: MatchableItem): number {
  if (target.entity_type !== "club") return 0;

  const club = target as MatchingClub;
  let score = 0;
  const maxScore = SCORING_WEIGHTS.POPULARITY;

  // Bonus pour club vérifié (admin revendiqué)
  if (club.is_verified) {
    score += 5;
  }

  // Score basé sur les followers sur la plateforme
  if (club.followers_count) {
    if (club.followers_count >= 1000) score += 5;
    else if (club.followers_count >= 500) score += 4;
    else if (club.followers_count >= 100) score += 3;
    else if (club.followers_count >= 50) score += 2;
    else if (club.followers_count >= 10) score += 1;
  }

  // Score basé sur les followers réseaux sociaux
  if (club.social_media_followers) {
    const totalSocialFollowers = Object.values(
      club.social_media_followers,
    ).reduce((sum, val) => sum + (val || 0), 0);
    if (totalSocialFollowers >= 100000) score += 5;
    else if (totalSocialFollowers >= 50000) score += 4;
    else if (totalSocialFollowers >= 10000) score += 3;
    else if (totalSocialFollowers >= 1000) score += 2;
    else if (totalSocialFollowers >= 100) score += 1;
  }

  return Math.min(score, maxScore);
}

// Calcul du score total de compatibilité
export function calculateCompatibilityScore(
  currentUser: MatchingProfile,
  target: MatchableItem,
): { score: number; criteria: ScoringCriteria } {
  const criteria: ScoringCriteria = {
    distance: scoreDistance(
      {
        latitude: currentUser.location?.latitude,
        longitude: currentUser.location?.longitude,
        department: currentUser.location?.department,
      },
      target,
    ),
    positionMatch: scorePositionMatch(currentUser, target),
    levelMatch: scoreLevelMatch(currentUser, target),
    availability: scoreAvailability(currentUser, target),
    activity: scoreActivity(target),
    profileComplete: scoreProfileComplete(target),
    popularity: scorePopularity(target),
  };

  const totalScore = Object.values(criteria).reduce((sum, val) => sum + val, 0);

  return {
    score: Math.min(100, totalScore),
    criteria,
  };
}

// Trier les entités par score de compatibilité
export function sortByCompatibility(
  currentUser: MatchingProfile,
  entities: MatchableItem[],
): MatchableItem[] {
  return entities
    .map((entity) => ({
      ...entity,
      compatibility_score: calculateCompatibilityScore(currentUser, entity)
        .score,
    }))
    .sort((a, b) => b.compatibility_score - a.compatibility_score);
}

// Filtrer les entités selon les critères
export function filterEntities(
  entities: MatchableItem[],
  filters: {
    entityType?: "profile" | "club" | "all";
    maxDistance?: number;
    department?: string;
    level?: string;
    position?: string;
    role?: string;
  },
  currentUserLocation?: { latitude?: number | null; longitude?: number | null },
): MatchableItem[] {
  return entities.filter((entity) => {
    // Filtre par type d'entité
    if (filters.entityType && filters.entityType !== "all") {
      if (entity.entity_type !== filters.entityType) return false;
    }

    // Filtre par département
    if (filters.department) {
      if (entity.location.department !== filters.department) return false;
    }

    // Filtre par distance
    if (
      filters.maxDistance &&
      currentUserLocation?.latitude &&
      currentUserLocation?.longitude
    ) {
      const distance = calculateDistance(
        currentUserLocation.latitude,
        currentUserLocation.longitude,
        entity.location.latitude,
        entity.location.longitude,
      );
      if (distance !== null && distance > filters.maxDistance) return false;
    }

    // Filtre par niveau
    if (filters.level) {
      if (entity.entity_type === "club") {
        const club = entity as MatchingClub;
        if (
          club.competition_level !== filters.level &&
          club.division !== filters.level
        ) {
          return false;
        }
      } else {
        const profile = entity as MatchingProfile;
        if (profile.highest_level !== filters.level) return false;
      }
    }

    // Filtre par rôle (pour les profils)
    if (filters.role && entity.entity_type === "profile") {
      const profile = entity as MatchingProfile;
      if (profile.primary_role !== filters.role) return false;
    }

    // Filtre par position
    if (filters.position) {
      if (entity.entity_type === "profile") {
        const profile = entity as MatchingProfile;
        if (profile.position !== filters.position) return false;
      } else {
        const club = entity as MatchingClub;
        const hasPosition = club.recruiting_positions?.some(
          (p) => p.position === filters.position,
        );
        if (!hasPosition) return false;
      }
    }

    return true;
  });
}
