export function teamInvitationMaxUses(raw: string) {
  const value = raw.trim();
  const count = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 200
  )
    throw new Error(
      "Le nombre d’utilisations doit être un entier entre 1 et 200.",
    );
  return count;
}
