/**
 * Balance harness (BALANCE §9) — the headless CLI over the shared sim. It plays N
 * seeded runs per class under each of the four scripted player policies §9 names —
 * **greedy-DPS**, **tag-committed**, **fuse-everything**, and **random** — and reports
 * the death-floor distribution per class, a policy × class median table, and the
 * release gates. Modelling more than one policy is the whole point of the class-parity
 * gate ("no class > 55% of top-decile deaths"): a single greedy-DPS bot structurally
 * favours the Duelist (its fantasy *is* DPS), so the deep-end ceiling only shows up as
 * class-fair when every play style gets a vote. The gate is therefore evaluated over
 * the pooled population; the per-policy breakdown keeps each policy's bias visible.
 *
 * Determinism: every draw (runs and the random policy's own choices) comes from the
 * seeded xoshiro RNG — no Math.random — so CI reproduces the exact numbers each run.
 *
 * Usage: pnpm harness [--runs 500] [--seed 1] [--cap 200] [--policy <name>] [--gate]
 */

import { equipSlotForKind, findEvent, getItem, type ClassId, type Tag } from '@towventure/shared/content';
import {
  applyCommand,
  runPendingFight,
  startRun,
  type Command,
  type RunState,
} from '@towventure/shared/run';
import { Rng, mixSeed } from '@towventure/shared/sim';

const CLASSES: ClassId[] = ['vanguard', 'duelist', 'arcanist'];

/** Deterministic tag iteration order (for tie-broken tag commitment). */
const TAG_ORDER: Tag[] = ['blade', 'bulwark', 'arcane', 'ember', 'venom', 'frost', 'shadow', 'wild'];

interface Args {
  runs: number;
  seed: number;
  cap: number;
  gate: boolean;
  policy: string | null;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { runs: 500, seed: 1, cap: 200, gate: false, policy: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i + 1];
    if (argv[i] === '--runs' && v) a.runs = Number(v);
    else if (argv[i] === '--seed' && v) a.seed = Number(v);
    else if (argv[i] === '--cap' && v) a.cap = Number(v);
    else if (argv[i] === '--policy' && v) a.policy = v;
    else if (argv[i] === '--gate') a.gate = true;
  }
  return a;
}

// ── shared policy helpers ────────────────────────────────────────────────────

/** Does any equip slot sit empty that this backpack item could fill? */
function equipTarget(state: RunState, itemId: string): boolean {
  const slot = equipSlotForKind(getItem(itemId).kind);
  if (!slot || slot === 'relic') return false;
  const e = state.equipment;
  if (slot === 'weapon') return e.weapon1 === null || e.weapon2 === null;
  if (slot === 'trinket') return e.trinket1 === null || e.trinket2 === null;
  return e[slot] === null;
}

/** Tags on an item, empty for anything the registry can't resolve. */
function itemTags(itemId: string): Tag[] {
  try {
    return getItem(itemId).tags;
  } catch {
    return [];
  }
}

/** The battle door with the fewest enemies (fall back to the first door). Shared by
 *  every non-random policy so class differences come from the *build*, not the route. */
function safestDoor(state: RunState): Command {
  const doors = state.doors ?? [];
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

/** The first same-id, same-★, sub-★5 duplicate pair in the backpack (fuse target). */
function firstDuplicatePair(state: RunState): Command | null {
  for (let i = 0; i < state.backpack.length; i++) {
    for (let j = i + 1; j < state.backpack.length; j++) {
      const a = state.backpack[i]!;
      const b = state.backpack[j]!;
      if (a.itemId === b.itemId && a.star === b.star && a.star < 5) {
        return { type: 'fuse', uid1: a.uid, uid2: b.uid };
      }
    }
  }
  return null;
}

/** Every fusable duplicate pair (for the random policy to pick among). */
function allDuplicatePairs(state: RunState): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let i = 0; i < state.backpack.length; i++) {
    for (let j = i + 1; j < state.backpack.length; j++) {
      const a = state.backpack[i]!;
      const b = state.backpack[j]!;
      if (a.itemId === b.itemId && a.star === b.star && a.star < 5) out.push([a.uid, b.uid]);
    }
  }
  return out;
}

/** A backpack item that fills an empty slot; prefers one carrying `preferred` if given. */
function firstEquipable(state: RunState, preferred?: Tag | null): Command | null {
  const cands = state.backpack.filter((it) => {
    try {
      return equipTarget(state, it.itemId);
    } catch {
      return false;
    }
  });
  const pick =
    preferred != null ? (cands.find((it) => itemTags(it.itemId).includes(preferred)) ?? cands[0]) : cands[0];
  return pick ? { type: 'equip', uid: pick.uid } : null;
}

