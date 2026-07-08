import { Injectable, Logger } from '@nestjs/common';
import { SettingKey } from '@cozgut/shared';
import { SettingsService } from '../settings/settings.service.js';

const GATEWAY_TIMEOUT_MS = 5000;

/**
 * SMS gateway client (SPEC §7.4) — an Android SMS-gateway app on a phone in
 * the same LAN. POSTs {to, message} with an Authorization header to
 * http://<ip>:8082/. Used by debt sale (§6.5), debt payment, and the
 * Settings test button.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly settings: SettingsService) {}

  /** Sends and reports the real outcome — for the Settings "test" button. */
  async send(to: string, message: string): Promise<{ sent: boolean; reason?: string }> {
    const ip = await this.settings.get(SettingKey.SMS_GATEWAY_IP);
    const token = await this.settings.get(SettingKey.SMS_TOKEN);
    if (!ip) return { sent: false, reason: 'sms.gatewayIp not configured' };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
    try {
      const res = await fetch(`http://${ip}:8082/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify({ to, message }),
        signal: controller.signal,
      });
      if (!res.ok) return { sent: false, reason: `gateway responded ${res.status}` };
      return { sent: true };
    } catch (e) {
      return { sent: false, reason: (e as Error).message };
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Fire-and-forget: never throws, swallows a missing phone number or gateway failure. */
  async sendSafely(to: string | null | undefined, message: string): Promise<void> {
    if (!to) return;
    const result = await this.send(to, message);
    if (!result.sent) this.logger.warn(`SMS send failed: ${result.reason}`);
  }
}
