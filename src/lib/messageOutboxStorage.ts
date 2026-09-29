import storage from "./sessionStorage";
import { createMessageOutbox } from "./messageOutbox";
export const messageOutbox = createMessageOutbox(storage);
export function forgetMessageOutboxForAccount(uid: string): Promise<void> {
  return messageOutbox.forgetAccount(uid);
}
