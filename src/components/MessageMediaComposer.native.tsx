import React, { useEffect, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import { Button, ErrorState, useUIStyles } from "./ui";
import {
  MAX_VOICE_SECONDS,
  attachmentTypes,
  type LocalMessageFile,
} from "../lib/messageAttachment";
import {
  discardMessageFile,
  discardMessageCacheFile,
  retainMessageFile,
} from "../lib/messageAttachmentStorage";
import { prepareVoiceRecording } from "../lib/messageMediaLifecycle";

export function MessageMediaComposer({
  uid,
  disabled,
  active,
  file,
  onChange,
  onRecording,
}: {
  uid: string;
  disabled: boolean;
  active: boolean;
  file: LocalMessageFile | null;
  onChange(file: LocalMessageFile | null): void;
  onRecording(recording: boolean): void;
}) {
  const s = useUIStyles();
  const nativeEnd = useRef<
    (status: {
      isFinished: boolean;
      hasError: boolean;
      url: string | null;
    }) => void
  >(() => {});
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) =>
    nativeEnd.current(status),
  );
  const state = useAudioRecorderState(recorder, 250);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const mounted = useRef(true);
  const foreground = useRef(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );
  const permitted = useRef(active && !disabled);
  const availability = useRef({ active, disabled });
  availability.current = { active, disabled };
  permitted.current = active && !disabled && foreground.current;
  const generation = useRef(0);
  const startedAt = useRef(0);
  const operation = useRef(false);
  const choosing = useRef(false);
  const started = useRef(false);
  const finish = useRef<
    (
      keep: boolean,
      ended?: { uri: string | null; seconds: number },
    ) => Promise<void>
  >(async () => {});
  finish.current = async (keep, ended) => {
    if (!keep) generation.current++;
    if (!started.current || operation.current) return;
    const attempt = generation.current;
    operation.current = true;
    setBusy(true);
    let uri = ended?.uri;
    try {
      const seconds = Math.min(
        MAX_VOICE_SECONDS,
        ended?.seconds ?? recorder.getStatus().durationMillis / 1000,
      );
      if (!ended) await recorder.stop();
      started.current = false;
      onRecording(false);
      uri = uri || recorder.uri;
      if (
        keep &&
        mounted.current &&
        permitted.current &&
        attempt === generation.current &&
        uri &&
        seconds > 0
      ) {
        const retained = await retainMessageFile(uid, {
          uri,
          name: "Message vocal.m4a",
          mime: "audio/mp4",
          size: 0,
          kind: "voice",
          duration: seconds,
        });
        if (
          mounted.current &&
          permitted.current &&
          attempt === generation.current
        )
          onChange(retained);
        else discardMessageFile(uid, retained.uri);
      }
    } catch (e) {
      if (mounted.current) setError(e);
    } finally {
      try {
        discardMessageCacheFile(uri || recorder.uri);
      } catch {
        /* Recorder may already be released. */
      }
      started.current = false;
      onRecording(false);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  nativeEnd.current = (status) => {
    if (!started.current || operation.current || !status.isFinished) return;
    if (status.hasError && mounted.current)
      setError(new Error("L’enregistrement a été interrompu. Réessayez."));
    void finish.current(!status.hasError, {
      uri: status.url,
      seconds: Math.max(0, (Date.now() - startedAt.current) / 1000),
    });
  };
  useEffect(() => {
    mounted.current = true;
    const sub = AppState.addEventListener("change", (value) => {
      foreground.current = value === "active";
      permitted.current =
        foreground.current &&
        availability.current.active &&
        !availability.current.disabled;
      if (value !== "active") {
        permitted.current = false;
        if (!choosing.current) void finish.current(false);
      }
    });
    return () => {
      mounted.current = false;
      permitted.current = false;
      generation.current++;
      sub.remove();
      // The hook releases the recorder; preparation in flight also checks mounted.
      if (started.current)
        void recorder
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              discardMessageCacheFile(recorder.uri);
            } catch {
              /* Released by the hook. */
            }
          });
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, [recorder]);
  useEffect(() => {
    if (!active || disabled) void finish.current(false);
  }, [active, disabled]);
  useEffect(() => {
    if (state.isRecording && state.durationMillis >= MAX_VOICE_SECONDS * 1000)
      void finish.current(true);
  }, [state.durationMillis, state.isRecording]);
  async function record() {
    if (operation.current || started.current || !permitted.current || file)
      return;
    const attempt = ++generation.current;
    operation.current = true;
    setBusy(true);
    setError(null);
    // Pause other message audio and block outgoing calls throughout preparation.
    onRecording(true);
    try {
      started.current = await prepareVoiceRecording({
        current: () =>
          mounted.current &&
          permitted.current &&
          generation.current === attempt,
        permission: async () =>
          (await AudioModule.requestRecordingPermissionsAsync()).granted,
        mode: (enabled) =>
          setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: enabled,
            allowsBackgroundRecording: false,
            shouldPlayInBackground: false,
          }),
        prepare: () => recorder.prepareToRecordAsync(),
        record: () => {
          startedAt.current = Date.now();
          recorder.record({ forDuration: MAX_VOICE_SECONDS });
        },
        stop: () => recorder.stop(),
        discard: () => {
          try {
            discardMessageCacheFile(recorder.uri);
          } catch {
            /* Recorder released. */
          }
        },
      });
    } catch (e) {
      if (mounted.current) setError(e);
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
      if (!started.current) {
        onRecording(false);
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    }
  }
  async function pick() {
    if (operation.current || !permitted.current || file) return;
    operation.current = true;
    choosing.current = true;
    const attempt = ++generation.current;
    let sourceUri: string | undefined;
    setBusy(true);
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: Object.keys(attachmentTypes),
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      sourceUri = asset.uri;
      // Android may deliver a picker result just before its activity restores AppState.
      // File copies can finish then, but route/account/call changes still invalidate them.
      const current = () =>
        mounted.current &&
        availability.current.active &&
        !availability.current.disabled &&
        attempt === generation.current;
      if (!current()) return;
      const retained = await retainMessageFile(uid, {
        uri: asset.uri,
        name: asset.name,
        mime: asset.mimeType || "",
        size: asset.size || 0,
        kind: "file",
        duration: null,
      });
      if (current()) onChange(retained);
      else discardMessageFile(uid, retained.uri);
    } catch (e) {
      if (mounted.current) setError(e);
    } finally {
      discardMessageCacheFile(sourceUri);
      choosing.current = false;
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <View style={{ gap: 8 }}>
      {!!error && <ErrorState error={error} />}
      {state.isRecording ? (
        <>
          <Text style={s.small} accessibilityLiveRegion="polite">
            Enregistrement · {Math.floor(state.durationMillis / 1000)} s /{" "}
            {MAX_VOICE_SECONDS} s
          </Text>
          <View style={[s.row, { flexWrap: "wrap" }]}>
            <Button
              title="Terminer"
              busy={busy}
              onPress={() => void finish.current(true)}
            />
            <Button
              title="Annuler"
              secondary
              onPress={() => void finish.current(false)}
            />
          </View>
        </>
      ) : file ? (
        <View style={{ gap: 8 }}>
          <Text style={s.small}>
            {file.name} · {Math.ceil(file.size / 1024)} Ko
            {file.duration ? ` · ${Math.ceil(file.duration)} s` : ""}
          </Text>
          <Button
            title="Retirer la pièce jointe"
            secondary
            disabled={disabled}
            onPress={() => {
              discardMessageFile(uid, file.uri);
              onChange(null);
            }}
          />
        </View>
      ) : (
        <View style={[s.row, { flexWrap: "wrap" }]}>
          <Button
            title="Joindre un fichier"
            secondary
            disabled={disabled || !active || busy}
            onPress={() => void pick()}
          />
          <Button
            title="Message vocal"
            secondary
            disabled={disabled || !active || busy}
            onPress={() => void record()}
          />
        </View>
      )}
    </View>
  );
}
