import { useEffect } from 'react';
import { buildCodexFrom, mergeCodexProgress, type CodexEntry } from '@towventure/shared/run';
import { useStore } from '../store.js';

const EMPTY = { items: {}, enemies: {} };

function Entry({ e }: { e: CodexEntry }) {
  if (!e.discovered) {
    return (
      <div className="bp-item codex-locked">
        <div className="item-name muted">???</div>
        <div className="muted" style={{ fontSize: 11 }}>
          Undiscovered
        </div>
      </div>
    );
  }
  const meter =
    e.kind === 'item' ? `★${e.progress}` : `${e.progress} ${e.progress === 1 ? 'kill' : 'kills'}`;
  return (
    <div className="bp-item">
      <div className="row spread">
        <span className="item-name">{e.name}</span>
        <span className="muted" style={{ fontSize: 11 }}>
          {meter}
        </span>
      </div>
      <div className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>
        {e.flavor}
      </div>
      {e.lore.map((l, i) => (
        <div
          key={i}
          className="muted"
          style={{ fontSize: 11, marginTop: 3, opacity: l.unlocked ? 1 : 0.45 }}
        >
          {l.unlocked ? `“${l.text}”` : `🔒 unlocks at ${l.req}`}
        </div>
      ))}
    </div>
  );
}

export function Codex() {
  const run = useStore((s) => s.run);
  const accountCodex = useStore((s) => s.accountCodex);
  const fetchCodex = useStore((s) => s.fetchCodex);
  const setView = useStore((s) => s.setView);

  // Pull the persisted lifetime Codex on open; merge the current run's fresh finds.
  useEffect(() => {
    void fetchCodex();
  }, [fetchCodex]);

  const merged = mergeCodexProgress(accountCodex ?? EMPTY, run?.codex ?? EMPTY);
  const codex = buildCodexFrom(merged);
  return (
    <div className="card col" style={{ margin: 12 }}>
      <div className="row spread">
        <div className="title">The Codex</div>
        <div className="muted">
          {codex.discovered}/{codex.total} discovered
        </div>
      </div>
      <div className="title" style={{ fontSize: 14, marginTop: 8 }}>
        Relics & Gear
      </div>
      <div className="backpack">
        {codex.items.map((e) => (
          <Entry key={e.id} e={e} />
        ))}
      </div>
      <div className="title" style={{ fontSize: 14, marginTop: 8 }}>
        Bestiary
      </div>
      <div className="backpack">
        {codex.enemies.map((e) => (
          <Entry key={e.id} e={e} />
        ))}
      </div>
      <button className="ghost" style={{ marginTop: 8 }} onClick={() => setView('gate')}>
        Back
      </button>
    </div>
  );
}
