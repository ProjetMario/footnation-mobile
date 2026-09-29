export function clubMessageText(value: string) {
  const text = value.trim();
  if (!text) throw new Error("Écrivez un message.");
  if (text.length > 4000)
    throw new Error("Le message est trop long (4 000 caractères maximum).");
  return text;
}
