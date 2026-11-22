import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import type { ImagePickerAsset } from "expo-image-picker";
import type { AssetMetadata } from "expo-media-library";
import {
  CreationMediaActions,
  pickerStyles,
  type CreationMediaPickerProps,
} from "./CreationMediaActions";

/** The system picker remains usable when the new library module is not in an older native build. */
export function CreationMediaPicker(props: CreationMediaPickerProps) {
  const [items, setItems] = useState<AssetMetadata[]>([]),
    [selection, setSelection] = useState<string[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [access, setAccess] = useState<
    "unknown" | "limited" | "all" | "denied"
  >("unknown");
  const [more, setMore] = useState(false);
  const mounted = useRef(true),
    locked = useRef(false);
  async function load(request = false, append = false) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const library = await import("expo-media-library");
      const permission = request
        ? await library.requestPermissionsAsync(false, ["photo", "video"])
        : await library.getPermissionsAsync(false, ["photo", "video"]);
      if (!mounted.current) return;
      if (!permission.granted) {
        setAccess(request ? "denied" : "unknown");
        return;
      }
      setAccess(permission.accessPrivileges === "limited" ? "limited" : "all");
      const rows = await new library.Query()
        .within(library.AssetField.MEDIA_TYPE, [
          library.MediaType.IMAGE,
          library.MediaType.VIDEO,
        ])
        .orderBy({ key: library.AssetField.CREATION_TIME, ascending: false })
        .offset(append ? items.length : 0)
        .limit(36)
        .exeForMetadata();
      if (mounted.current) {
        setItems((old) =>
          append
            ? [
                ...old,
                ...rows.filter(
                  (row) => !old.some((item) => item.id === row.id),
                ),
              ]
            : rows,
        );
        setMore(rows.length === 36);
      }
    } catch {
      if (mounted.current)
        setError(
          "La galerie n’est pas disponible ici. Le bouton Importer vous permet de choisir vos médias.",
        );
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, []);
  async function add() {
    if (locked.current || props.disabled) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const library = await import("expo-media-library");
      const assets: ImagePickerAsset[] = [];
      for (const id of selection) {
        const item = items.find((value) => value.id === id)!;
        const asset = new library.Asset(id);
        let uri = await asset.getUri();
        const type = item.mediaType === "video" ? "video" : "image";
        let width = item.width || (await asset.getWidth()),
          height = item.height || (await asset.getHeight());
        let mime =
          type === "video"
            ? /\.mov$/i.test(item.filename || "")
              ? "video/quicktime"
              : "video/mp4"
            : "image/jpeg";
        if (type === "image") {
          // Normalize HEIC/orientation to a full-quality portable JPEG for drafts and renderer.
          const { ImageManipulator, SaveFormat } =
            await import("expo-image-manipulator");
          const context = ImageManipulator.manipulate(uri);
          if (Math.max(width, height) > 4096)
            context.resize(
              width >= height ? { width: 4096 } : { height: 4096 },
            );
          const rendered = await context.renderAsync();
          const jpeg = await rendered.saveAsync({
            format: SaveFormat.JPEG,
            compress: 0.95,
          });
          uri = jpeg.uri;
          width = jpeg.width;
          height = jpeg.height;
        }
        assets.push({
          uri,
          assetId: id,
          type,
          mimeType: mime,
          width,
          height,
          fileName: item.filename,
          duration: type === "video" ? await asset.getDuration() : null,
        });
      }
      if (mounted.current) {
        await props.onAdd(assets);
        setSelection([]);
      }
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Ce média n’est plus disponible. Importez-le à nouveau.",
        );
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function expandAccess() {
    try {
      const library = await import("expo-media-library");
      await library.presentPermissionsPicker(["photo", "video"]);
      await load();
    } catch {
      setError("Utilisez Importer pour sélectionner d’autres médias.");
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <CreationMediaActions {...props} disabled={props.disabled || busy} />
      <View style={styles.heading}>
        <Text style={styles.title}>Récents</Text>
        {!!selection.length && (
          <Text style={pickerStyles.hint}>
            {selection.length} sélectionné{selection.length > 1 ? "s" : ""}
          </Text>
        )}
      </View>
      {(access === "unknown" || access === "denied") && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          style={styles.permission}
          onPress={() =>
            access === "denied" ? void Linking.openSettings() : void load(true)
          }
        >
          <Text style={styles.title}>
            {access === "denied"
              ? "Autoriser dans les réglages"
              : "Afficher mes médias récents"}
          </Text>
          <Text style={pickerStyles.hint}>
            Choisissez les photos et vidéos accessibles à FootNation.
          </Text>
        </Pressable>
      )}
      {access === "limited" && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void expandAccess()}
        >
          <Text style={pickerStyles.link}>
            Accès limité · Choisir d’autres médias
          </Text>
        </Pressable>
      )}
      <View style={styles.grid}>
        {items.map((item) => {
          const position = selection.indexOf(item.id),
            selected = position >= 0;
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={item.filename || "Média récent"}
              accessibilityState={{
                checked: selected,
                disabled: props.disabled || busy,
              }}
              disabled={props.disabled || busy}
              key={item.id}
              style={[styles.tile, selected && styles.selected]}
              onPress={() => {
                if (selected)
                  setSelection((old) => old.filter((id) => id !== item.id));
                else if (selection.length + props.project.sources.length < 10)
                  setSelection((old) => [...old, item.id]);
                else setError("Vous pouvez sélectionner 10 médias maximum.");
              }}
            >
              <Image
                source={{
                  uri:
                    Platform.OS === "ios" && !item.id.startsWith("ph://")
                      ? `ph://${item.id}`
                      : item.id,
                }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
              {item.mediaType === "video" && (
                <Text style={styles.duration}>
                  {Math.floor((item.duration || 0) / 60000)}:
                  {String(
                    Math.floor(((item.duration || 0) / 1000) % 60),
                  ).padStart(2, "0")}
                </Text>
              )}
              {selected && (
                <View style={styles.number}>
                  <Text style={styles.numberText}>{position + 1}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {busy && <ActivityIndicator color="#72ADFF" />}
      {!!error && (
        <Text accessibilityRole="alert" style={pickerStyles.error}>
          {error}
        </Text>
      )}
      {more && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void load(false, true)}
        >
          <Text style={pickerStyles.link}>Voir plus de médias</Text>
        </Pressable>
      )}
      {!!selection.length && (
        <Pressable
          accessibilityRole="button"
          disabled={busy || props.disabled}
          style={[pickerStyles.action, pickerStyles.primary]}
          onPress={() => void add()}
        >
          <Text style={pickerStyles.actionText}>
            Ajouter {selection.length} média{selection.length > 1 ? "s" : ""}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
export default CreationMediaPicker;
const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: "#fff", fontWeight: "700", fontSize: 15 },
  permission: {
    backgroundColor: "#171D28",
    borderRadius: 14,
    padding: 18,
    gap: 8,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  tile: {
    width: "24%",
    aspectRatio: 1,
    backgroundColor: "#202632",
    borderRadius: 6,
    overflow: "hidden",
  },
  selected: { borderWidth: 2, borderColor: "#2588FF" },
  duration: {
    position: "absolute",
    right: 5,
    bottom: 5,
    backgroundColor: "#0008",
    color: "#fff",
    fontSize: 12,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  number: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "#137CFF",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
