import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { resolveGeographyPath } from "../src/lib/geography";
import { expect, it } from "vitest";
const root = fileURLToPath(new URL("..", import.meta.url));
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory()
      ? files(path.join(directory, item.name))
      : [path.join(directory, item.name)],
  );
}
const routes = files(path.join(root, "app"))
  .filter(
    (file) => /\.tsx?$/.test(file) && !/\/(?:_layout|\+[^/]+)\./.test(file),
  )
  // These routes validate a finite alias set, not arbitrary destinations.
  .filter(
    (file) =>
      !["[legacy].tsx", "[locale]/[geo].tsx"].includes(
        path.relative(path.join(root, "app"), file),
      ),
  )
  .map(
    (file) =>
      "/" +
      path
        .relative(path.join(root, "app"), file)
        .replace(/\.tsx?$/, "")
        .split("/")
        .filter((segment) => !/^\(.*\)$/.test(segment) && segment !== "index")
        .map((segment) => (/^\[.*\]$/.test(segment) ? "*" : segment))
        .join("/"),
  );
function resolves(value: string) {
  const route = value
    .split(/[?#]/)[0]
    .split("/")
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .join("/");
  if (resolveGeographyPath(route)) return true;
  return routes.some((candidate) => {
    const expected = candidate.split("/"),
      actual = route.split("/");
    return (
      expected.length === actual.length &&
      expected.every(
        (segment, index) =>
          segment === actual[index] || segment === "*" || actual[index] === "*",
      )
    );
  });
}
function destination(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isTemplateExpression(node))
    return (
      node.head.text +
      node.templateSpans.map((span) => "*" + span.literal.text).join("")
    );
  if (ts.isObjectLiteralExpression(node)) {
    const pathname = node.properties.find(
      (property) =>
        ts.isPropertyAssignment(property) &&
        property.name.getText() === "pathname",
    );
    if (pathname && ts.isPropertyAssignment(pathname))
      return destination(pathname.initializer);
  }
  return null;
}
it("every statically known in-app router destination has a matching Expo route", () => {
  const unresolved: string[] = [];
  for (const file of ["src", "app"]
    .flatMap((dir) => files(path.join(root, dir)))
    .filter((file) => /\.tsx?$/.test(file))) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        /^router\.(push|replace|navigate)$/.test(
          node.expression.getText(source),
        ) &&
        node.arguments[0]
      ) {
        const target = destination(node.arguments[0]);
        if (target?.startsWith("/") && !resolves(target))
          unresolved.push(
            path.relative(root, file) +
              ":" +
              (source.getLineAndCharacterOfPosition(node.pos).line + 1) +
              " → " +
              target,
          );
      }
      if (
        ts.isJsxAttribute(node) &&
        node.name.getText(source) === "href" &&
        node.initializer
      ) {
        const init = ts.isJsxExpression(node.initializer)
          ? node.initializer.expression
          : node.initializer;
        const target = init && destination(init);
        if (target?.startsWith("/") && !resolves(target))
          unresolved.push(path.relative(root, file) + " href → " + target);
      }
      if (
        ts.isPropertyAssignment(node) &&
        node.name.getText(source) === "href"
      ) {
        const target = destination(node.initializer);
        if (target?.startsWith("/") && !resolves(target))
          unresolved.push(
            path.relative(root, file) + " href config → " + target,
          );
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(unresolved).toEqual([]);
}, 30000);

it("does not mistake catch-all geography routes for existing screens", () => {
  for (const route of [
    "/page-inventee",
    "/unknown/route",
    "/profile/a/missing",
    "/fr/unknown",
  ])
    expect(resolves(route), route).toBe(false);
  for (const route of [
    "/profile/example",
    "/club/example/member",
    "/football-paris",
  ])
    expect(resolves(route), route).toBe(true);
});
