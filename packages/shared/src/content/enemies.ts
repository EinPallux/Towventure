/**
 * Enemies — the Gatehouse roster (floors 1–10) plus the Toll-Keeper boss
 * (CONTENT.md §4). Base stats are floor-1 baselines; run/ scales them by floor
 * and role (BALANCE §6). Gatehouse regulars are teaching dummies with visible
 * telegraphs — no build checks until later biomes.
 */

import type { EnemyDef } from './types.js';

export const ENEMIES: EnemyDef[] = [
  {
    id: 'tunnel_rat',
    name: 'Tunnel Rat',
    role: 'regular',
    baseHp: 18,
    baseDamage: 4,
    cooldownSeconds: 1.4,
    check: 'none — a teaching dummy',
    flavor: 'It was here before the Tower. It will outlast the Tower.',
  },
  {
    id: 'gate_bandit',
    name: 'Gate Bandit',
    role: 'regular',
    baseHp: 26,
    baseDamage: 6,
    cooldownSeconds: 1.8,
    check: 'none — a teaching dummy',
    flavor: 'Charges a toll he did not set on a gate he does not own.',
  },
  {
    id: 'toll_shirker',
    name: 'Toll Shirker',
    role: 'regular',
    baseHp: 22,
    baseDamage: 5,
    cooldownSeconds: 1.6,
    dodgePct: 8,
    check: 'none — a teaching dummy',
    flavor: 'Owes the Bell more than he owes his own name.',
  },
  {
    id: 'two_coin_ferryman',
    name: 'Two-Coin Ferryman',
    role: 'elite',
    baseHp: 40,
    baseDamage: 8,
    cooldownSeconds: 1.5,
    check: 'burst — kill fast or bleed gold',
    flavor: 'One coin for the crossing. One coin for the silence after.',
  },
  {
    id: 'toll_keeper',
    name: 'The Toll-Keeper',
    role: 'boss',
    baseHp: 60,
    baseDamage: 10,
    cooldownSeconds: 2.0,
    armor: 4,
    // Every 6s: Toll — stun the hero 0.5s. (The "unless 15 hits landed" reprieve
    // and the buff-strip land with the full effect system in Phase 2.)
    effects: [
      { trigger: { kind: 'Every', seconds: 6 }, ops: [{ op: 'stun', ticks: 5, to: 'target' }] },
    ],
    check: 'attack cadence — keep swinging through the Toll',
    flavor: 'Everyone pays. The Bell keeps the change.',
  },
];
