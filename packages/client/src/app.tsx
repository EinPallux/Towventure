import { useEffect } from 'react';
import { useStore } from './store.js';
import { Codex } from './ui/Codex.js';
import { Death } from './ui/Death.js';
import { Fight } from './ui/Fight.js';
import { Gate } from './ui/Gate.js';
import { Ladder } from './ui/Ladder.js';
import { Merchant } from './ui/Merchant.js';
import { RunScreen } from './ui/RunScreen.js';
import { Skirmish } from './ui/Skirmish.js';
import { Social } from './ui/Social.js';
import { TopBar } from './ui/TopBar.js';

function ErrorToast() {
  const error = useStore((s) => s.error);
  const clear = useStore((s) => s.clearError);
  if (!error) return null;
  return (
    <div className="toast" onClick={clear} role="alert">
      {error}
    </div>
  );
}

function LiveToasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div className="live-toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast live" onClick={() => dismiss(t.id)} role="status">
          ❂ {t.body}
        </div>
      ))}
    </div>
  );
}

/** The Fusion Ceremony — a forge flash on any ★-up, grandest at ★5 (the Zenith forge). */
function Ceremony() {
  const ceremony = useStore((s) => s.ceremony);
  const dismiss = useStore((s) => s.dismissCeremony);
  const zenith = (ceremony?.star ?? 0) >= 5;
  useEffect(() => {
    if (!ceremony) return;
    const id = window.setTimeout(dismiss, zenith ? 2400 : 1500);
    return () => window.clearTimeout(id);
  }, [ceremony, zenith, dismiss]);
  if (!ceremony) return null;
  return (
    <div className={`ceremony ${zenith ? 'zenith' : ''}`} aria-hidden>
      <div className="rune">{zenith ? '✷' : '✦'}</div>
    </div>
  );
}

export function App() {
  const me = useStore((s) => s.me);
  const run = useStore((s) => s.run);
  const view = useStore((s) => s.view);
  const playback = useStore((s) => s.playback);

  let body: JSX.Element;
  if (!me) {
    body = <Gate />;
  } else if (view === 'ladder') {
    body = <Ladder />;
  } else if (view === 'codex') {
    body = <Codex />;
  } else if (view === 'skirmish') {
    body = <Skirmish />;
  } else if (view === 'merchant') {
    body = <Merchant />;
  } else if (view === 'social') {
    body = <Social />;
  } else if (playback) {
    body = <Fight />;
  } else if (run && run.status === 'dead') {
    body = <Death />;
  } else if (run && run.status === 'active') {
    body = run.phase === 'fight' ? <Fight /> : <RunScreen />;
  } else {
    body = <Gate />;
  }

  return (
    <div className="app">
      <div className="overlay">
        {me && <TopBar />}
        {body}
      </div>
      <ErrorToast />
      <LiveToasts />
      <Ceremony />
    </div>
  );
}
