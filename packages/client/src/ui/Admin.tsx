/**
 * Live-ops admin panel (OPERATIONS §6). Shown only when `me.account.isAdmin`; every
 * call is server-gated (admin flag + IP allowlist), so this is just the operator UI over
 * `/api/admin`: account lookup + moderation, the broadcast banner, and the content
 * kill-switch. Run-repair + season controls are the next admin slice.
 */

import { useEffect, useState } from 'react';
import {
  api,
  type AdminAccountView,
  type ApiError,
  type ContentFlag,
  type LiveBroadcast,
} from '../api/client.js';
import { useStore } from '../store.js';

const errText = (e: unknown): string => (e as ApiError)?.error ?? 'request failed';

function AccountLookup() {
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [data, setData] = useState<AdminAccountView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (n = name): Promise<void> => {
    setErr(null);
    setBusy(true);
    try {
      setData(await api.admin.lookup(n.trim()));
    } catch (e) {
      setData(null);
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const act = async (fn: () => Promise<unknown>): Promise<void> => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card col" style={{ gap: 8 }}>
      <div className="title" style={{ fontSize: 15 }}>
        Account lookup
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input
          placeholder="account name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load()}
        />
        <button className="small" disabled={busy || !name.trim()} onClick={() => void load()}>
          Look up
        </button>
      </div>
      {err && (
        <div className="muted" style={{ color: '#e8788a', fontSize: 12 }}>
          {err}
        </div>
      )}
      {data && (
        <div className="col" style={{ gap: 6 }}>
          <div className="row spread">
            <span className="item-name">
              {data.account.name}
              {data.account.isGuest ? ' · guest' : ''}
              {data.account.isAdmin ? ' · admin' : ''}
            </span>
            {data.ban && (
              <span className="tier-badge" style={{ background: '#7a3a4a' }}>
                BANNED
              </span>
            )}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {data.honor} Honor · ◈{data.marks} · lifetime {data.lifetime}
            {data.echo
              ? ` · Echo floor ${data.echo.floor} (${data.echo.kills} kills, ${data.echo.defeats}/3)`
              : ' · no Echo'}
          </div>
          {data.ban && (
            <div className="muted" style={{ fontSize: 12 }}>
              Ban reason: {data.ban.reason}
            </div>
          )}
          <div className="muted" style={{ fontSize: 12 }}>
            Recent:{' '}
            {data.recentRuns.map((r) => `${r.class} f${r.floor} (${r.status})`).join(' · ') ||
              'no runs'}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {data.ban ? (
              <button
                className="small"
                disabled={busy}
                onClick={() => void act(() => api.admin.unban(data.account.name))}
              >
                Unban
              </button>
            ) : (
              <>
                <input
                  placeholder="ban reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ maxWidth: 180 }}
                />
                <button
                  className="small"
                  disabled={busy || !reason.trim()}
                  onClick={() =>
                    void act(async () => {
                      await api.admin.ban(data.account.name, reason.trim());
                      setReason('');
                    })
                  }
                >
                  Ban
                </button>
              </>
            )}
            {data.echo && (
              <button
                className="small ghost"
                disabled={busy}
                onClick={() => void act(() => api.admin.echoTakedown(data.account.name))}
              >
                Echo takedown
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BroadcastPanel() {
  const [current, setCurrent] = useState<LiveBroadcast | null>(null);
  const [msg, setMsg] = useState('');
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async (): Promise<void> => {
    try {
      setCurrent((await api.admin.broadcastGet()).broadcast);
    } catch {
      /* non-fatal */
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    setBusy(true);
    try {
      await fn();
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card col" style={{ gap: 8 }}>
      <div className="title" style={{ fontSize: 15 }}>
        Broadcast banner
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        {current ? `Live: “${current.message}”` : 'No live banner.'}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input
          placeholder="message"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <input
          placeholder="hours (optional)"
          value={hours}
          onChange={(e) => setHours(e.target.value.replace(/[^0-9]/g, ''))}
          style={{ maxWidth: 130 }}
        />
        <button
          className="small"
          disabled={busy || !msg.trim()}
          onClick={() =>
            void run(async () => {
              await api.admin.broadcastSet(msg.trim(), hours ? Number(hours) : undefined);
              setMsg('');
              setHours('');
            })
          }
        >
          Set
        </button>
        <button
          className="small ghost"
          disabled={busy || !current}
          onClick={() => void run(() => api.admin.broadcastClear())}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function ContentFlagsPanel() {
  const [flags, setFlags] = useState<ContentFlag[]>([]);
  const [itemId, setItemId] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (): Promise<void> => {
    try {
      setFlags((await api.admin.contentFlags()).flags);
    } catch {
      /* non-fatal */
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const flip = async (id: string, disabled: boolean, r?: string): Promise<void> => {
    setErr(null);
    setBusy(true);
    try {
      await api.admin.setContentFlag(id, disabled, r);
      await load();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card col" style={{ gap: 8 }}>
      <div className="title" style={{ fontSize: 15 }}>
        Content kill-switch
      </div>
      <div className="muted" style={{ fontSize: 11 }}>
        Flags are stored + served; drop-exclusion enforcement is a follow-up.
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input
          placeholder="item id (e.g. rusty_cleaver)"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          style={{ minWidth: 200 }}
        />
        <input
          placeholder="reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ maxWidth: 160 }}
        />
        <button
          className="small"
          disabled={busy || !itemId.trim()}
          onClick={() =>
            void flip(itemId.trim(), true, reason.trim() || undefined).then(() => {
              setItemId('');
              setReason('');
            })
          }
        >
          Disable
        </button>
      </div>
      {err && (
        <div className="muted" style={{ color: '#e8788a', fontSize: 12 }}>
          {err}
        </div>
      )}
      <div className="col" style={{ gap: 4 }}>
        {flags.length === 0 && (
          <div className="muted" style={{ fontSize: 12 }}>
            No flags.
          </div>
        )}
        {flags.map((f) => (
          <div key={f.itemId} className="row spread">
            <span className="muted" style={{ fontSize: 12 }}>
              <strong className={f.disabled ? 'r-mythic' : ''}>{f.itemId}</strong> —{' '}
              {f.disabled ? 'disabled' : 'enabled'}
              {f.reason ? ` (${f.reason})` : ''}
            </span>
            <button
              className="small ghost"
              disabled={busy}
              onClick={() => void flip(f.itemId, !f.disabled)}
            >
              {f.disabled ? 'Enable' : 'Disable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Admin() {
  const setView = useStore((s) => s.setView);
  return (
    <div className="col grow" style={{ overflow: 'auto', padding: 12, gap: 12 }}>
      <div className="row spread">
        <div className="title">Live-ops admin</div>
        <button className="small ghost" onClick={() => setView('gate')}>
          Back
        </button>
      </div>
      <AccountLookup />
      <BroadcastPanel />
      <ContentFlagsPanel />
    </div>
  );
}
