import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SvgXml } from "react-native-svg";
import { cvPageSvg, cvPageLayout } from "../lib/cvLayout";
import { Download, FileText, Printer, Share2 } from "lucide-react-native";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { useProfile } from "../lib/data";
import { cvIdentity } from "../lib/cv";
import { exportCV, type CVAction } from "../lib/cvExport";
import { ShareCVSheet } from "../components/ShareCVSheet";
import { ProfileCareerEditor } from "../components/ProfileCareerEditor";
import { useTheme } from "../theme";

export default function CVFootball() {
  const { session } = useAuth();
  return (
    <Screen title="Mon CV">
      <AuthGate>
        <CV key={session?.user.id} />
      </AuthGate>
    </Screen>
  );
}
function CV() {
  const s = useUIStyles();
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(638, width - 42);
  const { colors } = useTheme();
  const { session } = useAuth();
  const uid = session?.user.id;
  const query = useProfile(uid);
  const profile = query.data;
  const [action, setAction] = useState<CVAction | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [editor, setEditor] = useState<"career" | "achievements" | null>(null);
  const owner = useRef(uid);
  const busy = useRef(false);
  useEffect(() => {
    owner.current = uid;
    return () => {
      owner.current = undefined;
    };
  }, [uid]);
  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );
  const run = async (kind: CVAction) => {
    if (!profile || busy.current) return;
    const assertCurrent = () => {
      if (!owner.current || owner.current !== profile.id)
        throw new Error("Votre compte a changé. Rouvrez votre CV.");
    };
    busy.current = true;
    setAction(kind);
    setError("");
    setFeedback("");
    try {
      await exportCV(profile, kind, assertCurrent);
      if (owner.current === profile.id)
        setFeedback(
          kind === "print"
            ? ""
            : Platform.OS === "web"
              ? "Votre téléchargement est prêt."
              : "Votre CV est prêt à être enregistré ou partagé.",
        );
    } catch (e) {
      if (owner.current === profile.id)
        setError(
          e instanceof Error
            ? e.message
            : "L’export a échoué. Veuillez réessayer.",
        );
    } finally {
      busy.current = false;
      if (owner.current === profile.id) setAction(null);
    }
  };
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  if (!profile)
    return (
      <Empty
        title="Complétez votre profil"
        description="Vos informations permettront de créer votre CV football."
      />
    );
  const identity = cvIdentity(profile);
  const incomplete = !profile.bio || !profile.position || !profile.club;
  return (
    <>
      <View style={{ gap: 5 }}>
        <Text style={s.title}>Votre parcours, prêt à partager.</Text>
        <Text style={s.small}>
          Votre CV se construit à partir des informations de votre profil.
        </Text>
      </View>
      <View style={styles.actions}>
        {(
          [
            { key: "pdf", label: "PDF", Icon: Download },
            { key: "word", label: "Word", Icon: FileText },
            { key: "print", label: "Imprimer", Icon: Printer },
            { key: "share", label: "Partager", Icon: Share2 },
          ] as const
        ).map(({ key, label, Icon }) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={
              key === "pdf"
                ? "Télécharger mon CV en PDF"
                : key === "word"
                  ? "Télécharger mon CV en Word"
                  : key === "print"
                    ? "Imprimer mon CV"
                    : "Partager mon CV"
            }
            accessibilityState={{ disabled: !!action, busy: action === key }}
            disabled={!!action}
            onPress={() =>
              key === "share" ? setShareOpen(true) : void run(key)
            }
            style={({ pressed }) => [
              styles.action,
              {
                backgroundColor: key === "share" ? colors.blue : colors.surface,
                borderColor: key === "share" ? colors.blue : colors.border,
                opacity: action || pressed ? 0.65 : 1,
              },
            ]}
          >
            {action === key ? (
              <ActivityIndicator color={colors.blue} />
            ) : (
              <Icon size={19} color={key === "share" ? "#fff" : colors.blue} />
            )}
            <Text
              style={{
                color: key === "share" ? "#fff" : colors.ink,
                fontFamily: "Inter-SemiBold",
                fontSize: 12,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={[s.text, { color: colors.danger }]}
        >
          {error}
        </Text>
      )}
      {!!feedback && (
        <Text accessibilityLiveRegion="polite" style={s.small}>
          {feedback}
        </Text>
      )}
      <View
        style={[
          styles.document,
          {
            backgroundColor: "#fff",
            borderColor: colors.border,
            alignSelf: "center",
          },
        ]}
      >
        <SvgXml
          xml={cvPageSvg(profile)}
          width={pageWidth}
          height={(pageWidth * 1123) / 794}
          accessibilityRole="image"
          accessibilityLabel={`CV sur une page de ${identity.name}, avec QR code vers son profil`}
        />
      </View>
      <Text style={s.small}>
        {cvPageLayout(profile).condensed
          ? "CV synthétique sur une page. Le parcours complet est accessible via le QR code."
          : "Format A4 · Une seule page · QR code vers votre profil FootNation"}
      </Text>
      {!!incomplete && (
        <Text style={s.small}>
          Complétez votre présentation, votre poste et votre club pour enrichir
          votre CV.
        </Text>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button
            title="Modifier mes informations"
            secondary
            onPress={() => router.push("/settings")}
          />
        </View>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button
            title="Modifier mon parcours"
            secondary
            onPress={() => setEditor("career")}
          />
        </View>
      </View>
      {!!shareOpen && (
        <ShareCVSheet profile={profile} onClose={() => setShareOpen(false)} />
      )}
      {!!editor && (
        <ProfileCareerEditor
          profile={profile}
          mode={editor}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: {
    flex: 1,
    minWidth: 65,
    minHeight: 68,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: 8,
  },
  document: { borderWidth: 1, borderRadius: 22, overflow: "hidden" },
});
