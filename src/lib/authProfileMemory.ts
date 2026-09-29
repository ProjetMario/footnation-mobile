import type { Profile } from "./models";
import { isSuspended } from "./validation";

export type AuthProfileStatus =
  "unverified" | "ready" | "missing" | "suspended";
export type AuthProfileAccess = {
  status: AuthProfileStatus;
  profile: Profile | null;
};
const unverified: AuthProfileAccess = { status: "unverified", profile: null };

// This memory is intentionally neither persisted nor shared between accounts.
// A new session's missing data must not be mistaken for a confirmed missing profile.
export function createAuthProfileMemory() {
  let userId: string | null | undefined;
  let generation = 0;
  let verified: AuthProfileAccess = unverified;
  return {
    changeAccount(nextId: string | null) {
      const changed = userId !== nextId;
      const clearCache = changed && userId !== undefined;
      if (changed) {
        generation++;
        userId = nextId;
        verified = unverified;
      }
      return { changed, clearCache };
    },
    begin: () => ++generation,
    invalidate: () => {
      generation++;
    },
    isCurrent: (ticket: number) => generation === ticket,
    read(id: string | null | undefined): AuthProfileAccess {
      return id && id === userId ? verified : unverified;
    },
    confirm(ticket: number, id: string, profile: Profile | null) {
      if (generation !== ticket || id !== userId) return null;
      if (profile && profile.id !== id)
        throw new Error("Le profil reçu ne correspond pas à votre session.");
      verified = isSuspended(profile)
        ? { status: "suspended", profile: null }
        : profile
          ? { status: "ready", profile }
          : { status: "missing", profile: null };
      return verified;
    },
  };
}
