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
  applyScrollResponderFix,
  scrollPatch,
} = require("../scripts/apply-native-fixes.cjs");
const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "footnation-scroll-responder-"));
  roots.push(root);
  const dependency = path.join(root, "node_modules/react-native");
  const file = "Libraries/Components/ScrollView/ScrollView.js";
  mkdirSync(path.dirname(path.join(dependency, file)), { recursive: true });
  const installed = path.dirname(require.resolve("react-native/package.json"));
  for (const item of ["package.json", file])
    copyFileSync(path.join(installed, item), path.join(dependency, item));
  const args = ["apply", "--directory=node_modules/react-native"];
  if (
    spawnSync("git", [...args, "--reverse", "--check", scrollPatch], {
      cwd: root,
    }).status === 0
  )
    expect(
      spawnSync("git", [...args, "--reverse", scrollPatch], { cwd: root })
        .status,
    ).toBe(0);
  return { root, dependency, file: path.join(dependency, file) };
}
afterEach(() =>
  roots
    .splice(0)
    .forEach((root) => rmSync(root, { recursive: true, force: true })),
);

describe("iOS nested scroll responder regression", () => {
  it("keeps a sibling button's responder during ticker scrolls, while preserving own drag handling", () => {
    const { root, file } = fixture();
    const before = readFileSync(file, "utf8");
    expect(applyScrollResponderFix(root)).toBe("applied");
    const after = readFileSync(file, "utf8");
    // Execute the actual installed handler body, not a duplicate helper.
    const body = (source: string) =>
      source.match(
        /_handleScrollShouldSetResponder:[\s\S]*?=> \{([\s\S]*?)\n  \};/,
      )![1];
    const run = (source: string, os: string, state: object, target: object) =>
      new Function("Platform", "e", body(source)).call(
        state,
        { OS: os },
        { target },
      );
    const outer = {},
      ticker = {};
    const state = {
      props: {},
      _isTouching: true,
      getNativeScrollRef: () => outer,
    };
    // Original handler incorrectly transfers from the pressed sibling to its parent.
    expect(run(before, "ios", state, ticker)).toBe(true);
    expect(run(after, "ios", state, ticker)).toBe(false);
    expect(run(after, "ios", state, outer)).toBe(true);
    expect(run(after, "ios", { ...state, _isTouching: false }, outer)).toBe(
      false,
    );
    expect(
      run(
        after,
        "ios",
        { ...state, props: { disableScrollViewPanResponder: true } },
        outer,
      ),
    ).toBe(false);
    expect(run(after, "android", state, ticker)).toBe(true);
    expect(applyScrollResponderFix(root)).toBe("already-applied");
    expect(readFileSync(file, "utf8")).toBe(after);
  });
  it("refuses another RN version or an incompatible source without changing it", () => {
    const { root, dependency, file } = fixture();
    const original = readFileSync(file, "utf8");
    writeFileSync(
      path.join(dependency, "package.json"),
      JSON.stringify({ version: "0.87.0" }),
    );
    expect(() => applyScrollResponderFix(root)).toThrow("Revoir le correctif");
    expect(readFileSync(file, "utf8")).toBe(original);
    writeFileSync(
      path.join(dependency, "package.json"),
      JSON.stringify({ version: "0.86.3" }),
    );
    const changed = original.replace(
      "return this._isTouching;",
      "return false;",
    );
    writeFileSync(file, changed);
    expect(() => applyScrollResponderFix(root)).toThrow("incompatible");
    expect(readFileSync(file, "utf8")).toBe(changed);
  });
  it("lets an opted-out iOS ticker receive its first tap even after synthetic momentum-end events", () => {
    const { root, file } = fixture();
    const before = readFileSync(file, "utf8");
    expect(applyScrollResponderFix(root)).toBe("applied");
    const after = readFileSync(file, "utf8");
    const body = (source: string) => source.match(
      /_handleStartShouldSetResponderCapture:[\s\S]*?=> \{([\s\S]*?)\n    \};/,
    )![1];
    const run = (source: string, os: string, disabled: boolean, animating = true) =>
      new Function("Platform", "TextInputState", "e", body(source)).call(
        {
          props: { disableScrollViewPanResponder: disabled, keyboardShouldPersistTaps: "always" },
          _isAnimating: () => animating,
          _softKeyboardIsDetached: () => false,
          _keyboardIsDismissible: () => false,
        },
        { OS: os },
        {},
        { target: {} },
      );
    expect(run(before, "ios", true)).toBe(true);
    expect(run(after, "ios", true)).toBe(false);
    // Ordinary scroll views still consume a tap to stop genuine deceleration.
    expect(run(after, "ios", false)).toBe(true);
    expect(run(after, "ios", false, false)).toBe(false);
    expect(run(after, "android", true)).toBe(true);
    expect(run(after, "android", false)).toBe(true);
  });
});
