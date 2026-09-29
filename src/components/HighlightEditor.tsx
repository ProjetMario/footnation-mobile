import React, { useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChoiceField } from "./ChoiceField";
import { Button, ErrorState, Field, useUIStyles } from "./ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  formatHighlightTime,
  highlightTime,
  highlightTypes,
} from "../lib/highlight";
export type Highlight = {
  id: string;
  created_by: string | null;
  timestamp_seconds: number;
  highlight_type: string;
  title: string | null;
  description: string | null;
  player_name: string | null;
  team: string | null;
};
export function HighlightEditor({
  streamId,
  highlight,
  time,
  duration,
  onClose,
}: {
  streamId: string;
  highlight?: Highlight;
  time: number;
  duration?: number | null;
  onClose: () => void;
}) {
  const s = useUIStyles();

  const uid = useAuth().session!.user.id;
  const cache = useQueryClient();
  const [id] = useState(() => highlight?.id || randomUUID());
  const [stamp, setStamp] = useState(
    formatHighlightTime(highlight?.timestamp_seconds ?? time),
  );
  const [type, setType] = useState(highlight?.highlight_type || "goal");
  const [team, setTeam] = useState(highlight ? highlight.team || "" : "home");
  const [title, setTitle] = useState(highlight?.title || "");
  const [description, setDescription] = useState(highlight?.description || "");
  const [player, setPlayer] = useState(highlight?.player_name || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mutation = useMutation({
    mutationFn: async (action: "save" | "delete") => {
      const session = await supabase.auth.getUser();
      if (session.error) throw session.error;
      if (session.data.user?.id !== uid)
        throw new Error("La session a changé. Rechargez cet écran.");
      if (highlight && highlight.created_by !== uid)
        throw new Error(
          "Vous pouvez uniquement modifier vos propres temps forts.",
        );
      const stream = await supabase
        .from("live_streams")
        .select("video_url,expires_at,duration_seconds")
        .eq("id", streamId)
        .single();
      if (stream.error) throw stream.error;
      if (
        !stream.data.video_url ||
        (stream.data.expires_at &&
          !(Date.parse(stream.data.expires_at) > Date.now()))
      )
        throw new Error("Ce replay n’est plus disponible.");
      let request;
      if (action === "delete" || highlight) {
        if (!highlight) throw new Error("Temps fort introuvable.");
        if (action === "delete")
          request = supabase.from("video_highlights").delete();
        else
          request = supabase
            .from("video_highlights")
            .update(values(stream.data.duration_seconds));
        request = request
          .eq("id", id)
          .eq("stream_id", streamId)
          .eq("created_by", uid);
        // Compare every editable value because this table has no update revision column.
        for (const key of [
          "timestamp_seconds",
          "highlight_type",
          "title",
          "description",
          "player_name",
          "team",
        ] as const) {
          request =
            highlight[key] === null
              ? request.is(key, null)
              : request.eq(key, highlight[key]!);
        }
        const result = await request.select("id").maybeSingle();
        if (result.error) throw result.error;
        if (!result.data)
          throw new Error(
            "Ce temps fort a été modifié ou supprimé. Fermez le formulaire et actualisez le replay.",
          );
      } else {
        const payload = values(stream.data.duration_seconds);
        const existing = await supabase
          .from("video_highlights")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) {
          if (
            existing.data.created_by !== uid ||
            existing.data.stream_id !== streamId ||
            Object.entries(payload).some(
              ([key, value]) => existing.data[key] !== value,
            )
          )
            throw new Error(
              "Ce temps fort a déjà été enregistré avec un autre contenu. Actualisez le replay.",
            );
          return;
        }
        const result = await supabase
          .from("video_highlights")
          .insert({ id, stream_id: streamId, created_by: uid, ...payload })
          .select("id")
          .single();
        if (result.error) throw result.error;
      }
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["native-replay", streamId] });
      onClose();
    },
  });
  function values(serverDuration?: number | null) {
    if (
      !highlightTypes.some((item) => item.value === type) ||
      !["", "home", "away"].includes(team)
    )
      throw new Error("Choisissez le type et l’équipe du temps fort.");
    return {
      timestamp_seconds: highlightTime(stamp, duration || serverDuration),
      highlight_type: type,
      team: team || null,
      title: title.trim() || null,
      description: description.trim() || null,
      player_name: player.trim() || null,
    };
  }
  return (
    <View style={s.card}>
      <Text style={s.h2}>
        {highlight ? "Modifier mon temps fort" : "Ajouter un temps fort"}
      </Text>
      <Field
        label="Temps dans le replay (minutes:secondes)"
        value={stamp}
        onChangeText={setStamp}
        placeholder="12:05"
        editable={!mutation.isPending}
        maxLength={14}
      />
      <ChoiceField
        label="Type"
        value={type}
        options={highlightTypes}
        onChange={setType}
        optional={false}
        disabled={mutation.isPending}
      />
      <ChoiceField
        label="Équipe"
        value={team}
        options={[
          { value: "home", label: "À domicile" },
          { value: "away", label: "À l’extérieur" },
        ]}
        onChange={setTeam}
        optional
        disabled={mutation.isPending}
      />
      <Field
        label="Joueur (facultatif)"
        value={player}
        onChangeText={setPlayer}
        maxLength={120}
        editable={!mutation.isPending}
      />
      <Field
        label="Titre (facultatif)"
        value={title}
        onChangeText={setTitle}
        maxLength={120}
        editable={!mutation.isPending}
      />
      <Field
        label="Description (facultative)"
        multiline
        value={description}
        onChangeText={setDescription}
        maxLength={2000}
        editable={!mutation.isPending}
      />
      {!!mutation.error && <ErrorState error={mutation.error} />}
      {!confirmDelete && (
        <Button
          title="Enregistrer le temps fort"
          busy={mutation.isPending}
          onPress={() => mutation.mutate("save")}
        />
      )}
      {!!(highlight && !confirmDelete) && (
        <Button
          title="Supprimer ce temps fort"
          secondary
          disabled={mutation.isPending}
          onPress={() => setConfirmDelete(true)}
        />
      )}
      {!!confirmDelete && (
        <>
          <Text style={s.text}>
            Supprimer définitivement ce temps fort ? La vidéo sera conservée.
          </Text>
          <Button
            title="Confirmer la suppression"
            busy={mutation.isPending}
            onPress={() => mutation.mutate("delete")}
          />
          <Button
            title="Conserver le temps fort"
            secondary
            disabled={mutation.isPending}
            onPress={() => setConfirmDelete(false)}
          />
        </>
      )}
      <Button
        title="Fermer"
        secondary
        disabled={mutation.isPending}
        onPress={onClose}
      />
    </View>
  );
}
