import React, { useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Check, MapPin } from "lucide-react-native";
import { useDebounced } from "../lib/data";
import {
  searchProfileSuggestions,
  type ProfileSuggestion,
} from "../lib/profileSuggestions";
import { useTheme } from "../theme";
import { Avatar, Field, useUIStyles } from "./ui";
export function ProfileAutocompleteField({
  kind,
  label,
  value,
  onChange,
  onSelect,
  disabled = false,
  country,
  maxLength,
}: {
  kind: "city" | "club";
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: ProfileSuggestion) => void;
  disabled?: boolean;
  country?: string | null;
  maxLength?: number;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const term = useDebounced(value);
  const frenchCity = !country || ["FR", "France"].includes(country);
  const trimmed = term.trim();
  const canSuggest = trimmed.length >= 2;
  const enabled =
    open &&
    !disabled &&
    canSuggest &&
    (kind === "club" || frenchCity);
  const query = useQuery({
    queryKey: ["profile-suggestions", kind, term],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => searchProfileSuggestions(kind, term, signal),
  });
  return (
    <View style={{ gap: 8 }}>
      <Field
        label={label}
        value={value}
        placeholder={
          kind === "city"
            ? "Rechercher une ville ou un code postal"
            : "Rechercher un club ou sa ville"
        }
        editable={!disabled}
        maxLength={maxLength}
        autoCorrect={false}
        onFocus={() => setOpen(true)}
        onChangeText={(text) => {
          setOpen(true);
          setSelected("");
          onChange(text);
        }}
      />
      {!!selected && !open && (
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <Check size={15} color={colors.blue} />
          <Text style={s.small}>{selected}</Text>
        </View>
      )}
      {open && !disabled && kind === "city" && frenchCity && !canSuggest && (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 12,
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
            backgroundColor: colors.surface,
          }}
        >
          <MapPin size={18} color={colors.blue} />
          <Text style={[s.small, { flex: 1 }]}>
            Tapez au moins 2 lettres ou un code postal, puis choisissez la ville dans le sélecteur.
          </Text>
        </View>
      )}
      {enabled && (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          {query.isFetching || term !== value ? (
            <Text style={[s.small, { padding: 14 }]}>Recherche…</Text>
          ) : query.isError ? (
            <View style={{ padding: 14, gap: 8 }}>
              <Text style={s.small}>
                Suggestions indisponibles. Vous pouvez conserver votre saisie.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void query.refetch()}
              >
                <Text style={{ color: colors.blue }}>Réessayer</Text>
              </Pressable>
            </View>
          ) : query.data?.length ? (
            query.data.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Choisir ${item.name}, ${item.detail}`}
                disabled={disabled}
                onPress={() => {
                  onChange(item.name);
                  onSelect?.(item);
                  setSelected(item.detail);
                  setOpen(false);
                  Keyboard.dismiss();
                }}
                style={({ pressed }) => ({
                  padding: 12,
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "center",
                  backgroundColor: pressed ? colors.accentSoft : colors.surface,
                })}
              >
                {kind === "club" ? (
                  <Avatar uri={item.logo} name={item.name} size={32} />
                ) : (
                  <MapPin size={18} color={colors.blue} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[s.text, { fontWeight: "600" }]}>
                    {item.name}
                  </Text>
                  <Text style={s.small}>{item.detail}</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={{ padding: 14, gap: 10 }}>
              <Text style={s.small}>
                Aucun résultat. Vous pouvez ajouter cette valeur manuellement.
              </Text>
              {!!value.trim() && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Utiliser ${value} manuellement`}
                  disabled={disabled}
                  onPress={() => {
                    onChange(value.trim());
                    setSelected(`${value.trim()} · manuel`);
                    setOpen(false);
                    Keyboard.dismiss();
                  }}
                >
                  <Text style={{ color: colors.blue, fontWeight: "700" }}>
                    Ajouter « {value.trim()} » manuellement
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
