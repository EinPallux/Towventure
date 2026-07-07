import { useEffect, useState } from 'react';
import {
  api,
  type LadderBoard,
  type LadderMetric,
  type LadderPage,
  type SeasonInfo,
} from '../api/client.js';
import { useStore } from '../store.js';

function daysLeft(endsAt: string): number {
  return Math.max(0, Math.ceil((Date.parse(endsAt) - Date.now()) / 86_400_000));
}

const TABS: { board: LadderBoard; label: string }[] = [
  { board: 'global', label: 'Global' },
  { board: 'weekly', label: 'Weekly Climb' },
  { board: 'echo-kills', label: 'Echo Kills' },
  { board: 'unnumbered', label: 'Unnumbered' },
];

const METRIC_HEAD: Record<LadderMetric, string> = {
  honor: 'Honor',
  floor: 'Best Floor',
  kills: 'Echo Kills',
};

export function Ladder() {
  const setView = useStore((s) => s.setView);
  const [board, setBoard] = useState<LadderBoard>('global');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<LadderPage | null>(null);
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api
      .ladder(board, page)
      .then((d) => live && setData(d))
      .catch(() => live && setData(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [board, page]);

  useEffect(() => {
    let live = true;
    api
      .season()
      .then((s) => live && setSeason(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const rows = data?.rows ?? [];
  const showSelf = data?.self && !rows.some((r) => r.isSelf);
  const metric = data?.metric ?? 'honor';
  const withTier = metric === 'honor';

  return (
    <div className="ladder card">
      <div className="row spread">
        <div className="title">
          The Stairs · Season {data?.season ?? season?.season.number ?? '—'}
          {season && (
            <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
              ends in {daysLeft(season.season.endsAt)}d
            </span>
          )}
        </div>
        <button className="small ghost" onClick={() => setView('gate')}>
          Back
        </button>
      </div>
      {season?.nextPlacement != null && (
        <div className="muted" style={{ fontSize: 12 }}>
          Season reset carries you to ~{season.nextPlacement} Honor · Lifetime {season.lifetime}
        </div>
      )}
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
        {TABS.map((t) => (
          <button
            key={t.board}
            className={board === t.board ? 'small primary' : 'small ghost'}
            onClick={() => {
              setBoard(t.board);
              setPage(0);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {loading && <div className="muted">Reading the names on the stairs…</div>}
      {!loading && rows.length === 0 && (
        <div className="muted">No climbers ranked here yet. Be the first.</div>
      )}
      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Climber</th>
              {withTier && <th>Tier</th>}
              <th style={{ textAlign: 'right' }}>{METRIC_HEAD[metric]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.rank}-${r.name}`} className={r.isSelf ? 'self' : ''}>
                <td>{r.rank}</td>
                <td>{r.name}</td>
                {withTier && <td className="muted">{r.tier}</td>}
                <td style={{ textAlign: 'right' }}>{r.value}</td>
              </tr>
            ))}
            {showSelf && data?.self && (
              <tr className="self">
                <td>{data.self.rank}</td>
                <td>{data.self.name}</td>
                {withTier && <td className="muted">{data.self.tier}</td>}
                <td style={{ textAlign: 'right' }}>{data.self.value}</td>
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
