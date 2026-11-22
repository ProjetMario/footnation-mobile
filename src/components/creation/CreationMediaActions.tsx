import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, Images } from "lucide-react-native";
import type { CreationProject } from "../../lib/creationProject";

export type CreationMediaPickerProps = {
  project: CreationProject;
  onAdd(assets: ImagePicker.ImagePickerAsset[]): Promise<void>;
  disabled?: boolean;
};
export function CreationMediaActions({
  project,
  onAdd,
  disabled,
}: CreationMediaPickerProps) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const lock = useRef(false);
  async function choose(camera: boolean) {
    if (lock.current || disabled || project.sources.length >= 10) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setDenied(false);
    try {
      if (camera && Platform.OS !== "web") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setDenied(!permission.canAskAgain);
          throw new Error(
            "Autorisez la caméra pour capturer ce moment, ou importez un média.",
          );
        }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images", "videos"],
            quality: 1,
            videoMaxDuration: 60,
            videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            allowsMultipleSelection: true,
            orderedSelection: true,
            selectionLimit: 10 - project.sources.length,
            quality: 1,
          });
      if (!result.canceled && result.assets.length) await onAdd(result.assets);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible d’importer ce média. Réessayez.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={pickerStyles.actionsWrap}>
      <View style={pickerStyles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Importer des photos et vidéos"
          disabled={disabled || busy || project.sources.length >= 10}
          onPress={() => void choose(false)}
          style={({ pressed }) => [
            pickerStyles.action,
            pickerStyles.primary,
            { opacity: disabled || busy ? 0.45 : pressed ? 0.7 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Images size={21} color="#fff" />
          )}
          <Text style={pickerStyles.actionText}>Importer</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Prendre une photo ou une vidéo"
          disabled={disabled || busy || project.sources.length >= 10}
          onPress={() => void choose(true)}
          style={({ pressed }) => [
            pickerStyles.action,
            { opacity: disabled || busy ? 0.45 : pressed ? 0.7 : 1 },
          ]}
        >
          <Camera size={21} color="#fff" />
          <Text style={pickerStyles.actionText}>Caméra</Text>
        </Pressable>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={pickerStyles.error}>
          {error}
        </Text>
      )}
      {denied && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openSettings()}
        >
          <Text style={pickerStyles.link}>Ouvrir les réglages</Text>
        </Pressable>
      )}
      <Text style={pickerStyles.hint}>
        Jusqu’à 10 médias · Photos : JPEG, PNG, WebP, HEIC/HEIF, 10 Mo maximum · Vidéos : MP4, MOV, WebM, 50 Mo maximum et 10 min maximum à l’import · Publication finale : 60 s maximum · Story visible 24 h
      </Text>
    </View>
  );
}
export const pickerStyles = StyleSheet.create({
  actionsWrap: { gap: 12 },
  actions: { flexDirection: "row", gap: 10 },
  action: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#202632",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  primary: { backgroundColor: "#137CFF" },
  actionText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  hint: { color: "#939FAF", fontSize: 12, lineHeight: 18 },
  error: { color: "#FFB3B9", fontSize: 13, lineHeight: 19 },
  link: {
    color: "#85B9FF",
    fontSize: 13,
    fontWeight: "600",
    paddingVertical: 8,
  },
});
