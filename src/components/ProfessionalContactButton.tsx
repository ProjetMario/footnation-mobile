import React, { useState } from "react";
import { Linking, View } from "react-native";
import { Button, ErrorState } from "./ui";
import {
  professionalContactUrl,
  type ProfessionalContactKind,
} from "../lib/professionalContact";
export function ProfessionalContactButton({
  kind,
  value,
}: {
  kind: ProfessionalContactKind;
  value: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function open() {
    setError(null);
    setBusy(true);
    try {
      await Linking.openURL(professionalContactUrl(kind, value));
    } catch {
      setError(
        new Error(
          "Impossible d’ouvrir cette coordonnée. Vous pouvez copier sa valeur ci-dessus.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 8 }}>
      <Button
        secondary
        title={
          {
            email: "Écrire un email",
            phone: "Ouvrir le téléphone",
            address: "Voir l’itinéraire",
          }[kind]
        }
        busy={busy}
        onPress={() => void open()}
      />
      {!!error && <ErrorState error={error} />}
    </View>
  );
}
