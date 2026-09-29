export type PushRegistration = {
  installationId: string;
  userId: string;
  projectId: string;
  token: string;
  platform: "ios" | "android";
  leaseId: string;
  phase: "pending" | "active" | "revoking";
  confirmedAt?: number;
};
export interface PushRegistrationPorts {
  read(): Promise<PushRegistration | null>;
  write(value: PushRegistration | null): Promise<void>;
  requireUser(userId: string): Promise<void>;
  register(value: PushRegistration): Promise<string>;
  revoke(value: PushRegistration): Promise<void>;
}
export function createPushRegistration(ports: PushRegistrationPorts) {
  let tail: Promise<unknown> = Promise.resolve();
  function serialize<T>(action: () => Promise<T>): Promise<T> {
    const operation = tail.then(action, action);
    tail = operation.catch(() => undefined);
    return operation;
  }
  async function revokeStored(stored: PushRegistration) {
    await ports.requireUser(stored.userId);
    const revoking = { ...stored, phase: "revoking" as const };
    await ports.write(revoking);
    await ports.requireUser(stored.userId);
    await ports.revoke(revoking);
    await ports.write(null);
  }
  return {
    register(value: Omit<PushRegistration, "phase">) {
      return serialize(async () => {
        await ports.requireUser(value.userId);
        const old = await ports.read();
        if (old && old.userId !== value.userId)
          throw new Error(
            "Une inscription d’un autre compte doit encore être désactivée sur cet appareil.",
          );
        if (old && old.leaseId === value.leaseId) {
          if (
            old.phase === "revoking" ||
            old.installationId !== value.installationId ||
            old.projectId !== value.projectId ||
            old.token !== value.token ||
            old.platform !== value.platform
          )
            throw new Error("Cette inscription ne peut pas être réutilisée.");
        } else if (old) {
          await revokeStored(old);
        }
        const pending = { ...value, phase: "pending" as const };
        await ports.write(pending);
        await ports.requireUser(value.userId);
        const leaseId = await ports.register(pending);
        if (leaseId !== value.leaseId)
          throw new Error("La confirmation de l’appareil est invalide.");
        await ports.requireUser(value.userId);
        const confirmed = {
          ...pending,
          phase: "active" as const,
          confirmedAt: Date.now(),
        };
        await ports.write(confirmed);
        await ports.requireUser(value.userId);
        return confirmed;
      });
    },
    revoke(userId: string) {
      return serialize(async () => {
        const stored = await ports.read();
        if (!stored) return;
        if (stored.userId !== userId)
          throw new Error("L’inscription appartient à un autre compte.");
        await revokeStored(stored);
      });
    },
  };
}

/** Renew well before the server's 30-day expiry; legacy records renew once. */
export function pushRenewalDue(
  record: PushRegistration,
  now = Date.now(),
): boolean {
  return (
    record.phase === "pending" ||
    (record.phase === "active" &&
      (!Number.isFinite(record.confirmedAt) ||
        record.confirmedAt! > now ||
        now - record.confirmedAt! >= 7 * 24 * 60 * 60 * 1000))
  );
}
