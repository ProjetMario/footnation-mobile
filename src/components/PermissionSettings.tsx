import React, { useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import { Button, useUIStyles } from "./ui";

/** Only rendered after a denied permission; opening Settings remains an explicit action. */
export function PermissionSettings() {
  const s = useUIStyles();
  const [error, setError] = useState(false);
  if (Platform.OS === "web") return null;
  return (
    <View style={{ gap: 8 }}>
      <Button
        title="Ouvrir les réglages de FootNation"
        secondary
        onPress={() => {
          setError(false);
          void Linking.openSettings().catch(() => setError(true));
        }}
      />
      {error && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={s.text}
        >
          Ouvrez les réglages de votre appareil, puis FootNation, pour modifier
          cette autorisation.
        </Text>
      )}
    </View>
  );
}
