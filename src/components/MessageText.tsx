import React, { useState } from "react";
import { Linking, Text, View } from "react-native";
import { router } from "expo-router";
import { messageLinks } from "../lib/messageLinks";
import { notificationPath } from "../lib/notificationPath";
import { useUIStyles } from "./ui";
export function MessageText({
  content,
  color,
}: {
  content: string;
  color: string;
}) {
  const s = useUIStyles();

  const [error, setError] = useState(false);
  const open = async (url: string) => {
    setError(false);
    try {
      const path = notificationPath(url);
      if (path) router.push(path);
      else await Linking.openURL(url);
    } catch {
      setError(true);
    }
  };
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={[s.text, { color }]}>
        {messageLinks(content).map((part, index) =>
          part.url ? (
            <Text
              key={index}
              accessibilityRole="link"
              accessibilityLabel={part.text}
              style={{ textDecorationLine: "underline" }}
              onPress={() => void open(part.url!)}
            >
              {part.text}
            </Text>
          ) : (
            <Text key={index}>{part.text}</Text>
          ),
        )}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={[s.small, { color }]}>
          Impossible d’ouvrir ce lien. Touchez-le pour réessayer.
        </Text>
      ) : null}
    </View>
  );
}
