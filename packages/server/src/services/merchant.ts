/**
 * Honor Merchant service (GDD §10.2, CONTENT §8). Marks + Champion's Keys are the only
 * currencies here; both move transactionally. Cosmetics land in `unlocks` (owned once);
 * boons arm on `accounts.armed_boon` and are consumed at the next run start. Vault items
 * cost 3 Keys (marked spent on the skirmish rows that granted them) instead of Marks.
 */

import { findMerchantItem, type MerchantItem } from '@towventure/shared/content';
import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { accounts, marksLedger, unlocks } from '../db/schema.js';
import { type Tx } from './honor.js';
import { KEYS_FOR_VAULT } from './skirmish.js';

/** The set of cosmetic item ids this account owns. */
export async function getOwnedIds(db: Db, accountId: string): Promise<Set<string>> {
  const rows = await db
    .select({ itemId: unlocks.itemId })
    .from(unlocks)
    .where(eq(unlocks.accountId, accountId));
  return new Set(rows.map((r) => r.itemId));
}

/** The boon currently armed for the next run (or null). */
export async function getArmedBoon(db: Db, accountId: string): Promise<string | null> {
  const rows = await db
    .select({ armedBoon: accounts.armedBoon })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  return rows[0]?.armedBoon ?? null;
}

/**
 * Read + clear the armed boon inside a run-start transaction (consumed once). Run start
 * is serialized per account (one active run), so the read-then-clear can't double-spend.
 */
export async function consumeArmedBoon(tx: Tx, accountId: string): Promise<string | null> {
  const rows = await tx
    .select({ armedBoon: accounts.armedBoon })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  const boon = rows[0]?.armedBoon ?? null;
  if (boon) await tx.update(accounts).set({ armedBoon: null }).where(eq(accounts.id, accountId));
  return boon;
}

async function marksBalanceTx(tx: Tx, accountId: string, season: number): Promise<number> {
  const rows = await tx
    .select({ total: sql<number>`coalesce(sum(${marksLedger.delta}), 0)::int` })
    .from(marksLedger)
    .where(and(eq(marksLedger.accountId, accountId), eq(marksLedger.season, season)));
  return rows[0]?.total ?? 0;
}

/** Mark `n` of this account's unspent Champion's Keys spent; returns true if `n` existed. */
async function spendKeys(tx: Tx, accountId: string, season: number, n: number): Promise<boolean> {
  const rows = await tx.execute(sql`
    UPDATE skirmishes SET key_spent = true
    WHERE id IN (
      SELECT id FROM skirmishes
      WHERE attacker_id = ${accountId} AND season = ${season}
        AND key_awarded = true AND key_spent = false
      ORDER BY at
      LIMIT ${n}
    )
    RETURNING id
  `);
  // postgres-js returns the RETURNING rows as an array — its length is the spend count.
  return (rows as unknown as unknown[]).length === n;
}

export type BuyError =
  | 'no_such_item'
  | 'already_owned'
  | 'not_enough_marks'
  | 'not_enough_keys';

export interface BuyResult {
  item: MerchantItem;
  spentMarks: number;
  spentKeys: number;
  armedBoon: string | null;
}

/** Purchase a Merchant/Vault item. Validates + moves currency in one transaction. */
export async function buyMerchantItem(
  db: Db,
  accountId: string,
  season: number,
  itemId: string,
): Promise<{ ok: true; result: BuyResult } | { ok: false; error: BuyError }> {
  const item = findMerchantItem(itemId);
  if (!item) return { ok: false, error: 'no_such_item' };

  const isCosmetic = item.kind !== 'boon';
  if (isCosmetic && (await getOwnedIds(db, accountId)).has(item.id)) {
    return { ok: false, error: 'already_owned' };
  }

  try {
    const result = await db.transaction(async (tx) => {
      let spentMarks = 0;
      let spentKeys = 0;
      if (item.vault) {
        if (!(await spendKeys(tx, accountId, season, KEYS_FOR_VAULT))) throw new Error('not_enough_keys');
        spentKeys = KEYS_FOR_VAULT;
      } else {
        if ((await marksBalanceTx(tx, accountId, season)) < item.price) throw new Error('not_enough_marks');
        await tx
          .insert(marksLedger)
          .values({ accountId, season, delta: -item.price, reason: `buy:${item.id}`, refId: null });
        spentMarks = item.price;
      }

      let armedBoon: string | null = null;
      if (item.boon) {
        await tx.update(accounts).set({ armedBoon: item.boon }).where(eq(accounts.id, accountId));
        armedBoon = item.boon;
      } else {
        await tx.insert(unlocks).values({ accountId, itemId: item.id }).onConflictDoNothing();
      }
      return { item, spentMarks, spentKeys, armedBoon } satisfies BuyResult;
    });
    return { ok: true, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'not_enough_keys') return { ok: false, error: 'not_enough_keys' };
    if (msg === 'not_enough_marks') return { ok: false, error: 'not_enough_marks' };
    throw err;
  }
}
