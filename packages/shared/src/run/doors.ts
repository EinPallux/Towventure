/**
 * Door generation (GDD §3.2). Boss every 10th floor (single door), Shop every 5th
 * (the floor is the shop, no doors), otherwise 2–3 Battle/Elite choices. Echo and
 * Event doors arrive in later phases (ROADMAP scopes Phase 1 to Battle/Elite/
 * Shop/Boss). All draws are seeded so the client can't peek at undrawn floors.
 */

import { biomeForFloor, getEnemy } from '../content/registry.js';
import { RNG_PURPOSE, deriveRng } from './rng.js';
import type { DoorOffer } from './types.js';

export function isBossFloor(floor: number): boolean {
  return floor % 10 === 0;
}

export function isShopFloor(floor: number): boolean {
  return floor % 5 === 0 && floor % 10 !== 0;
}

function battlePreview(enemyIds: string[]): string {
  const counts = new Map<string, number>();
  for (const id of enemyIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const parts: string[] = [];
  for (const [id, n] of counts)
    parts.push(n > 1 ? `${getEnemy(id).name} ×${n}` : getEnemy(id).name);
  return parts.join(', ');
}

/** The doors offered on a floor. Boss floors return a single boss door; shop floors return []. */
export function generateDoors(seed: number, floor: number): DoorOffer[] {
  const biome = biomeForFloor(floor);
  if (isBossFloor(floor)) {
    const boss = getEnemy(biome.bossId);
    return [{ kind: 'boss', enemyIds: [biome.bossId], preview: boss.name }];
  }
  if (isShopFloor(floor)) return [];

  const rng = deriveRng(seed, floor, RNG_PURPOSE.doors);
  const numDoors = 2 + rng.nextInt(2); // 2 or 3
  const doors: DoorOffer[] = [];
  const maxEnemies = Math.min(3, Math.max(1, Math.ceil(floor / 3)));

  for (let d = 0; d < numDoors; d++) {
    // ~1 in 4 doors is an Elite.
    if (rng.chance(25)) {
      const elite = getEnemy(biome.eliteId);
      doors.push({ kind: 'elite', enemyIds: [biome.eliteId], preview: `Elite · ${elite.name}` });
    } else {
      const count = 1 + rng.nextInt(maxEnemies);
      const enemyIds: string[] = [];
      for (let i = 0; i < count; i++) enemyIds.push(rng.pick(biome.regularIds));
      doors.push({ kind: 'battle', enemyIds, preview: battlePreview(enemyIds) });
    }
  }

  // Guarantee at least one non-Elite option (GDD: doors are a choice, not a gate).
  if (doors.every((d) => d.kind === 'elite')) {
    const count = 1 + rng.nextInt(maxEnemies);
    const enemyIds: string[] = [];
    for (let i = 0; i < count; i++) enemyIds.push(rng.pick(biome.regularIds));
    doors[0] = { kind: 'battle', enemyIds, preview: battlePreview(enemyIds) };
  }

  return doors;
}
