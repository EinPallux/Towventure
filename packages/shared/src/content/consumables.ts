/**
 * Consumables (CONTENT.md §3.4). Phase 1 carries these as inventory items with
 * their effect ops authored; the in-combat auto-trigger *conditions* (fight
 * start / HP<40% / Doomfall / vs Elite+) are wired in Phase 2 (ROADMAP). They can
 * still be held, sold, and shown in the backpack now.
 */

import type { ConsumableDef } from './types.js';

export const CONSUMABLES: ConsumableDef[] = [
  {
    id: 'small_ale',
    name: 'Small Ale',
    rarity: 'common',
    flavor: 'Courage, bottled small.',
    ops: [{ op: 'healPctMax', pct: 25 }],
  },
  {
    id: 'leadbelly_draught',
    name: 'Leadbelly Draught',
    rarity: 'uncommon',
    flavor: 'Sits like a shield in your stomach.',
    ops: [{ op: 'gainArmor', amount: 20 }],
  },
  {
    id: 'honey_of_the_gardens',
    name: 'Honey of the Gardens',
    rarity: 'uncommon',
    flavor: 'The bees remember the Tower fondly.',
    ops: [{ op: 'applyStatus', status: 'regen', stacks: 12, to: 'self' }],
  },
  {
    id: 'cinder_phial',
    name: 'Cinder Phial',
    rarity: 'common',
    flavor: 'Break glass in case of everything.',
    ops: [{ op: 'applyStatus', status: 'burn', stacks: 6, to: 'allEnemies' }],
  },
];
