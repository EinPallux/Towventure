/**
 * Golden replay suite. Runs every scripted scenario and compares its outcome to
 * the committed `golden.json`. Set `GOLDENS_UPDATE=1` (via `pnpm goldens:update`)
 * to regenerate after an *intentional* sim change — the PR body must say why
 * (ARCHITECTURE.md §4.4). CI runs without the flag, so silent drift fails.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { simulate } from '../engine.js';
import { SCENARIOS } from './scenarios.js';

interface Golden {
  hash: number;
  endTick: number;
  winner: 'hero' | 'enemies';
}

const GOLDEN_PATH = fileURLToPath(new URL('./golden.json', import.meta.url));
const UPDATE = process.env.GOLDENS_UPDATE === '1';

function computeAll(): Record<string, Golden> {
  const out: Record<string, Golden> = {};
  for (const s of SCENARIOS) {
    const r = simulate(s.spec, s.seed);
    out[s.name] = { hash: r.logHash, endTick: r.endTick, winner: r.winner };
  }
  return out;
}

if (UPDATE) {
  const generated = computeAll();
  writeFileSync(GOLDEN_PATH, JSON.stringify(generated, null, 2) + '\n');
  console.log(`[goldens] wrote ${Object.keys(generated).length} scenarios to golden.json`);
}

describe('golden replay suite', () => {
  const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Record<string, Golden>;

  it('covers every scenario in golden.json (no orphans, no gaps)', () => {
    expect(SCENARIOS.map((s) => s.name).sort()).toEqual(Object.keys(golden).sort());
  });

  for (const s of SCENARIOS) {
    it(`replays "${s.name}" to its pinned hash`, () => {
      const r = simulate(s.spec, s.seed);
      const g = golden[s.name];
      expect(g, `missing golden for ${s.name} — run pnpm goldens:update`).toBeDefined();
      expect({ hash: r.logHash, endTick: r.endTick, winner: r.winner }).toEqual(g);
    });

    it(`replays "${s.name}" identically twice (determinism)`, () => {
      expect(simulate(s.spec, s.seed).logHash).toBe(simulate(s.spec, s.seed).logHash);
    });
  }
});
