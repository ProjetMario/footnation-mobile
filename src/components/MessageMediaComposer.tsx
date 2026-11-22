import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Button, ErrorState, useUIStyles } from "./ui";
import {
  attachmentTypes,
  MAX_MESSAGE_FILE_BYTES,
  MAX_VOICE_SECONDS,
  type LocalMessageFile,
} from "../lib/messageAttachment";
import {
  discardMessageFile,
  retainMessageFile,
} from "../lib/messageAttachmentStorage.web";
import { BrowserVoiceRecording } from "../lib/browserVoiceRecording";

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
  const input = useRef<HTMLInputElement | null>(null);
  const capture = useRef<BrowserVoiceRecording | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const availability = useRef({ active, disabled, uid });
  availability.current = { active, disabled, uid };
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const locked = useRef(false);
  const callback = useRef({ onChange, onRecording });
  callback.current = { onChange, onRecording };
  const current = (attempt: number) =>
    mounted.current &&
    generation.current === attempt &&
    availability.current.uid === uid &&
    availability.current.active &&
    !availability.current.disabled;
  const finish = useRef<(keep: boolean) => Promise<void>>(async () => {});
  finish.current = async (keep) => {
    const recorder = capture.current;
    if (!recorder) return;
    capture.current = null;
    const attempt = generation.current;
    if (!keep) generation.current++;
    locked.current = true;
    if (mounted.current) setBusy(true);
    try {
      const result = keep ? await recorder.stop() : null;
      if (result && current(attempt)) {
        const uri = URL.createObjectURL(result.blob);
        try {
          const retained = await retainMessageFile(uid, {
            uri,
            name: `Message vocal.${attachmentTypes[result.mime]}`,
            mime: result.mime,
            size: result.blob.size,
            kind: "voice",
            duration: result.seconds,
          });
          if (current(attempt)) callback.current.onChange(retained);
          else discardMessageFile(uid, retained.uri);
        } finally {
          URL.revokeObjectURL(uri);
        }
      }
    } catch (cause) {
      if (current(attempt)) setError(cause);
    } finally {
      recorder.dispose();
      callback.current.onRecording(false);
      locked.current = false;
      if (mounted.current) {
        setRecording(false);
        setBusy(false);
      }
    }
  };
  useEffect(() => {
    mounted.current = true;
    const cancel = () => {
      generation.current++;
      void finish.current(false);
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") cancel();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", cancel);
    return () => {
      mounted.current = false;
      generation.current++;
      capture.current?.dispose();
      capture.current = null;
      callback.current.onRecording(false);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", cancel);
    };
  }, [uid]);
  useEffect(() => {
    if (!active || disabled) {
      generation.current++;
      void finish.current(false);
    }
  }, [active, disabled]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(
      () => setSeconds((value) => Math.min(MAX_VOICE_SECONDS, value + 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [recording]);
  async function record() {
    if (locked.current || capture.current || !active || disabled || file)
      return;
    locked.current = true;
    const attempt = ++generation.current;
    setError(null);
    setBusy(true);
    callback.current.onRecording(true);
    const recorder = new BrowserVoiceRecording(() => void finish.current(true));
    capture.current = recorder;
    try {
      if ((await recorder.start()) && current(attempt)) {
        setSeconds(0);
        setRecording(true);
      } else {
        recorder.dispose();
        if (capture.current === recorder) {
          capture.current = null;
          callback.current.onRecording(false);
        }
      }
    } catch (cause) {
      recorder.dispose();
      if (capture.current === recorder) {
        capture.current = null;
        callback.current.onRecording(false);
      }
      if (current(attempt))
        setError(
          cause instanceof Error && cause.name === "NotAllowedError"
            ? new Error(
                "Autorisez le microphone dans les réglages de ce site pour enregistrer un message vocal.",
              )
            : cause,
        );
    } finally {
      // A late permission result must not unlock or mute a newer recording.
      if (generation.current === attempt || !capture.current) {
        locked.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }
  async function pick(selected: File | undefined) {
    if (!selected || locked.current || file || !active || disabled) return;
    locked.current = true;
    const attempt = ++generation.current;
    setBusy(true);
    setError(null);
    let uri: string | undefined;
    try {
      if (
        !attachmentTypes[selected.type] ||
        selected.size <= 0 ||
        selected.size > MAX_MESSAGE_FILE_BYTES
      )
        throw new Error(
          "Choisissez une image, un PDF, une vidéo MP4 ou un fichier audio de 10 Mo maximum.",
        );
      uri = URL.createObjectURL(selected);
      const retained = await retainMessageFile(uid, {
        uri,
        name: selected.name,
        mime: selected.type,
        size: selected.size,
        kind: "file",
        duration: null,
      });
      if (current(attempt)) callback.current.onChange(retained);
      else discardMessageFile(uid, retained.uri);
    } catch (cause) {
      if (current(attempt)) setError(cause);
    } finally {
      if (uri) URL.revokeObjectURL(uri);
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <View style={{ gap: 8 }}>
      <input
        ref={input}
        type="file"
        accept={Object.keys(attachmentTypes).join(",")}
        style={{ display: "none" }}
        aria-label="Choisir une pièce jointe"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          void pick(selected);
        }}
      />
      {!!error && <ErrorState error={error} />}
      {recording ? (
        <>
          <Text style={s.small} accessibilityLiveRegion="polite">
            Enregistrement · {seconds} s / {MAX_VOICE_SECONDS} s
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
        <>
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
        </>
      ) : (
        <View style={[s.row, { flexWrap: "wrap" }]}>
          <Button
            title="Joindre un fichier"
            secondary
            disabled={disabled || !active || busy}
            onPress={() => input.current?.click()}
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
