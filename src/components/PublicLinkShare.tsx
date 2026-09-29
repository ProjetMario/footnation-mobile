import React, { useState } from "react";
import { Share, Text, View } from "react-native";
import { Button, ErrorState, useUIStyles } from "./ui";
export function PublicLinkShare({
  url,
  name,
  label,
}: {
  url: string;
  name: string;
  label: string;
}) {
  const s = useUIStyles();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function share() {
    setBusy(true);
    setError(null);
    try {
      await Share.share({
        title: `${name} sur FootNation`,
        message: `${name} sur FootNation\n${url}`,
      });
    } catch (error) {
      if (!(
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "AbortError"
      ))
        setError(
          new Error(
            "Le partage n’est pas disponible. Vous pouvez copier le lien ci-dessous.",
          ),
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      <Button
        secondary
        title={label}
        busy={busy}
        onPress={() => void share()}
      />
      {!!error && <ErrorState error={error} />}
      <Text selectable style={s.small}>
        {url}
      </Text>
    </View>
  );
}
