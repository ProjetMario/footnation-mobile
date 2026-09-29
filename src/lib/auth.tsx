import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { backendConfigured, supabase } from "./supabase";
import sessionStorage from "./sessionStorage";
import { storyPublicationJournal } from "./storyPublicationStorage";
import { postDraftJournal } from "./postDraftStorage";
import { forgetMessageOutboxForAccount } from "./messageOutboxStorage";
import { forgetExperienceSaveForAccount } from "./experienceSaveStorage";
import { forgetHiddenPostsForAccount } from "./hiddenPostStorage";
import { forgetDeletedAccountFiles } from "./accountDeletionLocalFiles";
import type { Profile } from "./models";
import { parseMemberAccess, type MemberAccess } from "./memberAccess";
import { unregisterPushDevice } from "./pushDevice";
import { reportError } from "./monitoring";
import {
  createNetworkInviteQueue,
  type NetworkInviteRequest,
} from "./networkInvite";
import {
  createAuthProfileMemory,
  type AuthProfileAccess,
  type AuthProfileStatus,
} from "./authProfileMemory";

const fallbackMemberAccess: MemberAccess = {
  state: "eligible",
  allowed: true,
  resend_available_at: null,
};
const Context = createContext<{
  session: Session | null;
  profile: Profile | null;
  profileStatus: AuthProfileStatus;
  memberAccess: MemberAccess | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  forgetDeletedAccount: (
    userId: string,
  ) => Promise<"removed" | "empty" | "other">;
  networkInviteRequest: NetworkInviteRequest | null;
  requestNetworkInvite: (session: Session) => void;
  dismissNetworkInvite: (key: string) => void;
}>({
  session: null,
  profile: null,
  profileStatus: "unverified",
  memberAccess: null,
  loading: true,
  error: null,
  reload: async () => {},
  forgetDeletedAccount: async () => "empty",
  networkInviteRequest: null,
  requestNetworkInvite: () => {},
  dismissNetworkInvite: () => {},
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] =
    useState<AuthProfileStatus>("unverified");
  const [memberAccess, setMemberAccess] = useState<MemberAccess | null>(null);
  const inviteQueue = useRef(createNetworkInviteQueue());
  const [networkInviteRequest, setNetworkInviteRequest] =
    useState<NetworkInviteRequest | null>(null);
  const requestNetworkInvite = useCallback((signedIn: Session) => {
    setNetworkInviteRequest(inviteQueue.current.request(signedIn));
  }, []);
  const dismissNetworkInvite = useCallback((key: string) => {
    setNetworkInviteRequest(inviteQueue.current.dismiss(key));
  }, []);
  const cache = useQueryClient(),
    mounted = useRef(true),
    sessionRef = useRef<Session | null>(null),
    memory = useRef(createAuthProfileMemory());

  const showProfile = useCallback((access: AuthProfileAccess) => {
    setProfile(access.profile);
    setProfileStatus(access.status);
    setError(
      access.status === "suspended" ? "Votre compte est désactivé." : null,
    );
    if (access.status === "suspended") setSession(null);
  }, []);

  const adoptSession = useCallback(
    (next: Session | null) => {
      setNetworkInviteRequest(
        inviteQueue.current.adoptAccount(next?.user.id || null),
      );
      const change = memory.current.changeAccount(next?.user.id || null);
      if (change.changed) {
        // Account changes invalidate every in-flight profile read immediately.
        if (change.clearCache) cache.clear();
        setProfile(null);
        setProfileStatus("unverified");
        setMemberAccess(null);
        setError(null);
        setLoading(!!next);
      }
      sessionRef.current = next;
      const access = memory.current.read(next?.user.id);
      setSession(access.status === "suspended" ? null : next);
      if (!next) {
        setLoading(false);
        setError(null);
      }
      return change.changed;
    },
    [cache],
  );

  const forgetDeletedAccount = useCallback(
    async (userId: string) => {
      // Called only after a positive deletion receipt. Use the same storage queue
      // as SDK session writes, then invalidate local profile reads synchronously.
      // Each cleanup is scoped to the receipt's UID, even if B has signed in.
      const drafts = await Promise.allSettled([
        storyPublicationJournal.forgetForAccount(userId),
        postDraftJournal.forgetForAccount(userId),
        forgetMessageOutboxForAccount(userId),
        forgetExperienceSaveForAccount(userId),
        forgetHiddenPostsForAccount(userId),
        forgetDeletedAccountFiles(userId),
      ]);
      const result = await sessionStorage.removeAccountSession(userId);
      const visibleId = sessionRef.current?.user.id;
      const otherAccount =
        result === "other" || (!!visibleId && visibleId !== userId);
      if (!otherAccount && visibleId === userId) adoptSession(null);
      if (drafts.some((result) => result.status === "rejected"))
        throw new Error(
          "Certains brouillons locaux nécessitent une nouvelle vérification du reçu de suppression.",
        );
      return otherAccount ? ("other" as const) : result;
    },
    [adoptSession],
  );

  const reload = useCallback(async () => {
    let generation = memory.current.begin();
    const current = () =>
      mounted.current && memory.current.isCurrent(generation);
    if (!backendConfigured) {
      setLoading(false);
      return;
    }
    try {
      // getSession may refresh an expired token over the network. A known local
      // session can keep its already verified profile visible during a cut.
      if (!onlineManager.isOnline() && sessionRef.current) {
        showProfile(memory.current.read(sessionRef.current.user.id));
        return;
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!current()) return;
      if (sessionError) throw sessionError;
      if (adoptSession(data.session)) generation = memory.current.begin();
      if (!data.session) {
        return;
      }
      if (!onlineManager.isOnline()) {
        showProfile(memory.current.read(data.session.user.id));
        return;
      }
      // Check admission before reading a profile protected by RLS.
      const admission = await supabase
        .rpc("get_member_access_status")
        .setHeader("Authorization", "Bearer " + data.session.access_token);
      if (!current()) return;
      let nextAccess: MemberAccess;
      try {
        if (admission.error) throw admission.error;
        nextAccess = parseMemberAccess(admission.data);
      } catch (reason) {
        nextAccess = fallbackMemberAccess;
        reportError(reason, "member-access");
      }
      setMemberAccess(nextAccess);
      if (!nextAccess.allowed) {
        setProfile(null);
        setProfileStatus("unverified");
        setError(null);
        return;
      }
      const result = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (!current()) return;
      if (result.error)
        throw new Error(
          "Impossible de charger votre profil. Vérifiez votre connexion.",
        );
      const access = memory.current.confirm(
        generation,
        data.session.user.id,
        result.data,
      );
      if (!access) return;
      showProfile(access);
      if (access.status === "suspended") {
        cache.clear();
        try {
          await unregisterPushDevice(data.session.user.id);
        } catch {
          // A disabled account must still be signed out; the server-side sender
          // must independently exclude suspended recipients.
        }
        if (!current()) return;
        const latest = await supabase.auth.getSession();
        if (
          !current() ||
          latest.error ||
          latest.data.session?.user.id !== data.session.user.id
        )
          return;
        await supabase.auth.signOut();
        return;
      }
      setSession(data.session);
    } catch (e) {
      if (current() && !onlineManager.isOnline() && sessionRef.current) {
        showProfile(memory.current.read(sessionRef.current.user.id));
      } else if (current()) {
        reportError(e, "auth");
        setError(
          e instanceof Error
            ? e.message
            : "Impossible de vérifier votre session.",
        );
      }
    } finally {
      if (current()) setLoading(false);
    }
  }, [adoptSession, cache, showProfile]);
  useEffect(() => {
    mounted.current = true;
    void reload();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted.current) return;
      adoptSession(next);
      if (event === "PASSWORD_RECOVERY") {
        setNetworkInviteRequest(inviteQueue.current.cancel());
      }
      setTimeout(() => {
        if (mounted.current) void reload();
      }, 0);
    });
    const removeOnline = onlineManager.subscribe((online) => {
      if (!mounted.current) return;
      if (online) void reload();
      else if (sessionRef.current) {
        showProfile(memory.current.read(sessionRef.current.user.id));
        setLoading(false);
      }
    });
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
        void reload();
      } else supabase.auth.stopAutoRefresh();
    });
    if (Platform.OS !== "web") supabase.auth.startAutoRefresh();
    return () => {
      mounted.current = false;
      memory.current.invalidate();
      subscription.unsubscribe();
      removeOnline();
      app.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, [adoptSession, reload, showProfile]);
  return (
    <Context.Provider
      value={{
        session,
        profile,
        profileStatus,
        memberAccess,
        loading,
        error,
        reload,
        forgetDeletedAccount,
        networkInviteRequest,
        requestNetworkInvite,
        dismissNetworkInvite,
      }}
    >
      {/* Account changes remount query observers and discard account-specific form state.
          Token refreshes keep the same key, so active screens remain stable. */}
      <React.Fragment key={session?.user.id || "anonymous"}>
        {children}
      </React.Fragment>
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
