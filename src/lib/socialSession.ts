import type { Session } from "@supabase/supabase-js";
import type { SocialProvider } from "./socialAuthPolicy";

export function sessionUsesProvider(
  session: Pick<Session, "user"> | null,
  expected: SocialProvider,
) {
  if (session?.user?.identities?.some((identity) => identity.provider === expected))
    return true;
  const metadata = session?.user?.app_metadata;
  if (!metadata || typeof metadata !== "object") return false;
  const provider = (metadata as { provider?: unknown }).provider;
  const providers = (metadata as { providers?: unknown }).providers;
  return (
    provider === expected ||
    (Array.isArray(providers) && providers.includes(expected))
  );
}
