import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildDuelSpec } from '@towventure/shared/run';
import { buildFloor, buildHero, buildLantern } from '../engine/meshes.js';
import { paletteForBiome } from '../engine/palettes.js';
import { Playback } from '../engine/playback.js';
import { useStore } from '../store.js';
import type { SkirmishResult } from '../api/client.js';
import { Diorama, addLanternLighting } from './Diorama.js';

const BAND_LABEL: Record<'below' | 'even' | 'above', string> = {
  above: '↑ punches up — pays best',
  even: '= even match',
  below: '↓ below you',
};

interface Bar {
  name: string;
  side: 'hero' | 'enemy';
  hp: number;
  maxHp: number;
}

/** A self-contained 1v1 duel replay: attacker vs defender, re-simmed from the seed. */
function DuelReplay({ res }: { res: SkirmishResult }) {
  const clear = useStore((s) => s.clearSkirmishResult);
  const spec = useMemo(() => buildDuelSpec(res.attacker.build, res.defender.build, 0), [res]);
  const [bars, setBars] = useState<Bar[]>([]);
  const [done, setDone] = useState(false);
  const pbRef = useRef<Playback | null>(null);

  const setup = useCallback(
    (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => {
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
      const foe = buildHero(pal.hero, pal.accent);
      foe.group.position.set(3.2, 0, 0);
      foe.group.rotation.y = -Math.PI / 2;
      scene.add(foe.group);
      const anim = [hero, foe].map(() => ({ lunge: 0, dead: false, deadT: 0 }));

      setBars([
        { name: res.attacker.name, side: 'hero', hp: spec.hero.maxHp, maxHp: spec.hero.maxHp },
        {
          name: `${res.defender.name}'s defense`,
          side: 'enemy',
          hp: spec.enemies[0]!.maxHp,
          maxHp: spec.enemies[0]!.maxHp,
        },
      ]);
      setDone(false);

      const pb = new Playback(spec, res.seed, {
        onHp: (idx, hp, maxHp) =>
          setBars((cur) => cur.map((b, i) => (i === idx ? { ...b, hp, maxHp } : b))),
        onSwing: (idx) => {
          if (anim[idx]) anim[idx].lunge = 1;
        },
        onDeath: (idx) => {
          if (anim[idx]) anim[idx].dead = true;
        },
        onEnd: () => setDone(true),
      });
      pbRef.current = pb;

      return {
        update: (dt: number) => {
          pb.update(dt);
          [hero, foe].forEach((a, i) => {
            const st = anim[i]!;
            const dir = i === 0 ? 1 : -1;
            st.lunge = Math.max(0, st.lunge - dt / 220);
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
    [spec, res],
  );

  const won = res.outcome.attackerWon;
  const delta = res.outcome.honorDelta;
  return (
    <>
      <Diorama key={res.seed} setup={setup} />
      <div className="fight-hud">
        <div className="hpbars">
          {bars.map((b, i) => (
            <div key={i} className="hp">
              <div className="label">
                <span>{b.name}</span>
                <span>
                  {b.hp}/{b.maxHp}
                </span>
              </div>
              <div className={`bar ${b.side === 'enemy' ? 'enemy' : ''}`}>
                <span style={{ width: `${b.maxHp > 0 ? Math.max(0, (b.hp / b.maxHp) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="fight-controls">
          {done ? (
            <div className="col" style={{ gap: 8, alignItems: 'center' }}>
              <div className="title">
                {won ? 'Victory' : 'Defeated'} · {delta >= 0 ? '+' : ''}
                {delta} Honor
                {res.outcome.keyAwarded ? ' · 🗝 Champion’s Key!' : ''}
              </div>
              {res.outcome.defenderReward && (
                <div className="muted">
                  {res.defender.name} defended — they earn +{res.outcome.defenderReward.honor} Honor,
                  ◈{res.outcome.defenderReward.marks}
                </div>
              )}
              <button className="primary" onClick={clear}>
                Back to the Board
              </button>
            </div>
          ) : (
            <>
              <button className="small" onClick={() => pbRef.current && (pbRef.current.speed = 1)}>
                1×
              </button>
              <button className="small" onClick={() => pbRef.current && (pbRef.current.speed = 2)}>
                2×
              </button>
              <button className="small ghost" onClick={() => pbRef.current?.skip()}>
                Skip
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Board() {
  const board = useStore((s) => s.skirmishBoard);
  const busy = useStore((s) => s.busy);
  const attack = useStore((s) => s.attack);
  const setView = useStore((s) => s.setView);
  if (!board) return <div className="card center">Scouting the Rival Board…</div>;

  return (
    <div className="col grow" style={{ overflow: 'auto', padding: 12, gap: 12 }}>
      <div className="card row spread">
        <div className="title">Skirmishes</div>
        <div className="row" style={{ gap: 14 }}>
          <span className="muted" title="Attacks left today">
            🎟 {board.tickets.remaining}/{board.tickets.cap}
          </span>
          <span className="muted" title="Champion’s Keys → Vault of Champions">
            🗝 {board.keys}/{board.keysForVault}
          </span>
        </div>
      </div>

      {!board.defense && (
        <div className="card muted">
          You have no defense snapshot yet — start a run to forge one, then rivals can be fought.
        </div>
      )}

      <div className="doors">
        {board.board.length === 0 && (
          <div className="card muted">No rivals in range yet. Climb — the tower fills up.</div>
        )}
        {board.board.map((r) => (
          <div key={r.accountId} className={`card door ${r.band}`}>
            <div className="kind">{r.band}</div>
            <div className="title" style={{ fontSize: 18 }}>
              {r.name}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {r.class} · Floor {r.floor} · {r.honor} Honor
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {BAND_LABEL[r.band]}
            </div>
            <div className="muted grow" />
            <button
              className="primary small"
              disabled={busy || board.tickets.remaining <= 0 || !board.defense}
              onClick={() => void attack(r.accountId)}
            >
              Attack · 🎟
            </button>
          </div>
        ))}
      </div>

      <div className="row">
        <button className="ghost" onClick={() => setView('gate')}>
          ← The Gate
        </button>
      </div>
    </div>
  );
}

export function Skirmish() {
  const result = useStore((s) => s.skirmishResult);
  const fetchSkirmish = useStore((s) => s.fetchSkirmish);
  useEffect(() => {
    void fetchSkirmish();
  }, [fetchSkirmish]);
  return result ? <DuelReplay res={result} /> : <Board />;
}
