/**
 * Materials / infusions (CONTENT.md §3.5, GDD §4.2). Materials socket permanent
 * substats or micro-effects onto gear; run/inventory `infuse` sockets them and
 * run/build compiles a socketed item's material mods/effects into the hero. Sockets
 * per item = socketsFor(rarity): Common 0 · Uncommon 1 · Rare 2 · Epic/Mythic 3.
 * Grave-Salt (Echo/Skirmish only) and Quickquill (Every-interval modifier op) await
 * their systems and are authored later.
 */

import type { MaterialDef } from './types.js';

export const MATERIALS: MaterialDef[] = [
  {
    id: 'whetstone',
    name: 'Whetstone',
    flavor: 'Sharper is a state of mind, mostly.',
    dropsFrom: 'everywhere',
    // +6% weapon damage, modelled as a fight-scoped damage buff (weapon swings only).
    effect: {
      trigger: { kind: 'OnFightStart' },
      ops: [{ op: 'buffDamagePct', pct: 6 }],
      scales: false,
    },
  },
  {
    id: 'emberdust',
    name: 'Emberdust',
    flavor: 'Warm to the touch, warmer to the enemy.',
    dropsFrom: 'Ember biomes, elites',
    effect: {
      trigger: { kind: 'OnHit' },
      chancePct: 15,
      ops: [{ op: 'applyStatus', status: 'burn', stacks: 1, to: 'target' }],
    },
  },
  {
    id: 'frostmote',
    name: 'Frostmote',
    flavor: 'A single flake that never lands.',
    dropsFrom: 'Frost biomes',
    effect: {
      trigger: { kind: 'OnHit' },
      chancePct: 12,
      ops: [{ op: 'applyStatus', status: 'chill', stacks: 1, to: 'target' }],
    },
  },
  {
    id: 'leadweave',
    name: 'Leadweave',
    flavor: 'Heavier than it looks, on purpose.',
    dropsFrom: 'Bulwark elites',
    mods: [
      { stat: 'armor', value: 8 },
      { stat: 'speedPct', value: -3 },
    ],
  },
  {
    id: 'hollowfang',
    name: 'Hollowfang',
    flavor: 'It remembers being a tooth. It misses it.',
    dropsFrom: 'Wild enemies',
    mods: [{ stat: 'lifestealPct', value: 4 }],
  },
  {
    id: 'glimmergrit',
    name: 'Glimmergrit',
    flavor: 'Grit that catches the lantern and keeps a little.',
    dropsFrom: 'shops only',
    mods: [{ stat: 'critChancePct', value: 5 }],
  },
  {
    id: 'blood_amber',
    name: 'Blood-Amber',
    flavor: 'Something small is still trapped inside, still trying.',
    dropsFrom: 'events',
    mods: [{ stat: 'maxHp', value: 10 }],
  },
];
