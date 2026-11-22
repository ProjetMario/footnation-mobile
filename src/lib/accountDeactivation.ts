import { requireBackend, supabase } from "./supabase";

export const deactivationDurations = [7, 30, 180] as const;
export type DeactivationDuration = (typeof deactivationDurations)[number];

export async function deactivateOwnAccount(
  userId: string,
  durationDays: DeactivationDuration,
) {
  if (!deactivationDurations.includes(durationDays))
    throw new Error("Choisissez une durée de 7, 30 ou 180 jours.");
  requireBackend();
  const current = await supabase.auth.getSession();
  if (
    current.error ||
    !current.data.session ||
    current.data.session.user.id !== userId
  )
    throw new Error(
      "La session a changé. Reconnectez-vous au compte concerné.",
    );
  const { data, error } = await supabase.functions.invoke(
    "account/deactivate",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${current.data.session.access_token}` },
      body: { durationDays },
    },
  );
  if (
    error ||
    !data?.deactivatedUntil ||
    !Number.isFinite(Date.parse(data.deactivatedUntil))
  )
    throw new Error(
      "La désactivation n’a pas pu être confirmée. Vérifiez votre connexion ou contactez l’équipe avant de réessayer.",
    );
  return data.deactivatedUntil as string;
}
