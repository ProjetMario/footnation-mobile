import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { clubSections } from "../src/lib/clubSections";
it("keeps every generic club form field within the server mutation contract", () => {
  const sql = readFileSync(
    new URL(
      "../backend/migrations/20260908038000_native_club_staff_management.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const contracts = [
    ...sql.matchAll(
      /WHEN '([^']+)' THEN target:='([^']+)'; allowed:=ARRAY\[([^\]]+)\]/g,
    ),
  ];
  const editable = Object.entries(clubSections).filter(
    ([, section]) => !section.readonly,
  );
  expect(contracts).toHaveLength(editable.length);
  for (const [key, section] of editable) {
    const contract = contracts.find((match) => match[1] === key)!;
    expect(contract[2]).toBe(section.table);
    const fields = [...contract[3].matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    );
    expect(fields.sort()).toEqual(
      [
        ...section.fields.map((field) => field.key),
        ...(key === "news" ? ["published_at"] : []),
      ].sort(),
    );
    for (const protectedField of [
      "id",
      "club_id",
      "author_id",
      "created_by",
      "is_from_fff",
      "is_from_scorenco",
    ])
      expect(fields).not.toContain(protectedField);
  }
});
