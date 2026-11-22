import { createClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { confirmMessageReads } from "../src/lib/messageReadReceipt";

function fixture(status: number, body: unknown) {
  const fetcher = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  const client = createClient(
    "https://fixture.supabase.co",
    "public-test-key",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetcher },
    },
  );
  return { client, fetcher };
}

it("serializes the read receipt through supabase-js and acknowledges only returned rows", async () => {
  const { client, fetcher } = fixture(200, [{ id: "one" }]);
  await expect(
    confirmMessageReads(client, "viewer", "peer", ["one", "two"]),
  ).resolves.toEqual(["one"]);
  const [input, init] = fetcher.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  const url = new URL(input);
  expect(init.method).toBe("PATCH");
  expect(url.searchParams.get("receiver_id")).toBe("eq.viewer");
  expect(url.searchParams.get("sender_id")).toBe("eq.peer");
  expect(url.searchParams.get("id")).toBe("in.(one,two)");
  expect(url.searchParams.get("read_at")).toBe("is.null");
  expect(url.searchParams.get("or")).toBe(
    "(is_blocked.is.null,is_blocked.eq.false)",
  );
  expect(Object.keys(JSON.parse(String(init.body)))).toEqual(["read_at"]);
});

it("propagates a 400 response without acknowledging any messages", async () => {
  const { client } = fixture(400, {
    code: "PGRST100",
    message: "Invalid request",
  });
  await expect(
    confirmMessageReads(client, "viewer", "peer", ["one"]),
  ).rejects.toMatchObject({ code: "PGRST100" });
});

it("does not acknowledge an empty server result or enter a successful retry loop", async () => {
  const { client } = fixture(200, []);
  await expect(
    confirmMessageReads(client, "viewer", "peer", ["one"]),
  ).rejects.toThrow("Aucune confirmation");
});

it("does not issue a write for an empty visible-message batch", async () => {
  const { client, fetcher } = fixture(200, []);
  await expect(
    confirmMessageReads(client, "viewer", "peer", []),
  ).resolves.toEqual([]);
  expect(fetcher).not.toHaveBeenCalled();
});
