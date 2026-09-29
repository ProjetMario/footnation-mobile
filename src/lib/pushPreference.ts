export async function changePushPreference(
  enabled: boolean,
  ports: {
    save(value: boolean): Promise<void>;
    register(): Promise<void>;
    unregister(): Promise<void>;
  },
): Promise<void> {
  await ports.save(false);
  if (!enabled) {
    await ports.unregister();
    return;
  }
  await ports.register();
  try {
    await ports.save(true);
  } catch (error) {
    try {
      await ports.unregister();
    } catch {
      // Delivery remains disabled by the first persisted preference write.
    }
    throw error;
  }
}