/** Tag the equipped kit leans on most (deterministic tie-break by TAG_ORDER). */
function committedTag(state: RunState): Tag | null {
  const counts = new Map<Tag, number>();
  for (const inst of Object.values(state.equipment)) {
    if (!inst) continue;
    for (const tag of itemTags(inst.itemId)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  let best: Tag | null = null;
  let bestN = 0;
  for (const t of TAG_ORDER) {
    const n = counts.get(t) ?? 0;
    if (n > bestN) {
      bestN = n;
      best = t;
    }
  }
  return best;
}

// ── the four policies (BALANCE §9) ───────────────────────────────────────────

type PolicyFn = (state: RunState) => Command;
interface Policy {
  name: string;
  make: (seed: number) => PolicyFn;
}

/** greedy-DPS — equip upgrades, fuse duplicates, always take the safest door and
 *  option 0. The original harness policy, preserved byte-for-byte so its standalone
 *  numbers stay directly comparable. */
function greedyAct(state: RunState): Command {
  switch (state.phase) {
    case 'doors':
      return safestDoor(state);
    case 'reward': {
      if (state.pendingItem) {
        return state.backpack.length < state.backpackSize
          ? { type: 'takeLoot', take: true }
          : { type: 'takeLoot', take: false };
      }
      const dup = firstDuplicatePair(state);
      if (dup) return dup;
      const eq = firstEquipable(state);
      if (eq) return eq;
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
    case 'event':
      return { type: 'resolveEvent', optionIndex: 0 };
    default:
      return { type: 'abandonRun' };
  }
}

/** tag-committed — commit to the kit's dominant tag family and stack it: take on-tag
 *  loot always, equip on-tag first, fuse duplicates, grab grave-copies. Lets each
 *  class chase *its* synergy ceiling (arcane detonations, bulwark walls, blade bleed). */
function makeTagPolicy(): PolicyFn {
  let committed: Tag | null = null;
  return (state) => {
    switch (state.phase) {
      case 'doors':
        return safestDoor(state);
      case 'reward': {
        if (committed === null) committed = committedTag(state);
        if (state.pendingGraveCopy) {
          const opts = state.pendingGraveCopy;
          const on = opts.findIndex((id) => committed !== null && itemTags(id).includes(committed));
          return opts.length ? { type: 'chooseGraveCopy', index: on >= 0 ? on : 0 } : { type: 'proceed' };
        }
        if (state.pendingItem) {
          const tags = itemTags(state.pendingItem);
          if (committed === null && tags.length) committed = tags[0]!;
          const onTag = committed === null ? true : tags.includes(committed);
          if (onTag) return { type: 'takeLoot', take: true };
          return state.backpack.length < state.backpackSize
            ? { type: 'takeLoot', take: true }
            : { type: 'takeLoot', take: false };
        }
        const dup = firstDuplicatePair(state);
        if (dup) return dup;
        const eq = firstEquipable(state, committed);
        if (eq) return eq;
        return { type: 'proceed' };
      }
      case 'shop': {
        const shop = state.shop;
        if (shop && state.backpack.length < state.backpackSize) {
          const onTag = shop.slots.findIndex(
            (s) =>
              !s.sold &&
              s.price <= state.gold &&
              committed !== null &&
              itemTags(s.refId).includes(committed),
          );
          if (onTag >= 0) return { type: 'buy', slotIndex: onTag };
          const copy = shop.slots.findIndex(
            (s) => !s.sold && s.kind === 'requestedCopy' && s.price <= state.gold,
          );
          if (copy >= 0) return { type: 'buy', slotIndex: copy };
        }
        return { type: 'leaveShop' };
      }
      case 'event':
        return { type: 'resolveEvent', optionIndex: 0 };
      default:
        return { type: 'abandonRun' };
    }
  };
}

/** fuse-everything — hoard duplicates and fuse relentlessly: fuse before all else,
 *  take every drop with room, buy anything affordable, grab grave-copies. The vertical
 *  power-spike playstyle. */
function fuseAct(state: RunState): Command {
  switch (state.phase) {
    case 'doors':
      return safestDoor(state);
    case 'reward': {
      const dup = firstDuplicatePair(state);
      if (dup) return dup;
      if (state.pendingGraveCopy) return { type: 'chooseGraveCopy', index: 0 };
      if (state.pendingItem) {
        return state.backpack.length < state.backpackSize
          ? { type: 'takeLoot', take: true }
          : { type: 'takeLoot', take: false };
      }
      const eq = firstEquipable(state);
      if (eq) return eq;
      return { type: 'proceed' };
    }
    case 'shop': {
      const shop = state.shop;
      if (shop && state.backpack.length < state.backpackSize) {
        const copy = shop.slots.findIndex(
          (s) => !s.sold && s.kind === 'requestedCopy' && s.price <= state.gold,
        );
        if (copy >= 0) return { type: 'buy', slotIndex: copy };
        const any = shop.slots.findIndex((s) => !s.sold && s.price <= state.gold);
        if (any >= 0) return { type: 'buy', slotIndex: any };
      }
      return { type: 'leaveShop' };
    }
    case 'event':
      return { type: 'resolveEvent', optionIndex: 0 };
    default:
      return { type: 'abandonRun' };
  }
}

/** random — a seeded coin-flip bot: legal-but-arbitrary choices at every branch. The
 *  noise floor. Its RNG is seeded from the run seed, so the run is fully reproducible. */
function makeRandomPolicy(seed: number): PolicyFn {
  const rng = new Rng(mixSeed(seed, 0x9e3779b1));
  return (state) => {
    switch (state.phase) {
      case 'doors': {
        const n = (state.doors ?? []).length;
        return { type: 'chooseDoor', doorIndex: n > 0 ? rng.nextInt(n) : 0 };
      }
      case 'reward': {
        if (state.pendingGraveCopy) {
          const opts = state.pendingGraveCopy;
          if (opts.length > 0 && rng.chance(60)) {
            return { type: 'chooseGraveCopy', index: rng.nextInt(opts.length) };
          }
          return { type: 'proceed' };
        }
        if (state.pendingItem) return { type: 'takeLoot', take: rng.chance(60) };
        const pairs = allDuplicatePairs(state);
        if (pairs.length > 0 && rng.chance(50)) {
          const p = rng.pick(pairs);
          return { type: 'fuse', uid1: p[0], uid2: p[1] };
        }
        const eq = firstEquipable(state);
        if (eq && rng.chance(70)) return eq;
        return { type: 'proceed' };
      }
      case 'shop': {
        const shop = state.shop;
        if (shop && state.backpack.length < state.backpackSize) {
          const affordable = shop.slots
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => !s.sold && s.price <= state.gold);
          if (affordable.length > 0 && rng.chance(50)) {
            return { type: 'buy', slotIndex: rng.pick(affordable).i };
          }
        }
        return { type: 'leaveShop' };
      }
      case 'event': {
        const ev = state.pendingEvent ? findEvent(state.pendingEvent) : undefined;
        const n = ev ? ev.options.length : 1;
        return { type: 'resolveEvent', optionIndex: rng.nextInt(Math.max(1, n)) };
      }
      default:
        return { type: 'abandonRun' };
    }
  };
}

const POLICIES: Policy[] = [
  { name: 'greedy-DPS', make: () => greedyAct },
  { name: 'tag-committed', make: () => makeTagPolicy() },
  { name: 'fuse-everything', make: () => fuseAct },
  { name: 'random', make: (seed) => makeRandomPolicy(seed) },
];

// ── run loop ─────────────────────────────────────────────────────────────────

interface Outcome {
  deathFloor: number;
  doomfall: boolean;
  fightsWon: number;
}

function playRun(classId: ClassId, seed: number, cap: number, act: PolicyFn): Outcome {
  let state = startRun(classId, [], seed);
  let guard = 0;
  while (state.status === 'active' && state.floor <= cap && guard++ < 20000) {
    if (state.phase === 'fight') {
      const out = runPendingFight(state);
      if (!out) break;
      state = out.state;
      continue;
    }
    const res = applyCommand(state, act(state));
    if (!res.ok) {
      // Policy produced an illegal move — bail to proceed so the run still terminates.
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

// ── reporting ────────────────────────────────────────────────────────────────

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
}

function report(label: string, outcomes: Outcome[]): void {
  const floors = outcomes.map((o) => o.deathFloor).sort((a, b) => a - b);
  const n = floors.length;
  const pct = (p: number): number => floors[Math.min(n - 1, Math.floor((p / 100) * n))]!;
  const mean = Math.round(floors.reduce((a, b) => a + b, 0) / n);
  const doomfallDeaths = outcomes.filter((o) => o.doomfall).length;

  const bands = new Map<number, number>();
  for (const f of floors) {
    const band = Math.floor((f - 1) / 10) * 10 + 1;
    bands.set(band, (bands.get(band) ?? 0) + 1);
  }

  console.log(`\n${label} — ${n} runs (all policies pooled)`);
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

/** Policy × class median death floor + each policy's own duel-…-decile bias, so the
 *  aggregate gate can't hide a single policy's skew. */
function policyTable(byPolicyClass: Map<string, Map<string, Outcome[]>>): void {
  console.log('\n── Median death floor · policy × class ──');
  console.log(`  ${'policy'.padEnd(16)}${CLASSES.map((c) => c.padStart(10)).join('')}`);
  for (const [pol, pc] of byPolicyClass) {
    const cells = CLASSES.map((c) => String(median((pc.get(c) ?? []).map((o) => o.deathFloor))).padStart(10));
    console.log(`  ${pol.padEnd(16)}${cells.join('')}`);
  }
}

/**
 * Release gates (BALANCE §9), evaluated over the pooled population of all policies ×
 * classes. Prints PASS/FAIL per gate and returns whether the *hard* gates held.
 * The per-item ±8% win-rate-cohort gate still needs item-tagged policy sims (a
 * follow-up); the class-distribution and Doomfall gates are computed here.
 */
function reportGates(byClass: Map<string, Outcome[]>): boolean {
  console.log('\n── Release gates (BALANCE §9) — pooled across policies ──');
  let allHardPassed = true;
  const line = (ok: boolean, hard: boolean, msg: string): void => {
    if (hard && !ok) allHardPassed = false;
    console.log(`  ${ok ? 'PASS' : hard ? 'FAIL' : 'WARN'} · ${msg}`);
  };

  // Gate 1 — each class's median first death sits in a sane band [20, 80].
  for (const [classId, outs] of byClass) {
    const m = median(outs.map((o) => o.deathFloor));
    line(m >= 20 && m <= 80, true, `${classId} median death floor ${m} ∈ [20, 80]`);
  }

  // Gate 2 — no class owns > 55% of the deepest-decile deaths (BALANCE §9).
  const all = [...byClass.values()].flat();
  const sorted = all.map((o) => o.deathFloor).sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  const topByClass = new Map<string, number>();
  let topTotal = 0;
  for (const [classId, outs] of byClass) {
    const n = outs.filter((o) => o.deathFloor >= threshold).length;
    topByClass.set(classId, n);
    topTotal += n;
  }
  for (const [classId, n] of topByClass) {
    const share = topTotal > 0 ? n / topTotal : 0;
    line(share <= 0.55, true, `${classId} top-decile death share ${(share * 100).toFixed(0)}% ≤ 55%`);
  }

  // Gate 3 — Doomfall causes 5–12% of deaths (soft: it must matter, not dominate).
  const doomfall = all.filter((o) => o.doomfall).length;
  const dfShare = (doomfall / all.length) * 100;
  line(dfShare >= 5 && dfShare <= 12, false, `Doomfall death share ${dfShare.toFixed(1)}% ∈ [5, 12]`);

  console.log(`\n${allHardPassed ? '✓ hard gates passed' : '✗ hard gates FAILED'}`);
  return allHardPassed;
}

// ── main ─────────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));
const selected = args.policy ? POLICIES.filter((p) => p.name === args.policy) : POLICIES;
if (selected.length === 0) {
  console.error(`Unknown --policy "${args.policy}". Known: ${POLICIES.map((p) => p.name).join(', ')}`);
  process.exit(2);
}

console.log(
  `\nTowventure balance harness — ${args.runs} runs/class × ${selected.length} ${selected.length === 1 ? 'policy' : 'policies'} (BALANCE §4 target: median first death ~floor 25–40)`,
);

const byClass = new Map<string, Outcome[]>();
const byPolicyClass = new Map<string, Map<string, Outcome[]>>();
for (const pol of selected) {
  const pc = new Map<string, Outcome[]>();
  for (const classId of CLASSES) {
    const outcomes: Outcome[] = [];
    for (let i = 0; i < args.runs; i++) {
      const seed = args.seed + i * 2654435761;
      outcomes.push(playRun(classId, seed, args.cap, pol.make(seed)));
    }
    pc.set(classId, outcomes);
    byClass.set(classId, [...(byClass.get(classId) ?? []), ...outcomes]);
  }
  byPolicyClass.set(pol.name, pc);
}

for (const classId of CLASSES) report(classId, byClass.get(classId) ?? []);
policyTable(byPolicyClass);
const hardOk = reportGates(byClass);
// `--gate` makes failing hard gates exit non-zero (for CI); default is informational.
if (args.gate && !hardOk) process.exit(1);
