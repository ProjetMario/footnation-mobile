import type { KeyValueStore } from "./chunkedStorage";
import {
  SocialAuthError,
  socialProvider,
  type SocialProvider,
} from "./socialAuthPolicy";

const key = "footnation-social-auth-attempt";
const maxAge = 10 * 60 * 1000;
type Attempt = {
  id: string;
  provider: SocialProvider;
  userId: string | null;
  createdAt: number;
};

/** One pending PKCE flow per local session, matching Supabase's single verifier. */
export function createSocialAuthAttempts(options: {
  storage: KeyValueStore & {
    runExclusive?: <T>(name: string, action: () => Promise<T>) => Promise<T>;
  };
  randomId: () => string;
  currentUser: () => Promise<string | null>;
  now?: () => number;
}) {
  const now = options.now || Date.now;
  const locked = <T>(action: () => Promise<T>) =>
    options.storage.runExclusive
      ? options.storage.runExclusive(key, action)
      : action();
  async function read(): Promise<Attempt | null> {
    const raw = await options.storage.getItem(key);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      if (
        typeof value.id !== "string" ||
        !socialProvider(value.provider) ||
        (value.userId !== null && typeof value.userId !== "string") ||
        !Number.isFinite(value.createdAt) ||
        value.createdAt > now() ||
        now() - value.createdAt > maxAge
      )
        return null;
      return value;
    } catch {
      return null;
    }
  }
  return {
    // Called only by an explicit password/signup/reset e-mail action, never by
    // visiting a screen or receiving an untrusted callback URL.
    beginEmail: () => locked(() => options.storage.removeItem(key)),
    checkLegacy: () =>
      locked(async () => {
        if (await options.storage.getItem(key))
          throw new SocialAuthError(
            "Cette tentative de connexion est incomplète. Recommencez avec le bouton de connexion de votre choix.",
          );
      }),
    begin: (provider: SocialProvider) =>
      locked(async () => {
        const attempt: Attempt = {
          id: options.randomId(),
          provider,
          userId: await options.currentUser(),
          createdAt: now(),
        };
        await options.storage.setItem(key, JSON.stringify(attempt));
        return attempt;
      }),
    check: (id: string | undefined, provider: SocialProvider) =>
      locked(async () => {
        const attempt = await read();
        if (
          !id ||
          !attempt ||
          attempt.id !== id ||
          attempt.provider !== provider
        )
          throw new SocialAuthError(
            "Cette tentative de connexion a expiré. Recommencez la connexion.",
          );
        if ((await options.currentUser()) !== attempt.userId)
          throw new SocialAuthError(
            "Le compte connecté a changé. Recommencez la connexion.",
          );
      }),
    clear: (id: string) =>
      locked(async () => {
        const attempt = await read();
        if (attempt?.id === id) await options.storage.removeItem(key);
      }),
  };
}
