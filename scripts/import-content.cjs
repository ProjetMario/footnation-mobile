const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");
const root = process.argv[2];
if (!root)
  throw new Error("Usage: node scripts/import-content.cjs /path/to/footnation");
const pages = {
  MentionsLegales: "mentions-legales",
  ConditionsVente: "conditions-generales-vente",
  PolitiqueConfidentialite: "politique-confidentialite",
  SecuriteMineurs: "securite-des-mineurs",
  Legal: "legal",
};
const output = {};
const manifest = {};
for (const [name, slug] of Object.entries(pages)) {
  const source = fs.readFileSync(
    path.join(root, "src/pages", name + ".tsx"),
    "utf8",
  );
  const ast = ts.createSourceFile(
    name,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const bindings = {};
  function literal(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      return node.text;
    if (ts.isObjectLiteralExpression(node)) {
      const out = {};
      for (const p of node.properties) {
        if (!ts.isPropertyAssignment(p)) throw new Error("Unsupported object");
        out[p.name.getText(ast).replace(/^['"]|['"]$/g, "")] = literal(
          p.initializer,
        );
      }
      return out;
    }
    if (ts.isIdentifier(node) && node.text in bindings)
      return bindings[node.text];
    if (ts.isPropertyAccessExpression(node))
      return literal(node.expression)[node.name.text];
    if (ts.isTemplateExpression(node))
      return (
        node.head.text +
        node.templateSpans
          .map((s) => String(literal(s.expression)) + s.literal.text)
          .join("")
      );
    throw new Error(
      `Unsupported content expression in ${name}: ${node.getText(ast)}`,
    );
  }
  const arrays = [];
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      try {
        bindings[node.name.text] = literal(node.initializer);
      } catch {}
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(ast) === "useTranslations" &&
      node.arguments[0] &&
      ts.isArrayLiteralExpression(node.arguments[0])
    )
      arrays.push(node.arguments[0].elements.map(literal));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  let paragraphs = arrays.sort((a, b) => b.length - a.length)[0];
  if (!paragraphs?.length) {
    paragraphs = [];
    function jsxText(node) {
      if (ts.isJsxText(node)) return node.text.replace(/\s+/g, " ");
      if (ts.isJsxExpression(node))
        return node.expression ? String(literal(node.expression)) : "";
      if (ts.isJsxElement(node)) return node.children.map(jsxText).join("");
      return "";
    }
    function collect(node) {
      if (
        ts.isJsxElement(node) &&
        /^(p|h1|h2|h3|li)$/.test(node.openingElement.tagName.getText(ast))
      ) {
        paragraphs.push(jsxText(node).trim());
        return;
      }
      ts.forEachChild(node, collect);
    }
    collect(ast);
  }
  if (!paragraphs?.length) throw new Error("No content in " + name);
  output[slug] = {
    title: {
      Legal: "Conditions et confidentialité",
      MentionsLegales: "Mentions légales",
      ConditionsVente: "Conditions générales de vente",
      PolitiqueConfidentialite: "Politique de confidentialité",
      SecuriteMineurs: "Sécurité des mineurs",
    }[name],
    paragraphs,
  };
  manifest[slug] = {
    source: `src/pages/${name}.tsx`,
    sha256: crypto.createHash("sha256").update(source).digest("hex"),
    paragraphs: paragraphs.length,
  };
}
fs.writeFileSync(
  "src/content/legal.json",
  JSON.stringify(output, null, 2) + "\n",
);
fs.writeFileSync(
  "src/content/legal-manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  "Imported",
  Object.keys(output).length,
  "source documents without rewriting their wording.",
);
