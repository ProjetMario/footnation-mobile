import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decrypt, encrypt, releaseKey } from './envelope.mjs';

test('release envelope round trips binary content with unique nonces', () => {
  const key = randomBytes(32);
  const bytes = randomBytes(5000);
  const first = encrypt(bytes, key);
  const second = encrypt(bytes, key);
  assert.deepEqual(decrypt(first, key), bytes);
  assert.notDeepEqual(first, second);
});
test('wrong keys and changes to header, IV, tag or ciphertext fail authentication', () => {
  const key = randomBytes(32);
  const original = encrypt(Buffer.from('Private signing material'), key);
  assert.throws(() => decrypt(original, randomBytes(32)));
  for (const index of [0, 8, 20, 36, original.length - 1]) {
    const changed = Buffer.from(original);
    changed[index] ^= 1;
    assert.throws(() => decrypt(changed, key));
  }
  assert.throws(() => releaseKey('not-a-key'));
  assert.deepEqual(releaseKey(key.toString('base64')), key);
});
test('CLI never creates plaintext when authentication fails and never overwrites files', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fn-release-envelope-'));
  try {
    const key = randomBytes(32);
    const encrypted = path.join(dir, 'encrypted');
    const output = path.join(dir, 'plaintext');
    writeFileSync(encrypted, encrypt(Buffer.from('private'), key));
    const cli = fileURLToPath(new URL('./envelope.mjs', import.meta.url));
    const bad = spawnSync(process.execPath, [cli, 'decrypt', encrypted, output], { env: { ...process.env, FN_IOS_RELEASE_KEY: randomBytes(32).toString('base64') }, encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.equal(existsSync(output), false);
    writeFileSync(output, 'existing');
    const overwrite = spawnSync(process.execPath, [cli, 'decrypt', encrypted, output], { env: { ...process.env, FN_IOS_RELEASE_KEY: key.toString('base64') }, encoding: 'utf8' });
    assert.equal(overwrite.status, 1);
    assert.equal(readFileSync(output, 'utf8'), 'existing');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
