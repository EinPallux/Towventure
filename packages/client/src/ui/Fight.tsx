import { useCallback, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { getEnemy } from '@towventure/shared/content';
import { prepareFight } from '@towventure/shared/run';
import { buildEnemy, buildFloor, buildHero, buildLantern, type Actor } from '../engine/meshes.js';
import { paletteForBiome } from '../engine/palettes.js';
import { Playback } from '../engine/playback.js';
import { useStore } from '../store.js';
import { Diorama, addLanternLighting } from './Diorama.js';

interface Hp {
  name: string;
  side: 'hero' | 'enemy';
  hp: number;
  maxHp: number;
}
interface DmgNum {
  id: number;
  side: 'left' | 'right';
  text: string;
  kind: string;
  x: number;
  y: number;
}

function FightIntro() {
  const run = useStore((s) => s.run)!;
  const busy = useStore((s) => s.busy);
  const fight = useStore((s) => s.fight);
  const ids = run.pendingFight?.enemyIds ?? [];
  const names = ids.map((id) => getEnemy(id).name).join(', ');
  return (
    <div className="gate center">
      <div className="card col" style={{ gap: 14 }}>
        <div className="kind muted" style={{ letterSpacing: '0.12em' }}>
          {run.pendingFight?.kind.toUpperCase()} · FLOOR {run.floor}
        </div>
        <div className="title" style={{ fontSize: 20 }}>
          {names}
        </div>
        <button className="primary" disabled={busy} onClick={() => void fight()}>
          Begin the battle
        </button>
      </div>
    </div>
  );
}

export function Fight() {
  const playback = useStore((s) => s.playback);
  const endPlayback = useStore((s) => s.endPlayback);

  const [hp, setHp] = useState<Hp[]>([]);
  const [nums, setNums] = useState<DmgNum[]>([]);
  const [doomfall, setDoomfall] = useState(false);
  const [done, setDone] = useState(false);
  const pbRef = useRef<Playback | null>(null);
  const numId = useRef(0);

  // prepareFight handles both normal fights and Echo duels — the same builder the
  // server used, so the client re-sims to the identical hash (ARCHITECTURE §3).
  const spec = useMemo(() => (playback ? (prepareFight(playback.preState)?.spec ?? null) : null), [playback]);
  const isEcho = playback?.preState.pendingFight?.kind === 'echo';

  const setup = useCallback(
    (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => {
      if (!spec || !playback) return {};
      const pal = paletteForBiome('gatehouse');
      scene.fog = new THREE.Fog(0x0d0b11, 10, 26);
      addLanternLighting(scene, pal.accent);
      scene.add(buildFloor(pal.base));
      const lantern = buildLantern(pal.accent);
      lantern.position.set(0, 4, 2);
      scene.add(lantern);
      camera.position.set(0, 3.1, 10.5);
      camera.lookAt(0, 1.1, 0);

      const hero = buildHero(pal.accent, pal.hero);
      hero.group.position.set(-3.2, 0, 0);
      hero.group.rotation.y = Math.PI / 2;
      scene.add(hero.group);

      const enemyCount = spec.enemies.length;
      const enemyActors: Actor[] = spec.enemies.map((_e, i) => {
        // An Echo duel renders its foe as a rival hero (a mirror), not a bestiary enemy.
        const a = isEcho
          ? buildHero(pal.hero, pal.accent)
          : buildEnemy(playback.preState.pendingFight!.enemyIds[i]!, pal.accent);
        a.group.position.set(2.6 + i * 1.4, 0, (i - (enemyCount - 1) / 2) * 1.1);
        a.group.rotation.y = -Math.PI / 2;
        scene.add(a.group);
        return a;
      });
      const actors = [hero, ...enemyActors];
      const anim = actors.map(() => ({ lunge: 0, dead: false, deadT: 0 }));

      // Hydrate initial HP bars. An Echo's foe bar shows the dead owner's name.
      const echoName = playback.preState.pendingFight?.echo?.ownerName;
      setHp([
        { name: spec.hero.name, side: 'hero', hp: spec.hero.maxHp, maxHp: spec.hero.maxHp },
        ...spec.enemies.map((e) => ({
          name: isEcho && echoName ? `${echoName}'s Echo` : e.name,
          side: 'enemy' as const,
          hp: e.maxHp,
          maxHp: e.maxHp,
        })),
      ]);
      setDoomfall(false);
      setDone(false);

      const pushNum = (idx: number, text: string, kind: string) => {
        const side = idx === 0 ? 'left' : 'right';
        const id = numId.current++;
        const x = (side === 'left' ? 22 : 70) + Math.random() * 8;
        const y = 42 + Math.random() * 12;
        setNums((cur) => [...cur, { id, side, text, kind, x, y }]);
        window.setTimeout(() => setNums((cur) => cur.filter((n) => n.id !== id)), 900);
      };

      const pb = new Playback(spec, playback.result.seed, {
        onHp: (idx, hpv, maxHp) =>
          setHp((cur) => cur.map((c, i) => (i === idx ? { ...c, hp: hpv, maxHp } : c))),
        onSwing: (idx) => {
          if (anim[idx]) anim[idx].lunge = 1;
        },
        onDeath: (idx) => {
          if (anim[idx]) anim[idx].dead = true;
        },
        onDamageNumber: (idx, text, kind) => pushNum(idx, text, kind),
        onDoomfall: () => setDoomfall(true),
        onEnd: () => setDone(true),
      });
      pbRef.current = pb;

      let t = 0;
      return {
        update: (dt: number) => {
          pb.update(dt);
          t += dt / 1000;
          lantern.position.y = 4 + Math.sin(t * 1.3) * 0.05;
          actors.forEach((a, i) => {
            const st = anim[i]!;
            const dir = i === 0 ? 1 : -1;
            st.lunge = Math.max(0, st.lunge - dt / 220);
            // Lunge reads as a forward lean toward the enemy line.
            a.group.rotation.z = dir * st.lunge * 0.25;
            if (st.dead) {
              st.deadT = Math.min(1, st.deadT + dt / 500);
              a.group.scale.setScalar(1 - st.deadT * 0.9);
              a.group.rotation.x = st.deadT * 1.2;
            }
          });
        },
        dispose: () => {
          pbRef.current = null;
        },
      };
    },
    [spec, playback],
  );

  if (!playback) return <FightIntro />;

  const setSpeed = (v: number) => {
    if (pbRef.current) pbRef.current.speed = v;
  };
  const skip = () => pbRef.current?.skip();

  return (
    <>
      <Diorama key={playback.result.seed} setup={setup} />
      <div className={`doomfall-vignette ${doomfall ? 'on' : ''}`} />
      <div className="fight-hud">
        <div className="hpbars">
          <div className="hpstack">
            {hp
              .filter((h) => h.side === 'hero')
              .map((h, i) => (
                <HpBar key={i} h={h} />
              ))}
          </div>
          <div className="hpstack enemies">
            {hp
              .filter((h) => h.side === 'enemy')
              .map((h, i) => (
                <HpBar key={i} h={h} />
              ))}
          </div>
        </div>
        {nums.map((n) => (
          <span
            key={n.id}
            className={`dmgnum ${n.kind}`}
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
          >
            {n.kind === 'heal' ? '+' : ''}
            {n.text}
          </span>
        ))}
        <div className="fight-controls">
          {done ? (
            <button className="primary" onClick={endPlayback}>
              {playback.postState.status === 'dead' ? 'The Tower keeps you…' : 'Continue ↑'}
            </button>
          ) : (
            <>
              <button className="small" onClick={() => setSpeed(1)}>
                1×
              </button>
              <button className="small" onClick={() => setSpeed(2)}>
                2×
              </button>
              <button className="small ghost" onClick={skip}>
                Skip
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function HpBar({ h }: { h: Hp }) {
  const pct = h.maxHp > 0 ? Math.max(0, Math.min(100, (h.hp / h.maxHp) * 100)) : 0;
  return (
    <div className="hp">
      <div className="label">
        <span>{h.name}</span>
        <span>
          {h.hp}/{h.maxHp}
        </span>
      </div>
      <div className={`bar ${h.side === 'enemy' ? 'enemy' : ''}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
