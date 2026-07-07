/**
 * Materials / infusions (CONTENT.md §3.5). Infusion itself is a Phase 2 system
 * (ROADMAP scopes Phase 1 run to loot/gold/equip/fusion/sell — no infuse), so
 * these are catalogued here as droppable/sellable items; the socket effects that
 * map cleanly to Phase 1 stats are filled in, the rest are authored in Phase 2.
 */

import type { MaterialDef } from './types.js';

export const MATERIALS: MaterialDef[] = [
  {
    id: 'whetstone',
    name: 'Whetstone',
    flavor: 'Sharper is a state of mind, mostly.',
    dropsFrom: 'everywhere',
    // +6% weapon damage — needs the weapon-damage-% infusion path (Phase 2).
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
    id: 'blood_amber',
    name: 'Blood-Amber',
    flavor: 'Something small is still trapped inside, still trying.',
    dropsFrom: 'events',
    mods: [{ stat: 'maxHp', value: 10 }],
  },
];
