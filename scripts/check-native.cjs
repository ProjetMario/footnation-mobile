const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { unsafeCondition } = require("./native-conditions.cjs");
const errors = [];
const files = [];
function collect(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${item.name}`;
    if (item.isDirectory()) {
      collect(file);
      continue;
    }
    if (!/\.tsx?$/.test(file)) continue;
    // Metro selects the native sibling on iOS/Android. Web-only JSX does not
    // belong to either native bundle; the native implementation is checked.
    if (/\.web\.tsx?$/.test(file)) continue;
    if (
      !/\.(native|ios|android)\.tsx?$/.test(file) &&
      fs.existsSync(file.replace(/\.(tsx?)$/, ".native.$1"))
    )
      continue;
    files.push(path.resolve(file));
  }
}
for (const dir of process.argv.length > 2
  ? process.argv.slice(2)
  : ["src", "app"])
  collect(dir);
const program = ts.createProgram(files, {
  strict: true,
  jsx: ts.JsxEmit.ReactJSX,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  moduleSuffixes: [".native", ""],
  types: [],
  skipLibCheck: true,
  noEmit: true,
});
const checker = program.getTypeChecker();
for (const file of files) {
  const ast = program.getSourceFile(file);
  const label = path.relative(process.cwd(), file);
  // The shared web club map is an intentional Expo DOM island. Its native
  // wrapper and every other screen remain subject to the native JSX checks.
  const clubMapDom =
    label === path.join("src", "components", "ClubMapCanvas.tsx");
  function error(node, message) {
    const { line } = ast.getLineAndCharacterOfPosition(node.getStart(ast));
    errors.push(`${label}:${line + 1}: ${message}`);
  }
  function visit(node) {
    if (unsafeCondition(node, ast, checker))
      error(node, "condition JSX non booleenne hors composant Text");
    if (
      ts.isImportDeclaration(node) &&
      /react-native-webview|@capacitor/.test(node.moduleSpecifier.text)
    )
      error(node, "composant web embarqué interdit");
    if (
      ts.isExpressionStatement(node) &&
      ts.isStringLiteral(node.expression) &&
      node.expression.text === "use dom" &&
      !clubMapDom
    )
      error(node, "écran DOM interdit");
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      if (!clubMapDom && /^[a-z]/.test(tag)) error(node, `balise HTML ${tag}`);
    }
    if (
      !clubMapDom &&
      ts.isJsxText(node) &&
      ts.isJsxElement(node.parent) &&
      !["Text", "Animated.Text"].includes(
        node.parent.openingElement.tagName.getText(ast),
      )
    ) {
      if (node.text.trim() || (node.text.length && !node.text.includes("\n")))
        error(node, "texte hors composant Text");
    }
    if (
      !clubMapDom &&
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      (ts.isStringLiteral(node.expression) ||
        ts.isNoSubstitutionTemplateLiteral(node.expression) ||
        ts.isNumericLiteral(node.expression)) &&
      node.expression.text.length
    ) {
      let parent = node.parent;
      while (parent && ts.isJsxFragment(parent)) parent = parent.parent;
      if (
        !parent ||
        !ts.isJsxElement(parent) ||
        !["Text", "Animated.Text"].includes(
          parent.openingElement.tagName.getText(ast),
        )
      )
        error(node, "expression texte hors composant Text");
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
if (errors.length) {
  console.error([...new Set(errors)].join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Interfaces natives contrôlées : aucune WebView directe ni chaîne JSX hors Text ; seul ClubMapCanvas utilise Expo DOM pour la carte web partagée.",
  );
