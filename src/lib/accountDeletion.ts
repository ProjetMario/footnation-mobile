import { requireBackend, supabase } from "./supabase";
import { randomUUID } from "expo-crypto";
import storage from "./sessionStorage";
import {
  createAccountDeletionJournal,
  type AccountDeletionReceipt,
} from "./accountDeletionJournal";

const journal = createAccountDeletionJournal(
  storage,
  randomUUID,
  Date.now,
  (operation) => storage.runExclusive("account-deletion-journal", operation),
);
export const listAccountDeletionReceipts = journal.list;

export type DeletionInspection = {
  ready: true;
  subscriptionCount: number;
  checkoutCount: number;
  recentlyAuthenticated: boolean;
};
const messages: Record<string, string> = {
  unavailable:
    "La suppression automatique n’est pas encore activée. Vous pouvez contacter l’équipe depuis cet écran.",
  invalid_request:
    "La confirmation est incomplète. Saisissez exactement SUPPRIMER.",
  authentication_required: "Reconnectez-vous à ce compte avant de continuer.",
  reauthentication_required:
    "Pour votre sécurité, reconnectez-vous puis confirmez à nouveau dans les cinq minutes.",
  in_progress:
    "Une opération de compte ou de paiement est déjà en cours. Patientez puis vérifiez à nouveau.",
  lease_expired:
    "La vérification a expiré. Vérifiez votre compte puis réessayez.",
  schema_not_ready:
    "Le compte nécessite une vérification par l’équipe avant sa suppression. Aucune suppression du compte n’a été confirmée.",
  billing_unavailable:
    "La facturation n’a pas pu être vérifiée. Le compte est conservé. Réessayez ou contactez l’équipe.",
  billing_ownership_required:
    "Un abonnement doit être vérifié par l’équipe avant de supprimer le compte. Contactez-nous pour éviter de futurs prélèvements.",
  shared_ownership:
    "La protection des espaces partagés n’est pas encore disponible sur ce serveur. Votre compte est conservé. Réessayez après la mise à jour du service.",
  media_cleanup_incomplete:
    "Le nettoyage des médias n’est pas terminé. Certains fichiers peuvent déjà avoir été retirés. Réessayez pour terminer la suppression.",
  deletion_failed:
    "La suppression n’a pas pu être confirmée. Certains médias ou abonnements peuvent déjà avoir été traités. Réessayez avec cet écran ou contactez l’équipe.",
  apple_revocation_unavailable:
    "La déconnexion auprès d’Apple n’a pas pu être confirmée. Réessayez pour terminer la suppression.",
};
export function deletionErrorMessage(code: unknown): string {
  return typeof code === "string" &&
    Object.prototype.hasOwnProperty.call(messages, code)
    ? messages[code]
    : messages.deletion_failed;
}

async function invokeDeletion(userId: string, body: Record<string, unknown>) {
  requireBackend();
  const current = await supabase.auth.getSession();
  if (current.error || current.data.session?.user.id !== userId)
    throw new Error(
      "La session a changé. Reconnectez-vous au compte concerné.",
    );
  // Pin the verified screen's session snapshot. functions.invoke otherwise uses
  // whichever account is current when its async fetch eventually starts.
  return invokeWithToken(current.data.session.access_token, body);
}
async function invokeWithToken(token: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("account-deletion", {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) {
    let code: unknown;
    try {
      const context = "context" in error ? error.context : undefined;
      if (context instanceof Response) code = (await context.json()).code;
    } catch {
      /* Never expose raw server responses or account information. */
    }
    throw new Error(deletionErrorMessage(code));
  }
  return data;
}
export async function inspectAccountDeletion(
  userId: string,
): Promise<DeletionInspection> {
  const data = await invokeDeletion(userId, { action: "inspect" });
  if (
    data?.ready !== true ||
    !Number.isInteger(data.subscriptionCount) ||
    data.subscriptionCount < 0 ||
    !Number.isInteger(data.checkoutCount) ||
    data.checkoutCount < 0 ||
    typeof data.recentlyAuthenticated !== "boolean"
  )
    throw new Error(deletionErrorMessage("deletion_failed"));
  return data;
}
export async function deleteOwnAccount(
  userId: string,
  confirmation: string,
): Promise<AccountDeletionReceipt> {
  if (confirmation !== "SUPPRIMER")
    throw new Error(deletionErrorMessage("invalid_request"));
  // Persist before the first destructive request. A restart can only CHECK the
  // receipt automatically; retrying deletion still requires explicit consent.
  const receipt = await journal.prepare(userId);
  const data = await invokeDeletion(userId, {
    action: "delete",
    operationId: receipt.operationId,
    confirmation,
  });
  if (
    data?.deleted !== true ||
    (data.appleRevocationRequired !== undefined &&
      typeof data.appleRevocationRequired !== "boolean")
  )
    throw new Error(deletionErrorMessage("deletion_failed"));
  const appleRevocationRequired =
    data.appleRevocationRequired === true ||
    receipt.appleRevocationRequired === true;
  await journal.complete(receipt.operationId, appleRevocationRequired);
  return { ...receipt, completed: true, appleRevocationRequired };
}

export async function checkAccountDeletionReceipt(
  receipt: AccountDeletionReceipt,
): Promise<boolean> {
  requireBackend();
  // This action never performs deletion and never uses another account's JWT.
  const data = await invokeWithToken("receipt-check", {
    action: "status",
    operationId: receipt.operationId,
  });
  if (
    typeof data?.deleted !== "boolean" ||
    (data.appleRevocationRequired !== undefined &&
      typeof data.appleRevocationRequired !== "boolean")
  )
    throw new Error(deletionErrorMessage("deletion_failed"));
  if (data.deleted)
    await journal.complete(
      receipt.operationId,
      data.appleRevocationRequired === true,
    );
  return data.deleted;
}
