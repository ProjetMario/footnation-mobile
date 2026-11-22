import React from "react";
import { Stack, router } from "expo-router";
import { Button, Empty, Screen } from "../../src/components/ui";
import { SUPPORTERS_ENABLED } from "../../src/lib/supportersConfig";
import { MemberAccessBoundary } from "../../src/components/MemberAccessBoundary";
import { memberAccessRoutePath } from "../../src/lib/memberAccess";

function ProtectedSupporterScreen({
  children,
  route,
}: {
  children: React.ReactNode;
  route: { name: string; params?: Readonly<object> };
}) {
  return (
    <MemberAccessBoundary
      path={memberAccessRoutePath({
        ...route,
        name: `supporters/${route.name}`,
      })}
    >
      {children}
    </MemberAccessBoundary>
  );
}

export default function SupportersLayout() {
  if (!SUPPORTERS_ENABLED)
    return (
      <Screen title="Supporters">
        <Empty title="L’espace Supporters est temporairement indisponible." />
        <Button
          title="Retour à l’accueil"
          onPress={() => router.replace("/")}
        />
      </Screen>
    );
  return (
    <Stack
      screenLayout={ProtectedSupporterScreen}
      screenOptions={{ headerShown: false }}
    />
  );
}
