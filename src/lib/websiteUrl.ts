export function websiteUrl(value: string): string {
  const raw = value.trim();
  if (!raw || /[\s\u0000-\u001f]/.test(raw))
    throw new Error("Vérifiez l’adresse du site internet.");
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(candidate);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !url.hostname.includes(".")
  )
    throw new Error("Indiquez un site internet public en http ou https.");
  return url.toString();
}
