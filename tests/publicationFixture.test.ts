import { afterAll, beforeAll, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createFixtureServer } from "../scripts/ux-fixture-server.mjs";
import { freezePostDraft, newPostDraft } from "../src/lib/postPublication";

const server = createFixtureServer({ publication: true });
const actor = "00000000-0000-4000-8000-000000000001";
let base: string;
let client: ReturnType<typeof createClient>;

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  client = createClient(base, "fixture", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await client.auth.signInWithPassword({
    email: "player@fixture.test",
    password: "fixture-only",
  });
  expect(signed.error).toBeNull();
});
afterAll(async () => {
  client.auth.stopAutoRefresh();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

it("stores only the actor's media and supports confirmed duplicate upload recovery", async () => {
  const bucket = client.storage.from("post-media");
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  expect(
    (await bucket.upload("another-account/media.jpg", bytes)).error,
  ).not.toBeNull();
  const draft = freezePostDraft(
    {
      ...newPostDraft(actor, "b0000000-0000-4000-8000-000000000010"),
      media: {
        id: "b0000000-0000-4000-8000-000000000011",
        type: "image",
        mime: "image/jpeg",
      },
    },
    (path) => bucket.getPublicUrl(path).data.publicUrl,
  );
  const path = draft.attempt!.path!;
  const uploaded = await bucket.upload(path, bytes, {
    contentType: "image/jpeg",
    metadata: { postId: "fixture-post", sha256: "fixture-checksum" },
  });
  expect(uploaded.error).toBeNull();
  expect((await bucket.upload(path, bytes)).error).not.toBeNull();
  const existing = await bucket.info(path);
  expect(existing.error).toBeNull();
  expect(existing.data).toMatchObject({
    size: 3,
    metadata: { postId: "fixture-post", sha256: "fixture-checksum" },
  });
  const publicImage = await fetch(bucket.getPublicUrl(path).data.publicUrl);
  expect([...new Uint8Array(await publicImage.arrayBuffer())]).toEqual([
    1, 2, 3,
  ]);
  const other = createClient(base, "fixture", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    expect(
      (
        await other.auth.signInWithPassword({
          email: "coach@fixture.test",
          password: "fixture-only",
        })
      ).error,
    ).toBeNull();
    expect(
      (await other.storage.from("post-media").info(path)).error,
    ).not.toBeNull();
    expect(
      (await other.storage.from("post-media").upload(path, bytes)).error,
    ).not.toBeNull();
  } finally {
    other.auth.stopAutoRefresh();
  }
});

it("reproduces a missing author foreign key and permits retrying the same post after repair", async () => {
  const record = {
    id: "b0000000-0000-4000-8000-000000000001",
    user_id: actor,
    content: "Publication de recette",
  };
  const setFault = (fault: string) =>
    fetch(base + "/__fixture/publication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fault }),
    });
  await setFault("posts_user_id_fkey");
  expect((await client.from("posts").insert(record)).error).toMatchObject({
    code: "23503",
  });
  expect(
    (await client.from("posts").select("id").eq("id", record.id).maybeSingle())
      .data,
  ).toBeNull();
  await setFault("none");
  expect((await client.from("posts").insert(record)).error).toBeNull();
  expect(
    (await client.from("posts").select("id").eq("id", record.id).maybeSingle())
      .data,
  ).toEqual({ id: record.id });
  expect((await client.from("posts").insert(record)).error).toMatchObject({
    code: "23505",
  });
  expect(
    (await client.from("posts").select("id").eq("id", record.id)).data,
  ).toHaveLength(1);
  expect(
    (
      await client
        .from("posts")
        .insert({ ...record, user_id: "another-account" })
    ).error,
  ).not.toBeNull();
});

it("completes a missing profile and then publishes the previously failed record", async () => {
  const record = {
    id: "b0000000-0000-4000-8000-000000000002",
    user_id: actor,
    content: "Brouillon conservé",
  };
  const missing = await fetch(base + "/__fixture/publication", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fault: "posts_user_id_fkey",
      profileMissing: true,
      role: "player",
    }),
  });
  expect((await missing.json()).missingProfiles).toEqual(["player"]);
  expect(
    (await client.from("profiles").select("id").eq("id", actor).maybeSingle())
      .data,
  ).toBeNull();
  expect(
    (
      await client
        .from("profiles")
        .select("id")
        .eq("id", "00000000-0000-4000-8000-000000000002")
        .maybeSingle()
    ).data,
  ).not.toBeNull();
  const status = await client.rpc("get_signup_status");
  expect(status.error).toBeNull();
  expect(status.data).toMatchObject({
    required: true,
    full_name: "Recette player",
  });
  expect((await client.from("posts").insert(record)).error).toMatchObject({
    code: "23503",
  });
  const signup = {
    p_full_name: "Recette Player",
    p_username: "player",
    p_birthdate: "2000-01-01",
    p_account_type: "personal",
    p_primary_role: "Joueur amateur",
    p_terms_version: "1.0",
  };
  expect(
    (await client.rpc("complete_signup", { ...signup, p_terms_version: "" }))
      .error,
  ).not.toBeNull();
  expect((await client.rpc("get_signup_status")).data.required).toBe(true);
  expect((await client.rpc("complete_signup", signup)).error).toBeNull();
  expect((await client.rpc("get_signup_status")).data).toMatchObject({
    required: false,
    username: "player",
  });
  expect(
    (
      await client
        .from("profiles")
        .select("id,full_name")
        .eq("id", actor)
        .single()
    ).data,
  ).toEqual({ id: actor, full_name: "Recette Player" });
  expect((await client.from("posts").insert(record)).error).toBeNull();
  expect(
    (
      await client
        .from("posts")
        .select("id,content")
        .eq("id", record.id)
        .single()
    ).data,
  ).toEqual({ id: record.id, content: "Brouillon conservé" });
  expect(
    await (await fetch(base + "/__fixture/publication")).json(),
  ).toMatchObject({ fault: "none", missingProfiles: [] });
});
