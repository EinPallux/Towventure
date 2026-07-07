/**
 * Protocol — zod schemas for every API request body (ARCHITECTURE §5). Invariant
 * §7: no unvalidated input reaches a reducer or the DB. The command schema is the
 * validated mirror of run/types `Command`; the `satisfies` check below fails the
 * build if the two ever drift.
 */

import { z } from 'zod';
import { VOW_IDS } from '../content/vows.js';
import type { Command, EquipSlotId } from '../run/types.js';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const nameSchema = z
  .string()
  .min(2)
  .max(24)
  .regex(/^[A-Za-z0-9_-]+$/, 'letters, digits, _ and - only');

export const passwordSchema = z.string().min(8).max(200);

export const registerSchema = z.object({
  name: nameSchema,
  password: passwordSchema,
  email: z.string().email().max(200).optional(),
});
export const loginSchema = z.object({ name: nameSchema, password: passwordSchema });
export const guestSchema = z.object({}).optional();

// ─── Run ─────────────────────────────────────────────────────────────────────

/** All three classes are playable in Phase 2; Honor-tier unlock gating is Phase 3. */
export const classIdSchema = z.enum(['vanguard', 'duelist', 'arcanist']);

/** Only vows with an enforced penalty are accepted — the +15%/vow Honor must be paid for. */
export const vowIdSchema = z.enum(VOW_IDS);

export const runStartSchema = z.object({
  classId: classIdSchema,
  // Each vow multiplies climb Honor (+15%) and carries a real, enforced penalty
  // (run/build, shop, loot). Validated to known vow ids, de-duplicated, ≤5 (CONTENT §6).
  // Honor-tier *unlock* gating (which vows a given tier may pick) is Phase 3.
  vows: z
    .array(vowIdSchema)
    .max(5)
    .default([])
    .refine((v) => new Set(v).size === v.length, { message: 'vows must be unique' }),
});

export const equipSlotSchema = z.enum([
  'weapon1',
  'weapon2',
  'helm',
  'armor',
  'boots',
  'trinket1',
  'trinket2',
  'relic',
]);

export const consumableConditionSchema = z.enum([
  'fightStart',
  'hpBelow70',
  'hpBelow40',
  'doomfall',
  'vsElite',
]);

export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chooseDoor'), doorIndex: z.number().int().min(0) }),
  z.object({ type: z.literal('takeLoot'), take: z.boolean() }),
  z.object({ type: z.literal('equip'), uid: z.string().min(1), slot: equipSlotSchema.optional() }),
  z.object({ type: z.literal('unequip'), slot: equipSlotSchema }),
  z.object({ type: z.literal('fuse'), uid1: z.string().min(1), uid2: z.string().min(1) }),
  z.object({
    type: z.literal('infuse'),
    itemUid: z.string().min(1),
    materialUid: z.string().min(1),
    socketIndex: z.number().int().min(0).max(2).optional(),
  }),
  z.object({ type: z.literal('sell'), uid: z.string().min(1) }),
  z.object({
    type: z.literal('setConsumableCondition'),
    uid: z.string().min(1),
    condition: consumableConditionSchema,
  }),
  z.object({ type: z.literal('buy'), slotIndex: z.number().int().min(0) }),
  z.object({ type: z.literal('reroll') }),
  z.object({ type: z.literal('leaveShop') }),
  z.object({ type: z.literal('resolveEvent'), optionIndex: z.number().int().min(0).max(7) }),
  z.object({ type: z.literal('chooseGraveCopy'), index: z.number().int().min(0).max(2) }),
  z.object({ type: z.literal('proceed') }),
  z.object({ type: z.literal('abandonRun') }),
]);

export const commandRequestSchema = z.object({
  expectedStateVersion: z.number().int().min(0),
  command: commandSchema,
});

// ─── Reads ───────────────────────────────────────────────────────────────────

export const laddersQuerySchema = z.object({
  page: z.coerce.number().int().min(0).max(10_000).default(0),
});
export const profileParamsSchema = z.object({ name: nameSchema });

/** Attack a rival's defense snapshot by account id (GDD §9). */
export const skirmishAttackSchema = z.object({ defenderId: z.string().uuid() });

/** Buy a Merchant/Vault item by its catalogue id (GDD §10.2). */
export const merchantBuySchema = z.object({ itemId: z.string().min(1).max(64) });

// ─── Inferred types ──────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RunStartInput = z.infer<typeof runStartSchema>;
export type CommandInput = z.infer<typeof commandSchema>;
export type CommandRequestInput = z.infer<typeof commandRequestSchema>;

// Compile-time guard: the zod command union must exactly produce run/types Command.
type _CommandParity = CommandInput extends Command
  ? Command extends CommandInput
    ? true
    : never
  : never;
const _commandParity: _CommandParity = true;
void _commandParity;

// Cross-check equip slot enum vs the EquipState key type.
const _slotParity: z.infer<typeof equipSlotSchema> extends EquipSlotId
  ? EquipSlotId extends z.infer<typeof equipSlotSchema>
    ? true
    : never
  : never = true;
void _slotParity;
