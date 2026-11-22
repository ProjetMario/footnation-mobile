import type { Session } from "@supabase/supabase-js";
import {
  socialAuthErrorMessage,
  type SocialAuthContext,
  type SocialProvider,
} from "./socialAuthPolicy";

export type SocialAuthResult = {
  session: Session;
  route: string;
  claim: string;
};

// AuthProvider remounts account-owned screens on sign-in. Keep the pending
// operation and its outcome outside those screens, including native Apple.
export function createSocialAuthFlow(
  signIn: (
    provider: SocialProvider,
    context: SocialAuthContext,
  ) => Promise<SocialAuthResult | null>,
) {
  let state: {
    busy: SocialProvider | null;
    result: SocialAuthResult | null;
    error: string;
  } = { busy: null, result: null, error: "" };
  const listeners = new Set<() => void>();
  const publish = (next: typeof state) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async start(provider: SocialProvider, context: SocialAuthContext) {
      if (state.busy) return;
      publish({ busy: provider, result: null, error: "" });
      try {
        const result = await signIn(provider, context);
        publish({ busy: null, result, error: "" });
      } catch (error) {
        publish({
          busy: null,
          result: null,
          error: socialAuthErrorMessage(error),
        });
      }
    },
    consume(result: SocialAuthResult) {
      if (state.result === result) publish({ ...state, result: null });
    },
  };
}
