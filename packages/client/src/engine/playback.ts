/**
 * Fight playback — the client re-simulates the fight from the server's seed (never
 * shipped an event log; ARCHITECTURE §3) and replays it as a cinematic. A clock
 * steps sim ticks (100ms each, scaled by `speed`); listeners drive HP bars, mesh
 * animations, and floating damage numbers. `skip` fast-forwards to the killcam.
 */

import { simulate, type CombatSpec, type SimEvent } from '@towventure/shared/sim';

export type DamageKind = 'hit' | 'crit' | 'heal' | 'dot';

export interface PlaybackListeners {
  onHp?: (idx: number, hp: number, maxHp: number) => void;
  onSwing?: (idx: number) => void;
  onHit?: (from: number, to: number, crit: boolean) => void;
  onDamageNumber?: (idx: number, text: string, kind: DamageKind) => void;
  onStatus?: (idx: number, status: string, stacks: number) => void;
  onDeath?: (idx: number) => void;
  onDoomfall?: () => void;
  onEnd?: (winner: 'hero' | 'enemies') => void;
}

export class Playback {
  readonly maxHp: number[];
  readonly hp: number[];
  readonly winner: 'hero' | 'enemies';
  readonly endTick: number;
  readonly logHash: number;
  speed = 1;

  private readonly events: SimEvent[];
  private readonly listeners: PlaybackListeners;
  private ptr = 0;
  private tick = 0;
  private acc = 0;
  private ended = false;

  constructor(spec: CombatSpec, seed: number, listeners: PlaybackListeners) {
    const r = simulate(spec, seed);
    this.events = r.events;
    this.winner = r.winner;
    this.endTick = r.endTick;
    this.logHash = r.logHash;
    this.maxHp = [spec.hero.maxHp, ...spec.enemies.map((e) => e.maxHp)];
    this.hp = [...this.maxHp];
    this.listeners = listeners;
  }

  get currentTick(): number {
    return this.tick;
  }
  get isDone(): boolean {
    return this.ended;
  }

  /** Advance by real elapsed milliseconds (scaled by speed). */
  update(dtMs: number): void {
    if (this.ended) return;
    this.acc += dtMs * this.speed;
    while (this.acc >= 100 && !this.ended) {
      this.acc -= 100;
      this.tick += 1;
      this.processUpTo(this.tick);
    }
  }

  /** Fast-forward to the end (respecting reads — jumps straight to the result). */
  skip(): void {
    while (this.ptr < this.events.length) this.apply(this.events[this.ptr++]!);
    this.finish();
  }

  private processUpTo(tick: number): void {
    while (this.ptr < this.events.length && this.events[this.ptr]!.t <= tick) {
      this.apply(this.events[this.ptr]!);
      this.ptr += 1;
    }
    if (this.ptr >= this.events.length) this.finish();
  }

  private setHp(idx: number, hp: number): void {
    this.hp[idx] = Math.max(0, hp);
    this.listeners.onHp?.(idx, this.hp[idx]!, this.maxHp[idx]!);
  }

  private apply(e: SimEvent): void {
    switch (e.type) {
      case 'swing':
        this.listeners.onSwing?.(e.who);
        break;
      case 'hit':
        this.setHp(e.to, (this.hp[e.to] ?? 0) - e.dmg);
        this.listeners.onHit?.(e.from, e.to, e.crit === 1);
        if (e.dmg > 0)
          this.listeners.onDamageNumber?.(e.to, String(e.dmg), e.crit === 1 ? 'crit' : 'hit');
        break;
      case 'dot':
        if (e.dmg > 0) {
          this.setHp(e.to, (this.hp[e.to] ?? 0) - e.dmg);
          this.listeners.onDamageNumber?.(e.to, String(e.dmg), 'dot');
        } else if (e.dmg < 0) {
          this.setHp(e.to, (this.hp[e.to] ?? 0) - e.dmg);
          this.listeners.onDamageNumber?.(e.to, String(-e.dmg), 'heal');
        }
        break;
      case 'thorns':
        this.setHp(e.to, (this.hp[e.to] ?? 0) - e.dmg);
        this.listeners.onDamageNumber?.(e.to, String(e.dmg), 'dot');
        break;
      case 'doomfallTick':
        this.setHp(e.who, (this.hp[e.who] ?? 0) - e.dmg);
        this.listeners.onDamageNumber?.(e.who, String(e.dmg), 'dot');
        break;
      case 'heal':
        this.setHp(e.who, (this.hp[e.who] ?? 0) + e.amount);
        this.listeners.onDamageNumber?.(e.who, String(e.amount), 'heal');
        break;
      case 'status':
        this.listeners.onStatus?.(e.to, e.status, e.stacks);
        break;
      case 'death':
        this.setHp(e.who, 0);
        this.listeners.onDeath?.(e.who);
        break;
      case 'doomfall':
        this.listeners.onDoomfall?.();
        break;
      case 'fightStart':
      case 'fightEnd':
      case 'dodge':
      case 'armor':
      case 'ward':
      case 'stun':
        break;
    }
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.listeners.onEnd?.(this.winner);
  }
}
