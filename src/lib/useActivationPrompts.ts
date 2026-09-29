import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";
import { createActivationPromptCoordinator } from "./activationPrompts";

export const activationPrompts =
  createActivationPromptCoordinator(AsyncStorage);
export function useActivationPrompts(userId: string | null) {
  const state = useSyncExternalStore(
    activationPrompts.subscribe,
    activationPrompts.snapshot,
    activationPrompts.snapshot,
  );
  useEffect(() => {
    void activationPrompts.adoptAccount(userId);
  }, [userId]);
  return state;
}
