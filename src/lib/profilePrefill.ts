/** Recover only editable signup fields; never copy privileges from auth metadata. */
export function profilePrefill(
  profile: Record<string, unknown> | null,
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (profile) return profile;
  const fields = [
    "first_name",
    "last_name",
    "username",
    "birthdate",
    "primary_role",
    "account_type",
    "club_official_name",
    "business_name",
    "institution_name",
  ];
  return Object.fromEntries(
    fields.flatMap((key) =>
      typeof metadata?.[key] === "string" ? [[key, metadata[key]]] : [],
    ),
  );
}
