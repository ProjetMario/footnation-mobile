import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { authCallbackPath, authReturnPath } from "./authReturn";
import { normalizeReferral } from "./referral";
import { declaredAge, parseMemberAccess } from "./memberAccess";
import { roleOptions } from "./networkOptions";

export type SocialSignupStatus = {
  required: boolean;
  fullName: string;
  username: string;
  birthdate: string;
  accountType: SocialSignupValues["accountType"];
  role: string;
};
export type SocialSignupValues = {
  fullName: string;
  username: string;
  birthdate: string;
  accountType: "personal" | "club" | "business" | "institution";
  role: string;
  acceptedTerms: boolean;
};

export function socialSignupPath(next?: unknown, referral?: unknown) {
  const params = new URLSearchParams();
  const destination = authReturnPath(next);
  const reference = normalizeReferral(referral);
  if (destination) params.set("next", destination);
  if (reference) params.set("ref", reference);
  const query = params.toString();
  return `/social-signup${query ? `?${query}` : ""}`;
}

async function currentSession(userId: string) {
  const result = await supabase.auth.getSession();
  if (result.error || result.data.session?.user.id !== userId)
    throw new Error("La session a changé. Reconnectez-vous.");
  return result.data.session;
}

export async function getSocialSignupStatus(
  userId: string,
): Promise<SocialSignupStatus> {
  const session = await currentSession(userId);
  const result = await supabase
    .rpc("get_social_signup_status")
    .setHeader("Authorization", `Bearer ${session.access_token}`);
  await currentSession(userId);
  if (
    result.error ||
    typeof result.data?.required !== "boolean" ||
    typeof result.data?.full_name !== "string"
  )
    throw new Error(
      "La vérification du profil est indisponible. Réessayez dans un instant.",
    );
  const data = result.data;
  return {
    required: data.required,
    fullName: data.full_name.slice(0, 120),
    username: typeof data.username === "string" ? data.username : "",
    birthdate:
      typeof data.birthdate === "string" && declaredAge(data.birthdate) !== null
        ? data.birthdate
        : "",
    accountType: ["personal", "club", "business", "institution"].includes(
      data.account_type,
    )
      ? data.account_type
      : "personal",
    role: roleOptions.some((option) => option.value === data.primary_role)
      ? data.primary_role
      : "",
  };
}

export async function finishSocialAuth(
  session: Session,
  context: {
    next?: string | null;
    referral?: string | null;
    provider: "google" | "apple";
  },
) {
  if (authReturnPath(context.next) === "/suppression-compte") {
    await currentSession(session.user.id);
    return "/suppression-compte";
  }
  const status = await getSocialSignupStatus(session.user.id);
  const reference = normalizeReferral(context.referral);
  if (status.required) {
    return socialSignupPath(context.next, reference);
  }
  return authCallbackPath(false, false, context.next);
}

export function socialSignupError(values: SocialSignupValues): string | null {
  if (
    values.fullName.trim().length < 2 ||
    values.fullName.trim().length > 120 ||
    /[\u0000-\u001f\u007f]/.test(values.fullName)
  )
    return "Indiquez un nom de 2 à 120 caractères.";
  if (!/^[a-z0-9_]{3,30}$/.test(values.username))
    return "Le pseudo doit contenir 3 à 30 lettres minuscules, chiffres ou tirets bas.";
  if (declaredAge(values.birthdate) === null)
    return "Indiquez votre date de naissance.";
  if (
    !["personal", "club", "business", "institution"].includes(
      values.accountType,
    )
  )
    return "Choisissez le type de profil.";
  if (
    values.accountType === "personal" &&
    !roleOptions.some((option) => option.value === values.role)
  )
    return "Choisissez votre rôle dans le football.";
  if (!values.acceptedTerms)
    return "Acceptez les conditions d’utilisation pour continuer.";
  return null;
}

export async function completeSocialSignup(
  userId: string,
  values: SocialSignupValues,
  referral?: unknown,
) {
  const validation = socialSignupError(values);
  if (validation) throw new Error(validation);
  const session = await currentSession(userId);
  const result = await supabase
    .rpc("complete_social_signup", {
      p_full_name: values.fullName.trim(),
      p_username: values.username,
      p_birthdate: values.birthdate,
      p_account_type: values.accountType,
      p_primary_role: values.role,
      p_terms_version: "1.0",
      p_referral: normalizeReferral(referral),
    })
    .setHeader("Authorization", `Bearer ${session.access_token}`);
  await currentSession(userId);
  if (result.error)
    throw new Error(
      result.error.code === "23505"
        ? "Ce pseudo est déjà utilisé. Choisissez-en un autre."
        : "Le profil n’a pas pu être finalisé. Vérifiez les champs et réessayez.",
    );
  return parseMemberAccess(result.data);
}
