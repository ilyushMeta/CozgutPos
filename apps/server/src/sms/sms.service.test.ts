import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SmsService } from './sms.service.js';

function makeSettings(values: Record<string, string | undefined>) {
  return { get: vi.fn(async (key: string) => values[key] ?? null) } as any;
}

describe('SmsService.send (SPEC §7.4)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reports failure when sms.gatewayIp is not configured', async () => {
    const svc = new SmsService(makeSettings({}));
    const result = await svc.send('+99361234567', 'salam');
    expect(result).toEqual({ sent: false, reason: 'sms.gatewayIp not configured' });
  });

  it('POSTs {to, message} with an Authorization header to http://<ip>:8082/', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
    global.fetch = fetchMock as any;
    const svc = new SmsService(
      makeSettings({ 'sms.gatewayIp': '192.168.1.50', 'sms.token': 'secret-token' }),
    );

    const result = await svc.send('+99361234567', 'salam');

    expect(result).toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.1.50:8082/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'secret-token' }),
        body: JSON.stringify({ to: '+99361234567', message: 'salam' }),
      }),
    );
  });

  it('reports failure on a non-ok gateway response', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 }) as Response) as any;
    const svc = new SmsService(makeSettings({ 'sms.gatewayIp': '192.168.1.50' }));
    const result = await svc.send('+99361234567', 'salam');
    expect(result).toEqual({ sent: false, reason: 'gateway responded 500' });
  });

  it('reports failure when the request throws (e.g. unreachable/timeout)', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('fetch failed');
    }) as any;
    const svc = new SmsService(makeSettings({ 'sms.gatewayIp': '192.168.1.50' }));
    const result = await svc.send('+99361234567', 'salam');
    expect(result).toEqual({ sent: false, reason: 'fetch failed' });
  });
});

describe('SmsService.sendSafely', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(SmsService.prototype as any, 'send');
  });

  it('is a no-op when no phone number is given', async () => {
    const svc = new SmsService(makeSettings({ 'sms.gatewayIp': '192.168.1.50' }));
    await svc.sendSafely(null, 'salam');
    await svc.sendSafely(undefined, 'salam');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('never throws even when send fails', async () => {
    const svc = new SmsService(makeSettings({}));
    await expect(svc.sendSafely('+99361234567', 'salam')).resolves.toBeUndefined();
  });
});
