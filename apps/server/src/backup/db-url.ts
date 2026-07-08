export interface DbConnInfo {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

/** Parses the Prisma-style `mysql://user:pass@host:port/db` connection string
 * into the discrete pieces `mysqldump`/`mysql` CLI flags need. */
export function parseDatabaseUrl(url: string): DbConnInfo {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || '3306',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}
