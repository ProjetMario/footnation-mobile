import { expect, it, vi } from "vitest";
import { changePushPreference } from "../src/lib/pushPreference";

function ports() {
  const calls: string[] = [];
  return {
    calls,
    value: {
      save: vi.fn(async (value: boolean) => {
        calls.push(`save:${value}`);
      }),
      register: vi.fn(async () => {
        calls.push("register");
      }),
      unregister: vi.fn(async () => {
        calls.push("unregister");
      }),
    },
  };
}

it("active l’envoi seulement après confirmation de l’appareil", async () => {
  const test = ports();
  await changePushPreference(true, test.value);
  expect(test.calls).toEqual(["save:false", "register", "save:true"]);
});

it("laisse l’envoi désactivé si l’inscription échoue", async () => {
  const test = ports();
  test.value.register.mockRejectedValueOnce(new Error("Réseau"));
  await expect(changePushPreference(true, test.value)).rejects.toThrow(
    "Réseau",
  );
  expect(test.calls).toEqual(["save:false"]);
  expect(test.value.save).toHaveBeenCalledTimes(1);
});

it("retire l’appareil après un échec de la préférence finale", async () => {
  const test = ports();
  test.value.save
    .mockImplementationOnce(async () => {
      test.calls.push("save:false");
    })
    .mockRejectedValueOnce(new Error("Préférence"));
  await expect(changePushPreference(true, test.value)).rejects.toThrow(
    "Préférence",
  );
  expect(test.calls).toEqual(["save:false", "register", "unregister"]);
});

it("désactive la préférence avant de retirer l’appareil", async () => {
  const test = ports();
  await changePushPreference(false, test.value);
  expect(test.calls).toEqual(["save:false", "unregister"]);
});
