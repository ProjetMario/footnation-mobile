// Local in-memory PostgreSQL only; no Supabase URL, credentials or fetch are used.
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { PGlite } = await import(
  process.env.FOOTNATION_PGLITE_MODULE || "@electric-sql/pglite"
);
async function loadSql(file) {
  let input = await readFile(file, "utf8");
  for (const [line, path] of [...input.matchAll(/^\\ir (.+)$/gm)]) {
    const included = await loadSql(resolve(dirname(file), path));
    input = input.replace(line, () => included);
  }
  return input;
}
const db = new PGlite();
let failed = false;
try {
  const fixture = fileURLToPath(
    new URL("./tests/native-push-delivery.sql", import.meta.url),
  );
  await db.exec(
    "SET footnation.push_test_disposable='1'; BEGIN;" +
      (await loadSql(fixture)) +
      "COMMIT;",
  );
  console.log("PASS: native push delivery and renewal PostgreSQL assertions");
} catch (error) {
  console.error({
    message: error.message,
    code: error.code,
    detail: error.detail,
    where: error.where,
  });
  failed = true;
} finally {
  await db.close();
}
if (failed) process.exitCode = 1;
