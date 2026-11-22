type FavoriteProfile = {
  id?: unknown;
  city?: unknown;
  favorite_pro_club?: unknown;
  favorite_amateur_club?: unknown;
};

export type FavoriteClubSupportersSuggestion = {
  ownerId: string;
  clubs: string[];
  city?: string;
};

const favoriteKeys = ["favorite_pro_club", "favorite_amateur_club"] as const;
const textValue = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const comparable = (value: unknown) => textValue(value).toLocaleLowerCase("fr");

/** Derive discovery suggestions only from the confirmed save response. */
export function favoriteClubSupportersSuggestion({
  ownerId,
  before,
  saved,
  editedKeys,
}: {
  ownerId: string;
  before: FavoriteProfile | null;
  saved: FavoriteProfile;
  editedKeys: readonly string[];
}): FavoriteClubSupportersSuggestion | null {
  if (
    !ownerId ||
    saved.id !== ownerId ||
    (before?.id != null && before.id !== ownerId)
  )
    return null;

  const clubs: string[] = [];
  for (const key of favoriteKeys) {
    const name = textValue(saved[key]);
    if (
      editedKeys.includes(key) &&
      name &&
      comparable(before?.[key]) !== comparable(name) &&
      !clubs.some((club) => comparable(club) === comparable(name))
    )
      clubs.push(name);
  }
  if (!clubs.length) return null;
  return { ownerId, clubs, city: textValue(saved.city) || undefined };
}
