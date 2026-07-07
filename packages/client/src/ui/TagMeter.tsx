import { TAG_SYNERGIES, tagCounts, type RunState } from '@towventure/shared/run';

const THRESHOLDS = [2, 4, 6] as const;
const TAG_LABEL: Record<string, string> = {
  blade: 'Blade',
  bulwark: 'Bulwark',
  arcane: 'Arcane',
  ember: 'Ember',
  venom: 'Venom',
  frost: 'Frost',
  shadow: 'Shadow',
  wild: 'Wild',
};

/** Build tag meter (GDD §4.3): shows each tag's count and which 2/4/6 thresholds are lit. */
export function TagMeter({ run }: { run: RunState }) {
  const counts = [...tagCounts(run).entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (counts.length === 0) return null;

  return (
    <div className="tagmeter">
      {counts.map(([tag, count]) => {
        const syns = TAG_SYNERGIES[tag] ?? [];
        const notes = syns
          .filter((s) => count >= s.threshold)
          .map((s) => `(${s.threshold}) ${s.note}`)
          .join('\n');
        return (
          <div
            key={tag}
            className="tagchip"
            title={notes || `${TAG_LABEL[tag]} — no threshold met`}
          >
            <span className="tagname">{TAG_LABEL[tag] ?? tag}</span>
            <span className="tagcount">{count}</span>
            <span className="pips">
              {THRESHOLDS.map((t) => (
                <span
                  key={t}
                  className={`pip ${count >= t ? 'lit' : ''} ${syns.some((s) => s.threshold === t) ? '' : 'empty'}`}
                >
                  {t}
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
