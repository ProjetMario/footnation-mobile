import { afterAll, beforeAll, expect, it } from "vitest";
import { createFixtureServer } from "../scripts/ux-fixture-server.mjs";

const server = createFixtureServer();
let base: string;
const player = "00000000-0000-4000-8000-000000000001";
const coach = "00000000-0000-4000-8000-000000000002";
const admin = "00000000-0000-4000-8000-000000000003";
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
async function query(table: string, operator: string, filter: string) {
  const params = new URLSearchParams({ select: "*", [operator]: filter });
  const response = await fetch(`${base}/rest/v1/${table}?${params}`);
  return { status: response.status, rows: await response.json() };
}

it("accepts the real bidirectional matching block filter without bypassing it", async () => {
  const result = await query(
    "user_blocks",
    "or",
    `(and(blocker_id.eq.${player},blocked_id.in.(${coach},${admin})),and(blocked_id.eq.${player},blocker_id.in.(${coach},${admin})))`,
  );
  expect(result).toEqual({ status: 200, rows: [] });
});

it("evaluates nested AND and OR groups with IN lists against actual rows", async () => {
  const result = await query(
    "profiles",
    "or",
    `(and(id.in.(${player},${coach}),username.eq.coach),and(id.eq.${admin},or(username.eq.admin,username.eq.nobody)))`,
  );
  expect(result.status).toBe(200);
  expect(result.rows.map((row: any) => row.id)).toEqual([coach, admin]);
  const and = await query(
    "profiles",
    "and",
    `(id.in.(${player},${coach}),or(username.eq.player,username.eq.nobody))`,
  );
  expect(and.rows.map((row: any) => row.id)).toEqual([player]);
});

it("preserves quoted commas and parentheses as literal filter values", async () => {
  const result = await query(
    "profiles",
    "or",
    '(and(full_name.eq."Nobody, (else)",username.eq.player),username.eq.coach)',
  );
  expect(result.status).toBe(200);
  expect(result.rows.map((row: any) => row.id)).toEqual([coach]);
});

it.each([
  "(and(username.eq.player,))",
  "(or(username.eq.player)",
  "(and(username.unknown.player,username.eq.player))",
  "(and(username.eq.player,,username.eq.coach))",
  `(${"and(".repeat(10)}username.eq.player${")".repeat(10)})`,
  `(${Array(102).fill("username.eq.player").join(",")})`,
])("rejects unsupported or malformed logical filters: %s", async (filter) => {
  const result = await query("profiles", "or", filter);
  expect(result.status).toBe(501);
  expect(result.rows.message).toBe("Filtre non simulé");
});
