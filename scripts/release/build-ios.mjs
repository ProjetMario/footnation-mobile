import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decrypt, encrypt, releaseKey } from './envelope.mjs';

process.umask(0o077);
const scripts = path.dirname(fileURLToPath(import.meta.url));
const work = path.join(process.env.RUNNER_TEMP || '', 'footnation-ios-release');
const source = path.join(work, 'source');
const deliverables = path.join(process.env.RUNNER_TEMP || '', 'footnation-ios-artifacts');
let key, log, keychain, installedProfile, originalKeychains;
let phase = 'configuration';
let success = false;
let createdWork = false;
const env = { ...process.env };
delete env.FN_IOS_RELEASE_KEY;
delete env.GITHUB_TOKEN;
delete env.GH_TOKEN;

function run(command, args, { cwd = source, capture = false, commandEnv = env } = {}) {
  const result = spawnSync(command, args, { cwd, env: commandEnv, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', log, log] });
  if (result.status !== 0 || result.error) {
    if (capture && log !== undefined) writeFileSync(log, result.stderr || 'Command failed.\n');
    throw new Error('Release command failed.');
  }
  return result.stdout || '';
}
function stage(name) { phase = name; console.log(`iOS release: ${name}`); }
function privateJson(filename) { return JSON.parse(readFileSync(path.join(source, 'release-private', filename), 'utf8')); }

try {
  if (process.platform !== 'darwin' || !process.env.RUNNER_TEMP || !process.env.GITHUB_WORKSPACE) throw new Error('GitHub macOS runner required.');
  if (existsSync(work) || existsSync(deliverables)) throw new Error('Fresh runner directories required.');
  mkdirSync(work, { mode: 0o700 });
  createdWork = true;
  mkdirSync(deliverables, { mode: 0o700 });
  log = openSync(path.join(work, 'release.log'), 'wx', 0o600);
  const xcodeVersion = run('xcodebuild', ['-version'], { cwd: work, capture: true });
  if (!/^Xcode 26\.6\s/m.test(xcodeVersion)) throw new Error('Expected Xcode 26.6.');
  key = releaseKey(process.env.FN_IOS_RELEASE_KEY);
  const payload = process.env.FN_PAYLOAD_PATH;
  if (!payload || path.isAbsolute(payload) || payload.split(/[\\/]/).some(p => p === '..') || !/^[a-zA-Z0-9_./-]+$/.test(payload)) throw new Error('Invalid payload path.');
  const expectedHash = process.env.FN_PAYLOAD_SHA256;
  if (!/^[a-f0-9]{64}$/.test(expectedHash || '')) throw new Error('Payload SHA256 required.');
  const ciphertext = readFileSync(path.join(process.env.GITHUB_WORKSPACE, payload));
  if (createHash('sha256').update(ciphertext).digest('hex') !== expectedHash) throw new Error('Payload integrity mismatch.');
  writeFileSync(path.join(work, 'source.tar.gz'), decrypt(ciphertext, key), { flag: 'wx', mode: 0o600 });
  stage('authenticated source extraction');
  run('python3', [path.join(scripts, 'safe-extract.py'), path.join(work, 'source.tar.gz'), source], { cwd: work });
  rmSync(path.join(work, 'source.tar.gz'));
  const signing = privateJson('signing.json');
  if (!/^[A-Z0-9]{10}$/.test(signing.teamId || '') || signing.bundleIdentifier !== 'com.footnation.app' || !/^\d+\.\d+\.\d+$/.test(signing.version || '') || !/^[1-9]\d{0,8}$/.test(String(signing.buildNumber || '')) || typeof signing.certificatePassword !== 'string') throw new Error('Invalid signing manifest.');
  const buildEnv = privateJson('build-env.json');
  for (const [name, value] of Object.entries(buildEnv)) {
    if (!/^EXPO_PUBLIC_[A-Z0-9_]+$/.test(name) && !['SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN'].includes(name)) throw new Error('Disallowed build environment variable.');
    if (typeof value !== 'string' || value.includes('\0')) throw new Error('Invalid build environment value.');
    env[name] = value;
  }
  Object.assign(env, { CI: '1', EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1', EXPO_PUBLIC_SUPPORTERS_ENABLED: 'false', EAS_BUILD_PLATFORM: 'ios', EAS_BUILD_PROFILE: 'jersey-store', NODE_ENV: 'production', FASTLANE_SKIP_UPDATE_CHECK: '1', FASTLANE_HIDE_CHANGELOG: '1', FASTLANE_OPT_OUT_USAGE: '1', FASTLANE_DONT_STORE_PASSWORD: '1', FN_SOURCE_ROOT: source, FN_WORK_ROOT: work });
  const appPath = path.join(source, 'app.json');
  const app = JSON.parse(readFileSync(appPath, 'utf8'));
  if (app.expo?.ios?.bundleIdentifier !== signing.bundleIdentifier) throw new Error('Bundle identifier mismatch.');
  app.expo.version = signing.version;
  app.expo.ios.buildNumber = String(signing.buildNumber);
  writeFileSync(appPath, JSON.stringify(app, null, 2));

  stage('dependency installation');
  run('npm', ['ci', '--include=dev', '--legacy-peer-deps', '--no-audit', '--no-fund']);
  stage('TypeScript and native configuration checks');
  run('npm', ['run', 'typecheck']);
  run('npm', ['run', 'check:build-env']);
  stage('Expo iOS project generation');
  run('npx', ['--no-install', 'expo', 'prebuild', '--platform', 'ios', '--no-install']);
  stage('CocoaPods installation');
  run('pod', ['install'], { cwd: path.join(source, 'ios') });

  stage('temporary signing keychain');
  keychain = path.join(work, 'signing.keychain-db');
  const keychainPassword = randomBytes(32).toString('hex');
  originalKeychains = [...run('security', ['list-keychains', '-d', 'user'], { capture: true }).matchAll(/"([^"]+)"/g)].map(match => match[1]);
  run('security', ['create-keychain', '-p', keychainPassword, keychain]);
  run('security', ['set-keychain-settings', '-lut', '21600', keychain]);
  run('security', ['unlock-keychain', '-p', keychainPassword, keychain]);
  run('security', ['import', path.join(source, 'release-private', 'certificate.p12'), '-k', keychain, '-P', signing.certificatePassword, '-T', '/usr/bin/codesign', '-T', '/usr/bin/security']);
  run('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', keychainPassword, keychain]);
  run('security', ['list-keychains', '-d', 'user', '-s', keychain, ...originalKeychains]);
  const profilePlist = run('security', ['cms', '-D', '-i', path.join(source, 'release-private', 'profile.mobileprovision')], { capture: true });
  writeFileSync(path.join(work, 'profile.plist'), profilePlist);
  const profile = JSON.parse(run('python3', ['-c', `import plistlib,json,hashlib,sys,datetime
p=plistlib.load(open(sys.argv[1],'rb'))
assert p.get('ExpirationDate') > datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
assert not p.get('ProvisionedDevices') and not p.get('ProvisionsAllDevices')
assert p['Entitlements'].get('get-task-allow') is False
print(json.dumps({'uuid':p['UUID'],'name':p['Name'],'team':p['TeamIdentifier'][0],'app':p['Entitlements']['application-identifier'],'certificates':[hashlib.sha1(c).hexdigest().upper() for c in p['DeveloperCertificates']]}))`, path.join(work, 'profile.plist')], { capture: true }));
  if (profile.team !== signing.teamId || profile.app !== `${signing.teamId}.${signing.bundleIdentifier}` || !/^[A-Fa-f0-9-]{36}$/.test(profile.uuid)) throw new Error('Provisioning profile mismatch.');
  const identities = run('security', ['find-identity', '-v', '-p', 'codesigning', keychain], { capture: true });
  const identity = profile.certificates.find(fingerprint => identities.includes(fingerprint));
  if (!identity) throw new Error('Signing certificate does not match the provisioning profile.');
  // Xcode 16+ stores profiles in UserData, not the historical MobileDevice directory.
  const profilesDir = path.join(process.env.HOME, 'Library', 'Developer', 'Xcode', 'UserData', 'Provisioning Profiles');
  mkdirSync(profilesDir, { recursive: true, mode: 0o700 });
  const profileTarget = path.join(profilesDir, `${profile.uuid}.mobileprovision`);
  if (existsSync(profileTarget)) throw new Error('Refusing to overwrite an existing profile.');
  copyFileSync(path.join(source, 'release-private', 'profile.mobileprovision'), profileTarget);
  installedProfile = profileTarget;
  writeFileSync(path.join(source, 'release-private', 'signing-runtime.json'), JSON.stringify({ ...signing, certificatePassword: undefined, profileUuid: profile.uuid, profileName: profile.name, identity }));
  mkdirSync(path.join(source, 'fastlane'), { recursive: true });
  copyFileSync(path.join(scripts, 'Fastfile'), path.join(source, 'fastlane', 'Fastfile'));
  stage('Xcode archive and App Store export');
  run('fastlane', ['ios', 'release']);
  const ipa = path.join(work, 'output', 'FootNation.ipa');
  stage('IPA identity and version verification');
  run('python3', ['-c', `import zipfile,plistlib,sys
with zipfile.ZipFile(sys.argv[1]) as z:
 names=[n for n in z.namelist() if n.startswith('Payload/') and n.count('/')==2 and n.endswith('.app/Info.plist')]
 assert len(names)==1
 p=plistlib.loads(z.read(names[0]))
 assert p['CFBundleIdentifier']==sys.argv[2]
 assert p['CFBundleShortVersionString']==sys.argv[3]
 assert p['CFBundleVersion']==sys.argv[4]`, ipa, signing.bundleIdentifier, signing.version, String(signing.buildNumber)]);
  stage('encrypted IPA artifact');
  const ipaBytes = readFileSync(ipa);
  writeFileSync(path.join(deliverables, 'FootNation.ipa.enc'), encrypt(ipaBytes, key));
  writeFileSync(path.join(deliverables, 'release.json'), JSON.stringify({ bundleIdentifier: signing.bundleIdentifier, version: signing.version, buildNumber: String(signing.buildNumber), ipaSha256: createHash('sha256').update(ipaBytes).digest('hex'), sourceSha256: expectedHash }, null, 2));
  success = true;
} catch {
  console.error(`iOS release failed during: ${phase}. Detailed logs are encrypted.`);
  process.exitCode = 1;
} finally {
  // Diagnostics stay encrypted; never upload source or raw build logs.
  try {
    if (log !== undefined) closeSync(log);
    if (key && existsSync(path.join(work, 'release.log'))) {
      const logsArchive = path.join(work, 'logs.tar.gz');
      const entries = ['release.log'];
      if (existsSync(path.join(work, 'build-logs'))) entries.push('build-logs');
      const result = spawnSync('tar', ['-czf', logsArchive, '-C', work, ...entries], { stdio: 'ignore' });
      if (result.status === 0) writeFileSync(path.join(deliverables, 'logs.tar.gz.enc'), encrypt(readFileSync(logsArchive), key));
    }
  } catch { console.error('Encrypted diagnostic archive unavailable.'); }
  if (originalKeychains) spawnSync('security', ['list-keychains', '-d', 'user', '-s', ...originalKeychains], { stdio: 'ignore' });
  if (keychain) spawnSync('security', ['delete-keychain', keychain], { stdio: 'ignore' });
  if (installedProfile) rmSync(installedProfile, { force: true });
  if (createdWork && process.env.RUNNER_TEMP && work.startsWith(`${process.env.RUNNER_TEMP}${path.sep}`)) rmSync(work, { recursive: true, force: true });
  key?.fill(0);
  if (success) console.log('Signed IPA verified and encrypted. This workflow does not submit or publish to the App Store.');
}
