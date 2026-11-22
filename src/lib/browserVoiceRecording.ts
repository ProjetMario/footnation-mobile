import { MAX_VOICE_SECONDS } from "./messageAttachment";

export function voiceRecordingMime() {
  if (typeof MediaRecorder === "undefined") return null;
  return (
    ["audio/webm", "audio/mp4", "audio/ogg"].find((mime) =>
      MediaRecorder.isTypeSupported(mime),
    ) || null
  );
}
export type VoiceResult = { blob: Blob; mime: string; seconds: number };
export class BrowserVoiceRecording {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private cancelled = false;
  private startedAt = 0;
  private chunks: Blob[] = [];
  private completion: Promise<VoiceResult> | null = null;
  private limit: ReturnType<typeof setTimeout> | null = null;
  constructor(private readonly onLimit: () => void) {}
  async start() {
    const mime = voiceRecordingMime();
    if (
      !globalThis.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      !mime
    )
      throw new Error(
        "Les messages vocaux nécessitent un navigateur compatible et une connexion HTTPS.",
      );
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (this.cancelled) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    this.stream = stream;
    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        audioBitsPerSecond: 128000,
      });
      this.recorder = recorder;
      this.completion = new Promise<VoiceResult>((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size) this.chunks.push(event.data);
        };
        recorder.onerror = () => {
          this.release();
          reject(new Error("L’enregistrement a été interrompu. Réessayez."));
        };
        recorder.onstop = () => {
          const seconds = Math.min(
            MAX_VOICE_SECONDS,
            Math.max(0.001, (Date.now() - this.startedAt) / 1000),
          );
          this.release();
          const blob = new Blob(this.chunks, { type: mime });
          this.chunks = [];
          resolve({ blob, mime, seconds });
        };
      });
      // A device can fail before the user presses Terminer. Keep that rejection handled.
      void this.completion.catch(() => {});
      this.startedAt = Date.now();
      recorder.start(1000);
      this.limit = setTimeout(this.onLimit, MAX_VOICE_SECONDS * 1000);
      return true;
    } catch (error) {
      this.release();
      throw error;
    }
  }
  private release() {
    if (this.limit) clearTimeout(this.limit);
    this.limit = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
  async stop(): Promise<VoiceResult | null> {
    if (!this.recorder || !this.completion) return null;
    if (this.recorder.state !== "inactive") this.recorder.stop();
    return this.completion;
  }
  dispose() {
    this.cancelled = true;
    if (this.recorder?.state !== "inactive") {
      try {
        this.recorder?.stop();
      } catch {
        /* Device already released. */
      }
    }
    this.release();
  }
}
