import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(async () => undefined),
  readdir: vi.fn(async () => [] as string[]),
  stat: vi.fn(async (_path: string) => ({ size: 100, birthtime: new Date('2026-01-01') })),
  unlink: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
}));
vi.mock('node:fs/promises', () => fsMocks);

const cryptoMocks = vi.hoisted(() => ({
  encryptBackup: vi.fn(async (plain: Buffer) => Buffer.concat([Buffer.from('ENC:'), plain])),
  decryptBackup: vi.fn(async (payload: Buffer) => payload.subarray(4)),
}));
vi.mock('./backup-crypto.js', () => cryptoMocks);

const { BackupService } = await import('./backup.service.js');

function makeSettings(values: Record<string, string> = {}) {
  return { get: vi.fn(async (key: string) => values[key] ?? null) } as any;
}

describe('BackupService (SPEC §5.14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'mysql://user:pw@localhost:3306/cozgut';
  });

  it('create() requires backup.folder to be configured', async () => {
    const svc = new BackupService(makeSettings({ 'backup.password': 'secret' }));
    await expect(svc.create()).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create() requires backup.password to be configured', async () => {
    const svc = new BackupService(makeSettings({ 'backup.folder': '/tmp/backups' }));
    await expect(svc.create()).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create() dumps, encrypts, and writes the file into the configured folder', async () => {
    const svc = new BackupService(
      makeSettings({ 'backup.folder': '/tmp/backups', 'backup.password': 'secret' }),
    );
    vi.spyOn(svc as any, 'dumpDatabase').mockResolvedValue(Buffer.from('-- dump'));

    const info = await svc.create();

    expect(fsMocks.mkdir).toHaveBeenCalledWith('/tmp/backups', { recursive: true });
    expect(cryptoMocks.encryptBackup).toHaveBeenCalledWith(Buffer.from('-- dump'), 'secret');
    expect(fsMocks.writeFile).toHaveBeenCalled();
    expect(info.filename).toMatch(/^cozgut-backup-.*\.sql\.gz\.enc$/);
  });

  it('list() returns an empty array when no folder is configured', async () => {
    const svc = new BackupService(makeSettings());
    expect(await svc.list()).toEqual([]);
  });

  it('list() only includes .sql.gz.enc files, newest first', async () => {
    fsMocks.readdir.mockResolvedValue(['old.sql.gz.enc', 'new.sql.gz.enc', 'ignore.txt'] as any);
    fsMocks.stat.mockImplementation(async (path: any) => {
      const isOld = String(path).includes('old');
      return { size: 10, birthtime: new Date(isOld ? '2026-01-01' : '2026-06-01') } as any;
    });
    const svc = new BackupService(makeSettings({ 'backup.folder': '/tmp/backups' }));

    const files = await svc.list();

    expect(files.map((f) => f.filename)).toEqual(['new.sql.gz.enc', 'old.sql.gz.enc']);
  });

  it('remove() rejects a filename containing a path separator (traversal guard)', async () => {
    const svc = new BackupService(makeSettings({ 'backup.folder': '/tmp/backups' }));
    await expect(svc.remove('../../etc/passwd')).rejects.toBeInstanceOf(BadRequestException);
    expect(fsMocks.unlink).not.toHaveBeenCalled();
  });

  it('remove() rejects a filename with the wrong extension', async () => {
    const svc = new BackupService(makeSettings({ 'backup.folder': '/tmp/backups' }));
    await expect(svc.remove('not-a-backup.txt')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('remove() deletes a valid backup filename', async () => {
    const svc = new BackupService(makeSettings({ 'backup.folder': '/tmp/backups' }));
    await svc.remove('cozgut-backup-2026-01-01.sql.gz.enc');
    expect(fsMocks.unlink).toHaveBeenCalledWith('/tmp/backups/cozgut-backup-2026-01-01.sql.gz.enc');
  });

  it('create() prunes backups older than the configured retention window', async () => {
    fsMocks.readdir.mockResolvedValue(['stale.sql.gz.enc', 'fresh.sql.gz.enc'] as any);
    fsMocks.stat.mockImplementation(async (path: any) => {
      const isStale = String(path).includes('stale');
      return {
        size: 10,
        birthtime: isStale ? new Date('2020-01-01') : new Date(),
      } as any;
    });
    const svc = new BackupService(
      makeSettings({
        'backup.folder': '/tmp/backups',
        'backup.password': 'secret',
        'backup.retentionDays': '30',
      }),
    );
    vi.spyOn(svc as any, 'dumpDatabase').mockResolvedValue(Buffer.from('-- dump'));

    await svc.create();

    expect(fsMocks.unlink).toHaveBeenCalledWith('/tmp/backups/stale.sql.gz.enc');
    expect(fsMocks.unlink).not.toHaveBeenCalledWith('/tmp/backups/fresh.sql.gz.enc');
  });

  it('restore() decrypts the upload then hands the SQL to restoreDatabase', async () => {
    const svc = new BackupService(makeSettings());
    const restoreDatabase = vi.spyOn(svc as any, 'restoreDatabase').mockResolvedValue(undefined);

    await svc.restore(Buffer.from('ENC:-- sql here'), 'secret');

    expect(cryptoMocks.decryptBackup).toHaveBeenCalledWith(
      Buffer.from('ENC:-- sql here'),
      'secret',
    );
    expect(restoreDatabase).toHaveBeenCalledWith(expect.anything(), Buffer.from('-- sql here'));
  });

  it('runScheduledBackup() is a no-op unless backup.scheduleEnabled is exactly "true"', async () => {
    const svc = new BackupService(makeSettings({ 'backup.scheduleEnabled': 'false' }));
    const create = vi.spyOn(svc, 'create');
    await svc.runScheduledBackup();
    expect(create).not.toHaveBeenCalled();
  });

  it('runScheduledBackup() creates a backup when enabled, swallowing failures', async () => {
    const svc = new BackupService(makeSettings({ 'backup.scheduleEnabled': 'true' }));
    const create = vi.spyOn(svc, 'create').mockRejectedValue(new Error('disk full'));
    await expect(svc.runScheduledBackup()).resolves.toBeUndefined();
    expect(create).toHaveBeenCalled();
  });
});
