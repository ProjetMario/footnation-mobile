import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SafeAreaModal } from "./SafeAreaModal";

/** Mounted only after the visitor asks to enlarge a photo already on the profile. */
export function ProfilePhotoViewer({
  uri,
  name,
  onClose,
}: {
  uri: string;
  name: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <SafeAreaModal visible animationType="fade" onRequestClose={onClose}>
      <SafeAreaView
        style={styles.screen}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
      >
        <View style={styles.header}>
          <View style={styles.title}>
            <Text style={styles.heading} accessibilityRole="header">
              Photo de profil
            </Text>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer la photo de profil"
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <X size={26} color="white" />
          </Pressable>
        </View>
        <View style={styles.photo}>
          {!failed && (
            <Image
              key={attempt}
              source={{ uri }}
              contentFit="contain"
              accessibilityLabel={`Photo de profil de ${name}`}
              style={StyleSheet.absoluteFill}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setFailed(true);
              }}
            />
          )}
          {loading && (
            <ActivityIndicator
              color="white"
              accessibilityLabel="Chargement de la photo"
            />
          )}
          {failed && (
            <View style={styles.error}>
              <Text style={styles.message}>
                La photo n’a pas pu être chargée.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setFailed(false);
                  setLoading(true);
                  setAttempt((value) => value + 1);
                }}
                style={styles.retry}
              >
                <Text style={styles.heading}>Réessayer</Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaModal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#05070B" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  title: { flex: 1, minWidth: 0, gap: 4 },
  heading: { color: "white", fontSize: 18, fontWeight: "700" },
  name: { color: "#CFD6E2", fontSize: 14 },
  close: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#202630",
  },
  pressed: { backgroundColor: "#384150" },
  photo: {
    flex: 1,
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  error: { gap: 16, alignItems: "center", padding: 24 },
  message: { color: "white", fontSize: 16, textAlign: "center" },
  retry: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "#087CFF",
  },
});
