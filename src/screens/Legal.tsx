import React from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { legalPage } from "../lib/legalPage";
import { Button, Screen, Empty, useUIStyles } from "../components/ui";
export default function Legal() {
  const s = useUIStyles();

  const { slug } = useLocalSearchParams<{ slug: string }>();
  const page = legalPage(slug);
  if (!page)
    return (
      <Screen title="Document introuvable">
        <Empty title="Ce document n’existe pas." />
      </Screen>
    );
  return (
    <Screen title={page.title}>
      {page.paragraphs.map((p, i) => (
        <Text selectable key={i} style={p.length < 85 ? s.h2 : s.text}>
          {p}
        </Text>
      ))}
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.h2}>
          Nous contacter et gérer vos données
        </Text>
        <Button
          title="Contacter l’équipe FootNation"
          onPress={() => router.push("/contact")}
        />
        <Button
          title="Politique de confidentialité"
          secondary
          onPress={() => router.push("/documents/politique-confidentialite")}
        />
        <Button
          title="Supprimer mon compte"
          secondary
          onPress={() => router.push("/suppression-compte")}
        />
      </View>
    </Screen>
  );
}
