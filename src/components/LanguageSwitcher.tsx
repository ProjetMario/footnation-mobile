import React from "react";
import { Check, Globe2, RotateCw, X } from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth";
import { useLanguage, useTranslation, type LanguageOption } from "../lib/i18n";
import { useTheme } from "../theme";

export function LanguageSwitcher({
  visibleForGuests = false,
  compact = false,
}: {
  visibleForGuests?: boolean;
  compact?: boolean;
} = {}) {
  const { session } = useAuth();
  const { colors, mode } = useTheme();
  const { language, options, setLanguage, refreshLanguageFromIp } =
    useLanguage();
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  if (!session && !visibleForGuests) return null;

  const selected =
    options.find((option) => option.code === language) || options[0];
  const floatingBottom = Math.max(16, insets.bottom + 8);

  async function choose(option: LanguageOption) {
    await setLanguage(option.code);
    setOpen(false);
  }

  async function redetect() {
    setRefreshing(true);
    try {
      await refreshLanguageFromIp();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("language.change")}
        onPress={() => setOpen(true)}
        style={[
          compact ? styles.compactPill : styles.pill,
          {
            backgroundColor:
              mode === "dark"
                ? "rgba(10,18,32,0.92)"
                : "rgba(255,255,255,0.94)",
            borderColor: colors.border,
            shadowColor: colors.ink,
          },
        ]}
      >
        <Text style={styles.flag}>{selected.flag}</Text>
        <Text
          style={[
            compact ? styles.compactShortCode : styles.shortCode,
            { color: colors.ink },
          ]}
        >
          {selected.shortCode}
        </Text>
        {!compact && (
          <Globe2 size={19} color={colors.muted} strokeWidth={2.2} />
        )}
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                bottom: floatingBottom + 30,
                shadowColor: colors.ink,
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.ink }]}>
                {t("language.title")}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("language.close")}
                hitSlop={12}
                onPress={() => setOpen(false)}
              >
                <X size={21} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {options.map((option) => {
                const active = option.code === language;
                return (
                  <Pressable
                    key={option.code}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => choose(option)}
                    style={[
                      styles.row,
                      active && { backgroundColor: colors.accentSoft },
                    ]}
                  >
                    <Text style={styles.rowFlag}>{option.flag}</Text>
                    <Text
                      style={[
                        styles.rowLabel,
                        { color: active ? colors.blue : colors.ink },
                      ]}
                    >
                      {option.nativeName}
                    </Text>
                    {active ? (
                      <Check size={19} color={colors.blue} strokeWidth={2.4} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("language.detectIp")}
              disabled={refreshing}
              onPress={redetect}
              style={[styles.detectButton, { borderColor: colors.border }]}
            >
              <RotateCw size={17} color={colors.blue} />
              <Text style={[styles.detectText, { color: colors.blue }]}>
                {t("language.detectIp")}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  compactPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 44,
    minWidth: 58,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  flag: { fontSize: 23 },
  shortCode: { fontSize: 17, fontFamily: "Inter-Bold" },
  compactShortCode: { fontSize: 12, fontFamily: "Inter-Bold" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.22)",
  },
  sheet: {
    position: "absolute",
    right: 16,
    width: 326,
    maxHeight: 430,
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.28)",
  },
  title: { fontSize: 17, fontFamily: "Inter-Bold" },
  row: {
    minHeight: 58,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  rowFlag: { fontSize: 23, width: 30 },
  rowLabel: { flex: 1, fontSize: 17, fontFamily: "Inter-SemiBold" },
  detectButton: {
    margin: 14,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  detectText: { fontSize: 14, fontFamily: "Inter-Bold" },
});
