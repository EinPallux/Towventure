import { useStore } from '../store.js';

export function TopBar() {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const logout = useStore((s) => s.logout);
  if (!me) return null;

  return (
    <div className="topbar">
      <div className="row">
        <span className="brand">TOWVENTURE</span>
        {run && run.status === 'active' && <span className="muted">Floor {run.floor}</span>}
      </div>
      <div className="row">
        <span className="tier-badge">{me.tier}</span>
        <span className="muted">{me.honor} Honor</span>
        <span className="muted" title="Valor Marks — spend at the Honor Merchant">
          ◈ {me.marks}
        </span>
        {me.echo && !me.echo.expired && (
          <span
            className="muted"
            title={`Your Echo stands on Floor ${me.echo.floor} · ${me.echo.defeats}/3 defeats`}
          >
            ❂ {me.echo.kills}
          </span>
        )}
        <span>{me.account.name}</span>
        {run && run.status === 'active' && view !== 'codex' && (
          <button className="small ghost" onClick={() => setView('codex')}>
            Codex
          </button>
        )}
        {view !== 'ladder' ? (
          <button className="small ghost" onClick={() => setView('ladder')}>
            Ladder
          </button>
        ) : (
          <button className="small ghost" onClick={() => setView('gate')}>
            Back
          </button>
        )}
        <button className="small ghost" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
