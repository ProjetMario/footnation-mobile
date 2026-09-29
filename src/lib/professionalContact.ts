export type ProfessionalContactKind = "email" | "phone" | "address";
export function professionalContactUrl(
  kind: ProfessionalContactKind,
  value: string,
): string {
  let text = value.trim();
  if (!text) throw new Error("Cette coordonnée n’est pas renseignée.");
  if (kind === "address")
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
  if (/[\u0000-\u001f\u007f]/.test(text))
    throw new Error("Cette coordonnée n’est pas valide.");
  if (kind === "email") {
    if (!/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(text))
      throw new Error("Cette adresse email n’est pas valide.");
    return `mailto:${encodeURIComponent(text)}`;
  }
  if (!/^[+\d\s().-]+$/.test(text))
    throw new Error("Ce numéro de téléphone n’est pas valide.");
  text = text.replace(/^00/, "+");
  if (text.startsWith("+")) text = text.replace(/\(0\)/g, "");
  text = text.replace(/[\s().-]/g, "");
  if (!/^\+?\d{7,15}$/.test(text))
    throw new Error("Ce numéro de téléphone n’est pas valide.");
  return `tel:${text}`;
}
export function publicTalentUrl(profile: {
  id: string;
  slug?: string | null;
}): string {
  return `https://www.foot-nation.com/talent/${encodeURIComponent(profile.slug?.trim() || profile.id)}`;
}

export function publicClubUrl(club: {
  id: string;
  slug?: string | null;
}): string {
  return `https://www.foot-nation.com/club/${encodeURIComponent(club.slug?.trim() || club.id)}`;
}
