import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createFixtureServer } from "../scripts/ux-fixture-server.mjs";
import { randomUUID } from "node:crypto";
vi.mock("../src/lib/supabase", () => ({ supabase: {} }));
import { createAdminApi } from "../src/lib/admin/api";
import { resources } from "../src/lib/admin/contracts";
let server: ReturnType<typeof createFixtureServer>;
let base: string;
const clients: ReturnType<typeof createClient>[] = [];
const memberId = "00000000-0000-4000-8000-000000000001";
const adminId = "00000000-0000-4000-8000-000000000003";
beforeEach(async () => {
  server = createFixtureServer({ superAdmin: true });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterEach(async () => {
  for (const client of clients.splice(0)) client.auth.stopAutoRefresh();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
async function sign(role = "admin") {
  const client = createClient(base, "fixture", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clients.push(client);
  const result = await client.auth.signInWithPassword({
    email: `${role}@fixture.test`,
    password: "fixture-only",
  });
  expect(result.error).toBeNull();
  return { client, api: createAdminApi(result.data.user!.id, client) };
}
it("loads every resource through the actual Supabase HTTP client and paginates without duplicates", async () => {
  const { api } = await sign();
  await api.access();
  for (const resource of resources)
    expect((await api.page(resource)).rows).toBeInstanceOf(Array);
  const first = await api.page("users");
  const second = await api.page("users", {}, first.nextOffset!);
  expect(first.rows).toHaveLength(30);
  expect(
    new Set([...first.rows, ...second.rows].map((row) => row.id)).size,
  ).toBe(first.total);
  const overview = await api.overview("month");
  expect(overview.counts.users).toBe(first.total);
  expect(overview.signups).toHaveLength(12);
});
it("edits and reloads a profile, then rejects its stale snapshot", async () => {
  const { api } = await sign();
  const row = (await api.page("users", { id: memberId })).rows[0];
  await api.mutate({
    record: row,
    action: "profile.update",
    values: { full_name: "Nom fictif modifié" },
    reason: "Correction de recette",
  });
  expect((await api.page("users", { id: memberId })).rows[0].full_name).toBe(
    "Nom fictif modifié",
  );
  await expect(
    api.mutate({
      record: row,
      action: "profile.premium",
      values: { is_premium: true },
      reason: "Ancienne fiche",
    }),
  ).rejects.toThrow("modifiée");
});
it("turns Premium on and back off and keeps completion overrides separate from profile fields", async () => {
  const { api } = await sign();
  let row = (await api.page("users", { id: memberId })).rows[0];
  await api.mutate({
    record: row,
    action: "profile.premium",
    values: { is_premium: true },
    reason: "Recette Premium",
  });
  expect((await api.page("premium", { id: memberId })).total).toBe(1);
  row = (await api.page("users", { id: memberId })).rows[0];
  await api.mutate({
    record: row,
    action: "profile.premium",
    values: { is_premium: false },
    reason: "Fin de recette",
  });
  expect((await api.page("premium", { id: memberId })).total).toBe(0);
  row = (await api.page("users", { id: memberId })).rows[0];
  await api.mutate({
    record: row,
    action: "profile.completion",
    values: { enabled: true },
    reason: "Dérogation de recette",
  });
  const after = (await api.page("users", { id: memberId })).rows[0];
  expect(after._completion_override).toBeTruthy();
  expect(after.avatar_url).toBeNull();
});
it("rejects ordinary users and invalidates access after revocation", async () => {
  const member = await sign("player");
  await expect(member.api.access()).rejects.toThrow("réservé");
  await expect(member.api.page("users")).rejects.toThrow("refusé");
  const { api } = await sign();
  await api.access();
  await fetch(`${base}/__fixture`, {
    method: "POST",
    body: JSON.stringify({ scenario: "forbidden" }),
  });
  await expect(api.page("users")).rejects.toThrow();
});
it("handles empty responses and service failures distinctly", async () => {
  const { api } = await sign();
  await fetch(`${base}/__fixture`, {
    method: "POST",
    body: JSON.stringify({ scenario: "empty" }),
  });
  expect((await api.page("users")).total).toBe(0);
  await fetch(`${base}/__fixture`, {
    method: "POST",
    body: JSON.stringify({ scenario: "error" }),
  });
  await expect(api.page("users")).rejects.toThrow();
});
it("blocks reported messages and preserves the confirmation snapshot", async () => {
  const { api } = await sign();
  const row = (await api.page("message-reports")).rows[0];
  await api.mutate({
    record: row,
    action: "message.block",
    values: {
      blocked: true,
      status: "resolved",
      expected_message: row._message_version!,
    },
    reason: "Spam fictif",
  });
  const after = (await api.page("message-reports")).rows[0];
  expect(after.status).toBe("resolved");
  expect((after._message as any).is_blocked).toBe(true);
});
it("confirms account actions without sending real mail and never deletes the acting admin", async () => {
  const { api } = await sign();
  const row = (await api.page("users", { id: memberId })).rows[0];
  const result = await api.edge("admin-console-account", {
    action: "reminder",
    userId: memberId,
    expected: row._version,
    operationId: randomUUID(),
    reason: "Recette uniquement",
  });
  expect(result.ok).toBe(true);
  expect(result.detail).toContain("Aucun e-mail réel");
  const self = (await api.page("users", { id: adminId })).rows[0];
  await expect(
    api.edge("admin-console-account", {
      action: "delete_account",
      userId: adminId,
      expected: self._version,
      operationId: randomUUID(),
      reason: "Recette uniquement",
    }),
  ).rejects.toThrow("Auto-suppression");
});
