import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import storage from "./sessionStorage.native";
import { supabase } from "./supabase";
import {
  createPushRegistration,
  pushRenewalDue,
  type PushRegistration,
} from "./pushRegistration";
const recordKey = "footnation-native-push-v1";
const deviceKey = "footnation-native-push-device";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const projectId =
  Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
export const pushDeviceAvailable =
  process.env.EXPO_PUBLIC_NATIVE_PUSH_ENABLED === "true" &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
  (Platform.OS === "ios" || Platform.OS === "android") &&
  typeof projectId === "string" &&
  uuid.test(projectId);
export const pushDeviceAvailabilityMessage = pushDeviceAvailable
  ? "Cette préférence s’applique à votre compte et inscrit ce téléphone."
  : "Les alertes seront disponibles dans une version Android ou iOS configurée pour FootNation.";
async function readRecord(): Promise<PushRegistration | null> {
  const raw = await storage.getItem(recordKey);
  if (!raw) return null;
  let value: PushRegistration;
  try {
    value = JSON.parse(raw) as PushRegistration;
  } catch {
    throw new Error(
      "Le suivi des notifications de cet appareil doit être vérifié.",
    );
  }
  if (
    !value ||
    ![value.installationId, value.userId, value.projectId, value.leaseId].every(
      (id) => typeof id === "string" && uuid.test(id),
    ) ||
    typeof value.token !== "string" ||
    value.token.length > 256 ||
    !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(
      value.token,
    ) ||
    !["ios", "android"].includes(value.platform) ||
    !["pending", "active", "revoking"].includes(value.phase)
  )
    throw new Error(
      "Le suivi des notifications de cet appareil doit être vérifié.",
    );
  return value;
}
async function accessTokenFor(userId: string) {
  const result = await supabase.auth.getSession();
  if (result.error) throw result.error;
  const session = result.data.session;
  if (!session || session.user.id !== userId)
    throw new Error("Votre session a changé. Rechargez cet écran.");
  const verified = await supabase.auth.getUser(session.access_token);
  if (verified.error) throw verified.error;
  if (verified.data.user?.id !== userId)
    throw new Error("Votre session a expiré.");
  return session.access_token;
}
const registration = createPushRegistration({
  read: readRecord,
  write: (value) =>
    value
      ? storage.setItem(recordKey, JSON.stringify(value))
      : storage.removeItem(recordKey),
  requireUser: async (userId) => {
    await accessTokenFor(userId);
  },
  register: async (value) => {
    const token = await accessTokenFor(value.userId);
    const { data, error } = await supabase
      .rpc("register_native_push_device", {
        p_installation_id: value.installationId,
        p_project_id: value.projectId,
        p_token: value.token,
        p_platform: value.platform,
        p_lease_id: value.leaseId,
      })
      .setHeader("Authorization", `Bearer ${token}`);
    if (error)
      throw new Error(
        "L’inscription de cet appareil n’a pas pu être confirmée. Réessayez.",
      );
    if (typeof data !== "string" || !uuid.test(data))
      throw new Error("La confirmation de l’appareil est invalide.");
    return data;
  },
  revoke: async (value) => {
    const token = await accessTokenFor(value.userId);
    const { data, error } = await supabase
      .rpc("revoke_native_push_device", {
        p_installation_id: value.installationId,
        p_lease_id: value.leaseId,
      })
      .setHeader("Authorization", `Bearer ${token}`);
    if (error || data !== true)
      throw new Error(
        "La désactivation des alertes n’a pas pu être confirmée. Réessayez avec une connexion réseau.",
      );
  },
});
let operation: Promise<unknown> = Promise.resolve();
function serialize<T>(action: () => Promise<T>) {
  const next = operation.then(action, action);
  operation = next.catch(() => undefined);
  return next;
}
/** Called only by an explicit activation action once push delivery is configured. */
async function registerDevice(
  userId: string,
  prompt: boolean,
  forceTokenCheck = false,
): Promise<void> {
  if (!pushDeviceAvailable)
    throw new Error("Les alertes ne sont pas disponibles dans cette version.");
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    throw new Error(
      "Installez la version Android ou iOS de FootNation pour activer les alertes.",
    );
  if (typeof projectId !== "string" || !uuid.test(projectId))
    throw new Error(
      "Les alertes ne sont pas encore disponibles dans cette version de l’application.",
    );
  if (Platform.OS !== "ios" && Platform.OS !== "android")
    throw new Error("Appareil non compatible.");
  await accessTokenFor(userId);
  const old = await readRecord();
  if (old && old.userId !== userId)
    throw new Error(
      "Une inscription d’un autre compte doit encore être désactivée sur cet appareil.",
    );
  if (!prompt) {
    if (!old) return;
    if (old.phase === "revoking") {
      await registration.revoke(userId);
      return;
    }
    const { data, error } = await supabase
      .from("user_preferences")
      .select("push_notifications")
      .eq("user_id", userId)
      .maybeSingle();
    if (error)
      throw new Error("La préférence de notifications est indisponible.");
    if (data?.push_notifications !== true) return;
    await accessTokenFor(userId);
  }
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("footnation", {
      name: "FootNation",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  let permissions = await Notifications.getPermissionsAsync();
  const granted = () =>
    permissions.granted ||
    permissions.ios?.status ===
      Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (prompt && !granted() && permissions.canAskAgain)
    permissions = await Notifications.requestPermissionsAsync();
  if (!granted()) {
    if (!prompt && old) {
      await registration.revoke(userId);
      return;
    }
    throw new Error(
      "Autorisez les notifications de FootNation dans les réglages de votre téléphone.",
    );
  }
  if (!prompt && old && !forceTokenCheck && !pushRenewalDue(old)) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  if (
    token.length > 256 ||
    !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(token)
  )
    throw new Error(
      "Le téléphone n’a pas fourni de jeton de notification valide.",
    );
  if (!prompt && old?.phase === "active" && old.token === token) {
    if (!pushRenewalDue(old)) return;
    const authorization = await accessTokenFor(userId);
    const { data, error } = await supabase
      .rpc("renew_native_push_device", {
        p_installation_id: old.installationId,
        p_lease_id: old.leaseId,
      })
      .setHeader("Authorization", `Bearer ${authorization}`);
    if (error)
      throw new Error(
        "Le renouvellement des notifications doit être réessayé.",
      );
    await accessTokenFor(userId);
    if (data === true) {
      await storage.setItem(
        recordKey,
        JSON.stringify({ ...old, confirmedAt: Date.now() }),
      );
      return;
    }
    if (data !== false)
      throw new Error("La confirmation de l’appareil est invalide.");
  }
  let installationId = await storage.getItem(deviceKey);
  if (!installationId) {
    installationId = randomUUID();
    await storage.setItem(deviceKey, installationId);
  }
  if (!uuid.test(installationId))
    throw new Error("L’identifiant de cet appareil doit être vérifié.");
  const retry =
    old?.phase === "pending" &&
    old.installationId === installationId &&
    old.projectId === projectId &&
    old.token === token &&
    old.platform === Platform.OS;
  await registration.register({
    installationId,
    userId,
    projectId,
    token,
    platform: Platform.OS,
    leaseId: retry ? old.leaseId : randomUUID(),
  });
}
export function registerPushDevice(userId: string): Promise<void> {
  return serialize(() => registerDevice(userId, true));
}
/** Only maintains this device's existing opt-in; never prompts or enrolls a new device. */
export function refreshPushDevice(
  userId: string,
  forceTokenCheck = false,
): Promise<void> {
  return serialize(() => registerDevice(userId, false, forceTokenCheck));
}
export function unregisterPushDevice(userId: string): Promise<void> {
  return serialize(() => registration.revoke(userId));
}
