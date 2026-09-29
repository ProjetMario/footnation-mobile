import React from "react";
import { router } from "expo-router";
import { Button, Empty, Screen } from "../src/components/ui";
export default function NotFound() {
  return (
    <Screen title="Page introuvable">
      <Empty title="Cette page est introuvable" />
      <Button title="Retour à l’accueil" onPress={() => router.replace("/")} />
    </Screen>
  );
}
