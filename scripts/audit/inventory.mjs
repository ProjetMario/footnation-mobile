import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, relative, join } from "node:path";
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const files = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory()
      ? files(join(directory, item.name))
      : [join(directory, item.name)],
  );
const routes = files(join(root, "app"))
  .filter(
    (file) =>
      /\.tsx?$/.test(file) && !/\/(?:_layout|\+native-intent)\./.test(file),
  )
  .map((file) => {
    const source = relative(root, file);
    const route =
      "/" +
      relative(join(root, "app"), file)
        .replace(/\.tsx?$/, "")
        .split("/")
        .filter((part) => !/^\(.*\)$/.test(part) && part !== "index")
        .join("/");
    return {
      route,
      source,
      navigation:
        "inventoriée — destinations statiques contrôlées par navigationRoutes.test.ts",
      roles_a_recetter: route.includes("admin")
        ? [
            "visiteur",
            "joueur sans droits",
            "responsable du club",
            "administrateur",
          ]
        : ["visiteur", "joueur", "responsable du club", "administrateur"],
      scenarios: [
        "ouverture directe",
        "navigation",
        "retour",
        "chargement",
        "vide",
        "erreur",
        "session expirée",
      ],
      visuel: "BLOQUÉ — navigateur contrôlable indisponible",
      mobile: "NON EXÉCUTÉ — appareil requis",
    };
  })
  .sort((a, b) => a.route.localeCompare(b.route));
mkdirSync(join(root, "docs/audit"), { recursive: true });
writeFileSync(
  join(root, "docs/audit/parcours-routes.json"),
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      note: "Inventaire de couverture ; une route présente n’est pas une preuve de recette visuelle.",
      routes,
    },
    null,
    2,
  ) + "\n",
);
console.log(routes.length + " routes inventoriées.");
