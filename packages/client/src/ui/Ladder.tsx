import { useEffect, useState } from 'react';
import { api, type LadderPage } from '../api/client.js';
import { useStore } from '../store.js';

export function Ladder() {
  const setView = useStore((s) => s.setView);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<LadderPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api
      .ladder(page)
      .then((d) => live && setData(d))
      .catch(() => live && setData(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [page]);

  const rows = data?.rows ?? [];
  const showSelf = data?.self && !rows.some((r) => r.isSelf);

  return (
    <div className="ladder card">
      <div className="row spread">
        <div className="title">Global Ladder · Season {data?.season ?? '—'}</div>
        <button className="small ghost" onClick={() => setView('gate')}>
          Back
        </button>
      </div>
      {loading && <div className="muted">Reading the names on the stairs…</div>}
      {!loading && rows.length === 0 && (
        <div className="muted">No climbers ranked yet. Be the first.</div>
      )}
      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Climber</th>
              <th>Tier</th>
              <th style={{ textAlign: 'right' }}>Honor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.rank}-${r.name}`} className={r.isSelf ? 'self' : ''}>
                <td>{r.rank}</td>
                <td>{r.name}</td>
                <td className="muted">{r.tier}</td>
                <td style={{ textAlign: 'right' }}>{r.honor}</td>
              </tr>
            ))}
            {showSelf && data?.self && (
              <tr className="self">
                <td>{data.self.rank}</td>
                <td>{data.self.name}</td>
                <td className="muted">{data.self.tier}</td>
                <td style={{ textAlign: 'right' }}>{data.self.honor}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button
          className="small"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          ← Prev
        </button>
        <div className="grow" />
        <button
          className="small"
          disabled={!data || (page + 1) * data.pageSize >= data.total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
