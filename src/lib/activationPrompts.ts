export const invitationPromptCooldown = 7 * 24 * 60 * 60 * 1000;
const onboardingKey = (id: string) =>
  `footnation:first-login-onboarding:v1:${id}`;
const invitationKey = (id: string) =>
  `footnation:invitation-prompt-until:v1:${id}`;
export type ActivationPromptState = {
  userId: string | null;
  ready: boolean;
  onboardingSeen: boolean;
  invitationUntil: number;
};

/** One account-scoped source of truth prevents two welcome modals from competing. */
export function createActivationPromptCoordinator(
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
  },
  now = Date.now,
) {
  let state: ActivationPromptState = {
    userId: null,
    ready: false,
    onboardingSeen: false,
    invitationUntil: 0,
  };
  let generation = 0;
  const listeners = new Set<() => void>();
  const update = (next: ActivationPromptState) => {
    state = next;
    listeners.forEach((notify) => notify());
  };
  const persist = (key: string, value: string) =>
    storage.setItem(key, value).catch(() => {});
  return {
    snapshot: () => state,
    subscribe(notify: () => void) {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    async adoptAccount(userId: string | null) {
      if (state.userId === userId) return;
      const ticket = ++generation;
      update({
        userId,
        ready: false,
        onboardingSeen: false,
        invitationUntil: 0,
      });
      if (!userId) return;
      try {
        const [seen, until] = await Promise.all([
          storage.getItem(onboardingKey(userId)),
          storage.getItem(invitationKey(userId)),
        ]);
        if (ticket !== generation) return;
        const expiry = Number(until);
        update({
          userId,
          ready: true,
          onboardingSeen: seen === "seen",
          invitationUntil: Number.isFinite(expiry) ? expiry : 0,
        });
      } catch {
        // A storage failure must not trap an established user behind repeated prompts.
        if (ticket === generation)
          update({
            userId,
            ready: true,
            onboardingSeen: true,
            invitationUntil: now() + invitationPromptCooldown,
          });
      }
    },
    dismissOnboarding(userId: string) {
      if (state.userId !== userId || !state.ready || state.onboardingSeen)
        return false;
      const until = now() + invitationPromptCooldown;
      update({ ...state, onboardingSeen: true, invitationUntil: until });
      void persist(onboardingKey(userId), "seen");
      void persist(invitationKey(userId), String(until));
      return true;
    },
    dismissInvitation(userId: string) {
      if (state.userId !== userId || !state.ready) return false;
      const until = now() + invitationPromptCooldown;
      update({ ...state, invitationUntil: until });
      void persist(invitationKey(userId), String(until));
      return true;
    },
  };
}

export function invitationPromptReady(
  state: ActivationPromptState,
  userId: string | undefined,
  now = Date.now(),
) {
  return (
    !!userId &&
    state.userId === userId &&
    state.ready &&
    state.onboardingSeen &&
    state.invitationUntil <= now
  );
}

export function isActivationLanding(pathname: string) {
  return pathname === "/" || pathname === "/my-profile";
}
