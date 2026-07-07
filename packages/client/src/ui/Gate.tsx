import { useCallback, useState } from 'react';
import * as THREE from 'three';
import { buildFloor, buildHero, buildLantern } from '../engine/meshes.js';
import { paletteForBiome } from '../engine/palettes.js';
import { useStore } from '../store.js';
import { Diorama, addLanternLighting } from './Diorama.js';

function GateScene() {
  const setup = useCallback((scene: THREE.Scene, camera: THREE.PerspectiveCamera) => {
    const pal = paletteForBiome('gatehouse');
    scene.fog = new THREE.Fog(0x0d0b11, 8, 22);
    addLanternLighting(scene, pal.accent);
    scene.add(buildFloor(pal.base));
    const hero = buildHero(pal.accent, pal.hero);
    scene.add(hero.group);
    const lantern = buildLantern(pal.accent);
    lantern.position.set(2.6, 3.4, 1);
    scene.add(lantern);
    camera.position.set(0.4, 2.2, 6.5);
    camera.lookAt(0, 1.1, 0);
    let t = 0;
    return {
      update: (dt: number) => {
        t += dt / 1000;
        hero.group.rotation.y = Math.sin(t * 0.5) * 0.35;
        hero.group.position.y = Math.sin(t * 1.6) * 0.02;
        lantern.position.y = 3.4 + Math.sin(t * 1.2) * 0.06;
      },
    };
  }, []);
  return <Diorama setup={setup} />;
}

function AuthForm() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const busy = useStore((s) => s.busy);
  const register = useStore((s) => s.register);
  const login = useStore((s) => s.login);
  const guest = useStore((s) => s.guest);

  const submit = () => {
    if (mode === 'register') void register(name, password);
    else void login(name, password);
  };

  return (
    <div className="card col" style={{ gap: 12 }}>
      <div className="row spread">
        <button
          className={mode === 'register' ? 'small primary' : 'small ghost'}
          onClick={() => setMode('register')}
        >
          New climber
        </button>
        <button
          className={mode === 'login' ? 'small primary' : 'small ghost'}
          onClick={() => setMode('login')}
        >
          Returning
        </button>
      </div>
      <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input
        placeholder="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <button className="primary" disabled={busy || !name || password.length < 8} onClick={submit}>
        {mode === 'register' ? 'Take the Vow' : 'Return to the climb'}
      </button>
      <button className="ghost" disabled={busy} onClick={() => void guest()}>
        Climb as a guest
      </button>
    </div>
  );
}

const CLASS_CHOICES = [
  { id: 'vanguard' as const, name: 'Vanguard', fantasy: 'the wall that hits back' },
  { id: 'duelist' as const, name: 'Duelist', fantasy: 'speed, crits, bleed, greed' },
  { id: 'arcanist' as const, name: 'Arcanist', fantasy: 'cooldowns, statuses, detonations' },
];

function Menu() {
  const me = useStore((s) => s.me)!;
  const run = useStore((s) => s.run);
  const busy = useStore((s) => s.busy);
  const startRun = useStore((s) => s.startRun);
  const setView = useStore((s) => s.setView);
  const [cls, setCls] = useState<'vanguard' | 'duelist' | 'arcanist'>('vanguard');
  const hasRun = run && run.status === 'active';

  if (hasRun) {
    return (
      <div className="card col" style={{ gap: 12 }}>
        <div className="muted">Welcome back, {me.account.name}.</div>
        <button className="primary" disabled={busy} onClick={() => setView('gate')}>
          Resume — Floor {run.floor}
        </button>
        <button className="ghost" onClick={() => setView('ladder')}>
          The Ladder
        </button>
      </div>
    );
  }

  return (
    <div className="card col" style={{ gap: 12 }}>
      <div className="muted">Choose your Vow, {me.account.name}.</div>
      <div className="col" style={{ gap: 6 }}>
        {CLASS_CHOICES.map((c) => (
          <button
            key={c.id}
            className={cls === c.id ? 'primary' : 'ghost'}
            style={{ textAlign: 'left' }}
            onClick={() => setCls(c.id)}
          >
            <strong>{c.name}</strong> <span className="muted">— {c.fantasy}</span>
          </button>
        ))}
      </div>
      <button className="primary" disabled={busy} onClick={() => void startRun(cls)}>
        Enter the Tower
      </button>
      <button className="ghost" onClick={() => setView('ladder')}>
        The Ladder
      </button>
    </div>
  );
}

export function Gate() {
  const me = useStore((s) => s.me);
  return (
    <>
      <GateScene />
      <div className="gate center">
        <h1>TOWVENTURE</h1>
        <div className="tag">The Tower keeps what it kills. Climb anyway.</div>
        {me ? <Menu /> : <AuthForm />}
      </div>
    </>
  );
}
