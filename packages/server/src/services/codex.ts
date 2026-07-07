/**
 * Codex service (CONTENT §7) — lifetime, per-account discovery. A run's codex is
 * banked once at its end (dead/abandoned) so enemy kills don't double-count: items
 * upsert to the greater ★, enemies add their run tally. `getCodex` returns the merged
 * progress the client renders with `buildCodexFrom`.
 */

import type { CodexProgress } from '@towventure/shared/run';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { codex } from '../db/schema.js';
import type { Tx } from './honor.js';

/** Bank a finished run's discovery into the account codex (idempotent per entry kind). */
export async function bankRunCodex(
  tx: Tx,
  accountId: string,
  progress: CodexProgress,
): Promise<void> {
  const rows: { accountId: string; kind: string; entryId: string; progress: number }[] = [];
  for (const [entryId, star] of Object.entries(progress.items)) {
    if (star > 0) rows.push({ accountId, kind: 'item', entryId, progress: star });
  }
  for (const [entryId, kills] of Object.entries(progress.enemies)) {
    if (kills > 0) rows.push({ accountId, kind: 'enemy', entryId, progress: kills });
  }
  if (rows.length === 0) return;
  await tx
    .insert(codex)
    .values(rows)
    .onConflictDoUpdate({
      target: [codex.accountId, codex.kind, codex.entryId],
      // Items keep the higher ★; enemies accumulate kills across runs.
      set: {
        progress: sql`CASE WHEN ${codex.kind} = 'item'
          THEN GREATEST(${codex.progress}, EXCLUDED.progress)
          ELSE ${codex.progress} + EXCLUDED.progress END`,
      },
    });
}

/** The account's merged lifetime Codex progress. */
export async function getCodex(db: Db, accountId: string): Promise<CodexProgress> {
  const rows = await db
    .select({ kind: codex.kind, entryId: codex.entryId, progress: codex.progress })
    .from(codex)
    .where(eq(codex.accountId, accountId));
  const out: CodexProgress = { items: {}, enemies: {} };
  for (const r of rows) {
    if (r.kind === 'item') out.items[r.entryId] = r.progress;
    else if (r.kind === 'enemy') out.enemies[r.entryId] = r.progress;
  }
  return out;
}
