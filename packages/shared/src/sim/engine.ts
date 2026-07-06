/**
 * The deterministic tick engine (GDD §3.3, BALANCE §1). Integer math only; the
 * only randomness is the seeded `Rng`. Given `(CombatSpec, seed)` it produces a
 * bit-identical `SimResult` on Node and every browser.
 *
 * Fixed resolution order per tick (deterministic, documented, theorycraftable):
 *   1. Doomfall onset (fires OnDoomfall once, at its start tick)
 *   2. Per combatant in order [hero, enemy0, enemy1, …]:
 *        a. due weapon swings, left→right
 *        b. due Every(Xs) effects, in slot order
 *   3. On each 1s boundary: status DoTs/Regen (STATUS_ORDER), then Ward decay
 *   4. On each 1s boundary during Doomfall: true damage to both sides
 *   5. OnHpBelow checks (after all damage), then status-duration decay, then
 *      end-of-fight resolution.
 * Simultaneous triggers within a combatant resolve in slot order (BALANCE §1).
 */

import {
  COOLDOWN_FLOOR_TICKS,
  CRIT_BASE_MULT_PCT,
  DODGE_CAP_PCT,
  DOOMFALL_BASE_PCT_PER_SEC,
  DOOMFALL_RAMP_EVERY_SEC,
  DOOMFALL_RAMP_PCT,
  FIGHT_CAP_TICKS,
  LIFESTEAL_CAP_PCT,
  MIN_HIT_DAMAGE,
  SPEED_CAP_PCT,
  STATUS,
  STATUS_ORDER,
  TICKS_PER_SECOND,
  type StatusKind,
} from './constants.js';
import { RollingHash } from './hash.js';
import { Rng } from './rng.js';
import type {
  CombatSpec,
  CombatantSpec,
  EffectBinding,
  EffectOp,
  EffectTarget,
  SimEvent,
  SimResult,
  WeaponSpec,
} from './types.js';

const EVENT_CODE: Record<SimEvent['type'], number> = {
  fightStart: 1,
  swing: 2,
  hit: 3,
  dodge: 4,
  status: 5,
  dot: 6,
  armor: 7,
  ward: 8,
  heal: 9,
  thorns: 10,
  stun: 11,
  doomfall: 12,
  doomfallTick: 13,
  death: 14,
  fightEnd: 15,
};

function statusCode(kind: StatusKind): number {
  return STATUS_ORDER.indexOf(kind) + 1;
}

interface StatusState {
  stacks: number;
  remaining: number; // ticks
}

interface WeaponRuntime extends WeaponSpec {
  nextSwing: number;
}

interface EffectRuntime {
  binding: EffectBinding;
  hitCounter: number; // for everyNthHit gates
  everyNext: number; // for Every triggers: next fire tick
  hpBelowFired: boolean; // for OnHpBelow (once per fight)
}

interface Combatant {
  spec: CombatantSpec;
  idx: number;
  side: 'hero' | 'enemy';
  hp: number;
  maxHp: number;
  armorBonus: number;
  damageBuffPct: number;
  ward: number;
  statuses: Record<StatusKind, StatusState>;
  weapons: WeaponRuntime[];
  effects: EffectRuntime[];
  alive: boolean;
}

function newStatuses(): Record<StatusKind, StatusState> {
  return {
    bleed: { stacks: 0, remaining: 0 },
    burn: { stacks: 0, remaining: 0 },
    chill: { stacks: 0, remaining: 0 },
    regen: { stacks: 0, remaining: 0 },
    ward: { stacks: 0, remaining: 0 }, // ward magnitude lives on `.ward`; this slot unused
  };
}

class Sim {
  private readonly combatants: Combatant[];
  private readonly hero: Combatant;
  private readonly enemies: Combatant[];
  private readonly rng: Rng;
  private readonly doomfallStart: number;
  private readonly events: SimEvent[] = [];
  private readonly hash = new RollingHash();
  private ended = false;
  private winner: 'hero' | 'enemies' = 'enemies';
  private endTick = 0;

