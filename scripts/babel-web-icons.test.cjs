const assert = require("node:assert/strict");
const { test } = require("node:test");
const { transformSync } = require("@babel/core");
const plugin = require("./babel-web-icons.cjs");

function imports(code) {
  const result = transformSync(code, {
    configFile: false,
    babelrc: false,
    ast: true,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [plugin],
  });
  return result.ast.program.body
    .filter((node) => node.type === "ImportDeclaration")
    .map((node) => ({
      source: node.source.value,
      kind: node.importKind,
      specifiers: node.specifiers.map((spec) => ({
        type: spec.type,
        local: spec.local.name,
      })),
    }));
}

test("only requested icons are imported, including renamed aliases", () => {
  const result = imports(
    'import { Heart, Globe2 as World } from "lucide-react-native";',
  );
  assert.deepEqual(
    result.map((node) => node.source),
    ["lucide-react-native/icons/heart", "lucide-react-native/icons/earth"],
  );
  assert.deepEqual(
    result.map((node) => node.specifiers[0].local),
    ["Heart", "World"],
  );
  assert.ok(
    result.every(
      (node) => node.specifiers[0].type === "ImportDefaultSpecifier",
    ),
  );
  for (const node of result) assert.ok(require.resolve(node.source));
});

test("type-only, namespace and unrelated imports keep their contract", () => {
  const result = imports(
    'import type { LucideIcon } from "lucide-react-native"; import * as All from "lucide-react-native"; import { Text } from "react-native";',
  );
  assert.equal(result[0].kind, "type");
  assert.equal(result[1].specifiers[0].type, "ImportNamespaceSpecifier");
  assert.equal(result[2].source, "react-native");
});

test("non-icon exports are retained alongside direct icons", () => {
  const result = imports(
    'import { Heart, createLucideIcon } from "lucide-react-native";',
  );
  assert.equal(result[0].source, "lucide-react-native/icons/heart");
  assert.equal(result[1].source, "lucide-react-native");
  assert.deepEqual(
    result[1].specifiers.map((spec) => spec.local),
    ["createLucideIcon"],
  );
});
