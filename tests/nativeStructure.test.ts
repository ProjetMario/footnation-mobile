import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
function inspect(
  jsx: string,
  setup = "",
  siblings: Record<string, string> = {},
) {
  const dir = mkdtempSync(join(tmpdir(), "footnation-native-"));
  try {
    writeFileSync(
      join(dir, "Screen.tsx"),
      `${setup}\nexport default function Screen(){return (${jsx});}`,
    );
    for (const [name, source] of Object.entries(siblings))
      writeFileSync(join(dir, name), source);
    return spawnSync(process.execPath, ["scripts/check-native.cjs", dir], {
      encoding: "utf8",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
// Some cases run several isolated TypeScript programs; allow for slow CI/dev hosts.
describe("native text structure regression", { timeout: 60000 }, () => {
  it.each([
    '<View>{" "}</View>',
    '<>{" "}</>',
    "<View>{0}</View>",
    "<View>texte</View>",
  ])("rejects text outside Text: %s", (jsx) => {
    const result = inspect(jsx);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("hors composant Text");
  });
  it("requires boolean guards for optional values outside Text", () => {
    for (const jsx of [
      "<View>{label && <Text>x</Text>}</View>",
      "<View>{count && <Text>x</Text>}</View>",
    ])
      expect(inspect(jsx).status).toBe(1);
    expect(
      inspect(
        "<View>{!!label && <Text>x</Text>}{count > 0 && <Text>x</Text>}</View>",
      ).status,
    ).toBe(0);
  });
  it("preserves intentional spaces inside Text and string props", () => {
    expect(
      inspect(
        '<View><Text>Foot{" "}Nation</Text><Field placeholder="Chercher" /></View>',
      ).status,
    ).toBe(0);
  });
  it("accepts typed boolean flags and Animated.Text without accepting numeric guards", () => {
    expect(
      inspect(
        '<View>{flags.ready && <Animated.Text>Prêt{" "}</Animated.Text>}</View>',
        "declare const flags: { ready?: boolean };",
      ).status,
    ).toBe(0);
    expect(
      inspect(
        "<View>{flags.count && <Text>Votes</Text>}</View>",
        "declare const flags: { count: number };",
      ).status,
    ).toBe(1);
  });
  it("checks the native implementation instead of its web fallback", () => {
    expect(
      inspect('<input type="date" />', "", {
        "Screen.native.tsx":
          "export default function Screen(){return <View><Text>Date</Text></View>}",
        "Picker.web.tsx": "export default function Picker(){return <input />}",
      }).status,
    ).toBe(0);
    expect(
      inspect('<input type="date" />', "", {
        "Screen.native.tsx":
          "export default function Screen(){return <input />}",
      }).status,
    ).toBe(1);
  });
  it("resolves imported guards from the native sibling", () => {
    expect(
      inspect(
        "<View>{ready && <Text>Prêt</Text>}</View>",
        'import { ready } from "./Status";',
        {
          "Status.ts": "export const ready = false;",
          "Status.native.ts": "export const ready = 0;",
        },
      ).status,
    ).toBe(1);
  });
});
