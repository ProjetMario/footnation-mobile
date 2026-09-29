export const pushDeviceAvailable = false;
export const pushDeviceAvailabilityMessage =
  "Activez les alertes depuis l’application FootNation installée sur Android ou iOS.";

export async function registerPushDevice(_userId: string): Promise<void> {
  throw new Error(
    "Les alertes sur téléphone nécessitent l’application Android ou iOS installée.",
  );
}
export async function unregisterPushDevice(_userId: string): Promise<void> {}
export async function refreshPushDevice(
  _userId: string,
  _forceTokenCheck = false,
): Promise<void> {}
