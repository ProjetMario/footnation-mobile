import React from "react";
import { Platform } from "react-native";
import {
  Redirect,
  router,
  usePathname,
  useLocalSearchParams,
} from "expo-router";
import { authGateReturnPath } from "../lib/authReturn";
import { useAuth } from "../lib/auth";
import { Button, Empty, Loading, ErrorState } from "./ui";
import { GuestPreviewBoundary } from "./GuestPreviewBoundary";
import { authUnavailableMessage, isTransientAuthFailure } from "../lib/authServiceRecovery";
import { discussionUi } from "../lib/discussionUi";

export function AuthGate({
  children,
  allowIncomplete = true,
  allowUnverified = false,
  publicPreview = false,
}: {
  children: React.ReactNode;
  allowIncomplete?: boolean;
  allowUnverified?: boolean;
  publicPreview?: boolean;
}) {
  const { session, profile, profileStatus, loading, error, reload } = useAuth();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const t = (text: string) => discussionUi(params.communityLocale, text);
  const next = authGateReturnPath(pathname, params);
  if (loading) return <Loading />;
  if (error)
    return <>
      <ErrorState error={new Error(isTransientAuthFailure({ message: error }) ? authUnavailableMessage : error)} retry={() => void reload()} />
      <Button title={t("Se reconnecter")} secondary onPress={() => router.push({ pathname: "/login", params: next ? { next } : {} })} />
    </>;
  if (!session && publicPreview && Platform.OS === "web")
    return <GuestPreviewBoundary>{children}</GuestPreviewBoundary>;
  if (!session)
    return (
      <Empty
        title={t("Connexion requise")}
        description={t("Connectez-vous pour accéder à cette section de FootNation.")}
        action={
          <>
            <Button
              title={t("Se connecter")}
              onPress={() =>
                router.push({
                  pathname: "/login",
                  params: next ? { next } : {},
                })
              }
            />
            <Button
              title={t("S’inscrire")}
              secondary
              onPress={() =>
                router.push({
                  pathname: "/signup",
                  params: next ? { next } : {},
                })
              }
            />
          </>
        }
      />
    );
  if (!!session && profileStatus === "unverified" && !allowUnverified)
    return (
      <Redirect
        href={{
          pathname: "/onboarding",
          params: next ? { next } : {},
        }}
      />
    );
  if (!profile && !allowIncomplete)
    return (
      <Empty
        title={t("Complétez votre profil")}
        description={t("Créez votre profil FootNation pour rejoindre la communauté.")}
        action={
          <Button
            title={t("Compléter mon profil")}
            onPress={() =>
              router.push({
                pathname: "/profile-setup",
                params: next ? { next } : {},
              })
            }
          />
        }
      />
    );
  return <>{children}</>;
}
