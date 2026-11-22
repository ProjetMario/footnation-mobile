import React from "react";
import { Text, View, StyleSheet, type TextProps, type ViewProps } from "react-native";
import { lightColors as colors } from "../theme/palette";

/** Public editorial pages are rendered at build time, independently of auth.
 * Their semantic HTML remains visible without JavaScript. Social interactions
 * open the corresponding existing Expo screen rather than an inert control.
 */
const WebLink = Text as unknown as React.ComponentType<TextProps & { href: string }>;
const WebRegion = View as unknown as React.ComponentType<Omit<ViewProps, "accessibilityRole"> & { accessibilityRole: "banner" | "navigation" }>;
export function PublicDocument({ content, appPath }: { content: string; appPath: string }) {
  return (
    <View style={styles.page} testID="expo-public-document">
      <WebRegion style={styles.header} accessibilityRole="banner">
        <WebLink href="/" style={styles.brand}>FOOTNATION</WebLink>
        <WebLink href="/app/signup" style={styles.link}>S’inscrire gratuitement</WebLink>
        <WebLink href="/app/login" style={styles.link}>Connexion</WebLink>
      </WebRegion>
      <View style={styles.content}>
        {React.createElement("div", { className: "fn-public-content", dangerouslySetInnerHTML: { __html: content } })}
        <View style={styles.actions}>
          <WebLink href={appPath} style={styles.primary}>Continuer dans FootNation →</WebLink>
          <WebLink href="/app/signup" style={styles.link}>Créer mon profil gratuitement</WebLink>
        </View>
      </View>
      <WebRegion style={styles.navigation} accessibilityRole="navigation" accessibilityLabel="Navigation FootNation">
        <WebLink href="/app/home" style={styles.link}>Accueil</WebLink>
        <WebLink href="/app/shorts" style={styles.link}>Shorts</WebLink>
        <WebLink href="/app/compose" style={styles.link}>Publier</WebLink>
        <WebLink href="/app/search" style={styles.link}>Recherche</WebLink>
        <WebLink href="/app/my-profile" style={styles.link}>Profil</WebLink>
      </WebRegion>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { minHeight: "100%", backgroundColor: colors.background },
  header: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 18, padding: 20, paddingTop: "max(20px, env(safe-area-inset-top))" as any, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
  brand: { fontSize: 23, fontWeight: "800", color: colors.blue, marginRight: "auto" },
  link: { color: colors.deepBlue, fontSize: 15, fontWeight: "600", paddingVertical: 12 },
  content: { width: "100%", maxWidth: 1100, alignSelf: "center", paddingBottom: 110 },
  actions: { alignItems: "center", gap: 12, padding: 24 },
  primary: { color: colors.white, backgroundColor: colors.blue, fontSize: 17, fontWeight: "700", padding: 18, borderRadius: 16, textAlign: "center" },
  navigation: { position: "fixed" as any, bottom: "max(12px, env(safe-area-inset-bottom))" as any, alignSelf: "center", flexDirection: "row", justifyContent: "space-around", gap: 12, width: "95%", maxWidth: 600, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 26, paddingHorizontal: 14, paddingVertical: 6 },
});
