// A missing optional RPC is a deployment capability, not a per-profile error.
// Back off briefly instead of issuing the same 404 on every poll. Permission,
// session and network failures must still reach the caller.
const unavailableUntil = new Map<string, number>();
const MISSING_RPC_BACKOFF_MS = 5 * 60_000;

export class MissingOptionalRpc extends Error {
  readonly code = "PGRST202";
  constructor() {
    super("Fonction temporairement indisponible sur ce serveur.");
  }
}

export async function optionalRpc<T>(
  name: string,
  request: () => PromiseLike<T>,
): Promise<T> {
  if ((unavailableUntil.get(name) || 0) > Date.now())
    throw new MissingOptionalRpc();
  try {
    const result = await request();
    unavailableUntil.delete(name);
    return result;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "PGRST202" || code === "42883")
      unavailableUntil.set(name, Date.now() + MISSING_RPC_BACKOFF_MS);
    throw error;
  }
}
