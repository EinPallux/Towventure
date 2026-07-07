import { useEffect } from 'react';
import { useStore } from '../store.js';
import type { MerchantEntry } from '../api/client.js';

const KIND_GLYPH: Record<MerchantEntry['kind'], string> = {
  boon: '⚔',
  trail: '✦',
  aura: '❂',
  banner: '⚑',
  title: '“',
};

function Item({ m }: { m: MerchantEntry }) {
  const busy = useStore((s) => s.busy);
  const buy = useStore((s) => s.buy);
  const cost = m.vault ? '3 🗝' : `◈ ${m.price}`;
  const cta = m.owned ? 'Owned' : m.armed ? 'Armed' : `Buy · ${cost}`;
  return (
    <div className={`card door ${m.vault ? 'above' : m.kind}`}>
      <div className="kind">{m.vault ? 'vault' : m.kind}</div>
      <div className="title" style={{ fontSize: 17 }}>
        {KIND_GLYPH[m.kind]} {m.name}
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        {m.flavor}
      </div>
      <div className="muted grow" />
      <button
        className={m.armed ? 'small' : 'primary small'}
        disabled={busy || m.owned || m.armed || !m.affordable}
        onClick={() => void buy(m.id)}
      >
        {m.affordable || m.owned || m.armed ? cta : `${cost} — short`}
      </button>
    </div>
  );
}

export function Merchant() {
  const data = useStore((s) => s.merchant);
  const setView = useStore((s) => s.setView);
  const fetchMerchant = useStore((s) => s.fetchMerchant);
  useEffect(() => {
    void fetchMerchant();
  }, [fetchMerchant]);
  if (!data) return <div className="card center">The Honor Merchant unrolls their wares…</div>;

  const boons = data.items.filter((m) => m.kind === 'boon' && !m.vault);
  const cosmetics = data.items.filter((m) => m.kind !== 'boon' && !m.vault);
  const vault = data.items.filter((m) => m.vault);

  return (
    <div className="col grow" style={{ overflow: 'auto', padding: 12, gap: 12 }}>
      <div className="card row spread">
        <div className="title">Honor Merchant</div>
        <div className="row" style={{ gap: 14 }}>
          <span className="muted" title="Valor Marks">
            ◈ {data.marks}
          </span>
          <span className="muted" title="Champion’s Keys">
            🗝 {data.keys}/{data.keysForVault}
          </span>
        </div>
      </div>

      <div className="muted" style={{ fontSize: 13 }}>
        War Chest boons — arm one; it fires at your next run’s start.
      </div>
      <div className="doors">
        {boons.map((m) => (
          <Item key={m.id} m={m} />
        ))}
      </div>

      <div className="muted" style={{ fontSize: 13 }}>
        Cosmetics — prestige, owned forever.
      </div>
      <div className="doors">
        {cosmetics.map((m) => (
          <Item key={m.id} m={m} />
        ))}
      </div>

      <div className="muted" style={{ fontSize: 13 }}>
        Vault of Champions — {data.keysForVault} Keys each.
      </div>
      <div className="doors">
        {vault.map((m) => (
          <Item key={m.id} m={m} />
        ))}
      </div>

      <div className="row">
        <button className="ghost" onClick={() => setView('gate')}>
          ← The Gate
        </button>
      </div>
    </div>
  );
}
