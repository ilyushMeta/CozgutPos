import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

export interface DbConnInfo {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/** Parses a `mysql://user:pass@host:port/db` connection string. */
export function parseDatabaseUrl(url: string): DbConnInfo {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

/** Reads `KEY=value` lines from a .env-style file. Missing file → empty object. */
export function readEnvFile(path: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Target app database connection (from apps/server/.env DATABASE_URL) — the CLI
 * writes migrated rows here via parameterized SQL (CLAUDE.md rule: no interpolation). */
export async function openTargetConnection(serverEnvPath: string): Promise<mysql.Connection> {
  const env = { ...readEnvFile(serverEnvPath), ...process.env } as Record<string, string>;
  const url = env.DATABASE_URL;
  if (!url) throw new Error(`DATABASE_URL not found in ${serverEnvPath} or process.env`);
  const info = parseDatabaseUrl(url);
  return mysql.createConnection({
    host: info.host,
    port: info.port,
    user: info.user,
    password: info.password,
    database: info.database,
    multipleStatements: false,
    decimalNumbers: false,
  });
}

/** Scratch connection used to load the legacy dump.sql (needs CREATE DATABASE
 * privilege — the app's least-privilege `cozgut_app` user does not have this,
 * so a separate admin-ish credential is used, e.g. `mysql://root@localhost:3306/`). */
export async function openLegacyAdminConnection(legacyDbUrl: string): Promise<mysql.Connection> {
  const info = parseDatabaseUrl(legacyDbUrl);
  return mysql.createConnection({
    host: info.host,
    port: info.port,
    user: info.user,
    password: info.password,
    multipleStatements: true, // the dump is one big script of statements
    decimalNumbers: false,
  });
}
