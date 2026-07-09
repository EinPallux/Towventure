/**
 * Onboarding (GDD §12) — the first run IS the tutorial. A handful of one-time coach
 * marks introduce doors, fighting, loot, and the first fusion; each shows once and is
 * remembered in localStorage forever. No separate mode, no modal walls — a dismissible
 * banner that never repeats. (The house-Echo soft target around floor 8 and the shared
 * seed are handled server-side; this is the guidance layer.)
 */

import { useMemo, useState } from 'react';
import { useStore } from '../store.js';
import type { InventoryItem, RunState } from '@towventure/shared/run';

const SEEN_KEY = 'tv_onboarded';

function loadSeen(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function markSeen(seen: Set<string>, id: string): void {
  seen.add(id);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch {
      /* storage disabled — the coach mark just may show again next session */
    }
  }
}

/** True when the run holds two stackable-identical items (same id + ★) — fusion-ready. */
function canFuse(run: RunState): boolean {
  const all: InventoryItem[] = [
    ...Object.values(run.equipment).filter((i): i is InventoryItem => i !== null),
    ...run.backpack,
  ];
  const keys = new Set<string>();
  for (const it of all) {
    const k = `${it.itemId}:${it.star}`;
    if (keys.has(k)) return true;
    keys.add(k);
  }
  return false;
}

interface Beat {
  id: string;
  when: boolean;
  text: string;
}

export function Onboarding() {
  const run = useStore((s) => s.run);
  const [seen, setSeen] = useState<Set<string>>(loadSeen);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const beat = useMemo<Beat | null>(() => {
    if (!run || run.status !== 'active' || run.bestFloor > 4) return null;
    const beats: Beat[] = [
      {
        id: 'doors',
        when: run.phase === 'doors',
        text: 'Choose a door. Each shows an honest, partial preview of what waits — and there is always more than one way up.',
      },
      {
        id: 'loot',
        when: run.phase === 'reward' && run.pendingItem !== null,
        text: 'Loot. Take it or leave it — your backpack is finite, and every choice is the build.',
      },
      {
        id: 'fuse',
        when: canFuse(run),
        text: 'Two of the same item? Open your hero screen and drag one onto the other to fuse it stronger (★1 → ★5).',
      },
    ];
    return beats.find((b) => b.when && !seen.has(b.id)) ?? null;
  }, [run, seen]);

  if (!beat || dismissed === beat.id) return null;

  const dismiss = (): void => {
    markSeen(seen, beat.id);
    setSeen(new Set(seen));
    setDismissed(beat.id);
  };

  return (
    <div className="coachmark" role="status">
      <span className="glyph">☞</span>
      <span className="grow">{beat.text}</span>
      <button className="small ghost" onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}
