export function normalizeReferral(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed,
    )
  )
    return trimmed.toLowerCase();
  return /^[a-z0-9]{6}$/i.test(trimmed) ? trimmed.toUpperCase() : null;
}
export type ReferralRepository = {
  current: (userId: string) => Promise<string | null>;
  resolve: (reference: string) => Promise<string | null>;
  assignIfEmpty: (userId: string, referrerId: string) => Promise<boolean>;
};
export async function applyReferral(
  repository: ReferralRepository,
  userId: string,
  raw: unknown,
) {
  const reference = normalizeReferral(raw);
  if (!reference) return "invalid" as const;
  if (await repository.current(userId)) return "already-assigned" as const;
  const referrer = await repository.resolve(reference);
  if (!referrer || referrer === userId) return "invalid" as const;
  return (await repository.assignIfEmpty(userId, referrer))
    ? ("assigned" as const)
    : ("already-assigned" as const);
}
