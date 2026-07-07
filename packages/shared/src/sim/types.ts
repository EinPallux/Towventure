/**
 * Sim I/O types. The sim is content-agnostic: it consumes a *compiled*
 * `CombatSpec` of flat integer stats + effect bindings and emits `(result,
 * events)`. The run/content layer owns turning items, ★ tiers, infusions and
 * class relics into these specs — the sim never sees an "item" or a "rarity".
 */

import type { StatusKind } from './constants.js';

// ─── Triggers (the Phase 1 vocabulary; ROADMAP Phase 1) ──────────────────────

export type Trigger =
  | { kind: 'OnHit' }
  | { kind: 'OnCrit' }
  | { kind: 'OnHurt' }
  | { kind: 'OnBlock' } // this combatant's Armor absorbed part of a hit
  | { kind: 'OnDodge' }
  | { kind: 'Every'; seconds: number }
  | { kind: 'OnFightStart' }
  | { kind: 'OnHpBelow'; pct: number }
  | { kind: 'OnDoomfall' }
  /** Fires on the applier when it applies status X (Phase 2 vocabulary). */
  | { kind: 'OnStatusApplied'; status: StatusKind }
  /** Fires on this combatant when an opposing combatant dies. */
  | { kind: 'OnEnemyDeath' };

export type TriggerKind = Trigger['kind'];

// ─── Effect operations ───────────────────────────────────────────────────────

/** Where a targeted op lands, relative to the effect's firing context. */
export type EffectTarget = 'self' | 'target' | 'attacker' | 'allEnemies';

export type EffectOp =
  | { op: 'applyStatus'; status: StatusKind; stacks: number; to: EffectTarget }
  | { op: 'gainArmor'; amount: number }
  | { op: 'gainWard'; amount: number }
  | { op: 'gainWardPctMax'; pct: number }
  | { op: 'heal'; amount: number }
  | { op: 'healPctMax'; pct: number }
  /** Deal `pct`% of this combatant's primary-weapon damage to `to` as a hit. */
  | { op: 'damageWeaponPct'; pct: number; to: EffectTarget }
  /** Fight-scoped additive damage% buff on self (e.g. Moth-Eaten Standard). */
  | { op: 'buffDamagePct'; pct: number }
  /** Fight-scoped additive Speed% buff on self (e.g. Pyrebrand ignite, Rumor). */
  | { op: 'buffSpeedPct'; pct: number }
  /** Buffer the combatant's NEXT landing weapon hit by `pct`% (Shadow (4) OnDodge). */
  | { op: 'buffNextHitPct'; pct: number }
  /** Fight-scoped: +`pct`% weapon damage vs a target afflicted with `status` (Venom (4)). */
  | { op: 'buffDamageVsStatusPct'; status: StatusKind; pct: number }
  /** Deal self.thorns × mult to the triggering attacker (Bulwark Sigil OnBlock). */
  | { op: 'retaliateThorns'; mult: number }
  /** Delay the target's next action(s) by `ticks` (Toll-Keeper's Bell). */
  | { op: 'stun'; ticks: number; to: EffectTarget };

/**
 * A trigger→effect pair with optional firing gates. Numbers here are already
 * ★-scaled by the compiler (the sim does no fusion math).
 */
export interface EffectBinding {
  /** Human label for events/legibility (item or relic name). */
  source: string;
  trigger: Trigger;
  ops: EffectOp[];
  /** Percentage gate (integer 0..100), e.g. "30% OnHit → …". */
  chancePct?: number;
  /** Only fire on every Nth qualifying hit (OnHit / weapon-hit triggers). */
  everyNthHit?: number;
  /** OnHurt gate: incoming hit must be ≥ this % of max HP to qualify. */
  minHitPctMax?: number;
}

// ─── Combatant + combat specs (sim input) ────────────────────────────────────

export interface WeaponSpec {
  name: string;
  /** Base cooldown in ticks at this build (already ★-scaled). */
  cooldownTicks: number;
  /** Base per-hit damage (already ★-scaled). */
  damage: number;
}

export interface CombatantSpec {
  id: string;
  name: string;
  maxHp: number;
  armor: number;
  /** Global cooldown modifier, percent; may be negative. */
  speedPct: number;
  critChancePct: number;
  /** Added to the ×1.5 base crit multiplier (percent). */
  critDamagePct: number;
  dodgePct: number;
  lifestealPct: number;
  thorns: number;
  /** Start-of-fight Ward as a % of max HP (e.g. Aegis of the Sleepless). */
  startWardPct?: number;
  // ─ Enemy-only mechanic flags (biomes 2–5 anti-autopilot walls, CONTENT §4). ─
  /** Cannot be crit — even by Shock's guaranteed crit (The Unshelved, Archive). */
  critImmune?: boolean;
  /** DoT of this status heals instead of damaging (Cinder Widow ← Burn, Foundry). */
  healsFromStatus?: StatusKind;
  /** Sustained self-heal, % max HP per second (Prior of Teeth, floor 50). */
  selfHealPctPerSec?: number;
  /** …halved once this many total status stacks sit on the combatant. */
  healHalvedAtStacks?: number;
  weapons: WeaponSpec[];
  effects: EffectBinding[];
}

export interface CombatSpec {
  hero: CombatantSpec;
  enemies: CombatantSpec[];
  /** Tick Doomfall begins (450 default, 350 under Vow of Haste). */
  doomfallStartTicks: number;
}

// ─── Events (sim output → client playback + hash) ────────────────────────────

/** Combatant index in the flattened `[hero, ...enemies]` array. */
export type CombatantIndex = number;

export type SimEvent =
  | { type: 'fightStart'; t: number }
  | { type: 'swing'; t: number; who: CombatantIndex; weapon: number }
  | {
      type: 'hit';
      t: number;
      from: CombatantIndex;
      to: CombatantIndex;
      dmg: number;
      crit: 0 | 1;
      blocked: 0 | 1;
    }
  | { type: 'dodge'; t: number; from: CombatantIndex; to: CombatantIndex }
  | { type: 'status'; t: number; to: CombatantIndex; status: StatusKind; stacks: number }
  /** Periodic status resolution; `dmg` > 0 damages, `dmg` < 0 heals (Regen). */
  | { type: 'dot'; t: number; to: CombatantIndex; status: StatusKind; dmg: number }
  | { type: 'armor'; t: number; who: CombatantIndex; amount: number }
  | { type: 'ward'; t: number; who: CombatantIndex; amount: number }
  | { type: 'heal'; t: number; who: CombatantIndex; amount: number }
  | { type: 'thorns'; t: number; from: CombatantIndex; to: CombatantIndex; dmg: number }
  | { type: 'stun'; t: number; to: CombatantIndex; ticks: number }
  | { type: 'doomfall'; t: number }
  | { type: 'doomfallTick'; t: number; who: CombatantIndex; dmg: number }
  | { type: 'death'; t: number; who: CombatantIndex }
  | { type: 'fightEnd'; t: number; winner: 'hero' | 'enemies' };

export interface SimResult {
  winner: 'hero' | 'enemies';
  endTick: number;
  heroHpRemaining: number;
  heroMaxHp: number;
  enemyHpRemaining: number[];
  /** FNV-1a digest of the numeric event stream — the cross-platform cross-check. */
  logHash: number;
  events: SimEvent[];
}
