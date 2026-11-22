import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { router, useLocalSearchParams, usePathname } from "expo-router";
import { useAuth } from "../lib/auth";
import { authGateReturnPath } from "../lib/authReturn";
import {
  guestPreviewRemaining,
  guestPreviewStorage,
  startGuestPreview,
} from "../lib/guestPreviewPolicy";
import { Button, Empty, Loading, Screen } from "./ui";

/** Unmounts media at expiry, instead of leaving an obscured player running. */
export function GuestPreviewBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const [remaining, setRemaining] = useState<number | null>(null);
  const guest = Platform.OS === "web" && !session && !loading;
  useEffect(() => {
    if (!guest) return;
    const deadline = startGuestPreview(guestPreviewStorage());
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const left = guestPreviewRemaining(deadline);
      setRemaining(left);
      if (left > 0) timer = setTimeout(update, left);
    };
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pageshow", update);
    };
  }, [guest]);

  if (Platform.OS !== "web" || session) return <>{children}</>;
  if (loading || remaining === null) return <Loading />;
  if (remaining > 0) return <>{children}</>;
  const next = authGateReturnPath(pathname, params);
  return (
    <Screen title="Rejoignez FootNation" back={false}>
      <View testID="guest-preview-gate">
        <Empty
          title="Continuez à découvrir FootNation"
          description="Votre aperçu gratuit de 30 secondes est terminé. Connectez-vous ou créez votre compte pour continuer à voir les publications, les shorts et les profils."
          action={
            <>
              <Button
                title="Créer mon compte gratuitement"
                onPress={() =>
                  router.push({
                    pathname: "/signup",
                    params: next ? { next } : {},
                  })
                }
              />
              <Button
                title="Se connecter"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/login",
                    params: next ? { next } : {},
                  })
                }
              />
              <Button
                title="Retour à l’accueil du site"
                secondary
                onPress={() => window.location.assign("/")}
              />
            </>
          }
        />
      </View>
    </Screen>
  );
}
