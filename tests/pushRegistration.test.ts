import { expect, it, vi } from "vitest";
import {
  createPushRegistration,
  pushRenewalDue,
  type PushRegistration,
  type PushRegistrationPorts,
} from "../src/lib/pushRegistration";
const input = {
  installationId: "device",
  userId: "owner",
  projectId: "project",
  token: "secret",
  platform: "ios" as const,
  leaseId: "attempt",
};
function setup() {
  let stored: PushRegistration | null = null;
  const ports: PushRegistrationPorts = {
    read: vi.fn(async () => stored),
    write: vi.fn(async (value) => {
      stored = value;
    }),
    requireUser: vi.fn(async () => {}),
    register: vi.fn(async (value) => value.leaseId),
    revoke: vi.fn(async () => {}),
  };
  return {
    ports,
    manager: createPushRegistration(ports),
    stored: () => stored,
  };
}
it("persiste l’identifiant d’opération avant inscription", async () => {
  const { ports, manager, stored } = setup();
  vi.mocked(ports.register).mockImplementation(async (value) => {
    expect(stored()).toEqual({ ...input, phase: "pending" });
    return value.leaseId;
  });
  await manager.register(input);
  expect(stored()?.phase).toBe("active");
});
it("ne contacte pas le serveur si le journal ne peut pas être sauvegardé", async () => {
  const { ports, manager } = setup();
  vi.mocked(ports.write).mockRejectedValueOnce(new Error("Stockage"));
  await expect(manager.register(input)).rejects.toThrow("Stockage");
  expect(ports.register).not.toHaveBeenCalled();
});
it("révoque une inscription ambiguë sans jamais la recréer", async () => {
  const { ports, manager, stored } = setup();
  vi.mocked(ports.register).mockRejectedValueOnce(new Error("Réseau"));
  await expect(manager.register(input)).rejects.toThrow("Réseau");
  await manager.revoke("owner");
  expect(ports.register).toHaveBeenCalledTimes(1);
  expect(ports.revoke).toHaveBeenCalledWith(
    expect.objectContaining({ ...input, phase: "revoking" }),
  );
  expect(stored()).toBeNull();
});
it("conserve l’intention de retrait après échec et autorise sa reprise", async () => {
  const { ports, manager, stored } = setup();
  await manager.register(input);
  vi.mocked(ports.revoke).mockRejectedValueOnce(new Error("Réseau"));
  await expect(manager.revoke("owner")).rejects.toThrow("Réseau");
  expect(stored()?.phase).toBe("revoking");
  await expect(manager.register(input)).rejects.toThrow("réutilisée");
  await manager.revoke("owner");
  expect(stored()).toBeNull();
});
it("sérialise le retrait après l’inscription en cours", async () => {
  const { ports, manager, stored } = setup();
  let release!: (lease: string) => void;
  vi.mocked(ports.register).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const registering = manager.register(input);
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  const revoking = manager.revoke("owner");
  expect(ports.revoke).not.toHaveBeenCalled();
  release(input.leaseId);
  await Promise.all([registering, revoking]);
  expect(stored()).toBeNull();
});
it("refuse une session changée avant toute écriture", async () => {
  const { ports, manager } = setup();
  vi.mocked(ports.requireUser).mockRejectedValueOnce(new Error("Session"));
  await expect(manager.register(input)).rejects.toThrow("Session");
  expect(ports.write).not.toHaveBeenCalled();
});
it("ne perd pas le journal d’un autre compte et retire l’ancien avant remplacement", async () => {
  const { ports, manager, stored } = setup();
  await manager.register(input);
  await expect(
    manager.register({ ...input, userId: "other", leaseId: "new" }),
  ).rejects.toThrow("autre compte");
  await expect(manager.revoke("other")).rejects.toThrow("autre compte");
  expect(stored()?.userId).toBe("owner");
  await manager.register({ ...input, leaseId: "new" });
  expect(ports.revoke).toHaveBeenCalledWith(
    expect.objectContaining({ ...input, phase: "revoking" }),
  );
  expect(stored()?.leaseId).toBe("new");
});
it("reprend avec le même identifiant après perte de confirmation locale", async () => {
  const { ports, manager, stored } = setup();
  const write = vi.mocked(ports.write).getMockImplementation()!;
  vi.mocked(ports.write)
    .mockImplementationOnce(write)
    .mockRejectedValueOnce(new Error("Stockage"));
  await expect(manager.register(input)).rejects.toThrow("Stockage");
  expect(stored()?.phase).toBe("pending");
  await manager.register(input);
  expect(
    vi.mocked(ports.register).mock.calls.map(([entry]) => entry.leaseId),
  ).toEqual(["attempt", "attempt"]);
});

it("garde l’intention si la session change après le RPC", async () => {
  const { ports, manager, stored } = setup();
  vi.mocked(ports.requireUser)
    .mockResolvedValueOnce()
    .mockResolvedValueOnce()
    .mockRejectedValueOnce(new Error("Session"));
  await expect(manager.register(input)).rejects.toThrow("Session");
  expect(stored()).toEqual({ ...input, phase: "pending" });
  expect(ports.register).toHaveBeenCalledTimes(1);
});

it("renouvelle les inscriptions anciennes sans recréer une révocation", () => {
  const now = 10 * 86400000;
  expect(pushRenewalDue({ ...input, phase: "active" }, now)).toBe(true);
  expect(
    pushRenewalDue(
      { ...input, phase: "active", confirmedAt: now - 86400000 },
      now,
    ),
  ).toBe(false);
  expect(
    pushRenewalDue(
      { ...input, phase: "active", confirmedAt: now - 7 * 86400000 },
      now,
    ),
  ).toBe(true);
  expect(pushRenewalDue({ ...input, phase: "pending" }, now)).toBe(true);
  expect(pushRenewalDue({ ...input, phase: "revoking" }, now)).toBe(false);
  expect(
    pushRenewalDue({ ...input, phase: "active", confirmedAt: now + 1 }, now),
  ).toBe(true);
});
