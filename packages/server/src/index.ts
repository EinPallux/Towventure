/**
 * Server entry. Loads env, connects Postgres, runs migrations, and listens.
 * `pnpm --filter @towventure/server dev` (tsx watch) or `start` (tsx).
 */

import { buildApp } from './app.js';
import { createDatabase } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { loadEnv } from './env.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const applied = await runMigrations(env.DATABASE_URL);
  const database = createDatabase(env.DATABASE_URL);
  const app = await buildApp(database, env);
  if (applied.length) app.log.info({ applied }, 'migrations applied');

  const close = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await database.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void close('SIGINT'));
  process.on('SIGTERM', () => void close('SIGTERM'));

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
