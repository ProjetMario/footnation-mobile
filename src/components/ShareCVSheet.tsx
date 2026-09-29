import React, { useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { X } from "lucide-react-native";
import { Button, IconButton, useUIStyles } from "./ui";
import { useTheme } from "../theme";
import { cvIdentity, cvProfileUrl, type CVProfile } from "../lib/cv";
export function ShareCVSheet({
  profile,
  onClose,
}: {
  profile: CVProfile;
  onClose: () => void;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const url = cvProfileUrl(profile);
  const title = `CV Football · ${cvIdentity(profile).name}`;
  const message = `Découvre mon CV Football sur FootNation — ${cvIdentity(profile).name} · ${url}`;
  const run = async (action: () => Promise<unknown>, success = "") => {
    setBusy(true);
    setFeedback("");
    try {
      await action();
      setFeedback(success);
    } catch (e) {
      if (!(
        e &&
        typeof e === "object" &&
        "name" in e &&
        e.name === "AbortError"
      ))
        setFeedback("Ce partage est indisponible. Vous pouvez copier le lien.");
    } finally {
      setBusy(false);
    }
  };
  const channels: [string, string][] = [
    [
      "WhatsApp",
      `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`,
    ],
    [
      "E-mail",
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}`,
    ],
    [
      "LinkedIn",
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    ],
    [
      "Facebook",
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    ],
    [
      "X / Twitter",
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`,
    ],
  ];
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(2,6,23,0.55)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            padding: 22,
            maxWidth: 520,
            width: "100%",
            maxHeight: "90%",
            alignSelf: "center",
            gap: 14,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Text style={[s.h2, { flex: 1 }]}>Partager mon CV</Text>
            <IconButton label="Fermer le partage du CV" onPress={onClose}>
              <X color={colors.muted} size={21} />
            </IconButton>
          </View>
          <Text style={s.small}>
            Faites découvrir votre parcours aux clubs, recruteurs et membres du
            réseau. Le lien ouvre votre profil FootNation.
          </Text>
          <ScrollView contentContainerStyle={{ gap: 10 }}>
            <Button
              title="Copier le lien"
              disabled={busy}
              onPress={() =>
                void run(() => Clipboard.setStringAsync(url), "Lien copié.")
              }
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {channels.map(([label, href]) => (
                <View key={label} style={{ flexGrow: 1, flexBasis: "45%" }}>
                  <Button
                    title={label}
                    secondary
                    disabled={busy}
                    onPress={() => void run(() => Linking.openURL(href))}
                  />
                </View>
              ))}
            </View>
            <Button
              title="Partager via mon appareil"
              secondary
              disabled={busy}
              onPress={() =>
                void run(() =>
                  Share.share({
                    title,
                    message:
                      Platform.OS === "ios"
                        ? `Découvre le CV Football de ${cvIdentity(profile).name}`
                        : message,
                    ...(Platform.OS === "ios" ? { url } : {}),
                  }),
                )
              }
            />
            {!!feedback && (
              <Text accessibilityLiveRegion="polite" style={s.small}>
                {feedback}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
