/**
 * Balance harness (BALANCE §9) — Phase 1 stub. Plays N seeded Vanguard runs with a
 * scripted greedy policy (equip upgrades, fuse duplicates, safest door) and reports
 * the death-floor distribution + Doomfall share. The full multi-policy release
 * gates (±8% cohort win-rate, class death profiles, etc.) land in Phase 2, when
 * content merges start gating on this CLI.
 *
 * Usage: pnpm harness [--runs 500] [--seed 1] [--cap 200]
 */

import { equipSlotForKind, getItem, type ClassId } from '@towventure/shared/content';
import {
  applyCommand,
  runPendingFight,
  startRun,
  type Command,
  type RunState,
} from '@towventure/shared/run';

const CLASSES: ClassId[] = ['vanguard', 'duelist', 'arcanist'];

interface Args {
  runs: number;
  seed: number;
  cap: number;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { runs: 500, seed: 1, cap: 200 };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i + 1];
    if (argv[i] === '--runs' && v) a.runs = Number(v);
    else if (argv[i] === '--seed' && v) a.seed = Number(v);
    else if (argv[i] === '--cap' && v) a.cap = Number(v);
  }
  return a;
}

/** Does any equip slot sit empty that this backpack item could fill? */
function equipTarget(state: RunState, itemId: string): boolean {
  const slot = equipSlotForKind(getItem(itemId).kind);
  if (!slot || slot === 'relic') return false;
  const e = state.equipment;
  if (slot === 'weapon') return e.weapon1 === null || e.weapon2 === null;
  if (slot === 'trinket') return e.trinket1 === null || e.trinket2 === null;
  return e[slot] === null;
}

/** The next command for the greedy policy (fights are run by the caller). */
function policy(state: RunState): Command {
  switch (state.phase) {
    case 'doors': {
      const doors = state.doors ?? [];
      // Prefer the battle door with the fewest enemies; fall back to the first door.
      let best = 0;
      let bestCount = Infinity;
      doors.forEach((d, i) => {
        if (d.kind === 'battle' && d.enemyIds.length < bestCount) {
          bestCount = d.enemyIds.length;
          best = i;
        }
      });
      return { type: 'chooseDoor', doorIndex: best };
    }
    case 'reward': {
      if (state.pendingItem) {
        return state.backpack.length < state.backpackSize
          ? { type: 'takeLoot', take: true }
          : { type: 'takeLoot', take: false };
      }
      // Fuse the first identical same-★ duplicate pair.
      for (let i = 0; i < state.backpack.length; i++) {
        for (let j = i + 1; j < state.backpack.length; j++) {
          const a = state.backpack[i]!;
          const b = state.backpack[j]!;
          if (a.itemId === b.itemId && a.star === b.star && a.star < 5) {
            return { type: 'fuse', uid1: a.uid, uid2: b.uid };
          }
        }
      }
      // Equip anything that fills an empty slot.
      const equipable = state.backpack.find((it) => {
        try {
          return equipTarget(state, it.itemId);
        } catch {
          return false;
        }
      });
      if (equipable) return { type: 'equip', uid: equipable.uid };
      return { type: 'proceed' };
    }
    case 'shop': {
      const shop = state.shop;
      if (shop && state.backpack.length < state.backpackSize) {
        const buyIdx = shop.slots.findIndex(
          (s) => !s.sold && s.kind === 'requestedCopy' && s.price <= state.gold,
        );
        if (buyIdx >= 0) return { type: 'buy', slotIndex: buyIdx };
      }
      return { type: 'leaveShop' };
    }
    default:
      return { type: 'abandonRun' };
  }
}

interface Outcome {
  deathFloor: number;
  doomfall: boolean;
  fightsWon: number;
}

function playRun(classId: ClassId, seed: number, cap: number): Outcome {
  let state = startRun(classId, [], seed);
  let guard = 0;
  while (state.status === 'active' && state.floor <= cap && guard++ < 20000) {
    if (state.phase === 'fight') {
      const out = runPendingFight(state);
      if (!out) break;
      state = out.state;
      continue;
    }
    const res = applyCommand(state, policy(state));
    if (!res.ok) {
      // Policy produced an illegal move (e.g. equip with no room) — bail to proceed.
      const fallback = applyCommand(state, { type: 'proceed' });
      if (!fallback.ok) break;
      state = fallback.state;
      continue;
    }
    state = res.state;
  }
  return {
    deathFloor: state.deathInfo?.floor ?? state.floor,
    doomfall: state.deathInfo?.killerEnemyId === 'doomfall',
    fightsWon: state.fightsWon,
  };
}

function report(label: string, outcomes: Outcome[]): void {
  const floors = outcomes.map((o) => o.deathFloor).sort((a, b) => a - b);
  const n = floors.length;
  const pct = (p: number) => floors[Math.min(n - 1, Math.floor((p / 100) * n))]!;
  const mean = Math.round(floors.reduce((a, b) => a + b, 0) / n);
  const doomfallDeaths = outcomes.filter((o) => o.doomfall).length;

  // Bucketed histogram (10-floor bands).
  const bands = new Map<number, number>();
  for (const f of floors) {
    const band = Math.floor((f - 1) / 10) * 10 + 1;
    bands.set(band, (bands.get(band) ?? 0) + 1);
  }

  console.log(`\n${label} — ${n} greedy runs`);
  console.log(
    `  death floor:  min ${floors[0]}  p25 ${pct(25)}  median ${pct(50)}  p75 ${pct(75)}  p95 ${pct(95)}  max ${floors[n - 1]}`,
  );
  console.log(`  mean ${mean} · Doomfall deaths ${((doomfallDeaths / n) * 100).toFixed(1)}%`);
  const maxBand = Math.max(...bands.values());
  for (const [band, count] of [...bands.entries()].sort((a, b) => a[0] - b[0])) {
    const bar = '█'.repeat(Math.max(1, Math.round((count / maxBand) * 30)));
    console.log(`  ${String(band).padStart(3)}–${String(band + 9).padStart(3)} ${bar} ${count}`);
  }
}

const args = parseArgs(process.argv.slice(2));
console.log(
  `\nTowventure balance harness — ${args.runs} runs/class (BALANCE §4 target: median first death ~floor 25–40)`,
);
for (const classId of CLASSES) {
  const outcomes: Outcome[] = [];
  for (let i = 0; i < args.runs; i++) {
    outcomes.push(playRun(classId, args.seed + i * 2654435761, args.cap));
  }
  report(classId, outcomes);
}
