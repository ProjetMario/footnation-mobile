// Disposable in-memory PostgreSQL; no linked database or network mutation.
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
let failed = false;
for (const fixture of [
  "experience-projection.sql",
  "experience-no-timestamp.sql",
]) {
  const db = new PGlite();
  try {
    await db.exec(
      "SET footnation.experience_test_disposable='1';" +
        (await loadSql(
          fileURLToPath(new URL(`./tests/${fixture}`, import.meta.url)),
        )),
    );
    console.log(`PASS: ${fixture}`);
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
}
if (failed) process.exitCode = 1;
