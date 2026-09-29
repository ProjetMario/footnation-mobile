import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Mail } from "lucide-react-native";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

type FooterSection = {
  title: string;
  links: FooterLink[];
};

function openUrl(url: string, onError: (message: string) => void) {
  return () => {
    onError("");
    void Linking.openURL(url).catch(() =>
      onError(
        "Impossible d’ouvrir ce lien. Réessayez ou vérifiez l’application associée.",
      ),
    );
  };
}

function LinkButton({
  label,
  href,
  external,
  onError,
}: FooterLink & { onError: (message: string) => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isInternal = href.startsWith("/") && !external;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        if (isInternal) {
          router.push(href);
        } else {
          void openUrl(href, onError)();
        }
      }}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={[
          styles.link,
          {
            color: "#B8C7DA",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SiteFooter() {
  const { colors } = useTheme();
  const s = useThemedStyles(createStyles);
  const [linkError, setLinkError] = useState("");

  const sections: FooterSection[] = [
    {
      title: "Navigation",
      links: [
        { label: "Accueil", href: "/" },
        { label: "Clubs", href: "/clubs" },
        { label: "Profil", href: "/my-profile" },
      ],
    },
    {
      title: "Espaces Pro",
      links: [
        {
          label: "Créer un espace Club",
          href: "/pro-pages/new?type=club_officiel",
        },
        {
          label: "Créer un espace Fédération",
          href: "/pro-pages/new?type=federation",
        },
        {
          label: "Créer un espace Entreprise",
          href: "/pro-pages/new?type=entreprise",
        },
        { label: "Dashboard Pro Pages", href: "/pro-pages" },
      ],
    },
    {
      title: "Découvrir",
      links: [
        { label: "Trouver un club", href: "/clubs-discovery" },
        { label: "Recrutement France", href: "/jobs" },
        { label: "Trouvez votre agent", href: "/matching" },
        { label: "Devenir pro", href: "/career" },
        { label: "Blog", href: "/blog" },
      ],
    },
    {
      title: "Légal",
      links: [
        { label: "Mentions légales", href: "/documents/mentions-legales" },
        { label: "CGV", href: "/documents/conditions-generales-vente" },
        {
          label: "Politique de confidentialité",
          href: "/documents/politique-confidentialite",
        },
        {
          label: "Sécurité des mineurs",
          href: "/documents/securite-des-mineurs",
        },
      ],
    },
    {
      title: "Application",
      links: [
        {
          label: "Télécharger l’application",
          href: "https://play.google.com/store/apps/details?id=com.footnation.app&pcampaignid=web_share",
          external: true,
        },
      ],
    },
    {
      title: "Clubs par département",
      links: [
        { label: "Clubs Nord (59)", href: "/clubs-departement/nord-59" },
        {
          label: "Clubs Pas-de-Calais (62)",
          href: "/clubs-departement/pas-de-calais-62",
        },
        { label: "Clubs Paris (75)", href: "/clubs-departement/paris-75" },
        { label: "Clubs Rhône (69)", href: "/clubs-departement/rhone-69" },
      ],
    },
    {
      title: "Suivez-nous",
      links: [
        { label: "X", href: "https://x.com/foot_nation", external: true },
        {
          label: "Facebook",
          href: "https://www.facebook.com/share/1BQ7EhTFj9/?mibextid=wwXIfr",
          external: true,
        },
        {
          label: "Instagram",
          href: "https://instagram.com/footnation.app",
          external: true,
        },
        {
          label: "TikTok",
          href: "https://www.tiktok.com/@footnation064",
          external: true,
        },
        {
          label: "YouTube",
          href: "https://youtube.com/@footnation.application",
          external: true,
        },
      ],
    },
  ];

  return (
    <View style={s.footer}>
      <View style={s.top}>
        <Text style={s.title}>FootNation</Text>
        <Text style={s.subtitle}>
          Votre plateforme de football amateur et professionnel dans le monde
          entier.
        </Text>
      </View>
      <View style={s.columns}>
        {sections.map((section) => (
          <View key={section.title} style={s.column}>
            <Text style={s.columnTitle}>{section.title}</Text>
            {section.links.map((link) => (
              <LinkButton key={link.label} {...link} onError={setLinkError} />
            ))}
          </View>
        ))}
      </View>
      {!!linkError && (
        <Text accessibilityRole="alert" style={s.legalText}>
          {linkError}
        </Text>
      )}
      <View style={s.legalBar}>
        <Text style={s.legalText}>
          <Text style={s.legalBrand}>FootNation</Text> — Édité par FootNation
          SAS — {new Date().getFullYear()}
        </Text>
        <View style={s.legalLine}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/contact")}
            style={({ pressed }) => ({
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text style={[s.legalLink, { color: colors.blue }]}>
              <Mail size={12} color={colors.blue} /> Nous contacter
            </Text>
          </Pressable>
          <Text style={s.legalDot}>•</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/documents/mentions-legales")}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <Text style={s.legalLink}>Mentions légales</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    footer: {
      marginTop: 18,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "#071429",
      padding: 16,
      gap: 16,
    },
    top: {
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.12)",
      paddingBottom: 12,
      gap: 8,
    },
    title: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 24,
      fontWeight: "800",
    },
    subtitle: {
      color: "#B8C7DA",
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 20,
    },
    columns: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 16,
    },
    column: {
      minWidth: "42%",
      maxWidth: "50%",
      gap: 8,
      paddingBottom: 2,
    },
    columnTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 4,
    },
    link: {
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 22,
    },
    legalBar: {
      marginTop: 2,
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.12)",
      paddingTop: 10,
      gap: 8,
    },
    legalText: {
      color: "#B8C7DA",
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 18,
    },
    legalBrand: {
      color: colors.white,
      fontFamily: "Inter-Bold",
    },
    legalLine: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
    },
    legalLink: {
      color: colors.white,
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 18,
    },
    legalDot: {
      color: "#B8C7DA",
      fontSize: 12,
    },
  });
