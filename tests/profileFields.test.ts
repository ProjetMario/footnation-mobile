import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
it("supports every native profile form field in the latest server update contract", () => {
  const settings = readFileSync(
    new URL("../src/screens/Settings.tsx", import.meta.url),
    "utf8",
  );
  const fieldsSource = settings.slice(
    settings.indexOf("const common ="),
    settings.indexOf("export default function Settings"),
  );
  const fields = [...fieldsSource.matchAll(/\["([a-z_]+)",/g)].map(
    (match) => match[1],
  );
  const migrations = new URL("../backend/migrations/", import.meta.url);
  const definitions = readdirSync(migrations)
    .sort()
    .map((name) => readFileSync(new URL(name, migrations), "utf8"))
    .filter((sql) =>
      sql.includes("FUNCTION public.update_native_profile_snapshot("),
    );
  const declaration =
    definitions
      .at(-1)
      ?.match(/DECLARE allowed text\[\] := ARRAY\[([\s\S]*?)\];/)?.[1] || "";
  const allowed = new Set(
    [...declaration.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]),
  );
  expect(fields.length).toBeGreaterThan(30);
  expect(
    [
      ...fields,
      "account_type",
      "skills",
      "full_name",
      "avatar_url",
      "primary_role",
    ].filter((field) => !allowed.has(field)),
  ).toEqual([]);
  for (const forbidden of [
    "id",
    "is_admin",
    "is_verified",
    "is_premium",
    "is_suspended",
  ])
    expect(allowed.has(forbidden)).toBe(false);
});
