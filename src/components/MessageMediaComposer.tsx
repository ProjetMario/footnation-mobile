import type { LocalMessageFile } from "../lib/messageAttachment";
// Recording and durable file drafts are provided by the native implementation.
export function MessageMediaComposer(_props: {
  uid: string;
  disabled: boolean;
  active: boolean;
  file: LocalMessageFile | null;
  onChange(file: LocalMessageFile | null): void;
  onRecording(recording: boolean): void;
}) {
  return null;
}
