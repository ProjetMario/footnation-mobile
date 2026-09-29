import type { Profile } from "./models";
import { supabase } from "./supabase";
import { levelOptions } from "./profileOptions";
export type HighestLevelDraft = {
  level: string;
  club: string;
  category: string;
  year: string;
  clubId?: string;
};
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
export function highestLevelDraft(profile: Profile): HighestLevelDraft {
  const entry = (profile.experience_history || [])
    .map(object)
    .find((row) => row?.is_highest_level === true);
  return {
    level: String(entry?.level || profile.highest_level || ""),
    club: String(entry?.club || ""),
    category: String(entry?.ageCategory || ""),
    year: String(entry?.highest_year || entry?.startYear || ""),
    clubId: typeof entry?.club_id === "string" ? entry.club_id : undefined,
  };
}
export function highestLevelPayload(
  profile: Profile,
  draft: HighestLevelDraft,
) {
  if (
    !levelOptions.includes(draft.level) ||
    !draft.club.trim() ||
    !draft.category.trim() ||
    !/^\d{4}$/.test(draft.year) ||
    +draft.year < 1900 ||
    +draft.year > new Date().getFullYear()
  )
    throw new Error(
      "Renseignez le niveau, le club, la catégorie et une année valide.",
    );
  if (draft.club.trim().length > 200 || draft.category.length > 200)
    throw new Error("Le nom du club ou la catégorie est trop long.");
  if (
    profile.experience_history != null &&
    !Array.isArray(profile.experience_history)
  )
    throw new Error(
      "Le parcours existant doit être vérifié avant modification.",
    );
  const history = [...(profile.experience_history || [])];
  const marked = history.findIndex(
    (value) => object(value)?.highest_level_details === true,
  );
  const same = history.findIndex((value) => {
    const row = object(value);
    return (
      row?.club === draft.club.trim() &&
      row?.level === draft.level &&
      row?.ageCategory === draft.category &&
      String(row?.startYear) === draft.year
    );
  });
  const index = marked >= 0 ? marked : same;
  const previous = index >= 0 ? object(history[index]) : null;
  const entry = {
    ...previous,
    club: draft.club.trim(),
    level: draft.level,
    ageCategory: draft.category,
    position: previous?.position || profile.position || "",
    startYear: previous?.startYear || draft.year,
    endYear: previous?.endYear || draft.year,
    highest_year: draft.year,
    is_highest_level: true,
    ...(same < 0 ? { highest_level_details: true } : {}),
  };
  // This is a profile detail, not a request for club membership or a new projection.
  if (draft.clubId) Object.assign(entry, { club_id: draft.clubId });
  else if (!previous?.native_experience_id)
    delete (entry as Record<string, unknown>).club_id;
  const updated = history.map((value, i) =>
    i === index
      ? entry
      : object(value)?.is_highest_level === true
        ? { ...object(value), is_highest_level: false }
        : value,
  );
  if (index < 0) updated.push(entry);
  if (updated.length > 200)
    throw new Error("Le parcours contient déjà 200 expériences.");
  return { highest_level: draft.level, experience_history: updated };
}
export async function saveHighestLevel(
  profile: Profile,
  draft: HighestLevelDraft,
) {
  const payload = highestLevelPayload(profile, draft);
  const auth = await supabase.auth.getUser();
  if (auth.error || auth.data.user?.id !== profile.id)
    throw new Error("Votre session a changé. Reconnectez-vous.");
  let q = supabase.from("profiles").update(payload).eq("id", profile.id);
  q =
    profile.highest_level == null
      ? q.is("highest_level", null)
      : q.eq("highest_level", profile.highest_level);
  q =
    profile.experience_history == null
      ? q.is("experience_history", null)
      : q.eq("experience_history", JSON.stringify(profile.experience_history));
  const { data, error } = await q.select("*").maybeSingle();
  if (error)
    throw new Error("Enregistrement impossible. Votre saisie est conservée.");
  if (!data)
    throw new Error("Votre parcours a changé. Fermez puis rouvrez l’édition.");
  return data as Profile;
}
export type AchievementDraft = {
  title: string;
  club: string;
  ageCategory: string;
  year: string;
};
export function achievementDraft(value?: unknown): AchievementDraft {
  if (typeof value === "string") {
    try {
      return achievementDraft(JSON.parse(value));
    } catch {
      return { title: value, club: "", ageCategory: "", year: "" };
    }
  }
  const row = object(value);
  return {
    title: String(row?.title || row?.name || ""),
    club: String(row?.club || ""),
    ageCategory: String(row?.ageCategory || row?.category || ""),
    year: String(row?.year || ""),
  };
}
export function updateAchievementList(
  original: unknown[] | null | undefined,
  index: number | null,
  draft: AchievementDraft,
) {
  if (!draft.title.trim())
    throw new Error("Renseignez le titre de cette distinction.");
  if (
    draft.year &&
    (!/^\d{4}$/.test(draft.year) ||
      +draft.year < 1900 ||
      +draft.year > new Date().getFullYear())
  )
    throw new Error("Choisissez une année valide.");
  if (Object.values(draft).some((value) => value.length > 300))
    throw new Error("Cette information est trop longue.");
  const rows = [...(original || [])];
  if (
    index !== null &&
    (!Number.isInteger(index) || index < 0 || index >= rows.length)
  )
    throw new Error("Cette distinction n’est plus disponible.");
  // Text-array storage is shared with the web; its reader also accepts JSON strings.
  const entry = JSON.stringify({
    ...draft,
    title: draft.title.trim(),
    club: draft.club.trim(),
  });
  if (index === null) rows.push(entry);
  else rows[index] = entry;
  if (rows.length > 200) throw new Error("Vous avez atteint 200 distinctions.");
  return rows;
}
export async function saveProfileAchievements(
  profile: Profile,
  key: "achievements" | "individual_awards",
  rows: unknown[],
) {
  const auth = await supabase.auth.getUser();
  if (auth.error || auth.data.user?.id !== profile.id)
    throw new Error("Votre session a changé. Reconnectez-vous.");
  const old = profile[key];
  const run = async (json: boolean) => {
    let q = supabase
      .from("profiles")
      .update({ [key]: rows })
      .eq("id", profile.id);
    q =
      old == null
        ? q.is(key, null)
        : q.eq(
            key,
            json
              ? JSON.stringify(old)
              : `{${old.map((value) => JSON.stringify(typeof value === "string" ? value : JSON.stringify(value))).join(",")}}`,
          );
    return q.select("*").maybeSingle();
  };
  const isJson = !!old?.some((value) => typeof value !== "string");
  let result = await run(isJson);
  // Both historical text[] and JSONB schemas exist. A parse failure cannot write a row.
  if (result.error?.code === "22P02") result = await run(!isJson);
  if (result.error)
    throw new Error("Enregistrement impossible. Votre saisie est conservée.");
  if (!result.data)
    throw new Error("Le palmarès a changé. Fermez puis rouvrez l’édition.");
  return result.data as Profile;
}
