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

  // ── The Menagerie (floors 51–60) — evasion, threshold-burst, and the collector ──
  {
    id: 'gloom_panther',
    name: 'Gloom Panther',
    role: 'regular',
    baseHp: 44,
    baseDamage: 10,
    cooldownSeconds: 1.2,
    dodgePct: 30,
    check: 'evasion — high Dodge; bring Shock or sure-hits',
    flavor: 'You will see it once. That once will be enough for it.',
  },
  {
    id: 'hollow_bear',
    name: 'Hollow Bear',
    role: 'regular',
    baseHp: 56,
    baseDamage: 9,
    cooldownSeconds: 1.8,
    // Enrages once wounded — burst it past the threshold or eat the rage.
    effects: [
      { trigger: { kind: 'OnHpBelow', pct: 50 }, ops: [{ op: 'buffDamagePct', pct: 45 }] },
    ],
    check: 'burst past the threshold — it enrages below 50% HP',
    flavor: 'They took the inside of it for a coat. It kept the wanting.',
  },
  {
    id: 'vitrine_adder',
    name: 'Vitrine Adder',
    role: 'regular',
    baseHp: 40,
    baseDamage: 9,
    cooldownSeconds: 1.3,
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'venom', stacks: 1, to: 'target' }] },
    ],
    check: 'Venom pressure — glass between you and its patience, and it broke',
    flavor: 'Labelled, dated, and never once asked whether it agreed.',
  },
  {
    id: 'collectors_favorite',
    name: "The Collector's Favorite",
    role: 'elite',
    baseHp: 74,
    baseDamage: 13,
    cooldownSeconds: 1.4,
    armor: 4,
    dodgePct: 8,
    check: 'a bit of everything — it wears a stolen build (Codex-item loadout deferred)',
    flavor: 'Someone loved it best. Now it is behind glass, loving no one.',
  },
  {
    id: 'the_collector',
    name: 'The Collector',
    role: 'boss',
    baseHp: 98,
    baseDamage: 17,
    cooldownSeconds: 1.8,
    armor: 6,
    // Opens with 3 Codex items equipped and, on defeat, offers one back — both need the
    // Codex-item pool wired into combat; deferred. A tanky, well-rounded stat check meanwhile.
    check: 'well-rounded wall — 3 stolen builds + the loot-offer are deferred',
    flavor: 'It does not fight to win. It fights to add you to the shelf.',
  },

  // ── The Vault (floors 61–70) — Chill drown, anti-Ward pressure, the armored deadbolt ──
  {
    id: 'drowned_bailiff',
    name: 'Drowned Bailiff',
    role: 'regular',
    baseHp: 48,
    baseDamage: 9,
    cooldownSeconds: 1.5,
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'chill', stacks: 1, to: 'target' }] },
    ],
    check: 'Chill drown — it stacks you slow, toward Doomfall',
    flavor: 'Still holding the writ. Still expecting you to sign.',
  },
  {
    id: 'pressure_wraith',
    name: 'Pressure Wraith',
    role: 'regular',
    baseHp: 42,
    baseDamage: 12,
    cooldownSeconds: 1.6,
    // One blow lands as five rapid sub-hits — Ward and one-shot buffers leak against it.
    hitsPerSwing: 5,
    check: 'anti-Ward — its hit is five fast ticks, not one',
    flavor: 'The depth remembers every climber it pressed flat.',
  },
  {
    id: 'deadbolt_sentinel',
    name: 'Deadbolt Sentinel',
    role: 'regular',
    baseHp: 54,
    baseDamage: 8,
    cooldownSeconds: 1.9,
    armor: 12,
    check: 'armor — a slab of a lock; Sunder or big hits',
    flavor: 'It guards a door that was never built. It does not know.',
  },
  {
    id: 'the_escrow',
    name: 'The Escrow',
    role: 'elite',
    baseHp: 80,
    baseDamage: 12,
    cooldownSeconds: 1.6,
    armor: 5,
    // Banks 30% of damage dealt to it and returns it as one hit at 50% — a Ward/Armor
    // timing check that needs a damage-banking mechanic; deferred. A sturdy elite for now.
    check: 'Ward/Armor timing — the banked-return burst is deferred',
    flavor: 'It holds what you give it. It always intends to return it.',
  },
  {
    id: 'bailiff_of_the_deep',
    name: 'Bailiff of the Deep',
    role: 'boss',
    baseHp: 102,
    baseDamage: 18,
    cooldownSeconds: 1.8,
    armor: 5,
    // The room floods: +1 Chill to you every 4s. The doc's crit-cleanse valve needs a
    // trigger that only the run layer can read; deferred. The flood itself is honest.
    effects: [
      { trigger: { kind: 'Every', seconds: 4 }, ops: [{ op: 'applyStatus', status: 'chill', stacks: 1, to: 'target' }] },
    ],
    check: 'the room floods — Chill every 4s (crit-cleanse valve deferred)',
    flavor: 'It reads the depth its charges drowned in, aloud, forever.',
  },

  // ── The Gallery of Mirrors (floors 71–80) — mirror matches; the build report card ──
  {
    id: 'mirrorkin',
    name: 'Mirrorkin',
    role: 'regular',
    baseHp: 50,
    baseDamage: 11,
    cooldownSeconds: 1.4,
    dodgePct: 6,
    // "It is you at 85%." A true mirror needs the hero's live build as the enemy
    // (a run/Echo concern); deferred. A balanced humanoid stat check stands in.
    check: 'mirror — a balanced fighter (true build-copy deferred)',
    flavor: 'It fights the way you do. It has your bad habit, too.',
  },
  {
    id: 'frame_ghoul',
    name: 'Frame Ghoul',
    role: 'regular',
    baseHp: 46,
    baseDamage: 10,
    cooldownSeconds: 1.5,
    // Reflects the first status you apply each 5s — a status-reflect the sim can't do yet;
    // deferred. It hardens a little when hurt instead, standing in for the recoil.
    effects: [
      { trigger: { kind: 'OnHurt' }, ops: [{ op: 'gainWard', amount: 3 }], chancePct: 30 },
    ],
    check: 'status-reflect (deferred) — it recoils Ward when struck',
    flavor: 'It lives in the gilt edge, wearing the last face that passed.',
  },
  {
    id: 'salon_shade',
    name: 'Salon Shade',
    role: 'regular',
    baseHp: 44,
    baseDamage: 9,
    cooldownSeconds: 1.4,
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'weaken', stacks: 1, to: 'target' }] },
    ],
    check: 'Weaken pressure — a portrait that critiques your form',
    flavor: 'It remembers being admired. It resents being merely seen.',
  },
  {
    id: 'the_understudy',
    name: 'The Understudy',
    role: 'elite',
    baseHp: 82,
    baseDamage: 14,
    cooldownSeconds: 1.4,
    armor: 3,
    dodgePct: 6,
    // Your PREVIOUS run's final build at 90% — memento mori. Needs last-run persistence
    // wired into combat; deferred. A strong humanoid elite stands in.
    check: 'memento mori — your last build at 90% is deferred',
    flavor: 'It learned your part by watching you die of it.',
  },
  {
    id: 'the_curator',
    name: 'The Curator',
    role: 'boss',
    baseHp: 116,
    baseDamage: 18,
    cooldownSeconds: 1.7,
    armor: 5,
    dodgePct: 5,
    // The mirror match: your exact build at 100% +15% Max HP. A true self-fight is a
    // run/Echo concern; deferred. Its baseHp already carries the +15% as a stat check.
    check: 'the build report card — the true mirror match is deferred',
    flavor: 'It curates one exhibit. The exhibit is the shape of your mistakes.',
  },

  // ── The Court (floors 81–90) — Burn-immune elegance, cadence duels, ceremony speed ──
  {
    id: 'ember_courtier',
    name: 'Ember Courtier',
    role: 'regular',
    baseHp: 52,
    baseDamage: 11,
    cooldownSeconds: 1.4,
    immuneToStatus: 'burn',
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'weaken', stacks: 1, to: 'target' }] },
    ],
    check: 'anti-Ember — Burn will not touch it; it Weakens you elegantly',
    flavor: 'It holds a candle it does not fear. It fears being unlit.',
  },
  {
    id: 'duel_bond_twins',
    name: 'Duel-Bond Twins',
    role: 'regular',
    baseHp: 58,
    baseDamage: 12,
    cooldownSeconds: 1.5,
    armor: 3,
    // They share HP and alternate a guard (the struck one takes 50% less) — a two-body
    // linkage the sim models as one enemy today; the cadence-guard is deferred.
    check: 'cadence — the shared-HP alternating guard is deferred',
    flavor: 'One bleeds when the other is cut. Neither will say which is which.',
  },
  {
    id: 'court_duelist',
    name: 'Court Duelist',
    role: 'regular',
    baseHp: 46,
    baseDamage: 10,
    cooldownSeconds: 1.1,
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'bleed', stacks: 1, to: 'target' }] },
    ],
    check: 'tempo + Bleed — fast, and it opens you politely',
    flavor: 'Every scar it gives you comes with a small, correct bow.',
  },
  {
    id: 'master_of_ceremonies',
    name: 'The Master of Ceremonies',
    role: 'elite',
    baseHp: 78,
    baseDamage: 13,
    cooldownSeconds: 1.05,
    // "The fight runs at 1.25× for both sides" needs a global sim-speed knob; deferred.
    // A very fast elite stands in for the quickened tempo.
    check: 'tempo — it fights fast (the 1.25× global speed is deferred)',
    flavor: 'It calls each of your blows before you throw it. It is never late.',
  },
  {
    id: 'princess_of_cinders',
    name: 'Princess of Cinders',
    role: 'boss',
    baseHp: 108,
    baseDamage: 19,
    cooldownSeconds: 1.7,
    // Phase one: pure Burn aggression. At 50% she snuffs all Burn (yours too) and turns
    // to Frost — a phase flip the sim can't do yet; deferred. The Burn phase is live.
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'burn', stacks: 2, to: 'target' }] },
    ],
    check: 'dual-axis — Burn now; the 50% snuff-to-Frost phase is deferred',
    flavor: 'She was crowned in a fire she started to stay warm.',
  },

  // ── The Crown (floors 91–100) — burst windows, the growing dream, the Warden ──
  {
    id: 'somnambulist',
    name: 'Somnambulist',
    role: 'regular',
    baseHp: 50,
    baseDamage: 13,
    cooldownSeconds: 1.3,
    // Sleeps 3s (invulnerable) after every 6s awake — a periodic-invuln window the sim
    // lacks; deferred. It hits hard while awake meanwhile.
    check: 'burst windows — the sleep-invuln cycle is deferred',
    flavor: 'It walks the Crown at night, asleep, and will not be woken kindly.',
  },
  {
    id: 'dream_larva',
    name: 'Dream Larva',
    role: 'regular',
    baseHp: 40,
    baseDamage: 7,
    cooldownSeconds: 1.4,
    // Grows through the fight — a race check. HP growth is deferred; its damage climbs.
    effects: [
      { trigger: { kind: 'Every', seconds: 2 }, ops: [{ op: 'buffDamagePct', pct: 5 }] },
    ],
    check: 'race — its damage grows every 2s (HP growth deferred)',
    flavor: 'It dreams of what it will become. The dream is getting closer.',
  },
  {
    id: 'crown_sleeper',
    name: 'Crown Sleeper',
    role: 'regular',
    baseHp: 52,
    baseDamage: 10,
    cooldownSeconds: 1.5,
    effects: [
      { trigger: { kind: 'OnHit' }, ops: [{ op: 'applyStatus', status: 'chill', stacks: 1, to: 'target' }] },
    ],
    check: 'Chill — the dream is cold, and it is spreading',
    flavor: 'It slept through its own coronation. It sleeps through yours.',
  },
  {
    id: 'the_apology',
    name: 'The Apology',
    role: 'elite',
    baseHp: 86,
    baseDamage: 15,
    cooldownSeconds: 1.5,
    armor: 4,
    // Copies your Relic — a run-level loadout theft; deferred. A hard elite stands in.
    check: 'the Relic-copy is deferred — a hard, honest elite for now',
    flavor: 'It is sorry. It has always been sorry. It will be sorry over you.',
  },
  {
    id: 'the_sleepless_warden',
    name: 'The Sleepless Warden',
    role: 'boss',
    baseHp: 130,
    baseDamage: 21,
    cooldownSeconds: 1.7,
    armor: 8,
    // The floor-100 wall: three phases replaying Toll + rewrite + flood, and permanent
    // Doomfall from 25% — multi-phase scripting the sim can't do yet; deferred. It fights
    // as the hardest single boss in the tower, with the Toll stun and a rising pressure.
    effects: [
      { trigger: { kind: 'Every', seconds: 6 }, ops: [{ op: 'stun', ticks: 5, to: 'target' }] },
      { trigger: { kind: 'Every', seconds: 8 }, ops: [{ op: 'applyStatus', status: 'chill', stacks: 2, to: 'target' }] },
    ],
    check: 'the last wall — Toll + flood now; three-phase Doomfall script deferred',
    flavor: 'It has not slept since the first climber. It will not sleep after you.',
  },
];
