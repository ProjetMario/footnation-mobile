import { supabase } from "./supabase";
import { isSuspended } from "./validation";
export type ProfileRecommendation = {
  id: string;
  profile_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_role: string | null;
  relationship: string | null;
  content: string;
  is_approved: boolean;
  created_at: string;
};
async function requireAuthor(uid: string) {
  const auth = await supabase.auth.getUser();
  if (auth.error || auth.data.user?.id !== uid)
    throw new Error("Votre session a changé. Reconnectez-vous.");
}
export function recommendationPayload(
  uid: string,
  target: string,
  content: string,
  relationship: string,
) {
  if (!uid || !target || uid === target)
    throw new Error("Choisissez un autre membre à recommander.");
  if (!content.trim() || content.trim().length > 2000)
    throw new Error(
      "Votre recommandation doit contenir entre 1 et 2 000 caractères.",
    );
  if (relationship.trim().length > 120)
    throw new Error("Précisez votre relation en 120 caractères maximum.");
  return {
    profile_id: target,
    author_id: uid,
    content: content.trim(),
    relationship: relationship.trim() || null,
    is_approved: false,
  };
}
export async function loadProfileRecommendations(
  profileId: string,
  uid: string,
  offset = 0,
) {
  const blocks = await supabase
    .from("user_blocks")
    .select("blocker_id,blocked_id")
    .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
  if (blocks.error) throw blocks.error;
  const blocked = (blocks.data || []).map((row) =>
    row.blocker_id === uid ? row.blocked_id : row.blocker_id,
  );
  let q = supabase
    .from("recommendations")
    .select(
      "id,profile_id,author_id,author_name,author_avatar,author_role,relationship,content,is_approved,created_at",
    )
    .eq("profile_id", profileId);
  if (uid !== profileId) q = q.or(`is_approved.eq.true,author_id.eq.${uid}`);
  if (blocked.length) q = q.not("author_id", "in", `(${blocked.join(",")})`);
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .order("id")
    .range(offset, offset + 29);
  if (error) throw error;
  return (data || []) as ProfileRecommendation[];
}
export async function createProfileRecommendation(
  uid: string,
  target: string,
  content: string,
  relationship: string,
) {
  const values = recommendationPayload(uid, target, content, relationship);
  await requireAuthor(uid);
  const [people, blocks] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id,full_name,username,avatar_url,primary_role,is_suspended,suspended_until",
      )
      .in("id", [uid, target]),
    supabase
      .from("user_blocks")
      .select("blocker_id,blocked_id")
      .or(
        `and(blocker_id.eq.${uid},blocked_id.eq.${target}),and(blocker_id.eq.${target},blocked_id.eq.${uid})`,
      ),
  ]);
  if (people.error || blocks.error)
    throw new Error("Impossible de vérifier les profils. Réessayez.");
  const author = people.data?.find((row) => row.id === uid);
  const recipient = people.data?.find((row) => row.id === target);
  if (
    !author ||
    !recipient ||
    isSuspended(author) ||
    isSuspended(recipient) ||
    blocks.data?.length
  )
    throw new Error(
      "Cette recommandation n’est pas disponible pour ce profil.",
    );
  const { data, error } = await supabase
    .from("recommendations")
    .insert({
      ...values,
      author_name: author.full_name || author.username || "Membre FootNation",
      author_avatar: author.avatar_url,
      author_role: author.primary_role,
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(
      "L’envoi n’a pas pu être confirmé. Vérifiez vos recommandations avant de réessayer.",
    );
  return data;
}
export async function moderateProfileRecommendation(
  uid: string,
  row: ProfileRecommendation,
  action: "approve" | "delete",
) {
  await requireAuthor(uid);
  if (
    action === "approve"
      ? row.profile_id !== uid
      : row.profile_id !== uid && row.author_id !== uid
  )
    throw new Error("Cette action n’est pas autorisée.");
  let q =
    action === "approve"
      ? supabase
          .from("recommendations")
          .update({ is_approved: true })
          .eq("profile_id", uid)
      : supabase
          .from("recommendations")
          .delete()
          .or(`profile_id.eq.${uid},author_id.eq.${uid}`);
  const { data, error } = await q.eq("id", row.id).select("id").maybeSingle();
  if (error || !data)
    throw new Error(
      "Cette recommandation n’a pas pu être mise à jour. Rechargez puis réessayez.",
    );
}
