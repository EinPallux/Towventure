import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { biomeForFloor, getEnemy } from '@towventure/shared/content';
import { prepareFight } from '@towventure/shared/run';
import { AudioEngine } from '../engine/audio.js';
import { buildEnemy, buildFloor, buildHero, buildLantern, type Actor } from '../engine/meshes.js';
import { paletteForBiome } from '../engine/palettes.js';
import { Playback } from '../engine/playback.js';
import { useStore } from '../store.js';
import { Diorama, addLanternLighting } from './Diorama.js';

/** Status → edge-pulse colour (the status VFX vocabulary, ART_DIRECTION §5). */
const STATUS_COLOR: Record<string, string> = {
  bleed: '#d8564e',
  burn: '#ff7a33',
  chill: '#7fc8ff',
  regen: '#76c893',
  ward: '#cbd5e1',
  venom: '#8fd14f',
  shock: '#ffe066',
  weaken: '#9a8cff',
  sunder: '#d0a24c',
  haste: '#66e0c0',
};

/** A colourblind-safe status palette (ART_DIRECTION §9): a hue spread that avoids the
 * red-green and blue-yellow confusions, so the ten statuses stay distinguishable. */
const STATUS_COLOR_CB: Record<string, string> = {
  bleed: '#e0662a', // orange
  burn: '#ffb14e', // amber
  chill: '#56b4e9', // sky blue
  regen: '#0072b2', // deep blue
  ward: '#e6e6e6', // near-white
  venom: '#009e73', // teal-green (distinct from blues)
  shock: '#f0e442', // yellow
  weaken: '#cc79a7', // pink
  sunder: '#8c6d1f', // brown
  haste: '#23b5b5', // cyan
};

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
  const settings = useStore((s) => s.settings);

  const [hp, setHp] = useState<Hp[]>([]);
  const [nums, setNums] = useState<DmgNum[]>([]);
  const [doomfall, setDoomfall] = useState(false);
  const [done, setDone] = useState(false);
  const [statusFlash, setStatusFlash] = useState<{ color: string; key: number } | null>(null);
  const pbRef = useRef<Playback | null>(null);
  const numId = useRef(0);
  const flashId = useRef(0);

  // prepareFight handles both normal fights and Echo duels — the same builder the
  // server used, so the client re-sims to the identical hash (ARCHITECTURE §3).
  const spec = useMemo(() => (playback ? (prepareFight(playback.preState)?.spec ?? null) : null), [playback]);
  const isEcho = playback?.preState.pendingFight?.kind === 'echo';

  // Keybinds (ART_DIRECTION §9 / GDD §12): 1×/2× speed and Skip from the keyboard.
  useEffect(() => {
    if (!playback) return;
    const onKey = (e: KeyboardEvent) => {
      const pb = pbRef.current;
      if (!pb) return;
      if (e.key === '1') pb.speed = 1;
      else if (e.key === '2') pb.speed = 2;
      else if (e.key === ' ' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        pb.skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playback]);

  const setup = useCallback(
    (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => {
      if (!spec || !playback) return {};
      // Render the fight in its actual biome's palette (was hardcoded to gatehouse).
      const biomeId = biomeForFloor(playback.preState.floor).id;
      const pal = paletteForBiome(biomeId);
      const reduced = settings.reducedMotion;
      const statusPalette = settings.colorblind === 'off' ? STATUS_COLOR : STATUS_COLOR_CB;
      scene.fog = new THREE.Fog(0x0d0b11, 10, 26);
      addLanternLighting(scene, pal.accent);
      scene.add(buildFloor(pal.base));
      const lantern = buildLantern(pal.accent);
      lantern.position.set(0, 4, 2);
      scene.add(lantern);
      const camHome = new THREE.Vector3(0, 3.1, 10.5);
      camera.position.copy(camHome);
      camera.lookAt(0, 1.1, 0);

      // Procedural audio, seeded by the biome accent. Resumed on first control click.
      const audio = new AudioEngine({
        accent: pal.accent,
        sfxVolume: settings.sfxVolume,
        musicVolume: settings.musicVolume,
      });
      audio.resume();
      audio.startMusic();

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
      const anim = actors.map(() => ({ lunge: 0, dead: false, deadT: 0, recoil: 0 }));
      // Juice state (all gated by reduced-motion): camera shake, hit-stop, killcam.
      let shake = 0;
      let hitStop = 0;
      let deadIdx = -1;
      let killcamT = 0;

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
          audio.swing();
        },
        onHit: (_from, to, crit) => {
          // Hit-stop + shake sell the impact; the struck actor recoils; sound scales by crit.
          if (anim[to]) anim[to].recoil = 1;
          audio.hit(crit);
          if (!reduced) {
            hitStop = crit ? 90 : 55;
            shake = Math.min(1, shake + (crit ? 0.5 : 0.28));
          }
        },
        onStatus: (idx, status) => {
          // A brief edge-pulse in the status's colour — legible without mesh surgery.
          setStatusFlash({ color: statusPalette[status] ?? '#cbd5e1', key: flashId.current++ });
          void idx;
        },
        onDeath: (idx) => {
          if (anim[idx]) anim[idx].dead = true;
          audio.death();
          if (!reduced) {
            deadIdx = idx;
            killcamT = 0;
            shake = 1;
          }
        },
        onDamageNumber: (idx, text, kind) => {
          pushNum(idx, text, kind);
          if (kind === 'dot') audio.dot();
          else if (kind === 'heal') audio.heal();
        },
        onDoomfall: () => {
          setDoomfall(true);
          audio.doomfall();
        },
        onEnd: (winner) => {
          setDone(true);
          audio.end(winner === 'hero');
        },
      });
      pb.speed = settings.fightSpeed;
      pbRef.current = pb;

      let t = 0;
      return {
        update: (dtRaw: number) => {
          // Hit-stop freezes the sim clock (not the render) for a beat after impacts.
          let dt = dtRaw;
          if (hitStop > 0) {
            const cut = Math.min(hitStop, dtRaw);
            hitStop -= dtRaw;
            dt = Math.max(0, dtRaw - cut);
          }
          pb.update(dt);
          t += dtRaw / 1000;
          lantern.position.y = 4 + Math.sin(t * 1.3) * 0.05;

          // Camera: a decaying shake around home, and a killcam push toward the fallen.
          shake = Math.max(0, shake - dtRaw / 300);
          const target = camHome.clone();
          if (deadIdx >= 0 && actors[deadIdx]) {
            killcamT = Math.min(1, killcamT + dtRaw / 900);
            const dead = actors[deadIdx]!.group.position;
            target.lerp(new THREE.Vector3(dead.x * 0.5, 2.2, 7.5), killcamT * 0.6);
          }
          if (!reduced && shake > 0) {
            const a = shake * shake * 0.35;
            target.x += Math.sin(t * 90) * a;
            target.y += Math.cos(t * 77) * a;
          }
          camera.position.lerp(target, reduced ? 1 : 0.35);
          camera.lookAt(0, 1.1, 0);

          actors.forEach((a, i) => {
            const st = anim[i]!;
            const dir = i === 0 ? 1 : -1;
            st.lunge = Math.max(0, st.lunge - dtRaw / 220);
            st.recoil = Math.max(0, st.recoil - dtRaw / 160);
            // Lunge = forward lean toward the enemy line; recoil = a struck-back scale pop.
            a.group.rotation.z = dir * st.lunge * 0.25;
            if (st.dead) {
              st.deadT = Math.min(1, st.deadT + dtRaw / 500);
              a.group.scale.setScalar(1 - st.deadT * 0.9);
              a.group.rotation.x = st.deadT * 1.2;
            } else {
              a.group.scale.setScalar(1 + st.recoil * 0.14);
            }
          });
        },
        dispose: () => {
          audio.dispose();
          pbRef.current = null;
        },
      };
    },
    [spec, playback, isEcho, settings],
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
      {statusFlash && (
        <div
          key={statusFlash.key}
          className="status-flash"
          style={{ boxShadow: `inset 0 0 120px 24px ${statusFlash.color}55` }}
        />
      )}
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
