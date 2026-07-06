/**
 * Protocol — zod schemas for every API request body (ARCHITECTURE §5). Invariant
 * §7: no unvalidated input reaches a reducer or the DB. The command schema is the
 * validated mirror of run/types `Command`; the `satisfies` check below fails the
 * build if the two ever drift.
 */

import { z } from 'zod';
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

/** Phase 1 ships the Vanguard only; the enum grows as classes unlock (Phase 2). */
export const classIdSchema = z.enum(['vanguard']);

export const runStartSchema = z.object({
  classId: classIdSchema,
  // Vows are locked empty in Phase 1. Each vow multiplies climb Honor (+15%), but the
  // vow catalog, per-vow penalties, and Honor-tier unlock gating are Phase 2/3
  // (ROADMAP). Accepting arbitrary/duplicate vow strings now would hand out free Honor
  // for penalties that aren't implemented — an economy/ladder exploit. When vows ship,
  // this becomes a validated, de-duplicated, tier-gated enum.
  vows: z.array(z.string()).max(0).default([]),
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

export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chooseDoor'), doorIndex: z.number().int().min(0) }),
  z.object({ type: z.literal('takeLoot'), take: z.boolean() }),
  z.object({ type: z.literal('equip'), uid: z.string().min(1), slot: equipSlotSchema.optional() }),
  z.object({ type: z.literal('unequip'), slot: equipSlotSchema }),
  z.object({ type: z.literal('fuse'), uid1: z.string().min(1), uid2: z.string().min(1) }),
  z.object({ type: z.literal('sell'), uid: z.string().min(1) }),
  z.object({ type: z.literal('buy'), slotIndex: z.number().int().min(0) }),
  z.object({ type: z.literal('reroll') }),
  z.object({ type: z.literal('leaveShop') }),
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
