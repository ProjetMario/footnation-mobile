import { supabase } from "./supabase";

type Row = Record<string, unknown>;
export function profileRolesDraft(profile: Row | null) {
  return [
    ...new Set(
      [
        profile?.primary_role,
        ...(Array.isArray(profile?.secondary_roles)
          ? profile.secondary_roles
          : []),
      ]
        .filter(
          (role): role is string => typeof role === "string" && !!role.trim(),
        )
        .map((role) => role.trim()),
    ),
  ].join(", ");
}
export function profileRolesPayload(value: string) {
  const roles = [
    ...new Set(
      value
        .split(",")
        .map((role) => role.trim())
        .filter(Boolean),
    ),
  ];
  return { primary_role: roles[0] || null, secondary_roles: roles.slice(1) };
}

// The existing snapshot RPC does not accept secondary_roles. Save both role
// columns atomically through the same owner-RLS path as inline profile edits.
export async function saveProfileRoles(
  current: Row,
  original: Row,
  value: string,
): Promise<Row> {
  const payload = profileRolesPayload(value);
  if (
    current.primary_role === payload.primary_role &&
    JSON.stringify(current.secondary_roles || []) ===
      JSON.stringify(payload.secondary_roles)
  )
    return current;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.id !== current.id)
    throw new Error(
      "La session a changé. Reconnectez-vous avant d’enregistrer vos rôles.",
    );
  let query = supabase.from("profiles").update(payload).eq("id", data.user.id);
  query =
    original.primary_role == null
      ? query.is("primary_role", null)
      : query.eq("primary_role", original.primary_role);
  query =
    original.secondary_roles == null
      ? query.is("secondary_roles", null)
      : query.eq(
          "secondary_roles",
          `{${(original.secondary_roles as string[]).map((role) => JSON.stringify(role)).join(",")}}`,
        );
  const result = await query.select("*").maybeSingle();
  if (result.error)
    throw new Error(
      "Les autres informations ont été enregistrées, mais pas les rôles. Votre sélection est conservée : réessayez.",
    );
  if (!result.data)
    throw new Error(
      "Vos rôles ont changé entre-temps. Rechargez le formulaire avant de réessayer.",
    );
  return result.data;
}
