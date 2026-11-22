import React, { useState } from "react";
import { NotificationButton } from "../components/NotificationButton";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  FileText,
  MessageCircle,
  Shield,
} from "lucide-react-native";
import { useAuth } from "../lib/auth";
import { Avatar, MenuRow, Screen, useUIStyles } from "../components/ui";
import { displayName } from "../lib/models";
import { useTheme } from "../theme";
import { SiteFooter } from "../components/SiteFooter";
import { spaceCategories } from "../components/spaceCategories";
export default function More() {
  const { colors } = useTheme();
  const s = useUIStyles();
  const { session, profile } = useAuth();
  const [opened, setOpened] = useState<string | null>(null);
  const [footer, setFooter] = useState(false);
  const groups = profile?.is_admin
    ? [
        ...spaceCategories,
        {
          id: "admin",
          title: "Administration",
          description: "Gestion et vérifications",
          Icon: Shield,
          items: [
            {
              title: "Vérifications des profils",
              path: "/admin/verifications",
              Icon: Shield,
            },
            {
              title: "Administration FootNation",
              path: "/admin",
              Icon: Shield,
            },
          ],
        },
      ]
    : spaceCategories;
  return (
    <Screen title="Mon espace" back={false} right={<NotificationButton />}>
      <View
        style={{ width: "100%", maxWidth: 520, alignSelf: "center", gap: 18 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={session ? "Voir mon profil" : "Se connecter"}
          onPress={() => router.push(session ? "/my-profile" : "/login")}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 8,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Avatar
            uri={profile?.avatar_url}
            name={displayName(profile)}
            size={48}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[s.text, { fontFamily: "Inter-Bold", fontSize: 18 }]}>
              {session ? displayName(profile) : "Bienvenue sur FootNation"}
            </Text>
            <Text style={s.small}>
              {session ? "Voir mon profil" : "Se connecter"}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.muted} />
        </Pressable>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { title: "Mon CV", path: "/cv-football", Icon: FileText },
            { title: "Messages", path: "/messages", Icon: MessageCircle },
            { title: "Enregistrés", path: "/saved-posts", Icon: Bookmark },
          ].map(({ title, path, Icon }) => (
            <Pressable
              key={path}
              accessibilityRole="button"
              accessibilityLabel={title}
              onPress={() => router.push(path)}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                minHeight: 70,
                padding: 10,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon size={22} color={colors.blue} />
              <Text
                style={[
                  s.small,
                  {
                    fontFamily: "Inter-SemiBold",
                    color: colors.ink,
                    textAlign: "center",
                  },
                ]}
              >
                {title}
              </Text>
            </Pressable>
          ))}
        </View>
        <View
          style={{
            borderRadius: 18,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          {groups.map(({ id, title, description, Icon, items }, index) => {
            const expanded = opened === id;
            return (
              <View
                key={id}
                style={{
                  borderTopWidth: index ? 1 : 0,
                  borderColor: colors.border,
                  backgroundColor: expanded
                    ? colors.accentSoft
                    : colors.surface,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={title}
                  accessibilityHint={description}
                  accessibilityState={{ expanded }}
                  onPress={() => setOpened(expanded ? null : id)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    minHeight: 60,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <View
                    style={{
                      backgroundColor: colors.surfaceRaised,
                      borderRadius: 13,
                      padding: 8,
                    }}
                  >
                    <Icon size={21} color={colors.blue} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[s.text, { fontFamily: "Inter-SemiBold" }]}>
                      {title}
                    </Text>
                  </View>
                  {expanded ? (
                    <ChevronDown size={19} color={colors.blue} />
                  ) : (
                    <ChevronRight size={19} color={colors.muted} />
                  )}
                </Pressable>
                {expanded && (
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      paddingHorizontal: 15,
                      paddingBottom: 8,
                    }}
                  >
                    {items.map(({ title: label, path, Icon: Glyph }) => (
                      <MenuRow
                        key={path}
                        title={label}
                        onPress={() => router.push(path)}
                        icon={<Glyph size={19} color={colors.blue} />}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: footer }}
          onPress={() => setFooter((v) => !v)}
          style={{
            padding: 12,
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Text style={s.small}>À propos de FootNation</Text>
          <ChevronDown size={16} color={colors.muted} />
        </Pressable>
        {footer && <SiteFooter />}
      </View>
    </Screen>
  );
}
