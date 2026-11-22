/** An empty field clears the number; never silently truncate an invalid input. */
export function parseJerseyNumber(value: string): number | null {
  const input = value.trim();
  if (!input) return null;
  if (!/^\d{1,2}$/.test(input) || Number(input) < 1)
    throw new Error("Indiquez un numéro de maillot entier entre 1 et 99.");
  return Number(input);
}

export function visibleJerseyNumber(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 99
    ? value
    : null;
}
