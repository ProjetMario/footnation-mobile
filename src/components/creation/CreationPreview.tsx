import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  ImagePlus,
  Play,
  Check,
  Trash2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react-native";
import { NativeVideo } from "../Video";
import {
  creationDuration,
  reviseCreation,
  type CreationProject,
  type CreationText,
} from "../../lib/creationProject";
import { studioColors as c, p } from "./CreationPrimitives";

function OverlayText({
  text,
  width,
  height,
}: {
  text: CreationText;
  width: number;
  height: number;
}) {
  const overlayWidth = width * 0.88;
  const [overlayHeight, setOverlayHeight] = useState(30);
  return (
    <View
      pointerEvents="none"
      onLayout={(event) => setOverlayHeight(event.nativeEvent.layout.height)}
      style={{
        position: "absolute",
        left: Math.max(
          0,
          Math.min(width - overlayWidth, width * text.x - overlayWidth / 2),
        ),
        top: Math.max(
          0,
          Math.min(height - overlayHeight, height * text.y - overlayHeight / 2),
        ),
        width: overlayWidth,
        backgroundColor: "#00000091",
        padding: Math.max(3, (width * 16) / 1080),
        borderRadius: 5,
      }}
    >
      <Text
        style={{
          color: text.color,
          fontSize: Math.max(8, (text.size * width) / 390),
          lineHeight: Math.max(10, ((text.size + 6) * width) / 390),
        }}
      >
        {text.text}
      </Text>
    </View>
  );
}
export function CreationPreview({
  project,
  uris,
  selectedIndex = 0,
  renderedUri,
  editable = false,
  onDuration,
}: {
  project: CreationProject;
  uris: Record<string, string>;
  selectedIndex?: number;
  renderedUri?: string | null;
  editable?: boolean;
  onDuration?(sourceId: string, duration: number): void;
}) {
  const { width, height } = useWindowDimensions();
  const clip = project.clips[selectedIndex];
  const source =
    project.sources.find((item) => item.id === clip?.sourceId) ||
    project.sources[0];
  const uri = source && uris[source.id];
  const [seconds, setSeconds] = useState(0);
  useEffect(() => setSeconds(0), [selectedIndex, renderedUri]);
  const [a, b] = project.aspect.split(":").map(Number);
  const maximumHeight = Math.min(
    width > 760 ? 510 : 340,
    Math.max(215, height * 0.41),
  );
  const previewWidth = Math.min(
    width - 56,
    width > 760 ? 720 : 560,
    maximumHeight * (a / b),
  );
  const previewHeight = previewWidth / (a / b);
  const offset = project.clips
    .slice(0, selectedIndex)
    .reduce((sum, item) => sum + item.duration - project.transition, 0);
  const globalTime = Math.max(0, offset + seconds - (clip?.start || 0));
  const visibleTexts = project.texts.filter(
    (text) => globalTime >= text.start && globalTime < text.end,
  );
  const visibleCaption = project.captionsEnabled
    ? project.captions.find(
        (caption) => globalTime >= caption.start && globalTime < caption.end,
      )
    : undefined;
  return (
    <View
      style={{
        backgroundColor: "#03050A",
        borderRadius: 24,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: c.line,
        minHeight: 225,
      }}
    >
      {source || renderedUri ? (
        <View
          style={{
            minHeight: previewHeight,
            alignItems: "center",
            justifyContent: "center",
            padding: 8,
          }}
        >
          <View
            style={{
              width: previewWidth,
              height: previewHeight,
              backgroundColor: "#090D16",
              overflow: "hidden",
              borderRadius: 17,
            }}
          >
            {renderedUri ? (
              <NativeVideo
                key={renderedUri}
                uri={renderedUri}
                controls
                active
                contentFit="contain"
                style={StyleSheet.absoluteFill}
              />
            ) : !uri ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { justifyContent: "center", alignItems: "center" },
                ]}
              >
                <Text style={p.note}>Chargement du média…</Text>
              </View>
            ) : source.type === "video" ? (
              <NativeVideo
                key={`${source.id}:${clip?.id}`}
                uri={uri}
                active
                controls
                contentFit={clip?.fit ?? "contain"}
                clip={
                  clip
                    ? { start: clip.start, duration: clip.duration }
                    : undefined
                }
                volume={project.originalVolume}
                onProgress={(time, duration) => {
                  setSeconds(time);
                  if (
                    (!source.duration || source.duration <= 0) &&
                    duration > 0
                  )
                    onDuration?.(source.id, duration);
                }}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <>
                {clip?.fit === "contain" && (
                  <Image
                    source={{ uri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    blurRadius={30}
                  />
                )}
                <Image
                  source={{ uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit={clip?.fit ?? "contain"}
                  contentPosition={{
                    left: `${(clip?.x ?? 0.5) * 100}%`,
                    top: `${(clip?.y ?? 0.5) * 100}%`,
                  }}
                />
              </>
            )}
            {!renderedUri &&
              visibleTexts.map((text) => (
                <OverlayText
                  key={text.id}
                  text={text}
                  width={previewWidth}
                  height={previewHeight}
                />
              ))}
            {!renderedUri && !!visibleCaption && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 12,
                  right: 12,
                  bottom: "17%",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontSize: 13,
                    backgroundColor: "#000000AA",
                    padding: 6,
                    borderRadius: 6,
                    textAlign: "center",
                  }}
                >
                  {visibleCaption.text}
                </Text>
              </View>
            )}
          </View>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 14,
              top: 14,
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: "#101724DC",
              borderRadius: 99,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            {!!renderedUri && <Check color={c.cyan} size={13} />}
            <Text
              style={{
                color: renderedUri ? c.cyan : c.text,
                fontSize: 11,
                fontWeight: "700",
              }}
            >
              {renderedUri
                ? "Ton montage"
                : editable
                  ? `Extrait ${selectedIndex + 1}`
                  : "Aperçu"}
            </Text>
          </View>
          {editable &&
            !renderedUri &&
            (project.clips.length > 1 ||
              project.texts.length > 0 ||
              !!project.music ||
              clip?.fit === "cover") && (
              <View
                style={{
                  position: "absolute",
                  bottom: 11,
                  alignSelf: "center",
                  borderRadius: 99,
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  backgroundColor: "#101724E8",
                }}
              >
                <Text style={{ color: c.muted, fontSize: 10 }}>
                  Génère un aperçu pour voir le montage complet
                </Text>
              </View>
            )}
        </View>
      ) : (
        <LinearGradient
          colors={["#182A47", "#0A101D", "#121827"]}
          style={{
            minHeight: previewHeight,
            alignItems: "center",
            justifyContent: "center",
            padding: 30,
            gap: 15,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 25,
              borderWidth: 1,
              borderColor: "#385F91",
              backgroundColor: "#1D3553",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ImagePlus color={c.cyan} size={31} />
          </View>
          <Text
            style={{
              color: c.text,
              fontWeight: "900",
              fontSize: 25,
              textAlign: "center",
            }}
          >
            Ton foot. Ton moment.
          </Text>
          <Text style={[p.note, { textAlign: "center", maxWidth: 265 }]}>
            Un but, une séance, les coulisses…{"\n"}Fais vivre le terrain à ta
            communauté.
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

export function CreationTimeline({
  project,
  uris,
  selectedIndex,
  onSelect,
  sourceMode = false,
  onChange,
}: {
  project: CreationProject;
  uris: Record<string, string>;
  selectedIndex: number;
  onSelect(index: number): void;
  sourceMode?: boolean;
  onChange?(project: CreationProject): void;
}) {
  const rows = sourceMode
    ? project.sources.map((source, index) => ({
        id: source.id,
        source,
        duration: source.duration,
        index,
      }))
    : project.clips.map((clip, index) => ({
        id: clip.id,
        source: project.sources.find((item) => item.id === clip.sourceId)!,
        duration: clip.duration,
        index,
      }));
  const source = rows[selectedIndex]?.source;
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={p.label}>
          {sourceMode
            ? `${project.sources.length}/10 médias sélectionnés`
            : "TA TIMELINE"}
        </Text>
        <Text style={p.note}>
          {Math.round(creationDuration(project) * 10) / 10} s
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 9, paddingVertical: 2 }}
      >
        {rows.map((row, index) => (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            accessibilityLabel={`Sélectionner ${sourceMode ? "le média" : "l’extrait"} ${index + 1}`}
            onPress={() => onSelect(index)}
            style={{
              width: sourceMode ? 83 : 70,
              height: 91,
              borderRadius: 13,
              overflow: "hidden",
              borderWidth: 2,
              borderColor: index === selectedIndex ? c.blue : c.line,
              backgroundColor: c.raised,
            }}
          >
            {row.source.type === "image" && uris[row.source.id] ? (
              <Image
                source={{ uri: uris[row.source.id] }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Play size={23} color={c.text} />
                <Text
                  numberOfLines={1}
                  style={{
                    color: c.muted,
                    fontSize: 9,
                    marginTop: 4,
                    paddingHorizontal: 4,
                  }}
                >
                  {row.source.name}
                </Text>
              </View>
            )}
            <View
              style={{
                position: "absolute",
                top: 4,
                left: 4,
                width: 21,
                height: 21,
                borderRadius: 20,
                backgroundColor: index === selectedIndex ? c.blue : "#101724CC",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 10, color: "white", fontWeight: "800" }}>
                {index + 1}
              </Text>
            </View>
            {!!row.duration && (
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  paddingHorizontal: 5,
                  paddingVertical: 4,
                  backgroundColor: "#000000A8",
                  borderTopLeftRadius: 6,
                }}
              >
                <Text
                  style={{ fontSize: 10, color: "white", fontWeight: "600" }}
                >
                  {Math.round(row.duration * 10) / 10}s
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
      {sourceMode && !!source && !!onChange && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
          <Text numberOfLines={1} style={[p.note, { flex: 1 }]}>
            {source.name}
          </Text>
          {([-1, 1] as const).map((direction) => (
            <Pressable
              key={direction}
              accessibilityRole="button"
              accessibilityLabel={
                direction === -1
                  ? "Déplacer le média avant"
                  : "Déplacer le média après"
              }
              disabled={
                selectedIndex + direction < 0 ||
                selectedIndex + direction >= rows.length
              }
              onPress={() => {
                const next = [...project.sources];
                [next[selectedIndex], next[selectedIndex + direction]] = [
                  next[selectedIndex + direction],
                  next[selectedIndex],
                ];
                const order = new Map(
                  next.map((item, index) => [item.id, index]),
                );
                onChange(
                  reviseCreation(project, {
                    sources: next,
                    clips: [...project.clips].sort(
                      (a, b) =>
                        (order.get(a.sourceId) ?? 0) -
                        (order.get(b.sourceId) ?? 0),
                    ),
                    captions: [],
                    captionsEnabled: false,
                  }),
                );
                onSelect(selectedIndex + direction);
              }}
              style={{
                padding: 7,
                opacity:
                  selectedIndex + direction < 0 ||
                  selectedIndex + direction >= rows.length
                    ? 0.3
                    : 1,
              }}
            >
              {direction === -1 ? (
                <ArrowLeft color={c.text} size={18} />
              ) : (
                <ArrowRight color={c.text} size={18} />
              )}
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retirer ce média"
            onPress={() => {
              onChange(
                reviseCreation(project, {
                  sources: project.sources.filter(
                    (item) => item.id !== source.id,
                  ),
                  clips: project.clips.filter(
                    (item) => item.sourceId !== source.id,
                  ),
                  captions: [],
                  captionsEnabled: false,
                }),
              );
              onSelect(Math.max(0, selectedIndex - 1));
            }}
            style={{ padding: 7 }}
          >
            <Trash2 color={c.danger} size={18} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
