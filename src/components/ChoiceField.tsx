import React, { useState } from "react";
import { Keyboard, Modal, Text, View } from "react-native";
import { Button, Chip, Screen, SearchField, useUIStyles } from "./ui";
import { normalizeSuggestion } from "../lib/profileSelectionOptions";
export function ChoiceField({
  label,
  value,
  options,
  onChange,
  optional = true,
  disabled = false,
  multiple = false,
  allowCustom = false,
  optionalLabel = "Tous / Aucun",
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  optional?: boolean;
  disabled?: boolean;
  multiple?: boolean;
  allowCustom?: boolean;
  optionalLabel?: string;
}) {
  const s = useUIStyles();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedValues = multiple
    ? value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : [value];
  const allOptions = multiple
    ? [
        ...options,
        ...selectedValues
          .filter((v) => !options.some((o) => o.value === v))
          .map((v) => ({ value: v, label: v })),
      ]
    : options;
  const filtered = allOptions.filter((option) =>
    normalizeSuggestion(`${option.label} ${option.value}`).includes(
      normalizeSuggestion(search),
    ),
  );
  const selection =
    multiple && selectedValues.length
      ? selectedValues
          .map((v) => options.find((o) => o.value === v)?.label || v)
          .join(", ")
      : options.find((option) => option.value === value)?.label ||
        value ||
        "Choisir";
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <Button
        title={selection}
        accessibilityLabel={`${label} : ${selection}`}
        secondary
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setSearch("");
          setOpen(true);
        }}
      />
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Screen
          title={label}
          back={false}
          right={
            <Button
              title={multiple ? "Terminer" : "Fermer"}
              secondary
              onPress={() => setOpen(false)}
            />
          }
        >
          {(options.length > 6 || allowCustom) && (
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder={`Rechercher · ${label.toLowerCase()}`}
            />
          )}
          {!!optional && (
            <Chip
              label={optionalLabel}
              selected={!value}
              onPress={() => {
                onChange("");
                setOpen(false);
              }}
            />
          )}
          {filtered.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={selectedValues.includes(option.value)}
              onPress={() => {
                if (multiple)
                  onChange(
                    (selectedValues.includes(option.value)
                      ? selectedValues.filter((v) => v !== option.value)
                      : [...selectedValues, option.value]
                    ).join(", "),
                  );
                else {
                  onChange(option.value);
                  setOpen(false);
                }
              }}
            />
          ))}
          {allowCustom &&
            !!search.trim() &&
            !allOptions.some(
              (o) =>
                normalizeSuggestion(o.value) === normalizeSuggestion(search),
            ) && (
              <Chip
                label={`Ajouter « ${search.trim()} »`}
                onPress={() => {
                  onChange(
                    multiple
                      ? [...selectedValues, search.trim()].join(", ")
                      : search.trim(),
                  );
                  setSearch("");
                  if (!multiple) setOpen(false);
                }}
              />
            )}
          {!filtered.length && (
            <Text style={s.small}>Aucun résultat pour cette recherche.</Text>
          )}
        </Screen>
      </Modal>
    </View>
  );
}
