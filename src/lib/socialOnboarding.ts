import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { authCallbackPath, authReturnPath } from "./authReturn";
import { normalizeReferral } from "./referral";
import { declaredAge, parseMemberAccess } from "./memberAccess";
import { roleOptions } from "./networkOptions";

export const postAuthDestination = "/shorts?mode=all";

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

export function selectedSignupRoles(role: string) {
  return role
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

type RpcError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type RpcResult<T> = {
  data: T | null;
  error: RpcError | null;
};

function legacySignupFallback(error: RpcError | null, rpcName: string) {
  if (!error) return false;
  const text = `${error.code || ""} ${error.message || ""} ${error.details || ""} ${error.hint || ""}`;
  return (
    error.code === "42883" ||
    error.code === "PGRST202" ||
    error.code === "42501" ||
    /404|403|forbidden|not found|could not find|function not found|schema cache|MEMBER_AGE_ACCESS_REQUIRED/i.test(
      text,
    ) ||
    new RegExp(rpcName, "i").test(text)
  );
}

function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs = 15000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            "La vérification du profil prend trop de temps. Réessayez ou reconnectez-vous.",
          ),
        ),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function socialSignupPath(next?: unknown, referral?: unknown) {
  const params = new URLSearchParams();
  const destination = authReturnPath(next);
  const reference = normalizeReferral(referral);
  if (destination) params.set("next", destination);
  if (reference) params.set("ref", reference);
  const query = params.toString();
  return `/onboarding${query ? `?${query}` : ""}`;
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
  let result = (await withTimeout(
    supabase
      .rpc("get_signup_status")
      .setHeader("Authorization", `Bearer ${session.access_token}`),
  )) as RpcResult<Record<string, unknown>>;
  if (legacySignupFallback(result.error, "get_signup_status")) {
    result = (await withTimeout(
      supabase
        .rpc("get_social_signup_status")
        .setHeader("Authorization", `Bearer ${session.access_token}`),
    )) as RpcResult<Record<string, unknown>>;
  }
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
  const fullName = typeof data.full_name === "string" ? data.full_name : "";
  const username = typeof data.username === "string" ? data.username : "";
  const birthdate = typeof data.birthdate === "string" ? data.birthdate : "";
  const accountType =
    typeof data.account_type === "string" ? data.account_type : "personal";
  const primaryRole =
    typeof data.primary_role === "string" ? data.primary_role : "";
  const accountTypes: SocialSignupValues["accountType"][] = [
    "personal",
    "club",
    "business",
    "institution",
  ];
  const hasProfileIdentity =
    !!username.trim() && declaredAge(birthdate) !== null;
  return {
    required: data.required === true || !hasProfileIdentity,
    fullName: fullName.slice(0, 120),
    username,
    birthdate: declaredAge(birthdate) !== null ? birthdate : "",
    accountType: accountTypes.includes(
      accountType as SocialSignupValues["accountType"],
    )
      ? (accountType as SocialSignupValues["accountType"])
      : "personal",
    role: roleOptions.some((option) => option.value === primaryRole)
      ? primaryRole
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
  const next = authReturnPath(context.next);
  if (next === "/suppression-compte") {
    await currentSession(session.user.id);
    return "/suppression-compte";
  }
  const status = await getSocialSignupStatus(session.user.id);
  const reference = normalizeReferral(context.referral);
  if (status.required) {
    return socialSignupPath(next, reference);
  }
  return next || postAuthDestination;
}

export async function postSocialCallbackRoute(
  session: Session,
  context: {
    next?: string | null;
    referral?: string | null;
    recovery?: boolean;
  },
): Promise<{ route: string; inviteNetwork: boolean }> {
  const destination = authReturnPath(context.next);
  if (context.recovery || destination === "/suppression-compte")
    return {
      route: authCallbackPath(!!context.recovery, false, destination),
      inviteNetwork: false,
    };
  const status = await getSocialSignupStatus(session.user.id);
  if (status.required)
    return {
      route: socialSignupPath(destination, context.referral),
      inviteNetwork: false,
    };
  return {
    route: destination || postAuthDestination,
    inviteNetwork: !destination?.startsWith("/admin/user/"),
  };
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
  if (values.accountType === "personal") {
    const roles = selectedSignupRoles(values.role);
    if (
      !roles.length ||
      roles.some((role) => !roleOptions.some((option) => option.value === role))
    )
      return "Choisissez au moins un rôle dans le football.";
  }
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
  let result = (await supabase
    .rpc("complete_signup", {
      p_full_name: values.fullName.trim(),
      p_username: values.username,
      p_birthdate: values.birthdate,
      p_account_type: values.accountType,
      p_primary_role:
        values.accountType === "personal"
          ? selectedSignupRoles(values.role)[0] || values.role
          : values.role,
      p_terms_version: "1.0",
      p_referral: normalizeReferral(referral),
    })
    .setHeader(
      "Authorization",
      `Bearer ${session.access_token}`,
    )) as RpcResult<unknown>;
  if (legacySignupFallback(result.error, "complete_signup")) {
    result = (await supabase
      .rpc("complete_social_signup", {
        p_full_name: values.fullName.trim(),
        p_username: values.username,
        p_birthdate: values.birthdate,
        p_account_type: values.accountType,
        p_primary_role:
          values.accountType === "personal"
            ? selectedSignupRoles(values.role)[0] || values.role
            : values.role,
        p_terms_version: "1.0",
        p_referral: normalizeReferral(referral),
      })
      .setHeader(
        "Authorization",
        `Bearer ${session.access_token}`,
      )) as RpcResult<unknown>;
  }
  await currentSession(userId);
  if (result.error) {
    if (result.error.code === "23505")
      throw new Error("Ce pseudo est déjà utilisé. Choisissez-en un autre.");
    if (legacySignupFallback(result.error, "complete_social_signup")) {
      throw new Error(
        "La finalisation de l’inscription est temporairement indisponible côté serveur. Vos renseignements sont conservés. Réessayez après la mise à jour du service.",
      );
    }
    throw new Error(
      "Le profil n’a pas pu être finalisé. Vérifiez les champs et réessayez.",
    );
  }
  const access = parseMemberAccess(result.data);
  return access;
}
