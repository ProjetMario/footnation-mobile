import { createRequire } from "node:module";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
const require = createRequire(import.meta.url);
const {
  applyNativeFixes,
  patch,
} = require("../scripts/apply-native-fixes.cjs");
const fixtures: string[] = [];
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "footnation-touch-patch-test-"));
  fixtures.push(root);
  const dependency = path.join(root, "node_modules/react-native-screens");
  mkdirSync(path.join(dependency, "ios"), { recursive: true });
  const installed = path.dirname(
    require.resolve("react-native-screens/package.json"),
  );
  for (const file of [
    "package.json",
    "ios/RNSScreen.h",
    "ios/RNSScreen.mm",
    "ios/RNSScreenStack.mm",
  ])
    copyFileSync(path.join(installed, file), path.join(dependency, file));
  const args = ["apply", "--directory=node_modules/react-native-screens"];
  if (
    spawnSync("git", [...args, "--reverse", "--check", patch], { cwd: root })
      .status === 0
  )
    expect(
      spawnSync("git", [...args, "--reverse", patch], { cwd: root }).status,
    ).toBe(0);
  return { root, dependency };
}
afterEach(() => {
  for (const root of fixtures.splice(0))
    rmSync(root, { recursive: true, force: true });
});
describe("iOS native touch backport", () => {
  it("patches the installed native sources, preserves controller identity and is idempotent", () => {
    const { root, dependency } = fixture();
    const file = path.join(dependency, "ios/RNSScreen.mm");
    expect(readFileSync(file, "utf8")).toContain("self.view = snapshot;");
    expect(applyNativeFixes(root)).toBe("applied");
    const corrected = readFileSync(file, "utf8");
    expect(corrected).not.toContain("self.view = snapshot;");
    expect(corrected).toContain("[self.view addSubview:snapshot];");
    expect(applyNativeFixes(root)).toBe("already-applied");
    expect(readFileSync(file, "utf8")).toBe(corrected);
  });
  it("fails before changing any source if the dependency version changes", () => {
    const { root, dependency } = fixture();
    const file = path.join(dependency, "ios/RNSScreen.mm");
    const before = readFileSync(file, "utf8");
    writeFileSync(
      path.join(dependency, "package.json"),
      JSON.stringify({ version: "4.27.0" }),
    );
    expect(() => applyNativeFixes(root)).toThrow("Revoir le correctif");
    expect(readFileSync(file, "utf8")).toBe(before);
  });
  it("refuses partial or incompatible source changes without patching the other files", () => {
    const { root, dependency } = fixture();
    const file = path.join(dependency, "ios/RNSScreen.h");
    const before = readFileSync(file, "utf8");
    const screen = path.join(dependency, "ios/RNSScreen.mm");
    writeFileSync(
      screen,
      readFileSync(screen, "utf8").replace(
        "self.view = snapshot;",
        "self.view = anotherSnapshot;",
      ),
    );
    expect(() => applyNativeFixes(root)).toThrow("incompatible");
    expect(readFileSync(file, "utf8")).toBe(before);
  });
});