  constructor(spec: CombatSpec, seed: number) {
    this.rng = new Rng(seed);
    this.doomfallStart = spec.doomfallStartTicks;
    this.hero = this.makeCombatant(spec.hero, 0, 'hero');
    this.enemies = spec.enemies.map((e, i) => this.makeCombatant(e, i + 1, 'enemy'));
    this.combatants = [this.hero, ...this.enemies];
  }

  private makeCombatant(spec: CombatantSpec, idx: number, side: 'hero' | 'enemy'): Combatant {
    const c: Combatant = {
      spec,
      idx,
      side,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      armorBonus: 0,
      damageBuffPct: 0,
      ward: 0,
      statuses: newStatuses(),
      weapons: spec.weapons.map((w) => ({ ...w, nextSwing: 0 })),
      effects: spec.effects.map((b) => ({
        binding: b,
        hitCounter: 0,
        everyNext: 0,
        hpBelowFired: false,
      })),
      alive: true,
    };
    return c;
  }

  // ─── stat accessors ────────────────────────────────────────────────────────

  private armorOf(c: Combatant): number {
    return Math.max(0, c.spec.armor + c.armorBonus);
  }

  private speedOf(c: Combatant): number {
    const chill = c.statuses.chill.stacks * STATUS.chill.speedPctPerStack;
    let s = c.spec.speedPct - chill;
    if (s > SPEED_CAP_PCT) s = SPEED_CAP_PCT;
    if (s < -90) s = -90; // keep cooldown denominator sane
    return s;
  }

  private effectiveCd(c: Combatant, w: WeaponRuntime): number {
    const cd = Math.trunc((w.cooldownTicks * 100) / (100 + this.speedOf(c)));
    return Math.max(COOLDOWN_FLOOR_TICKS, cd);
  }

  private wardCap(c: Combatant): number {
    return Math.trunc((c.maxHp * STATUS.ward.capPctOfMaxHp) / 100);
  }

  private focusEnemyFor(c: Combatant): Combatant | undefined {
    const pool = c.side === 'hero' ? this.enemies : [this.hero];
    let best: Combatant | undefined;
    for (const t of pool) {
      if (!t.alive) continue;
      if (!best || t.hp < best.hp) best = t;
    }
    return best;
  }

  // ─── event emission (also folds into the cross-check hash) ──────────────────

  private emit(e: SimEvent): void {
    this.events.push(e);
    this.hash.push(EVENT_CODE[e.type]).push(e.t);
    switch (e.type) {
      case 'swing':
        this.hash.push(e.who).push(e.weapon);
        break;
      case 'hit':
        this.hash.push(e.from).push(e.to).push(e.dmg).push(e.crit).push(e.blocked);
        break;
      case 'dodge':
        this.hash.push(e.from).push(e.to);
        break;
      case 'status':
        this.hash.push(e.to).push(statusCode(e.status)).push(e.stacks);
        break;
      case 'dot':
        this.hash.push(e.to).push(statusCode(e.status)).push(e.dmg);
        break;
      case 'armor':
      case 'ward':
      case 'heal':
        this.hash.push(e.who).push(e.amount);
        break;
      case 'thorns':
        this.hash.push(e.from).push(e.to).push(e.dmg);
        break;
      case 'stun':
        this.hash.push(e.to).push(e.ticks);
        break;
      case 'doomfallTick':
        this.hash.push(e.who).push(e.dmg);
        break;
      case 'death':
        this.hash.push(e.who);
        break;
      case 'fightEnd':
        this.hash.push(e.winner === 'hero' ? 0 : 1);
        break;
      case 'fightStart':
      case 'doomfall':
        break;
    }
  }

  // ─── damage primitives ──────────────────────────────────────────────────────

