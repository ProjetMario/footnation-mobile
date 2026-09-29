const fs = require("node:fs");
const ts = require("typescript");
const path = require("node:path");
const root = process.argv[2];
if (!root) throw new Error("Indiquer le dossier du site FootNation.");
const file = path.join(root, "src/App.tsx");
const ast = ts.createSourceFile(
  file,
  fs.readFileSync(file, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const routes = [];
function visit(node) {
  if (
    ts.isJsxSelfClosingElement(node) &&
    node.tagName.getText(ast) === "Route"
  ) {
    const attrs = node.attributes.properties;
    const p = attrs.find(
      (a) => ts.isJsxAttribute(a) && a.name.getText(ast) === "path",
    );
    const e = attrs.find(
      (a) => ts.isJsxAttribute(a) && a.name.getText(ast) === "element",
    );
    if (p?.initializer && ts.isStringLiteral(p.initializer))
      routes.push({
        path: p.initializer.text,
        element: e?.initializer?.getText(ast) || null,
      });
  }
  ts.forEachChild(node, visit);
}
visit(ast);
fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync(
  "docs/source-routes.json",
  JSON.stringify(routes, null, 2) + "\n",
);
console.log(
  `${routes.length} routes statiques actives inventoriées. Les routes dynamiques SEO s’ajoutent à cette liste.`,
);
