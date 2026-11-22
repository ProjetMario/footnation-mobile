import { authReturnPath } from "./authReturn";

/** The preview allows reading only. Never call a mutation before login. */
export function authenticatedInteraction(
  userId: string | undefined,
  next: string,
  action: () => void,
  login: (next: string | null) => void,
) {
  if (!userId) {
    login(authReturnPath(next));
    return;
  }
  action();
}
