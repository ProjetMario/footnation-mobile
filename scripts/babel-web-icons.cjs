const { readFileSync } = require("node:fs");
const path = require("node:path");

// Use Lucide's supported per-icon exports. Its main barrel otherwise makes
// Metro download the entire icon catalog, including thousands of unused icons.
// Read the installed export map rather than guessing kebab names: aliases such
// as Globe2 must keep resolving to the same icon after dependency upgrades.
const entry = require.resolve("lucide-react-native");
const exportsSource = readFileSync(
  path.resolve(path.dirname(entry), "../esm/lucide-react-native.mjs"),
  "utf8",
);
const icons = new Map();
for (const match of exportsSource.matchAll(
  /export \{([^}]+)\} from '\.\/icons\/([^']+)\.mjs';/g,
)) {
  for (const alias of match[1].matchAll(/default as (\w+)/g)) {
    icons.set(alias[1], `lucide-react-native/icons/${match[2]}`);
  }
}
if (!icons.size)
  throw new Error("Lucide's per-icon exports could not be resolved");

module.exports = ({ types: t }) => ({
  name: "footnation-web-icons",
  visitor: {
    ImportDeclaration(importPath) {
      const node = importPath.node;
      if (
        node.source.value !== "lucide-react-native" ||
        node.importKind === "type"
      )
        return;
      const rest = [],
        direct = [];
      for (const specifier of node.specifiers) {
        const name =
          t.isImportSpecifier(specifier) && specifier.importKind !== "type"
            ? specifier.imported.name || specifier.imported.value
            : null;
        if (!icons.has(name)) {
          rest.push(specifier);
          continue;
        }
        direct.push(
          t.importDeclaration(
            [t.importDefaultSpecifier(specifier.local)],
            t.stringLiteral(icons.get(name)),
          ),
        );
      }
      if (!direct.length) return;
      if (rest.length) direct.push(t.importDeclaration(rest, node.source));
      importPath.replaceWithMultiple(direct);
    },
  },
});
