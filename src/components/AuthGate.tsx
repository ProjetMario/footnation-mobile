import React from "react";
import { router, usePathname, useLocalSearchParams } from "expo-router";
import { authGateReturnPath } from "../lib/authReturn";
import { useAuth } from "../lib/auth";
import { Button, Empty, Loading, ErrorState } from "./ui";
import { useConnectivity } from "./ConnectivityProvider";
export function AuthGate({
  children,
  allowIncomplete = true,
}: {
  children: React.ReactNode;
  allowIncomplete?: boolean;
}) {
  const { session, profile, profileStatus, loading, error, reload } = useAuth();
  const { isOffline, checking, retry } = useConnectivity();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const next = authGateReturnPath(pathname, params);
  if (loading) return <Loading />;
  if (error)
    return <ErrorState error={new Error(error)} retry={() => void reload()} />;
  if (!session)
    return (
      <Empty
        title="Connexion requise"
        description="Connectez-vous pour accéder à cette section de FootNation."
        action={
          <>
            <Button
              title="Se connecter"
              onPress={() =>
                router.push({ pathname: "/login", params: next ? { next } : {} })
              }
            />
            <Button
              title="S’inscrire"
              secondary
              onPress={() =>
                router.push({ pathname: "/signup", params: next ? { next } : {} })
              }
            />
          </>
        }
      />
    );
  if (profileStatus === "unverified")
    return (
      <Empty
        title={
          isOffline
            ? "Profil indisponible hors ligne"
            : "Votre profil reste à vérifier"
        }
        description="Retrouvez une connexion pour charger votre profil et accéder à cette section."
        action={
          <Button
            title="Réessayer"
            secondary
            busy={checking}
            onPress={() => void retry().then(() => reload())}
          />
        }
      />
    );
  if (!profile && !allowIncomplete)
    return (
      <Empty
        title="Complétez votre profil"
        description="Créez votre profil FootNation pour rejoindre la communauté."
        action={
          <Button
            title="Compléter mon profil"
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
