import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Headphones } from "lucide-react-native";
import { Button, useUIStyles } from "./ui";
import { useTheme } from "../theme";

export function SupportEntry({ admin = false }: { admin?: boolean }) {
  const s = useUIStyles();
  const { colors } = useTheme();
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Headphones size={25} color={colors.blue} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.h2}>Centre d’aide FootNation</Text>
          <Text style={s.small}>
            {admin
              ? "Répondre aux membres et gérer leurs tickets."
              : "Une demande, une conversation privée et un suivi jusqu’à sa résolution."}
          </Text>
        </View>
      </View>
      <Button
        title={admin ? "Gérer les tickets d’aide" : "Mes demandes d’aide"}
        onPress={() => router.push("/support")}
      />
    </View>
  );
}
