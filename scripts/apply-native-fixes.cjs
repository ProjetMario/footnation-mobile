const { readFileSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

// Backport upstream #4407 without upgrading beyond Expo SDK 57's native ABI.
// Only the paths differ from upstream (ios/legacy -> ios in the v4 package).
// https://github.com/software-mansion/react-native-screens/pull/4407
const patch = path.resolve(
  __dirname,
  "../patches/react-native-screens-4.26.2-ios-touch.patch",
);
function applyNativeFixes(project = path.resolve(__dirname, "..")) {
  const dependency = path.join(project, "node_modules/react-native-screens");
  const version = JSON.parse(
    readFileSync(path.join(dependency, "package.json"), "utf8"),
  ).version;
  if (version !== "4.26.2")
    throw new Error(
      `Revoir le correctif tactile iOS pour react-native-screens ${version} avant de compiler.`,
    );
  const git = (...args) =>
    spawnSync(
      "git",
      [
        "apply",
        "--directory=node_modules/react-native-screens",
        ...args,
        patch,
      ],
      {
        cwd: project,
        encoding: "utf8",
      },
    );
  const verified = () => {
    const screen = readFileSync(
      path.join(dependency, "ios/RNSScreen.mm"),
      "utf8",
    );
    const stack = readFileSync(
      path.join(dependency, "ios/RNSScreenStack.mm"),
      "utf8",
    );
    return (
      screen.includes("[self.view addSubview:snapshot];") &&
      !screen.includes("self.view = snapshot;") &&
      screen.includes("_invalidated = YES;") &&
      stack.includes("[screenChildComponent.controller addSnapshotToView];") &&
      git("--reverse", "--check").status === 0
    );
  };
  if (verified()) return "already-applied";
  const checked = git("--check");
  if (checked.status !== 0)
    throw new Error(
      "Correctif tactile iOS incompatible avec les sources installées. Aucune modification appliquée.",
    );
  const result = git();
  if (result.status !== 0 || !verified())
    throw new Error(
      "Le correctif tactile iOS n’a pas pu être vérifié ; compilation arrêtée.",
    );
  return "applied";
}
const scrollPatch = path.resolve(
  __dirname,
  "../patches/react-native-0.86.3-ios-scroll-responder.patch",
);
function applyScrollResponderFix(project = path.resolve(__dirname, "..")) {
  const dependency = path.join(project, "node_modules/react-native");
  const version = JSON.parse(
    readFileSync(path.join(dependency, "package.json"), "utf8"),
  ).version;
  if (version !== "0.86.3")
    throw new Error(
      `Revoir le correctif de défilement iOS pour React Native ${version}.`,
    );
  const git = (...args) =>
    spawnSync(
      "git",
      ["apply", "--directory=node_modules/react-native", ...args, scrollPatch],
      { cwd: project, encoding: "utf8" },
    );
  if (git("--reverse", "--check").status === 0) return "already-applied";
  if (git("--check").status !== 0)
    throw new Error(
      "Correctif de défilement iOS incompatible avec les sources installées.",
    );
  if (git().status !== 0 || git("--reverse", "--check").status !== 0)
    throw new Error("Le correctif de défilement iOS n’a pas pu être vérifié.");
  return "applied";
}
module.exports = {
  applyNativeFixes,
  patch,
  applyScrollResponderFix,
  scrollPatch,
};
if (require.main === module) {
  try {
    console.log(`Correctif tactile iOS : ${applyNativeFixes()}`);
    console.log(`Correctif de défilement iOS : ${applyScrollResponderFix()}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
