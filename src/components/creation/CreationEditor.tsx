import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import {
  Captions,
  Crop,
  Music2,
  Scissors,
  Sparkles,
  Type,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Plus,
} from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import {
  autoCutProject,
  creationDuration,
  CREATION_TEMPLATES,
  reviseCreation,
  type CreationProject,
  type CreationMusic,
  type CreationClip,
} from "../../lib/creationProject";
import {
  StudioButton,
  StudioChip,
  StudioField,
  StudioNumber,
  StudioSection,
  studioColors as c,
  p,
} from "./CreationPrimitives";

type Tool = "auto" | "trim" | "crop" | "audio" | "text" | "captions";
const tools: { id: Tool; title: string; icon: typeof Sparkles }[] = [
  { id: "auto", title: "Auto Cut", icon: Sparkles },
  { id: "trim", title: "Découper", icon: Scissors },
  { id: "crop", title: "Cadrer", icon: Crop },
  { id: "audio", title: "Audio", icon: Music2 },
  { id: "text", title: "Texte", icon: Type },
  { id: "captions", title: "Sous-titres", icon: Captions },
];
function Amount({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange(value: number): void;
}) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={p.note}>{label}</Text>
        <Text style={[p.note, { color: c.text }]}>
          {Math.round(value * 100)} %
        </Text>
      </View>
      <Slider
        accessibilityLabel={label}
        value={value}
        minimumValue={0}
        maximumValue={1}
        step={0.01}
        onSlidingComplete={onChange}
        minimumTrackTintColor={c.blue}
        maximumTrackTintColor={c.line}
        thumbTintColor={c.text}
      />
    </View>
  );
}
export function CreationEditor({
  project,
  onChange,
  clipIndex,
  onClipIndex,
  music,
  transcribe,
  transcriptionAvailable,
  busy,
}: {
  project: CreationProject;
  onChange(project: CreationProject): void;
  clipIndex: number;
  onClipIndex(index: number): void;
  music: CreationMusic[];
  transcribe(): void;
  transcriptionAvailable: boolean;
  busy: boolean;
}) {
  const [tool, setTool] = useState<Tool>("auto");
  const [target, setTarget] = useState<15 | 30 | 60>(30);
  const clip = project.clips[clipIndex];
  const source = project.sources.find((item) => item.id === clip?.sourceId);
  const duration = creationDuration(project);
  const patch = (value: Partial<CreationProject>) =>
    onChange(reviseCreation(project, value));
  const updateClip = (value: Partial<CreationClip>) =>
    patch({
      clips: project.clips.map((item, index) =>
        index === clipIndex ? { ...item, ...value } : item,
      ),
      captions: [],
      captionsEnabled: false,
    });
  const move = (direction: -1 | 1) => {
    const targetIndex = clipIndex + direction;
    if (targetIndex < 0 || targetIndex >= project.clips.length) return;
    const next = [...project.clips];
    [next[clipIndex], next[targetIndex]] = [next[targetIndex], next[clipIndex]];
    patch({ clips: next, captions: [], captionsEnabled: false });
    onClipIndex(targetIndex);
  };
  return (
    <View style={{ gap: 14 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {tools.map(({ id, title, icon: Icon }) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{ selected: id === tool }}
            onPress={() => setTool(id)}
            style={{
              width: 76,
              alignItems: "center",
              gap: 7,
              paddingVertical: 7,
            }}
          >
            <View
              style={{
                width: 58,
                height: 47,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tool === id ? "#20477C" : c.panel,
                borderWidth: 1,
                borderColor: tool === id ? c.blue : c.line,
              }}
            >
              <Icon color={tool === id ? c.cyan : c.text} size={21} />
            </View>
            <Text
              style={{
                color: tool === id ? c.text : c.muted,
                fontSize: 11,
                fontWeight: "700",
              }}
            >
              {title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View
        pointerEvents={busy ? "none" : "auto"}
        style={{ opacity: busy ? 0.6 : 1 }}
      >
        {tool === "auto" && (
          <StudioSection
            title="Un montage en un geste"
            detail="Choisis ton rythme. Tu pourras ajuster chaque extrait."
          >
            <View style={{ gap: 9 }}>
              {CREATION_TEMPLATES.map((model) => (
                <Pressable
                  key={model.id}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: project.template === model.id,
                  }}
                  onPress={() => patch({ template: model.id })}
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor:
                      project.template === model.id ? c.blue : c.line,
                    backgroundColor:
                      project.template === model.id ? "#173660" : c.background,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor:
                        model.id === "energy"
                          ? "#28529E"
                          : model.id === "memories"
                            ? "#674666"
                            : "#334C53",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Sparkles size={18} color={c.text} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      style={{ color: c.text, fontWeight: "800", fontSize: 15 }}
                    >
                      {model.name}
                    </Text>
                    <Text style={p.note}>{model.detail}</Text>
                  </View>
                  {project.template === model.id && (
                    <View
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 9,
                        backgroundColor: c.blue,
                      }}
                    />
                  )}
                </Pressable>
              ))}
            </View>
            <View style={p.row}>
              {([15, 30, 60] as const).map((seconds) => (
                <StudioChip
                  key={seconds}
                  label={`${seconds} secondes`}
                  selected={target === seconds}
                  onPress={() => setTarget(seconds)}
                />
              ))}
            </View>
            <StudioButton
              label="Créer mon Auto Cut"
              icon={Sparkles}
              onPress={() => {
                onChange(
                  autoCutProject(
                    project,
                    project.template,
                    target,
                    music.find((item) => item.id === project.music?.id)?.beats,
                  ),
                );
                onClipIndex(0);
              }}
            />
            <Text style={p.note}>
              Les vidéos courtes conservent leur durée disponible. La musique
              choisie guide les coupes.
            </Text>
          </StudioSection>
        )}
        {tool === "trim" && !!clip && !!source && (
          <StudioSection
            title={`Extrait ${clipIndex + 1} · ${source.type === "video" ? "Vidéo" : "Photo"}`}
            detail="Sélectionne un extrait dans la timeline pour le modifier."
          >
            <View style={p.row}>
              {source.type === "video" && (
                <StudioNumber
                  label="Début (s)"
                  value={clip.start}
                  max={Math.max(0, source.duration - 0.1)}
                  onChange={(start) =>
                    updateClip({
                      start,
                      duration: Math.min(
                        clip.duration,
                        source.duration - start,
                      ),
                    })
                  }
                />
              )}
              <StudioNumber
                label={
                  source.type === "image"
                    ? "Durée de la photo (s)"
                    : "Durée de l’extrait (s)"
                }
                value={clip.duration}
                min={Math.max(0.1, project.transition + 0.1)}
                max={
                  source.type === "image" ? 60 : source.duration - clip.start
                }
                onChange={(value) => updateClip({ duration: value })}
              />
            </View>
            <View style={p.row}>
              <StudioButton
                compact
                secondary
                label="Avant"
                icon={ArrowLeft}
                disabled={clipIndex === 0}
                onPress={() => move(-1)}
              />
              <StudioButton
                compact
                secondary
                label="Après"
                icon={ArrowRight}
                disabled={clipIndex >= project.clips.length - 1}
                onPress={() => move(1)}
              />
              <StudioButton
                compact
                secondary
                danger
                label="Retirer"
                icon={Trash2}
                disabled={project.clips.length <= 1}
                onPress={() => {
                  patch({
                    clips: project.clips.filter(
                      (_, index) => index !== clipIndex,
                    ),
                    captions: [],
                    captionsEnabled: false,
                  });
                  onClipIndex(Math.max(0, clipIndex - 1));
                }}
              />
            </View>
            {project.sources.length > 1 && (
              <>
                <Text style={p.label}>Remplacer par un autre média</Text>
                <View style={p.row}>
                  {project.sources.map((item, index) => (
                    <StudioChip
                      key={item.id}
                      label={`Média ${index + 1}`}
                      selected={item.id === source.id}
                      onPress={() =>
                        updateClip({
                          sourceId: item.id,
                          start: 0,
                          duration:
                            item.type === "image"
                              ? clip.duration
                              : Math.min(clip.duration, item.duration),
                        })
                      }
                    />
                  ))}
                </View>
              </>
            )}
          </StudioSection>
        )}
        {tool === "crop" && !!clip && (
          <StudioSection
            title="Le bon cadre"
            detail="Le cadrage s’applique à l’extrait sélectionné."
          >
            <View style={p.row}>
              {(["9:16", "4:5", "1:1", "16:9"] as const).map((aspect) => (
                <StudioChip
                  key={aspect}
                  label={aspect}
                  selected={project.aspect === aspect}
                  onPress={() => patch({ aspect })}
                />
              ))}
            </View>
            <View style={p.row}>
              <StudioChip
                label="Tout afficher"
                selected={clip.fit === "contain"}
                onPress={() => updateClip({ fit: "contain" })}
              />
              <StudioChip
                label="Remplir"
                selected={clip.fit === "cover"}
                onPress={() => updateClip({ fit: "cover" })}
              />
            </View>
            {clip.fit === "cover" ? (
              <>
                <Amount
                  label="Position horizontale"
                  value={clip.x}
                  onChange={(x) => updateClip({ x })}
                />
                <Amount
                  label="Position verticale"
                  value={clip.y}
                  onChange={(y) => updateClip({ y })}
                />
              </>
            ) : (
              <Text style={p.note}>
                Toute l’image reste visible. Le montage utilise un fond flouté.
              </Text>
            )}
          </StudioSection>
        )}
        {tool === "audio" && (
          <StudioSection title="Donne le ton">
            <StudioChip
              label="Son original"
              selected={!project.music}
              onPress={() => patch({ music: null })}
            />
            {music.map((track) => (
              <Pressable
                key={track.id}
                accessibilityRole="button"
                onPress={() =>
                  patch({
                    music: {
                      id: track.id,
                      volume: project.music?.volume ?? 0.45,
                    },
                  })
                }
                style={{
                  padding: 13,
                  gap: 4,
                  borderRadius: 14,
                  borderColor: project.music?.id === track.id ? c.blue : c.line,
                  borderWidth: 1,
                }}
              >
                <Text style={{ color: c.text, fontWeight: "800" }}>
                  {track.title}
                </Text>
                <Text style={p.note}>{track.artist}</Text>
              </Pressable>
            ))}
            {!music.length && (
              <Text style={p.note}>
                Les musiques disponibles apparaîtront ici. Ton son original est
                conservé.
              </Text>
            )}
            <Amount
              label="Son original"
              value={project.originalVolume}
              onChange={(originalVolume) => patch({ originalVolume })}
            />
            {!!project.music && (
              <Amount
                label="Musique"
                value={project.music.volume}
                onChange={(volume) =>
                  patch({ music: { ...project.music!, volume } })
                }
              />
            )}
          </StudioSection>
        )}
        {tool === "text" && (
          <StudioSection title="Un mot, une émotion">
            {project.texts.map((text) => (
              <View
                key={text.id}
                style={{
                  gap: 11,
                  paddingBottom: 16,
                  borderBottomWidth: 1,
                  borderColor: c.line,
                }}
              >
                <StudioField
                  label="Ton texte"
                  value={text.text}
                  maxLength={500}
                  onChangeText={(value) =>
                    patch({
                      texts: project.texts.map((item) =>
                        item.id === text.id ? { ...item, text: value } : item,
                      ),
                    })
                  }
                />
                <View style={p.row}>
                  <StudioNumber
                    label="Apparaît à (s)"
                    value={text.start}
                    max={Math.max(0, text.end - 0.1)}
                    onChange={(start) =>
                      patch({
                        texts: project.texts.map((item) =>
                          item.id === text.id ? { ...item, start } : item,
                        ),
                      })
                    }
                  />
                  <StudioNumber
                    label="Disparaît à (s)"
                    value={text.end}
                    min={text.start + 0.1}
                    max={duration}
                    onChange={(end) =>
                      patch({
                        texts: project.texts.map((item) =>
                          item.id === text.id ? { ...item, end } : item,
                        ),
                      })
                    }
                  />
                </View>
                <Amount
                  label="Position horizontale du texte"
                  value={text.x}
                  onChange={(x) =>
                    patch({
                      texts: project.texts.map((item) =>
                        item.id === text.id ? { ...item, x } : item,
                      ),
                    })
                  }
                />
                <Amount
                  label="Position verticale du texte"
                  value={text.y}
                  onChange={(y) =>
                    patch({
                      texts: project.texts.map((item) =>
                        item.id === text.id ? { ...item, y } : item,
                      ),
                    })
                  }
                />
                <View style={p.row}>
                  <StudioNumber
                    label="Taille"
                    value={text.size}
                    min={16}
                    max={100}
                    onChange={(size) =>
                      patch({
                        texts: project.texts.map((item) =>
                          item.id === text.id ? { ...item, size } : item,
                        ),
                      })
                    }
                  />
                  {["#FFFFFF", "#8EE7ED", "#FFE58F"].map((color) => (
                    <Pressable
                      key={color}
                      accessibilityRole="button"
                      accessibilityLabel={`Texte ${color}`}
                      onPress={() =>
                        patch({
                          texts: project.texts.map((item) =>
                            item.id === text.id ? { ...item, color } : item,
                          ),
                        })
                      }
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 20,
                        backgroundColor: color,
                        borderWidth: 3,
                        borderColor: color === text.color ? c.blue : c.panel,
                      }}
                    />
                  ))}
                  <StudioButton
                    compact
                    secondary
                    danger
                    label="Retirer"
                    icon={Trash2}
                    onPress={() =>
                      patch({
                        texts: project.texts.filter(
                          (item) => item.id !== text.id,
                        ),
                      })
                    }
                  />
                </View>
              </View>
            ))}
            <StudioButton
              secondary
              label="Ajouter un texte"
              icon={Plus}
              disabled={project.texts.length >= 10}
              onPress={() =>
                patch({
                  texts: [
                    ...project.texts,
                    {
                      id: randomUUID(),
                      text: "Ton moment de foot",
                      start: 0,
                      end: duration,
                      x: 0.5,
                      y: 0.3,
                      size: 42,
                      color: "#FFFFFF",
                    },
                  ],
                })
              }
            />
          </StudioSection>
        )}
        {tool === "captions" && (
          <StudioSection
            title="Sous-titres"
            detail="Transcris les voix du montage, puis corrige le texte et son timing."
          >
            <StudioButton
              label={
                project.captions.length
                  ? "Relancer la transcription"
                  : "Générer les sous-titres"
              }
              icon={Captions}
              disabled={
                !transcriptionAvailable ||
                !project.sources.some((item) => item.type === "video")
              }
              onPress={transcribe}
            />
            {!transcriptionAvailable && (
              <Text style={p.note}>
                La transcription est momentanément indisponible. Tu peux ajouter
                tes sous-titres manuellement.
              </Text>
            )}
            {!!project.captions.length && (
              <StudioChip
                label={
                  project.captionsEnabled
                    ? "Sous-titres activés"
                    : "Sous-titres masqués"
                }
                selected={project.captionsEnabled}
                onPress={() =>
                  patch({ captionsEnabled: !project.captionsEnabled })
                }
              />
            )}
            {project.captions.map((caption, index) => (
              <View
                key={caption.id}
                style={{
                  gap: 9,
                  paddingBottom: 12,
                  borderBottomWidth: 1,
                  borderColor: c.line,
                }}
              >
                <StudioField
                  label={`Sous-titre ${index + 1}`}
                  value={caption.text}
                  multiline
                  maxLength={500}
                  onChangeText={(text) =>
                    patch({
                      captions: project.captions.map((item) =>
                        item.id === caption.id ? { ...item, text } : item,
                      ),
                    })
                  }
                />
                <View style={p.row}>
                  <StudioNumber
                    label="Début (s)"
                    value={caption.start}
                    max={Math.max(0, caption.end - 0.1)}
                    onChange={(start) =>
                      patch({
                        captions: project.captions.map((item) =>
                          item.id === caption.id ? { ...item, start } : item,
                        ),
                      })
                    }
                  />
                  <StudioNumber
                    label="Fin (s)"
                    value={caption.end}
                    min={caption.start + 0.1}
                    max={duration}
                    onChange={(end) =>
                      patch({
                        captions: project.captions.map((item) =>
                          item.id === caption.id ? { ...item, end } : item,
                        ),
                      })
                    }
                  />
                  <StudioButton
                    compact
                    secondary
                    danger
                    label="Retirer"
                    icon={Trash2}
                    onPress={() =>
                      patch({
                        captions: project.captions.filter(
                          (item) => item.id !== caption.id,
                        ),
                      })
                    }
                  />
                </View>
              </View>
            ))}
            <StudioButton
              secondary
              label="Ajouter un sous-titre"
              icon={Plus}
              disabled={project.captions.length >= 150}
              onPress={() => {
                const start = Math.min(
                  project.captions.at(-1)?.end ?? 0,
                  Math.max(0, duration - 1),
                );
                patch({
                  captionsEnabled: true,
                  captions: [
                    ...project.captions,
                    {
                      id: randomUUID(),
                      text: "Ton sous-titre",
                      start,
                      end: Math.min(duration, start + 3),
                    },
                  ],
                });
              }}
            />
          </StudioSection>
        )}
      </View>
    </View>
  );
}
