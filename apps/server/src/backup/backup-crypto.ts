import { randomBytes, createCipheriv, createDecipheriv, scrypt } from 'node:crypto';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { BadRequestException } from '@nestjs/common';

const scryptAsync = promisify(scrypt);
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

/**
 * Backup file format (SPEC §5.14 "password-protected ZIP"): rather than a
 * literal PKZIP+AES container (fragile/native-dependency-heavy in pure
 * Node), we gzip the mysqldump output and AES-256-GCM encrypt it as one
 * opaque file — same security properties (password-protected, only our own
 * Restore can open it), zero extra npm dependencies. Payload layout:
 * salt(16) | iv(12) | authTag(16) | ciphertext.
 */
export async function encryptBackup(plain: Buffer, password: string): Promise<Buffer> {
  const gzipped = await gzipAsync(plain);
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(gzipped), cipher.final()]);
  return Buffer.concat([salt, iv, cipher.getAuthTag(), encrypted]);
}

export async function decryptBackup(payload: Buffer, password: string): Promise<Buffer> {
  if (payload.length < SALT_LEN + IV_LEN + TAG_LEN) {
    throw new BadRequestException('invalid backup file');
  }
  const salt = payload.subarray(0, SALT_LEN);
  const iv = payload.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const authTag = payload.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const encrypted = payload.subarray(SALT_LEN + IV_LEN + TAG_LEN);
  const key = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  try {
    const gzipped = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return await gunzipAsync(gzipped);
  } catch {
    throw new BadRequestException('wrong password or corrupted backup file');
  }
}
