import { notificationPath } from "./notificationPath";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PushResponseResult = {
  consumed: boolean;
  path: string | null;
};

export function pushNotificationId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const value = (data as { notificationId?: unknown }).notificationId;
  return typeof value === "string" && uuid.test(value) ? value : null;
}

export async function resolvePushResponse(
  expectedUserId: string | null | undefined,
  data: unknown,
  dependencies: {
    authenticatedUserId: () => Promise<string | null>;
    notificationLink: (
      notificationId: string,
      receiverId: string,
    ) => Promise<string | null | undefined>;
  },
): Promise<PushResponseResult> {
  if (!expectedUserId) return { consumed: false, path: null };
  const notificationId = pushNotificationId(data);
  if (!notificationId) return { consumed: true, path: null };
  const authenticatedUserId = await dependencies.authenticatedUserId();
  if (authenticatedUserId !== expectedUserId)
    return { consumed: false, path: null };
  const link = await dependencies.notificationLink(
    notificationId,
    expectedUserId,
  );
  if ((await dependencies.authenticatedUserId()) !== expectedUserId)
    return { consumed: false, path: null };
  return { consumed: true, path: notificationPath(link) };
}

export function createPushResponseController(ports: {
  currentUserId(): string | null | undefined;
  resolve(userId: string, data: unknown): Promise<PushResponseResult>;
  lastResponseId(): string | undefined;
  clear(): void;
  navigate(path: string): void;
}) {
  let generation = 0;
  const inFlight = new Set<string>();
  const consumed = new Set<string>();
  return {
    invalidate() {
      generation += 1;
    },
    async handle(response: { id: string; data: unknown }) {
      const userId = ports.currentUserId();
      if (!userId) return;
      const key = `${userId}:${response.id}`;
      if (inFlight.has(key) || consumed.has(key)) return;
      const current = ++generation;
      inFlight.add(key);
      try {
        const result = await ports.resolve(userId, response.data);
        if (
          current !== generation ||
          ports.currentUserId() !== userId ||
          !result.consumed
        )
          return;
        consumed.add(key);
        if (consumed.size > 64)
          consumed.delete(consumed.values().next().value!);
        // An older response must never erase a newer OS response.
        if (ports.lastResponseId() === response.id) ports.clear();
        if (result.path) ports.navigate(result.path);
      } finally {
        inFlight.delete(key);
      }
    },
  };
}
