// Isolated simulator-only diagnostics. Never used by the distribution builder.
// Trace event names and numeric view tags only, never input values or credentials.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const source = process.argv[2];
if (process.platform !== 'darwin' || !process.env.RUNNER_TEMP ||
    source !== path.join(process.env.RUNNER_TEMP, 'footnation-native-screenshots/source')) {
  throw Error('Only a disposable simulator source copy may be instrumented');
}
const rn = path.join(source, 'node_modules/react-native');
if (JSON.parse(readFileSync(path.join(rn, 'package.json'))).version !== '0.86.3') {
  throw Error('Review diagnostics for the installed RN version');
}
const receipt = [];
function patch(file, before, after) {
  const target = path.join(rn, file), original = readFileSync(target, 'utf8');
  if (original.split(before).length !== 2) throw Error('Diagnostic anchor not unique: ' + file);
  const modified = original.replace(before, after);
  writeFileSync(target, modified);
  const hash = data => createHash('sha256').update(data).digest('hex');
  receipt.push({file, originalSha256:hash(original), diagnosticSha256:hash(modified)});
}
// Native level 3 persists in the simulator unified log; bypass console/Sentry.
patch('Libraries/Renderer/implementations/ReactFabric-prod.js',
  'function dispatchEvent(target, topLevelType, nativeEvent) {',
  'function dispatchEvent(target, topLevelType, nativeEvent) {\n' +
  '  if (/touch/i.test(topLevelType)) global.nativeLoggingHook?.("FN_DIAG_FABRIC " + topLevelType + " " + nativeEvent?.target, 3);');
patch('Libraries/Components/ScrollView/ScrollView.js',
  'if (this._isAnimating()) {\n        return true;',
  'global.nativeLoggingHook?.("FN_DIAG_SCROLL_CAPTURE " + !!this.props.horizontal + " " + this._isAnimating(), 3);\n' +
  '      if (this._isAnimating()) {\n        return true;');
patch('Libraries/Pressability/Pressability.js',
  'this._performTransitionSideEffects(prevState, nextState, signal, event);',
  'global.nativeLoggingHook?.("FN_DIAG_PRESSABILITY " + prevState + " " + nextState + " " + signal, 3);\n' +
  '      this._performTransitionSideEffects(prevState, nextState, signal, event);');
writeFileSync(path.join(source, 'touch-trace-receipt.json'), JSON.stringify({diagnosticOnly:true, files:receipt}));
