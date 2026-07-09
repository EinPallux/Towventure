import { useStore } from '../store.js';

const CB_LABEL: Record<string, string> = {
  off: 'Off',
  deuteranopia: 'Deuteranopia (red-green)',
  protanopia: 'Protanopia (red-green)',
  tritanopia: 'Tritanopia (blue-yellow)',
};

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="row spread" style={{ gap: 12 }}>
      <span>{label}</span>
      <span className="row" style={{ gap: 8 }}>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(value * 100)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          style={{ width: 140 }}
        />
        <span className="muted" style={{ width: 34, textAlign: 'right' }}>
          {Math.round(value * 100)}%
        </span>
      </span>
    </label>
  );
}

export function Settings() {
  const open = useStore((s) => s.settingsOpen);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const toggle = useStore((s) => s.toggleSettings);
  if (!open) return null;

  return (
    <div className="modal-scrim" onClick={() => toggle(false)}>
      <div className="card col" style={{ gap: 14, width: 'min(440px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="row spread">
          <div className="title">Settings</div>
          <button className="small ghost" onClick={() => toggle(false)}>
            Close
          </button>
        </div>

        <div className="col" style={{ gap: 10 }}>
          <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Audio
          </div>
          <Slider label="Sound effects" value={settings.sfxVolume} onChange={(v) => update({ sfxVolume: v })} />
          <Slider label="Music" value={settings.musicVolume} onChange={(v) => update({ musicVolume: v })} />
        </div>

        <div className="col" style={{ gap: 10 }}>
          <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Accessibility
          </div>
          <label className="row spread">
            <span>Reduced motion</span>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => update({ reducedMotion: e.target.checked })}
            />
          </label>
          <label className="row spread">
            <span>Colourblind palette</span>
            <select
              value={settings.colorblind}
              onChange={(e) => update({ colorblind: e.target.value as typeof settings.colorblind })}
            >
              {Object.entries(CB_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="col" style={{ gap: 10 }}>
          <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Combat
          </div>
          <label className="row spread">
            <span>Default fight speed</span>
            <span className="row" style={{ gap: 6 }}>
              {[1, 2].map((sp) => (
                <button
                  key={sp}
                  className={settings.fightSpeed === sp ? 'small primary' : 'small ghost'}
                  onClick={() => update({ fightSpeed: sp })}
                >
                  {sp}×
                </button>
              ))}
            </span>
          </label>
          <div className="muted" style={{ fontSize: 12 }}>
            In a fight: <strong>1</strong>/<strong>2</strong> set speed · <strong>Space</strong> or{' '}
            <strong>S</strong> skips to the result.
          </div>
        </div>
      </div>
    </div>
  );
}
