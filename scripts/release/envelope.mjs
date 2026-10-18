import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const magic = Buffer.from('FNREL001');
export function releaseKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    throw new Error('A canonical base64 32-byte release key is required.');
  }
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) throw new Error('Invalid release key.');
  return key;
}
export function encrypt(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(magic);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([magic, iv, cipher.getAuthTag(), ciphertext]);
}
export function decrypt(envelope, key) {
  if (envelope.length < 36 || !envelope.subarray(0, 8).equals(magic)) throw new Error('Invalid encrypted release.');
  const decipher = createDecipheriv('aes-256-gcm', key, envelope.subarray(8, 20));
  decipher.setAAD(magic);
  decipher.setAuthTag(envelope.subarray(20, 36));
  // Authenticate completely before returning or writing any plaintext.
  return Buffer.concat([decipher.update(envelope.subarray(36)), decipher.final()]);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [mode, input, output] = process.argv.slice(2);
    if (!['encrypt', 'decrypt'].includes(mode) || !input || !output || input === output) throw new Error('Invalid arguments.');
    const data = readFileSync(input);
    if (data.length > 1024 * 1024 * 1024) throw new Error('Release exceeds the size limit.');
    const key = releaseKey(process.env.FN_IOS_RELEASE_KEY);
    writeFileSync(output, mode === 'encrypt' ? encrypt(data, key) : decrypt(data, key), { mode: 0o600, flag: 'wx' });
  } catch {
    console.error('Release encryption/decryption failed; no credentials are logged.');
    process.exitCode = 1;
  }
}
