import { describe, it, expect } from 'vitest';
import { parseDatabaseUrl } from './db-url.js';

describe('parseDatabaseUrl', () => {
  it('splits a standard mysql:// connection string into its parts', () => {
    const info = parseDatabaseUrl('mysql://cozgut_app:devpass@localhost:3306/cozgut');
    expect(info).toEqual({
      host: 'localhost',
      port: '3306',
      user: 'cozgut_app',
      password: 'devpass',
      database: 'cozgut',
    });
  });

  it('defaults to port 3306 when omitted', () => {
    const info = parseDatabaseUrl('mysql://user:pw@dbhost/mydb');
    expect(info.port).toBe('3306');
  });

  it('URL-decodes special characters in the password', () => {
    const info = parseDatabaseUrl('mysql://user:p%40ss%23word@host:3306/db');
    expect(info.password).toBe('p@ss#word');
  });
});
