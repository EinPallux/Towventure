import { useStore } from './store.js';
import { Codex } from './ui/Codex.js';
import { Death } from './ui/Death.js';
import { Fight } from './ui/Fight.js';
import { Gate } from './ui/Gate.js';
import { Ladder } from './ui/Ladder.js';
import { Merchant } from './ui/Merchant.js';
import { RunScreen } from './ui/RunScreen.js';
import { Skirmish } from './ui/Skirmish.js';
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
    </div>
  );
}
