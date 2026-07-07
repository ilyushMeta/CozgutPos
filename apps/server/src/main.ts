import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // CORS locked to LAN origins (SPEC §8). Empty list → reflect request origin (dev).
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : true, credentials: true });

  app.setGlobalPrefix('api');

  const port = Number(process.env.SERVER_PORT ?? 3000);
  // Bind to all interfaces so LAN clients can reach the server.
  await app.listen(port, '0.0.0.0');
  Logger.log(`Çözgüt POS server on http://0.0.0.0:${port}/api`, 'Bootstrap');
}

void bootstrap();
