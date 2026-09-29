import React, { createContext, useContext, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { ChevronRight, Edit3, X } from "lucide-react-native";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import { Button } from "./ui";
import type { ProfileInfo, ProfileInfoAction } from "../lib/profileInfoActions";

import type { Profile } from "../lib/models";
import {
  editableProfileField,
  type EditableProfileField,
} from "../lib/profileInlineEdit";
import { InlineProfileEditor } from "./InlineProfileEditor";
const InfoContext = createContext<{
  open: (info: ProfileInfo) => void;
  canEdit: (label: string) => boolean;
} | null>(null);

export function ProfileInfoProvider({
  children,
  ownProfile,
}: {
  ownProfile?: Profile;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState<{
    profile: Profile;
    field: EditableProfileField;
  } | null>(null);
  const [info, setInfo] = useState<ProfileInfo | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const close = () => setInfo(null);
  const open = (next: ProfileInfo) => {
    const field = ownProfile && editableProfileField(ownProfile, next.label);
    if (ownProfile && field) {
      setEditing({ profile: ownProfile, field });
      return;
    }
    setFeedback("");
    setInfo(next);
  };
  const act = async (action: ProfileInfoAction) => {
    if ("href" in action) {
      close();
      router.push(action.href as never);
      return;
    }
    setBusy(true);
    setFeedback("");
    try {
      await Linking.openURL(action.url);
    } catch {
      setFeedback(
        "Impossible d’ouvrir ce lien. Vous pouvez copier l’information.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <InfoContext.Provider
      value={{
        open,
        canEdit: (label) =>
          !!ownProfile && !!editableProfileField(ownProfile, label),
      }}
    >
      {children}
      {!!editing && (
        <InlineProfileEditor
          profile={editing.profile}
          field={editing.field}
          onClose={() => setEditing(null)}
        />
      )}
      <Modal
        visible={!!info}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Fermer le détail"
            onPress={close}
          />
          <View
            accessibilityViewIsModal
            onAccessibilityEscape={close}
            style={styles.sheet}
          >
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>
                {info?.label}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer l’information"
                onPress={close}
                style={styles.close}
              >
                <X size={22} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.body}>
              <Text selectable style={styles.value}>
                {info?.value || "Non renseigné"}
              </Text>
              {info?.actions?.map((action, index) => (
                <Button
                  key={`${action.label}-${index}`}
                  title={action.label}
                  secondary={index > 0}
                  disabled={busy}
                  onPress={() => void act(action)}
                />
              ))}
              {!!info?.value && (
                <Button
                  title="Copier l’information"
                  secondary
                  disabled={busy}
                  onPress={() =>
                    void Clipboard.setStringAsync(info.value!)
                      .then(() => setFeedback("Information copiée."))
                      .catch(() =>
                        setFeedback(
                          "Copie indisponible. Sélectionnez le texte pour le copier.",
                        ),
                      )
                  }
                />
              )}
              {!!feedback && (
                <Text accessibilityLiveRegion="polite" style={styles.feedback}>
                  {feedback}
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </InfoContext.Provider>
  );
}

export function ProfileInfoLink({
  info,
  children,
  style,
}: {
  info: ProfileInfo;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const context = useContext(InfoContext);
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  if (!context) return <View style={style}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${info.label} : ${info.value || "Non renseigné"}`}
      accessibilityHint={
        context.canEdit(info.label)
          ? "Modifier cette information"
          : "Afficher les détails et les actions disponibles"
      }
      onPress={() => context.open(info)}
      style={({ pressed }) => [styles.link, style, pressed && styles.pressed]}
    >
      <View style={styles.linkContent}>{children}</View>
      {context.canEdit(info.label) ? (
        <Edit3 size={16} color={colors.blue} />
      ) : (
        <ChevronRight size={17} color={colors.muted} />
      )}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    link: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 44,
      paddingVertical: 5,
      borderRadius: 10,
    },
    linkContent: { flex: 1, minWidth: 0, gap: 5 },
    pressed: { backgroundColor: colors.accentSoft },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      padding: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    sheet: {
      width: "100%",
      maxWidth: 520,
      maxHeight: "80%",
      borderRadius: 24,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingLeft: 22,
      paddingRight: 8,
      paddingTop: 10,
    },
    title: {
      flex: 1,
      color: colors.ink,
      fontSize: 20,
      lineHeight: 27,
      fontFamily: "Inter-Bold",
    },
    close: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { padding: 22, gap: 14 },
    value: {
      color: colors.ink,
      fontSize: 17,
      lineHeight: 27,
      fontFamily: "Inter-Regular",
      marginBottom: 8,
    },
    feedback: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  });
