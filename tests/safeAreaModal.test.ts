import React from "react";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Modal: "native-modal" }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: "safe-area-provider",
}));
import { SafeAreaModal } from "../src/components/SafeAreaModal";

it.each([true, false])(
  "preserves visibility=%s and native dismissal",
  (visible) => {
    const close = vi.fn();
    const content = React.createElement("content");
    const modal = SafeAreaModal({
      visible,
      transparent: true,
      presentationStyle: "overFullScreen",
      supportedOrientations: ["portrait", "landscape"],
      onRequestClose: close,
      children: content,
    });
    expect(modal.props.visible).toBe(visible);
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.presentationStyle).toBe("overFullScreen");
    expect(modal.props.supportedOrientations).toEqual([
      "portrait",
      "landscape",
    ]);
    modal.props.onRequestClose();
    expect(close).toHaveBeenCalledOnce();
    const provider = modal.props.children;
    expect(provider.type).toBe("safe-area-provider");
    expect(provider.props.style.flex).toBe(1);
    expect(provider.props.initialMetrics).toBeUndefined();
    expect(provider.props.children).toBe(content);
  },
);

function sourceFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(folder, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : entry.name.endsWith(".tsx")
        ? [path]
        : [];
  });
}

// A safe area inherited from the navigator does not describe a new native
// modal window. Catch any future bypass of the shared modal boundary.
it("every direct native modal owns a provider inside its window", () => {
  const violations: string[] = [];
  for (const path of [
    ...sourceFiles(resolve("src")),
    ...sourceFiles(resolve("app")),
  ]) {
    const source = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const nativeModals = new Set<string>();
    for (const node of source.statements) {
      if (
        !ts.isImportDeclaration(node) ||
        !ts.isStringLiteral(node.moduleSpecifier) ||
        node.moduleSpecifier.text !== "react-native"
      )
        continue;
      const imports = node.importClause?.namedBindings;
      if (imports && ts.isNamedImports(imports)) {
        for (const item of imports.elements) {
          if ((item.propertyName || item.name).text === "Modal")
            nativeModals.add(item.name.text);
        }
      }
    }
    const visit = (node: ts.Node) => {
      if (
        ts.isJsxElement(node) &&
        nativeModals.has(node.openingElement.tagName.getText(source))
      ) {
        const hasProvider = node.children.some(
          (child) =>
            ts.isJsxElement(child) &&
            child.openingElement.tagName.getText(source) === "SafeAreaProvider",
        );
        if (!hasProvider)
          violations.push(
            `${path}:${source.getLineAndCharacterOfPosition(node.pos).line + 1}`,
          );
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(violations).toEqual([]);
});
