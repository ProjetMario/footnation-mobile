import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAccountSessionStorage } from "./accountSessionStorage";
export default createAccountSessionStorage(AsyncStorage, {
  // Every tab uses this namespace for SDK reads/writes and the atomic removal.
  // Supabase's current SDK is lockless by default; a per-instance queue alone
  // would not protect the displayed account against a sign-in in another tab.
  withLock: (key, operation) => {
    const locks = globalThis.navigator?.locks;
    return locks
      ? locks.request(`footnation-storage:${key}`, operation)
      : operation();
  },
  // Older web runtimes must not do an unsafe compare-then-remove. Auth will
  // reject the deleted account on its next server validation instead.
  canRemoveAccount: () =>
    typeof globalThis.navigator?.locks?.request === "function",
});
