import type { Profile } from "./models";
import type { AuthProfileStatus } from "./authProfileMemory";
import { isActivationLanding } from "./activationPrompts";

export type NetworkInviteRequest = { userId: string; key: string };
type SignedInIdentity = { user: { id: string; last_sign_in_at?: string } };

/** Only explicit successful authentication arms an invitation, never token events. */
export function createNetworkInviteQueue() {
  let account: string | null = null;
  let lastKey: string | null = null;
  let pending: NetworkInviteRequest | null = null;
  return {
    adoptAccount(userId: string | null) {
      if (account !== userId) {
        account = userId;
        lastKey = null;
        pending = null;
      }
      return pending;
    },
    request(session: SignedInIdentity) {
      if (!account || account !== session.user.id) return pending;
      // Both the browser OAuth result and the route callback can finish the same login.
      const key = `${account}:${session.user.last_sign_in_at || "current-login"}`;
      if (lastKey !== key) {
        lastKey = key;
        pending = { userId: account, key };
      }
      return pending;
    },
    dismiss(key: string) {
      if (pending?.key === key) pending = null;
      return pending;
    },
    cancel() {
      pending = null;
      // Keep the completed login key so a late duplicate callback stays dismissed.
      return pending;
    },
  };
}

export function isInvitationAuthCallback(params: {
  code?: string;
  invite?: string;
  recovery?: string;
}) {
  return !!params.code && params.invite === "1" && params.recovery !== "1";
}

const hasText = (value: unknown) => typeof value === "string" && !!value.trim();

/** Match the required registration fields; old personal profiles may only have full_name. */
export function hasInviteReadyProfile(profile: Profile | null): boolean {
  if (!profile) return false;
  switch (profile.account_type || "personal") {
    case "club":
      return hasText(profile.club_official_name) && hasText(profile.bio);
    case "business":
      return hasText(profile.business_name);
    case "institution":
      return hasText(profile.institution_name);
    case "personal":
      return (
        hasText(profile.username) &&
        ((hasText(profile.first_name) && hasText(profile.last_name)) ||
          (profile.first_name == null &&
            profile.last_name == null &&
            hasText(profile.full_name)))
      );
    default:
      return false;
  }
}

export function canPresentNetworkInvite({
  request,
  userId,
  profile,
  profileStatus,
  loading,
  error,
  pathname,
  callBusy = false,
}: {
  request: NetworkInviteRequest | null;
  userId?: string;
  profile: Profile | null;
  profileStatus: AuthProfileStatus;
  loading: boolean;
  error: string | null;
  pathname: string;
  callBusy?: boolean;
}) {
  return (
    !!request &&
    request.userId === userId &&
    profile?.id === userId &&
    !loading &&
    !error &&
    !callBusy &&
    profileStatus === "ready" &&
    hasInviteReadyProfile(profile) &&
    isActivationLanding(pathname) &&
    ![
      "/login",
      "/signup",
      "/settings",
      "/profile-setup",
      "/reset-password",
      "/account-settings",
      "/suppression-compte",
      "/invite",
    ].includes(pathname) &&
    !pathname.startsWith("/auth/")
  );
}
