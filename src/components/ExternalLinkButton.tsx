import { useState } from "react";
import { Linking, View } from "react-native";
import { websiteUrl } from "../lib/websiteUrl";
import { Button, ErrorState } from "./ui";

export function ExternalLinkButton({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setError(null);
    setBusy(true);
    try {
      await Linking.openURL(websiteUrl(url));
    } catch {
      setError(
        new Error(
          "Impossible d’ouvrir ce lien. Vérifiez l’adresse et réessayez.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <Button title={title} secondary busy={busy} onPress={() => void open()} />
      {!!error && <ErrorState error={error} />}
    </View>
  );
}
