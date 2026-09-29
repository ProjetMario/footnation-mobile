import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
import { createChunkedStorage } from "./chunkedStorage";
import { createAccountSessionStorage } from "./accountSessionStorage";
export default createAccountSessionStorage(
  createChunkedStorage(
    {
      getItem: SecureStore.getItemAsync,
      setItem: (key, value) =>
        SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      removeItem: SecureStore.deleteItemAsync,
    },
    randomUUID,
  ),
);
