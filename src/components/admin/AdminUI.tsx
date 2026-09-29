import React, { createContext, useContext, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthGate } from "../AuthGate";
import {
  Button,
  ErrorState,
  Field,
  IconButton,
  Loading,
  useUIStyles,
} from "../ui";
import { useAuth } from "../../lib/auth";
import { createAdminApi, type AdminApi } from "../../lib/admin/api";
import { useTheme } from "../../theme";

const Context = createContext<{ api: AdminApi; uid: string } | null>(null);
export function useAdmin() {
  const value = useContext(Context);
  if (!value) throw new Error("Administration hors session");
  return value;
}
export function AdminAccess({ children }: { children: React.ReactNode }) {
  const uid = useAuth().session?.user.id;
  return (
    <AuthGate>
      {!!uid && (
        <AccountAccess key={uid} uid={uid}>
          {children}
        </AccountAccess>
      )}
    </AuthGate>
  );
}
function AccountAccess({
  uid,
  children,
}: {
  uid: string;
  children: React.ReactNode;
}) {
  const api = useMemo(() => createAdminApi(uid), [uid]);
  const query = useQuery({
    queryKey: ["admin", uid, "access"],
    queryFn: api.access,
    staleTime: 0,
    refetchInterval: 30000,
    retry: false,
  });
  if (query.isPending) return <Loading />;
  if (query.error || !query.data)
    return (
      <ErrorState
        error={query.error || new Error("Accès refusé.")}
        retry={() => void query.refetch()}
      />
    );
  return <Context.Provider value={{ api, uid }}>{children}</Context.Provider>;
}
export function AdminTabs<T extends string>({
  items,
  value,
  onChange,
  label = "Rubrique",
}: {
  items: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const s = useUIStyles();
  function choose(id: T) {
    setOpen(false);
    onChange(id);
  }
  if (width < 768)
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(true)}
          style={[
            s.card,
            {
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: 48,
            },
          ]}
        >
          <Text style={s.text}>{items.find(([id]) => id === value)?.[1]}</Text>
          <ChevronDown size={20} color={colors.ink} />
        </Pressable>
        <AdminModal title={label} visible={open} onClose={() => setOpen(false)}>
          {items.map(([id, text]) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: value === id }}
              onPress={() => choose(id)}
              style={{
                minHeight: 48,
                padding: 14,
                borderRadius: 12,
                backgroundColor:
                  id === value ? colors.accentSoft : colors.surface,
              }}
            >
              <Text
                style={[
                  s.text,
                  { color: id === value ? colors.deepBlue : colors.ink },
                ]}
              >
                {text}
              </Text>
            </Pressable>
          ))}
        </AdminModal>
      </>
    );
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
    >
      {items.map(([id, text]) => (
        <Pressable
          key={id}
          accessibilityRole="tab"
          accessibilityState={{ selected: id === value }}
          onPress={() => choose(id)}
          style={{
            minHeight: 44,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 10,
            backgroundColor: id === value ? colors.accentSoft : colors.surface,
          }}
        >
          <Text
            style={[
              s.small,
              {
                fontFamily: "Inter-SemiBold",
                color: id === value ? colors.deepBlue : colors.ink,
              },
            ]}
          >
            {text}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function AdminModal({
  title,
  visible,
  onClose,
  children,
  busy = false,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  busy?: boolean;
}) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const s = useUIStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          justifyContent: width < 768 ? "flex-end" : "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.48)",
          padding: width < 768 ? 0 : 24,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 700,
            maxHeight: "90%",
            backgroundColor: colors.surface,
            borderRadius: 20,
            overflow: "hidden",
            paddingBottom: Math.max(24, insets.bottom),
          }}
        >
          <View style={[s.between, { padding: 20 }]}>
            <Text accessibilityRole="header" style={[s.h2, { flex: 1 }]}>
              {title}
            </Text>
            <IconButton
              label="Fermer"
              onPress={() => {
                if (!busy) onClose();
              }}
            >
              <X color={colors.ink} size={22} />
            </IconButton>
          </View>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 16,
              gap: 12,
            }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function AdminConfirm({
  title,
  detail,
  visible,
  onCancel,
  onConfirm,
  busy,
  error,
  destructive = false,
}: {
  title: string;
  detail: string;
  visible: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  busy: boolean;
  error?: unknown;
  destructive?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const s = useUIStyles();
  return (
    <AdminModal title={title} visible={visible} onClose={onCancel} busy={busy}>
      <Text style={s.text}>{detail}</Text>
      <Field
        label="Motif de l’action"
        value={reason}
        onChangeText={setReason}
        maxLength={1000}
        editable={!busy}
        multiline
      />
      {destructive && (
        <Field
          label="Écrivez SUPPRIMER pour confirmer"
          value={confirmation}
          onChangeText={setConfirmation}
          editable={!busy}
          autoCapitalize="characters"
        />
      )}
      {!!error && <ErrorState error={error} />}
      <Button
        title={title}
        busy={busy}
        disabled={
          reason.trim().length < 3 ||
          (destructive && confirmation !== "SUPPRIMER")
        }
        onPress={() => onConfirm(reason)}
      />
      <Button title="Annuler" secondary disabled={busy} onPress={onCancel} />
    </AdminModal>
  );
}
export function Pagination({
  offset,
  total,
  next,
  onChange,
  busy,
}: {
  offset: number;
  total: number;
  next: number | null;
  onChange: (n: number) => void;
  busy?: boolean;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  return (
    <View style={[s.between, { flexWrap: "wrap" }]}>
      <Text style={s.small}>
        {total
          ? `${offset + 1}–${Math.min(offset + 30, total)} sur ${total.toLocaleString("fr-FR")}`
          : "0 résultat"}
      </Text>
      <View style={s.row}>
        <Pressable
          disabled={!offset || busy}
          accessibilityRole="button"
          accessibilityLabel="Page précédente"
          accessibilityState={{ disabled: !offset || busy }}
          onPress={() => onChange(Math.max(0, offset - 30))}
          style={{ padding: 12, opacity: offset ? 1 : 0.35 }}
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <Pressable
          disabled={next === null || busy}
          accessibilityRole="button"
          accessibilityLabel="Page suivante"
          accessibilityState={{ disabled: next === null || busy }}
          onPress={() => {
            if (next !== null) onChange(next);
          }}
          style={{ padding: 12, opacity: next === null ? 0.35 : 1 }}
        >
          <ChevronRight size={22} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}
export function Notice({ children }: { children: React.ReactNode }) {
  const s = useUIStyles();
  return (
    <Text accessibilityLiveRegion="polite" style={s.small}>
      {children}
    </Text>
  );
}
export function useAdminLayout() {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  return {
    compact: width < 768,
    styles: StyleSheet.create({
      stack: { gap: 18 },
      content: {
        width: "100%",
        maxWidth: 1280,
        alignSelf: "center",
        padding: width < 768 ? 16 : 28,
        paddingBottom: 48,
        gap: 20,
      },
      card: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 20,
        padding: width < 768 ? 16 : 22,
        backgroundColor: colors.surface,
        gap: 14,
      },
      grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
      cell: {
        flexGrow: 1,
        flexBasis: width < 768 ? "100%" : "46%",
        minWidth: 0,
      },
      stat: {
        flexGrow: 1,
        flexBasis: width < 390 ? "100%" : width < 768 ? "44%" : "21%",
        minWidth: 0,
      },
    }),
  };
}
