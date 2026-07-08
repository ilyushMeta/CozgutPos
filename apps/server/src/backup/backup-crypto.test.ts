import { describe, it, expect } from 'vitest';
import { encryptBackup, decryptBackup } from './backup-crypto.js';

describe('backup-crypto (SPEC §5.14 password-protected backup)', () => {
  it('round-trips arbitrary bytes through encrypt/decrypt with the correct password', async () => {
    const original = Buffer.from('-- mysqldump output\nCREATE TABLE foo (id INT);\n', 'utf8');
    const encrypted = await encryptBackup(original, 'correct-horse-battery-staple');
    const decrypted = await decryptBackup(encrypted, 'correct-horse-battery-staple');
    expect(decrypted.equals(original)).toBe(true);
  });

  it('produces smaller-or-comparable ciphertext for gzip-friendly repetitive SQL text', async () => {
    const original = Buffer.from('INSERT INTO t VALUES (1);\n'.repeat(200), 'utf8');
    const encrypted = await encryptBackup(original, 'pw');
    expect(encrypted.length).toBeLessThan(original.length);
  });

  it('rejects the wrong password', async () => {
    const encrypted = await encryptBackup(Buffer.from('secret data'), 'right-password');
    await expect(decryptBackup(encrypted, 'wrong-password')).rejects.toThrow();
  });

  it('rejects a truncated/corrupted payload', async () => {
    const encrypted = await encryptBackup(Buffer.from('secret data'), 'pw');
    const corrupted = encrypted.subarray(0, encrypted.length - 5);
    await expect(decryptBackup(corrupted, 'pw')).rejects.toThrow();
  });

  it('rejects a payload too short to even contain the header', async () => {
    await expect(decryptBackup(Buffer.from('short'), 'pw')).rejects.toThrow();
  });

  it('produces different ciphertext for the same plaintext each time (random salt/iv)', async () => {
    const a = await encryptBackup(Buffer.from('same plaintext'), 'pw');
    const b = await encryptBackup(Buffer.from('same plaintext'), 'pw');
    expect(a.equals(b)).toBe(false);
  });
});
