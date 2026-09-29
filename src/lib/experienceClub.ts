export type ExperienceClubValue = { club: string; club_id?: string };

/** Free text must never continue pointing at a previously selected other club. */
export function editExperienceClubName<T extends ExperienceClubValue>(
  entry: T,
  name: string,
): T {
  return {
    ...entry,
    club: name,
    club_id: name === entry.club ? entry.club_id : undefined,
  };
}

export function selectExperienceClub<T extends ExperienceClubValue>(
  entry: T,
  club: { id: string; name: string },
): T {
  if (!club.id || !club.name.trim())
    throw new Error("Ce club n’est plus disponible.");
  return { ...entry, club: club.name.trim(), club_id: club.id };
}

export function experienceClubPath(
  value: ExperienceClubValue,
): `/club/${string}` | null {
  return value.club_id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.club_id,
    )
    ? `/club/${value.club_id}`
    : null;
}
