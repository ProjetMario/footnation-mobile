import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Shirt } from "lucide-react-native";
import type { Profile } from "../lib/models";
import { isPlayerProfile } from "../lib/profileAbout";
import { editableProfileField } from "../lib/profileInlineEdit";
import { visibleJerseyNumber } from "../lib/profileJersey";
import { InlineProfileEditor } from "./InlineProfileEditor";
import { PlayerJerseyBadge } from "./PlayerJerseyBadge";

export function ProfileJerseyNumber({
  profile,
  ownProfile,
}: {
  profile: Profile;
  ownProfile: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const number = visibleJerseyNumber(profile.jersey_number);
  if (!isPlayerProfile(profile) || (!ownProfile && number === null))
    return null;
  if (!ownProfile) return <PlayerJerseyBadge number={number!} />;
  const field = editableProfileField(profile, "Numéro de maillot")!;
  return (
    <View style={{ flexShrink: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          number === null
            ? "Ajouter mon numéro de maillot"
            : `Modifier mon numéro de maillot ${number}`
        }
        onPress={() => setEditing(true)}
        style={({ pressed }) => ({
          alignItems: "center",
          justifyContent: "center",
          minWidth: 48,
          minHeight: 48,
          padding: 4,
          borderRadius: 12,
          opacity: pressed ? 0.7 : 1,
          backgroundColor:
            number === null ? "rgba(255,255,255,0.12)" : "transparent",
          gap: 3,
        })}
      >
        {number === null ? (
          <>
            <Shirt size={24} color="#FFFFFF" />
            <Text
              style={{
                color: "#FFFFFF",
                fontFamily: "Inter-SemiBold",
                fontSize: 10,
              }}
            >
              + N°
            </Text>
          </>
        ) : (
          <PlayerJerseyBadge compact number={number} />
        )}
      </Pressable>
      {editing && (
        <InlineProfileEditor
          profile={profile}
          field={field}
          onClose={() => setEditing(false)}
        />
      )}
    </View>
  );
}
