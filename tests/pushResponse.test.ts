import { describe, expect, it, vi } from "vitest";
import {
  pushNotificationId,
  createPushResponseController,
  resolvePushResponse,
} from "../src/lib/pushResponse";

const notificationId = "10000000-0000-4000-8000-000000000001";

describe("push responses", () => {
  it("accepts only a notification UUID", () => {
    expect(pushNotificationId({ notificationId })).toBe(notificationId);
    expect(pushNotificationId({ notificationId: "../messages" })).toBeNull();
    expect(pushNotificationId({ url: "/messages" })).toBeNull();
  });

  it("waits for an authenticated session", async () => {
    const notificationLink = vi.fn();
    await expect(
      resolvePushResponse(
        null,
        { notificationId },
        {
          authenticatedUserId: vi.fn(),
          notificationLink,
        },
      ),
    ).resolves.toEqual({ consumed: false, path: null });
    expect(notificationLink).not.toHaveBeenCalled();
  });

  it("refuses a response after the session changes", async () => {
    const notificationLink = vi.fn();
    await expect(
      resolvePushResponse(
        "user-a",
        { notificationId },
        {
          authenticatedUserId: async () => "user-b",
          notificationLink,
        },
      ),
    ).resolves.toEqual({ consumed: false, path: null });
    expect(notificationLink).not.toHaveBeenCalled();
  });

  it("uses only the verified stored internal link", async () => {
    const dependencies = {
      authenticatedUserId: async () => "user-a",
      notificationLink: vi.fn(async () =>
        Promise.resolve("https://www.foot-nation.com/posts/example"),
      ),
    };
    await expect(
      resolvePushResponse("user-a", { notificationId }, dependencies),
    ).resolves.toEqual({ consumed: true, path: "/posts/example" });
    expect(dependencies.notificationLink).toHaveBeenCalledWith(
      notificationId,
      "user-a",
    );
    dependencies.notificationLink.mockResolvedValueOnce("https://evil.test");
    await expect(
      resolvePushResponse("user-a", { notificationId }, dependencies),
    ).resolves.toEqual({ consumed: true, path: null });
  });
});

it("refuse le lien si le compte change pendant la lecture de notification", async () => {
  await expect(
    resolvePushResponse(
      "user-a",
      { notificationId },
      {
        authenticatedUserId: vi
          .fn()
          .mockResolvedValueOnce("user-a")
          .mockResolvedValueOnce("user-b"),
        notificationLink: async () => "/messages",
      },
    ),
  ).resolves.toEqual({ consumed: false, path: null });
});

function controllerSetup() {
  let user: string | null = "user-a";
  let last = "response-a";
  const ports = {
    currentUserId: () => user,
    resolve: vi.fn(async () => ({ consumed: true, path: "/notifications" })),
    lastResponseId: () => last,
    clear: vi.fn(),
    navigate: vi.fn(),
  };
  return {
    ports,
    controller: createPushResponseController(ports),
    setUser: (value: string | null) => {
      user = value;
    },
    setLast: (value: string) => {
      last = value;
    },
  };
}
it("ne navigue pas après déconnexion durant la résolution", async () => {
  const { ports, controller, setUser } = controllerSetup();
  ports.resolve.mockImplementation(async () => {
    setUser(null);
    return { consumed: true, path: "/messages" };
  });
  await controller.handle({ id: "response-a", data: {} });
  expect(ports.navigate).not.toHaveBeenCalled();
  expect(ports.clear).not.toHaveBeenCalled();
});
it("ne traite qu’une fois les doubles événements du même clic", async () => {
  const { ports, controller } = controllerSetup();
  await Promise.all([
    controller.handle({ id: "response-a", data: {} }),
    controller.handle({ id: "response-a", data: {} }),
  ]);
  await controller.handle({ id: "response-a", data: {} });
  expect(ports.navigate).toHaveBeenCalledTimes(1);
});
it("un ancien clic lent ne remplace jamais le dernier clic", async () => {
  const { ports, controller, setLast } = controllerSetup();
  let release!: (value: { consumed: boolean; path: string }) => void;
  ports.resolve.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const first = controller.handle({ id: "response-a", data: {} });
  setLast("response-b");
  await controller.handle({ id: "response-b", data: {} });
  release({ consumed: true, path: "/messages" });
  await first;
  expect(ports.navigate).toHaveBeenCalledExactlyOnceWith("/notifications");
  expect(ports.clear).toHaveBeenCalledTimes(1);
});
it("ne supprime pas un nouveau clic OS encore non traité", async () => {
  const { ports, controller, setLast } = controllerSetup();
  setLast("response-b");
  await controller.handle({ id: "response-a", data: {} });
  expect(ports.clear).not.toHaveBeenCalled();
});
it("une erreur réseau conserve le clic pour une reprise", async () => {
  const { ports, controller } = controllerSetup();
  ports.resolve.mockRejectedValueOnce(new Error("offline"));
  await expect(
    controller.handle({ id: "response-a", data: {} }),
  ).rejects.toThrow();
  await controller.handle({ id: "response-a", data: {} });
  expect(ports.navigate).toHaveBeenCalledTimes(1);
});
