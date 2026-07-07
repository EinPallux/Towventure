/**
 * Minimal forward-only migrator: applies every `drizzle/*.sql` file in filename
 * order, each in a transaction, recording applied files in `schema_migrations`.
 * Dependency-light and transparent — expand-contract discipline (AGENTS.md §4).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { loadEnv } from '../env.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'drizzle');

export async function runMigrations(url: string): Promise<string[]> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const applied: string[] = [];
  try {
    await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;
    const done = new Set(
      (await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((r) => r.name),
    );
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const ddl = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await sql.begin(async (tx) => {
        await tx.unsafe(ddl);
        await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
      });
      applied.push(file);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
  return applied;
}

// Run directly: `pnpm --filter @towventure/server migrate`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const env = loadEnv();
  runMigrations(env.DATABASE_URL)
    .then((applied) => {
      if (applied.length) console.log(`[migrate] applied: ${applied.join(', ')}`);
      else console.log('[migrate] up to date');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[migrate] failed:', err);
      process.exit(1);
    });
}
