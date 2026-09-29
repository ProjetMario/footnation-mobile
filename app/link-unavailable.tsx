import React from "react";
import { router } from "expo-router";
import { Button, Empty, Screen } from "../src/components/ui";
export default function LinkUnavailable() {
  return (
    <Screen title="Lien indisponible">
      <Empty
        title="Ce lien ne peut pas être ouvert"
        description="Retrouvez le contenu depuis la recherche ou l’accueil de FootNation."
      />
      <Button title="Retour à l’accueil" onPress={() => router.replace("/")} />
    </Screen>
  );
}
