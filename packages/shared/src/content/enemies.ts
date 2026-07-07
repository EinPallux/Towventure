/**
 * Enemies — the Gatehouse roster (floors 1–10) through the Chapel (41–50), each
 * biome's 3 regulars + elite + boss (CONTENT.md §4/§4.1). Base stats are floor-1
 * baselines; run/ scales them by floor and role (BALANCE §4/§6). Past the Gatehouse
 * every enemy checks a build axis. Three anti-autopilot walls are modelled in the
 * sim directly — The Unshelved (crit-immune), Cinder Widow (heals from Burn) and the
 * floor-50 Prior of Teeth (status-density self-heal). Mechanics that need vocabulary
 * the sim/run layers don't have yet (weapon-copy, silence, gold-bribe, death-blast,
 * lifesteal/speed caps, summons) are noted "deferred" in each `check` and land with
 * the deferred-ops wave; the enemy still fights as an honest stat check meanwhile.
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

  // ── The Gardens (floors 11–20) — Venom & Bleed pressure; checks sustain/cleanse ──
  {
    id: 'bramble_shambler',
    name: 'Bramble Shambler',
    role: 'regular',
    baseHp: 30,
    baseDamage: 6,
    cooldownSeconds: 1.7,
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'venom', stacks: 1, to: 'target' }] },
    ],
    check: 'Venom pressure — cleanse or out-sustain the ramp',
    flavor: 'It grew around a climber who stopped to rest. Do not rest.',
  },
  {
    id: 'pollen_drone',
    name: 'Pollen Drone',
    role: 'regular',
    baseHp: 12,
    baseDamage: 4,
    cooldownSeconds: 1.0,
    check: 'swarm — rewards AoE and fast weapons',
    flavor: 'One is nothing. The Gardens never send one.',
  },
  {
    id: 'bloodthorn_creeper',
    name: 'Bloodthorn Creeper',
    role: 'regular',
    baseHp: 26,
    baseDamage: 6,
    cooldownSeconds: 1.6,
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'bleed', stacks: 1, to: 'target' }] },
    ],
    check: 'Bleed pressure — the Garden opens what it touches',
    flavor: 'Every thorn remembers a different name for you.',
  },
  {
    id: 'rustling_mimic',
    name: 'Rustling Mimic',
    role: 'elite',
    baseHp: 50,
    baseDamage: 10,
    cooldownSeconds: 1.4,
    check: 'burst — kill it fast (its gold-bribe economy is deferred)',
    flavor: 'It wears the shape of the chest you hoped for.',
  },
  {
    id: 'root_queen_marrow',
    name: 'Root-Queen Marrow',
    role: 'boss',
    baseHp: 72,
    baseDamage: 12,
    cooldownSeconds: 1.9,
    armor: 2,
    // Venom ramps on you throughout (CONTENT §4.1) but at a beatable cadence — a
    // geared build races her down before it snowballs. The 66%/33% Shambler summons
    // need mid-fight spawns the sim doesn't model yet — deferred.
    effects: [
      {
        trigger: { kind: 'Every', seconds: 5 },
        ops: [{ op: 'applyStatus', status: 'venom', stacks: 1, to: 'target' }],
      },
    ],
    check: 'sustain vs a rising Venom tide (summons deferred)',
    flavor: 'She was the first thing to take root, and she resents the walls.',
  },

  // ── The Archive (floors 21–30) — honest-damage & effect-redundancy checks ──
  {
    id: 'inkbound_folio',
    name: 'Inkbound Folio',
    role: 'regular',
    baseHp: 38,
    baseDamage: 8,
    cooldownSeconds: 1.5,
    check: 'weapon parity — it copies your fastest weapon (copy deferred)',
    flavor: 'It has read every climber. It is bored of the ending.',
  },
  {
    id: 'redaction_wisp',
    name: 'Redaction Wisp',
    role: 'regular',
    baseHp: 32,
    baseDamage: 7,
    cooldownSeconds: 1.4,
    dodgePct: 10,
    check: 'effect redundancy — it silences a trinket (silence deferred)',
    flavor: 'It edits you mid-sentence. You forget which blade was yours.',
  },
  {
    id: 'marginalia_wisp',
    name: 'Marginalia Wisp',
    role: 'regular',
    baseHp: 30,
    baseDamage: 6,
    cooldownSeconds: 1.4,
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'weaken', stacks: 1, to: 'target' }] },
    ],
    check: 'Weaken pressure — its notes sap your blows',
    flavor: 'A cramped hand in the margin, correcting your every swing.',
  },
  {
    id: 'the_unshelved',
    name: 'The Unshelved',
    role: 'elite',
    baseHp: 58,
    baseDamage: 11,
    cooldownSeconds: 1.5,
    armor: 3,
    critImmune: true,
    check: 'honest damage — immune to crits; Shock cannot pierce it',
    flavor: 'Filed under nothing. Cited by no one. It does not flinch.',
  },
  {
    id: 'the_unread',
    name: 'The Unread',
    role: 'boss',
    baseHp: 82,
    baseDamage: 14,
    cooldownSeconds: 1.8,
    armor: 3,
    // The 8s "rewrite" (swap which weapon is on cooldown) needs a cooldown-swap op;
    // deferred. A brief stagger stands in for the disruption meanwhile.
    effects: [
      { trigger: { kind: 'Every', seconds: 8 }, ops: [{ op: 'stun', ticks: 4, to: 'target' }] },
    ],
    check: 'weapon parity — a stagger stands in for the deferred rewrite',
    flavor: 'The one book no one finished. It is finishing you.',
  },

  // ── The Foundry (floors 31–40) — the Sunder tutorial and the Ember wall ──
  {
    id: 'slagling',
    name: 'Slagling',
    role: 'regular',
    baseHp: 22,
    baseDamage: 8,
    cooldownSeconds: 1.2,
    check: 'dodge/armor the blast — for now a brittle rusher (death-blast deferred)',
    flavor: 'Poured, cooled wrong, and furious about it.',
  },
  {
    id: 'vow_forged_sentinel',
    name: 'Vow-Forged Sentinel',
    role: 'regular',
    baseHp: 46,
    baseDamage: 9,
    cooldownSeconds: 1.7,
    armor: 6,
    // Hardens as the fight drags — out-damage it before it turtles.
    effects: [
      { trigger: { kind: 'Every', seconds: 3 }, ops: [{ op: 'gainArmor', amount: 1 }] },
    ],
    check: 'armor race — punishes the slow, turtling mirror',
    flavor: 'It swore the same vow you did. It kept the letter, not the point.',
  },
  {
    id: 'slag_imp',
    name: 'Slag Imp',
    role: 'regular',
    baseHp: 34,
    baseDamage: 8,
    cooldownSeconds: 1.4,
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'burn', stacks: 1, to: 'target' }] },
    ],
    check: 'Burn pressure — and mind what else in here feeds on it',
    flavor: 'A cinder that learned to hold a grudge and a grin.',
  },
  {
    id: 'cinder_widow',
    name: 'Cinder Widow',
    role: 'elite',
    baseHp: 64,
    baseDamage: 11,
    cooldownSeconds: 1.5,
    healsFromStatus: 'burn',
    check: 'anti-Ember wall — Burn HEALS her; bring another axis',
    flavor: 'She married the forge. She kept the fire in the settlement.',
  },
  {
    id: 'forgetide_colossus',
    name: 'Forgetide Colossus',
    role: 'boss',
    baseHp: 88,
    baseDamage: 15,
    cooldownSeconds: 2.0,
    armor: 24,
    // Sunder already melts Armor 3/stack (min −15). The doc's 10/stack shed + the
    // 0-Armor stagger window are the stronger, deferred version.
    check: 'Sunder it down — Armor melts 3/stack (full shed + stagger deferred)',
    flavor: 'Every climber it stopped is somewhere in the casting.',
  },

  // ── The Chapel (floors 41–50) — sustain/priority checks and the mid-game wall ──
  {
    id: 'chained_penitent',
    name: 'Chained Penitent',
    role: 'regular',
    baseHp: 44,
    baseDamage: 9,
    cooldownSeconds: 1.6,
    check: 'sustain — it halves your Lifesteal aura (aura deferred)',
    flavor: 'It confesses to crimes the Tower has not invented yet.',
  },
  {
    id: 'bell_starved_acolyte',
    name: 'Bell-Starved Acolyte',
    role: 'regular',
    baseHp: 34,
    baseDamage: 7,
    cooldownSeconds: 1.4,
    check: 'priority target — a ringer buffs the rest (the bell is deferred)',
    flavor: 'It rings for a Bell that stopped answering long ago.',
  },
  {
    id: 'ash_chorister',
    name: 'Ash Chorister',
    role: 'regular',
    baseHp: 40,
    baseDamage: 8,
    cooldownSeconds: 1.5,
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'chill', stacks: 1, to: 'target' }] },
    ],
    check: 'Chill pressure — its hymn drags you toward Doomfall',
    flavor: 'The choir sings the cold in. You are the warm part.',
  },
  {
    id: 'warden_of_chains',
    name: 'Warden of Chains',
    role: 'elite',
    baseHp: 70,
    baseDamage: 12,
    cooldownSeconds: 1.6,
    armor: 6,
    check: 'big hits — it caps your Speed at +25% (the cap is deferred)',
    flavor: 'Its keys open nothing. Its chains close everything.',
  },
  {
    id: 'prior_of_teeth',
    name: 'Prior of Teeth',
    role: 'boss',
    baseHp: 92,
    baseDamage: 16,
    cooldownSeconds: 1.9,
    armor: 5,
    // The floor-50 mid-game wall (CONTENT §4.1): 3% max-HP self-heal every second,
    // HALVED once 10+ total status stacks sit on him. A status-density check.
    selfHealPctPerSec: 3,
    healHalvedAtStacks: 10,
    check: 'status density — heals 3%/s, halved at 10+ statuses on him',
    flavor: 'He smiles the whole climb wide. Every tooth was someone.',
  },
];
