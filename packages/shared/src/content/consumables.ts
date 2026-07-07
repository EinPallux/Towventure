/**
 * Consumables (CONTENT.md §3.4) — auto-trigger one-shots. Each carries its effect
 * ops and a default firing condition; the player can retarget it (setConsumableCondition
 * command). run/build compiles the held, eligible ones into the hero's fight spec as
 * one-shot effect bindings, and resolveFight consumes the ones that fired. They are
 * still held/sold/shown in the backpack like any inventory item.
 */

import type { ConsumableDef } from './types.js';

export const CONSUMABLES: ConsumableDef[] = [
  {
    id: 'small_ale',
    name: 'Small Ale',
    rarity: 'common',
    flavor: 'Courage, bottled small.',
    ops: [{ op: 'healPctMax', pct: 25 }],
    defaultCondition: 'hpBelow40', // an emergency heal
  },
  {
    id: 'leadbelly_draught',
    name: 'Leadbelly Draught',
    rarity: 'uncommon',
    flavor: 'Sits like a shield in your stomach.',
    ops: [{ op: 'gainArmor', amount: 20 }],
    defaultCondition: 'vsElite', // save the wall for the hard fights
  },
  {
    id: 'honey_of_the_gardens',
    name: 'Honey of the Gardens',
    rarity: 'uncommon',
    flavor: 'The bees remember the Tower fondly.',
    ops: [{ op: 'applyStatus', status: 'regen', stacks: 12, to: 'self' }],
    defaultCondition: 'hpBelow70', // sustain once you start taking hits
  },
  {
    id: 'cinder_phial',
    name: 'Cinder Phial',
    rarity: 'common',
    flavor: 'Break glass in case of everything.',
    ops: [{ op: 'applyStatus', status: 'burn', stacks: 6, to: 'allEnemies' }],
    defaultCondition: 'fightStart', // open with AoE Burn
  },
  {
    id: 'adrenal_vial',
    name: 'Adrenal Vial',
    rarity: 'uncommon',
    flavor: 'The Tower feels closer, suddenly. Faster.',
    // +25% Speed 6s ≈ 5 Haste stacks (the timed +Speed status).
    ops: [{ op: 'applyStatus', status: 'haste', stacks: 5, to: 'self' }],
    defaultCondition: 'fightStart', // the opener burst
  },
];
