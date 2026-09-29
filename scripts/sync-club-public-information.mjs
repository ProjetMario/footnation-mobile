// Bundle the same public identity/address/facility data as the web club page.
// Run again when public/data/savoie-epreuves-report.json is updated.
import { readFile, writeFile } from "node:fs/promises";
const source = JSON.parse(
  await readFile(
    new URL("../../public/data/savoie-epreuves-report.json", import.meta.url),
    "utf8",
  ),
);
const clubKeys = [
  "name",
  "normalized_name",
  "fff_affiliation_number",
  "league",
  "district",
  "full_address",
  "shirt_colors",
];
const facilityKeys = ["name", "full_address", "additional_info"];
const pick = (value, keys) =>
  Object.fromEntries(keys.map((key) => [key, value?.[key] ?? null]));
const results = source.results
  .filter((row) => row.status === 200 && row.data?.club)
  .map((row) => ({
    numero: String(row.numero),
    status: 200,
    data: {
      club: pick(row.data.club, clubKeys),
      facilities: (row.data.facilities || []).map((facility) =>
        pick(facility, facilityKeys),
      ),
    },
  }));
await writeFile(
  new URL("../src/data/clubPublicInformation.json", import.meta.url),
  JSON.stringify({ generated_at: source.generated_at, results }) + "\n",
);
console.log(`Bundled public information for ${results.length} clubs.`);
