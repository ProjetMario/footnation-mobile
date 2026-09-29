import { afterEach, beforeEach, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createFixtureServer } from "../scripts/ux-fixture-server.mjs";
let server: ReturnType<typeof createFixtureServer>;
let base: string;
const clients: ReturnType<typeof createClient>[] = [];
beforeEach(async () => {
  server = createFixtureServer({ socialAuth: true });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterEach(async () => {
  clients.forEach((client) => client.auth.stopAutoRefresh());
  clients.length = 0;
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
async function sign(role?: string) {
  const client = createClient(base, "fixture-only", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clients.push(client);
  if (role)
    expect(
      (
        await client.auth.signInWithPassword({
          email: `${role}@fixture.test`,
          password: "fixture-only",
        })
      ).error,
    ).toBeNull();
  return client;
}
const complete = {
  p_full_name: "Sam Test",
  p_username: "sam_test",
  p_birthdate: "2000-01-01",
  p_account_type: "personal",
  p_primary_role: "Joueur",
  p_terms_version: "1.0",
  p_referral: null,
};
it("persists local completion only for the current synthetic account", async () => {
  const client = await sign("new"),
    other = await sign("parent");
  expect((await client.rpc("get_social_signup_status")).data).toMatchObject({
    required: true,
    full_name: "Sam Test",
    birthdate: null,
  });
  expect(
    (await client.rpc("get_member_access_status")).data.onboarding_required,
  ).toBe(true);
  expect(
    (await client.rpc("complete_social_signup", complete)).data,
  ).toMatchObject({ allowed: true, onboarding_required: false });
  expect((await client.rpc("get_social_signup_status")).data).toMatchObject({
    required: false,
    username: "sam_test",
  });
  expect((await client.rpc("get_member_access_status")).data).toMatchObject({
    state: "eligible",
    allowed: true,
    onboarding_required: false,
  });
  expect((await other.rpc("get_social_signup_status")).data.required).toBe(
    true,
  );
});
it("keeps the parental gate after completing a minor's synthetic profile", async () => {
  const client = await sign("parent");
  expect(
    (await client.rpc("complete_social_signup", complete)).data,
  ).toMatchObject({
    state: "parent_required",
    allowed: false,
    onboarding_required: false,
  });
  expect((await client.rpc("get_member_access_status")).data).toMatchObject({
    state: "parent_required",
    allowed: false,
  });
});
it("does not fabricate successful signup for anonymous or incomplete requests", async () => {
  const anon = await sign();
  expect((await anon.rpc("get_social_signup_status")).status).toBe(401);
  const client = await sign("new");
  expect((await client.rpc("complete_social_signup", {})).status).toBe(400);
  expect((await client.rpc("get_social_signup_status")).data.required).toBe(
    true,
  );
});
