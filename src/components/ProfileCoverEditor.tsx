import React, { useRef, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Camera, X } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Profile } from "../lib/models";
import { useAuth } from "../lib/auth";
import { publicProfileName } from "../lib/publicTalent";
import { saveProfileCover, uploadProfileCover } from "../lib/profileCover";
import { useTheme } from "../theme";
import { Avatar, Button, IconButton, useUIStyles } from "./ui";

export function ProfileCoverEditor({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  const [baseline] = useState(profile);
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pickerError, setPickerError] = useState("");
  const [picking, setPicking] = useState(false);
  const upload = useRef<{
    asset: ImagePicker.ImagePickerAsset;
    url: string;
  } | null>(null);
  const client = useQueryClient();
  const { reload } = useAuth();
  const { colors } = useTheme();
  const s = useUIStyles();
  const save = useMutation({
    mutationFn: async () => {
      if (!asset) throw new Error("Choisissez une photo.");
      if (upload.current?.asset !== asset) {
        const result = await uploadProfileCover(baseline, asset);
        upload.current = { asset, url: result.url };
      }
      return saveProfileCover(baseline, upload.current.url);
    },
    onSuccess: (updated) => {
      client.setQueriesData<Profile>(
        { queryKey: ["profile", profile.id] },
        (old) => (old ? { ...old, ...updated } : old),
      );
      void client.invalidateQueries({ queryKey: ["profile", profile.id] });
      void reload();
      onClose();
    },
  });
  async function choosePhoto() {
    setPickerError("");
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.85,
        allowsEditing: true,
        aspect: [16, 9],
      });
      if (!result.canceled && result.assets[0]) {
        setAsset(result.assets[0]);
        save.reset();
      }
    } catch {
      setPickerError("Impossible d’ouvrir la photothèque. Réessayez.");
    } finally {
      setPicking(false);
    }
  }
  const preview = asset?.uri || baseline.cover_image_url || baseline.avatar_url;
  const busy = save.isPending || picking;
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 16,
          backgroundColor: "rgba(3,12,24,0.6)",
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 560,
            maxHeight: "94%",
            alignSelf: "center",
            borderRadius: 24,
            overflow: "hidden",
            backgroundColor: colors.surface,
          }}
        >
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 18 }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Camera color={colors.blue} size={22} />
              <Text accessibilityRole="header" style={[s.h2, { flex: 1 }]}>
                Photo de couverture
              </Text>
              <IconButton
                label="Fermer la couverture"
                onPress={() => {
                  if (!busy) onClose();
                }}
              >
                <X size={22} color={colors.muted} />
              </IconButton>
            </View>
            <View
              style={{
                aspectRatio: 1.65,
                borderRadius: 18,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                backgroundColor: "#0B1B33",
              }}
            >
              {!!preview && (
                <Image
                  source={{ uri: preview }}
                  contentFit="cover"
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                  }}
                />
              )}
              <LinearGradient
                colors={["rgba(2,6,23,0.2)", "rgba(2,6,23,0.8)"]}
                style={{ position: "absolute", width: "100%", height: "100%" }}
              />
              <Avatar
                uri={baseline.avatar_url}
                name={publicProfileName(baseline)}
                size={64}
              />
              <Text
                style={[
                  s.h2,
                  {
                    color: "white",
                    textAlign: "center",
                    paddingHorizontal: 16,
                  },
                ]}
              >
                {publicProfileName(baseline)}
              </Text>
            </View>
            <Text style={s.small}>
              Choisissez une photo qui vous ressemble. Elle apparaîtra en fond
              de votre profil.
            </Text>
            <Button
              title={asset ? "Choisir une autre photo" : "Choisir une photo"}
              secondary
              busy={picking}
              disabled={save.isPending}
              onPress={() => void choosePhoto()}
            />
            {!!(pickerError || save.error) && (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {pickerError || save.error?.message}
              </Text>
            )}
            {!!asset && (
              <Button
                title="Enregistrer la couverture"
                busy={save.isPending}
                disabled={picking}
                onPress={() => save.mutate()}
              />
            )}
            <Button
              title="Annuler"
              secondary
              disabled={busy}
              onPress={onClose}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
