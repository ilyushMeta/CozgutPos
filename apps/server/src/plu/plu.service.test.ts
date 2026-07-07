import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PluService } from './plu.service.js';

vi.mock('node:fs/promises', () => ({ writeFile: vi.fn(async () => undefined) }));
vi.mock('node:child_process', () => ({
  exec: vi.fn((_cmd: string, cb: (err: Error | null) => void) => cb(null)),
}));

const { writeFile } = await import('node:fs/promises');
const { exec } = await import('node:child_process');

function makeSettings(values: Record<string, string | undefined>) {
  return { get: vi.fn(async (key: string) => values[key] ?? null) } as any;
}

function makePrisma(products: any[]) {
  return { product: { findMany: vi.fn(async () => products) } } as any;
}

const SCALE_PRODUCT = {
  id: 42,
  name: 'Çörek',
  code: '1001',
  isScaleItem: true,
  batches: [{ sellPrice: '5.50' }],
};

describe('PluService (SPEC §7.3)', () => {
  beforeEach(() => {
    vi.mocked(writeFile).mockClear();
    vi.mocked(exec).mockClear();
  });

  it('exportIfEnabled is a no-op when scale.enabled is not "true"', async () => {
    const settings = makeSettings({ 'scale.enabled': 'false' });
    const svc = new PluService(makePrisma([]), settings);
    const result = await svc.exportIfEnabled();
    expect(result).toBeNull();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('export throws when scale.pluPath is not configured', async () => {
    const settings = makeSettings({});
    const svc = new PluService(makePrisma([]), settings);
    await expect(svc.export()).rejects.toBeInstanceOf(BadRequestException);
  });

  it('writes translit-safe lines using the default template', async () => {
    const settings = makeSettings({ 'scale.pluPath': '/tmp/plu.txt' });
    const svc = new PluService(makePrisma([SCALE_PRODUCT]), settings);
    const result = await svc.export();

    expect(result).toEqual({ path: '/tmp/plu.txt', count: 1 });
    expect(writeFile).toHaveBeenCalledWith('/tmp/plu.txt', '42\tCorek\t5.50\t1001\n', 'utf8');
  });

  it('honors a custom template', async () => {
    const settings = makeSettings({
      'scale.pluPath': '/tmp/plu.txt',
      'scale.pluTemplate': '{code};{name};{price}',
    });
    const svc = new PluService(makePrisma([SCALE_PRODUCT]), settings);
    await svc.export();
    expect(writeFile).toHaveBeenCalledWith('/tmp/plu.txt', '1001;Corek;5.50\n', 'utf8');
  });

  it('runs the configured command after writing the file', async () => {
    const settings = makeSettings({
      'scale.pluPath': '/tmp/plu.txt',
      'scale.command': 'echo done',
    });
    const svc = new PluService(makePrisma([SCALE_PRODUCT]), settings);
    await svc.export();
    expect(exec).toHaveBeenCalledWith('echo done', expect.any(Function));
  });

  it('exportSafely swallows errors instead of throwing', async () => {
    const settings = makeSettings({ 'scale.enabled': 'true' }); // no pluPath → export() throws
    const svc = new PluService(makePrisma([]), settings);
    await expect(svc.exportSafely()).resolves.toBeUndefined();
  });
});