  /** Ward absorbs first, remainder hits HP. Bypasses Armor (DoTs, spells, thorns). */
  private damageThroughWard(c: Combatant, dmg: number, t: number): number {
    if (dmg <= 0) return 0;
    if (c.ward > 0) {
      const absorbed = Math.min(c.ward, dmg);
      c.ward -= absorbed;
      dmg -= absorbed;
      this.emit({ type: 'ward', t, who: c.idx, amount: c.ward });
    }
    if (dmg > 0) c.hp -= dmg;
    return dmg;
  }

  /** True damage: bypasses Armor and Ward (Doomfall). */
  private trueDamage(c: Combatant, dmg: number): number {
    if (dmg <= 0) return 0;
    c.hp -= dmg;
    return dmg;
  }

  private healUp(c: Combatant, amount: number, t: number): void {
    if (amount <= 0 || !c.alive) return;
    const before = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + amount);
    const gained = c.hp - before;
    if (gained > 0) this.emit({ type: 'heal', t, who: c.idx, amount: gained });
  }

  private addWard(c: Combatant, amount: number, t: number): void {
    if (amount <= 0) return;
    const cap = this.wardCap(c);
    if (c.ward >= cap) return;
    c.ward = Math.min(cap, c.ward + amount);
    this.emit({ type: 'ward', t, who: c.idx, amount: c.ward });
  }

  private applyStatus(c: Combatant, kind: StatusKind, stacks: number, t: number): void {
    if (stacks <= 0 || !c.alive) return;
    if (kind === 'ward') {
      // "ward" as a status op adds Ward magnitude equal to stacks.
      this.addWard(c, stacks, t);
      return;
    }
    const s = c.statuses[kind];
    const def = STATUS[kind];
    s.stacks += stacks;
    if (kind === 'chill' && 'maxStacks' in def) s.stacks = Math.min(s.stacks, def.maxStacks);
    s.remaining = 'durationTicks' in def ? def.durationTicks : s.remaining;
    this.emit({ type: 'status', t, to: c.idx, status: kind, stacks: s.stacks });
  }

  // ─── the weapon hit (the only path that fires hit-triggers) ─────────────────

  private weaponHit(att: Combatant, weaponIdx: number, w: WeaponRuntime, t: number): void {
    const target = this.focusEnemyFor(att);
    if (!target) return;

    // 1. dodge
    const dodge = Math.min(DODGE_CAP_PCT, target.spec.dodgePct);
    if (this.rng.chance(dodge)) {
      this.emit({ type: 'dodge', t, from: att.idx, to: target.idx });
      this.fireTriggers(target, 'OnDodge', t, att);
      return;
    }

    // 2. crit
    const crit = this.rng.chance(att.spec.critChancePct);

    // 3. base × buffs × crit
    let dmg = w.damage;
    if (att.damageBuffPct !== 0) dmg = Math.trunc((dmg * (100 + att.damageBuffPct)) / 100);
    if (crit) dmg = Math.trunc((dmg * (CRIT_BASE_MULT_PCT + att.spec.critDamagePct)) / 100);

    // 4. Armor flat reduction (min 1)
    const armor = this.armorOf(target);
    const afterArmor = Math.max(MIN_HIT_DAMAGE, dmg - armor);
    const blocked = armor > 0 && afterArmor < dmg;

    // 5. Ward, then HP
    const toHp = this.damageThroughWard(target, afterArmor, t);
    this.emit({
      type: 'hit',
      t,
      from: att.idx,
      to: target.idx,
      dmg: toHp,
      crit: crit ? 1 : 0,
      blocked: blocked ? 1 : 0,
    });

    // Lifesteal on HP damage dealt.
    const ls = Math.min(LIFESTEAL_CAP_PCT, att.spec.lifestealPct);
    if (ls > 0 && toHp > 0) this.healUp(att, Math.trunc((toHp * ls) / 100), t);

    // Passive Thorns: attacker takes the target's thorns on landing a hit.
    if (target.alive && target.spec.thorns > 0) {
      const th = target.spec.thorns;
      this.damageThroughWard(att, th, t);
      this.emit({ type: 'thorns', t, from: target.idx, to: att.idx, dmg: th });
      this.checkDeath(att, t);
    }

    // 6. triggers — attacker then defender, each in slot order.
    this.fireTriggers(att, 'OnHit', t, target);
    if (crit) this.fireTriggers(att, 'OnCrit', t, target);
    if (blocked) this.fireTriggers(target, 'OnBlock', t, att);
    this.fireTriggers(target, 'OnHurt', t, att, toHp);

    this.checkDeath(target, t);
    this.checkDeath(att, t);
  }

  // ─── trigger dispatch ───────────────────────────────────────────────────────

  private fireTriggers(
    c: Combatant,
    kind: EffectBinding['trigger']['kind'],
    t: number,
    other?: Combatant,
    incomingDmg?: number,
  ): void {
    if (!c.alive && kind !== 'OnHurt') return;
    for (const eff of c.effects) {
      const b = eff.binding;
      if (b.trigger.kind !== kind) continue;

      if ((kind === 'OnHit' || kind === 'OnCrit') && b.everyNthHit) {
        eff.hitCounter += 1;
        if (eff.hitCounter % b.everyNthHit !== 0) continue;
      }
      if (kind === 'OnHurt' && b.minHitPctMax !== undefined) {
        if (incomingDmg === undefined || incomingDmg * 100 < c.maxHp * b.minHitPctMax) continue;
      }
      if (b.chancePct !== undefined && !this.rng.chance(b.chancePct)) continue;

      this.runOps(c, b, t, other);
    }
  }

  private resolveTarget(
    self: Combatant,
    to: EffectTarget,
    other: Combatant | undefined,
  ): Combatant[] {
    switch (to) {
      case 'self':
        return [self];
      case 'attacker':
        return other && other.alive ? [other] : [];
      case 'target': {
        if (other && other.alive && other.side !== self.side) return [other];
        const f = this.focusEnemyFor(self);
        return f ? [f] : [];
      }
      case 'allEnemies':
        return (self.side === 'hero' ? this.enemies : [this.hero]).filter((e) => e.alive);
    }
  }

  private runOps(self: Combatant, b: EffectBinding, t: number, other: Combatant | undefined): void {
    for (const op of b.ops) this.runOp(self, op, t, other);
  }

  private runOp(self: Combatant, op: EffectOp, t: number, other: Combatant | undefined): void {
    switch (op.op) {
      case 'applyStatus': {
        for (const tgt of this.resolveTarget(self, op.to, other)) {
          this.applyStatus(tgt, op.status, op.stacks, t);
          this.checkDeath(tgt, t);
        }
        return;
      }
      case 'gainArmor':
        self.armorBonus += op.amount;
        this.emit({ type: 'armor', t, who: self.idx, amount: op.amount });
        return;
      case 'gainWard':
        this.addWard(self, op.amount, t);
        return;
      case 'gainWardPctMax':
        this.addWard(self, Math.trunc((self.maxHp * op.pct) / 100), t);
        return;
      case 'heal':
        this.healUp(self, op.amount, t);
        return;
      case 'healPctMax':
        this.healUp(self, Math.trunc((self.maxHp * op.pct) / 100), t);
        return;
      case 'buffDamagePct':
        self.damageBuffPct += op.pct;
        return;
      case 'damageWeaponPct': {
        const base = self.weapons[0]?.damage ?? 0;
        const dmg = Math.trunc((base * op.pct) / 100);
        for (const tgt of this.resolveTarget(self, op.to, other)) {
          const toHp = this.damageThroughWard(tgt, dmg, t);
          this.emit({
            type: 'hit',
            t,
            from: self.idx,
            to: tgt.idx,
            dmg: toHp,
            crit: 0,
            blocked: 0,
          });
          this.checkDeath(tgt, t);
        }
        return;
      }
      case 'retaliateThorns': {
        const dmg = self.spec.thorns * op.mult;
        for (const tgt of this.resolveTarget(self, 'attacker', other)) {
          this.damageThroughWard(tgt, dmg, t);
          this.emit({ type: 'thorns', t, from: self.idx, to: tgt.idx, dmg });
          this.checkDeath(tgt, t);
        }
        return;
      }
      case 'stun': {
        for (const tgt of this.resolveTarget(self, op.to, other)) {
          for (const w of tgt.weapons) w.nextSwing = Math.max(w.nextSwing, t + op.ticks);
          this.emit({ type: 'stun', t, to: tgt.idx, ticks: op.ticks });
        }
        return;
      }
    }
  }

  // ─── death + end conditions ─────────────────────────────────────────────────

  private checkDeath(c: Combatant, t: number): void {
    if (c.alive && c.hp <= 0) {
      c.hp = 0;
      c.alive = false;
      this.emit({ type: 'death', t, who: c.idx });
    }
    if (!this.hero.alive) this.finish('enemies', t);
    else if (this.enemies.every((e) => !e.alive)) this.finish('hero', t);
  }

  private finish(winner: 'hero' | 'enemies', t: number): void {
    if (this.ended) return;
    this.ended = true;
    this.winner = winner;
    this.endTick = t;
  }

  // ─── per-second resolution ──────────────────────────────────────────────────

  private secondBoundary(t: number): void {
    // DoTs & Regen, in STATUS_ORDER, in combatant order.
    for (const c of this.combatants) {
      if (!c.alive) continue;
      for (const kind of STATUS_ORDER) {
        if (kind === 'ward' || kind === 'chill') continue;
        const s = c.statuses[kind];
        if (s.stacks <= 0 || s.remaining <= 0) continue;
        if (kind === 'bleed' || kind === 'burn') {
          const dmg = s.stacks * STATUS[kind].dmgPerSecPerStack;
          this.damageThroughWard(c, dmg, t);
          this.emit({ type: 'dot', t, to: c.idx, status: kind, dmg });
          this.checkDeath(c, t);
        } else if (kind === 'regen') {
          const heal = s.stacks * STATUS.regen.healPerSecPerStack;
          const before = c.hp;
          c.hp = Math.min(c.maxHp, c.hp + heal);
          const gained = c.hp - before;
          if (gained > 0) this.emit({ type: 'dot', t, to: c.idx, status: 'regen', dmg: -gained });
        }
        if (this.ended) return;
      }
      // Ward decay: 5% of remaining per second.
      if (c.ward > 0) {
        const dec = Math.trunc((c.ward * STATUS.ward.decayPctPerSec) / 100);
        if (dec > 0) {
          c.ward -= dec;
          this.emit({ type: 'ward', t, who: c.idx, amount: c.ward });
        }
      }
    }
  }

  private doomfall(t: number): void {
    const secs = Math.trunc((t - this.doomfallStart) / TICKS_PER_SECOND);
    const rate =
      DOOMFALL_BASE_PCT_PER_SEC + Math.trunc(secs / DOOMFALL_RAMP_EVERY_SEC) * DOOMFALL_RAMP_PCT;
    for (const c of this.combatants) {
      if (!c.alive) continue;
      const dmg = Math.trunc((c.maxHp * rate) / 100);
      this.trueDamage(c, dmg);
      this.emit({ type: 'doomfallTick', t, who: c.idx, dmg });
      this.checkDeath(c, t);
      if (this.ended) return;
    }
  }

  private checkHpBelow(t: number): void {
    for (const c of this.combatants) {
      if (!c.alive) continue;
      for (const eff of c.effects) {
        const trig = eff.binding.trigger;
        if (trig.kind !== 'OnHpBelow' || eff.hpBelowFired) continue;
        if (c.hp * 100 <= c.maxHp * trig.pct) {
          eff.hpBelowFired = true;
          if (eff.binding.chancePct !== undefined && !this.rng.chance(eff.binding.chancePct))
            continue;
          this.runOps(c, eff.binding, t, this.focusEnemyFor(c));
        }
      }
    }
  }

  private decayDurations(): void {
    for (const c of this.combatants) {
      for (const kind of STATUS_ORDER) {
        if (kind === 'ward') continue;
        const s = c.statuses[kind];
        if (s.remaining > 0) {
          s.remaining -= 1;
          if (s.remaining <= 0) s.stacks = 0;
        }
      }
    }
  }

  // ─── main loop ───────────────────────────────────────────────────────────────

  run(): SimResult {
    this.emit({ type: 'fightStart', t: 0 });

    // Start-of-fight Ward, then OnFightStart effects (slot order, combatant order).
    for (const c of this.combatants) {
      if (c.spec.startWardPct)
        this.addWard(c, Math.trunc((c.maxHp * c.spec.startWardPct) / 100), 0);
    }
    for (const c of this.combatants) this.fireTriggers(c, 'OnFightStart', 0, this.focusEnemyFor(c));
    // Schedule first swings and first Every fires.
    for (const c of this.combatants) {
      for (const w of c.weapons) w.nextSwing = this.effectiveCd(c, w);
      for (const eff of c.effects) {
        if (eff.binding.trigger.kind === 'Every') {
          eff.everyNext = eff.binding.trigger.seconds * TICKS_PER_SECOND;
        }
      }
    }
    this.checkHpBelow(0);

    for (let t = 1; t <= FIGHT_CAP_TICKS && !this.ended; t++) {
      if (t === this.doomfallStart) {
        this.emit({ type: 'doomfall', t });
        for (const c of this.combatants)
          this.fireTriggers(c, 'OnDoomfall', t, this.focusEnemyFor(c));
      }

      for (const c of this.combatants) {
        if (!c.alive || this.ended) break;
        // (a) weapon swings, left→right
        for (let wi = 0; wi < c.weapons.length && !this.ended; wi++) {
          const w = c.weapons[wi]!;
          if (t >= w.nextSwing) {
            this.emit({ type: 'swing', t, who: c.idx, weapon: wi });
            this.weaponHit(c, wi, w, t);
            if (c.alive) w.nextSwing = t + this.effectiveCd(c, w);
          }
        }
        // (b) Every(Xs) effects, slot order
        for (const eff of c.effects) {
          if (this.ended) break;
          const trig = eff.binding.trigger;
          if (trig.kind !== 'Every') continue;
          if (t >= eff.everyNext) {
            if (eff.binding.chancePct === undefined || this.rng.chance(eff.binding.chancePct)) {
              this.runOps(c, eff.binding, t, this.focusEnemyFor(c));
            }
            eff.everyNext += trig.seconds * TICKS_PER_SECOND;
          }
        }
      }

      if (!this.ended && t % TICKS_PER_SECOND === 0) {
        this.secondBoundary(t);
        if (!this.ended && t >= this.doomfallStart) this.doomfall(t);
      }

      if (!this.ended) this.checkHpBelow(t);
      this.decayDurations();
    }

    if (!this.ended) {
      // Reached the 60s cap without a kill (rare given Doomfall). Decide by HP.
      const enemyHp = this.enemies.reduce((a, e) => a + Math.max(0, e.hp), 0);
      this.finish(this.hero.alive && this.hero.hp >= enemyHp ? 'hero' : 'enemies', FIGHT_CAP_TICKS);
    }

    this.emit({ type: 'fightEnd', t: this.endTick, winner: this.winner });

    return {
      winner: this.winner,
      endTick: this.endTick,
      heroHpRemaining: Math.max(0, this.hero.hp),
      heroMaxHp: this.hero.maxHp,
      enemyHpRemaining: this.enemies.map((e) => Math.max(0, e.hp)),
      logHash: this.hash.digest(),
      events: this.events,
    };
  }
}

/**
 * Run a fight. Pure: same `(spec, seed)` → same result on every platform.
 */
export function simulate(spec: CombatSpec, seed: number): SimResult {
  return new Sim(spec, seed).run();
}
