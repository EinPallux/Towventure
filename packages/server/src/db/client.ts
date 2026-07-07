/**
 * Postgres connection + Drizzle handle. Postgres is the only datastore
 * (ARCHITECTURE §1); one pooled `postgres` client per process.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Sql = ReturnType<typeof postgres>;
export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface Database {
  sql: Sql;
  db: Db;
  close: () => Promise<void>;
}

export function createDatabase(url: string, opts: { max?: number } = {}): Database {
  const sql = postgres(url, { max: opts.max ?? 10, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  return { sql, db, close: () => sql.end({ timeout: 5 }) };
}

export { schema };
