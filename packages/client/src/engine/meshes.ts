/**
 * Procedural meshes (ART_DIRECTION §2, §3). Every actor is built from Three.js
 * primitives — zero binary assets. These are Phase 1 "recognisable silhouettes":
 * a shared hero rig and a small creature kit for the Gatehouse. Full family
 * builders + the Icon Baker + Zenith variants land in Phase 4.
 */

import * as THREE from 'three';

function flat(color: number, emissive = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.05,
    emissive: new THREE.Color(emissive),
    flatShading: true,
  });
}

/** A humanoid rig (torso, head, limbs) — the hero and humanoid enemies share it. */
function humanoid(bodyColor: number, accent: number, scale: number): THREE.Group {
  const g = new THREE.Group();
  const body = flat(bodyColor);
  const trim = flat(accent, accent);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), body);
  torso.position.y = 1.0;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.38), body);
  head.position.y = 1.68;
  g.add(head);

  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.5), trim);
  shoulders.position.y = 1.4;
  g.add(shoulders);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), body);
    arm.position.set(side * 0.44, 1.05, 0);
    g.add(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.24), body);
    leg.position.set(side * 0.18, 0.35, 0);
    g.add(leg);
  }
  g.scale.setScalar(scale);
  return g;
}

/** A simple blade held in the hero's right hand (silhouette flavour). */
function blade(accent: number): THREE.Group {
  const g = new THREE.Group();
  const steel = flat(0xb9c0cc, 0x0a0c10);
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.02), steel);
  b.position.y = 0.45;
  g.add(b);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), flat(accent, accent));
  g.add(guard);
  g.position.set(0.5, 1.0, 0.1);
  g.rotation.z = -0.15;
  return g;
}

export interface Actor {
  group: THREE.Group;
  /** Local baseline so animations can return to rest. */
  baseX: number;
}

export function buildHero(accent: number, heroColor: number): Actor {
  const group = humanoid(heroColor, accent, 1.0);
  group.add(blade(accent));
  return { group, baseX: 0 };
}

/** Enemy body plans for the Gatehouse roster + boss (creatureBuilder Phase 1 subset). */
export function buildEnemy(enemyId: string, accent: number): Actor {
  const g = new THREE.Group();
  if (enemyId === 'tunnel_rat' || enemyId === 'toll_shirker') {
    // Low quadruped-ish blob with a snout.
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.5), flat(0x6d5a4a));
    body.position.y = 0.4;
    g.add(body);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.22), flat(0x4a3d32));
    snout.position.set(-0.55, 0.4, 0);
    g.add(snout);
    g.scale.setScalar(0.8);
  } else if (enemyId === 'toll_keeper') {
    // Bigger humanoid with a bell.
    const h = humanoid(0x4a4550, accent, 1.5);
    g.add(h);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.7, 8), flat(accent, accent));
    bell.position.set(0.9, 1.9, 0);
    bell.rotation.z = Math.PI;
    g.add(bell);
  } else {
    // Bandit / Ferryman: a hooded humanoid.
    g.add(humanoid(enemyId === 'two_coin_ferryman' ? 0x3a4a44 : 0x5a4a3a, accent, 1.05));
  }
  return { group: g, baseX: 0 };
}

export function buildLantern(accent: number): THREE.Group {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.42, 0.3),
    new THREE.MeshStandardMaterial({
      color: accent,
      emissive: new THREE.Color(accent),
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.9,
    }),
  );
  g.add(glass);
  const light = new THREE.PointLight(accent, 6, 14, 2);
  light.position.set(0, 0, 0);
  g.add(light);
  return g;
}

/** A slab of tower floor for the diorama to stand on. */
export function buildFloor(base: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.6, 6),
    new THREE.MeshStandardMaterial({ color: base, roughness: 0.95, flatShading: true }),
  );
  m.position.y = -0.3;
  m.receiveShadow = true;
  return m;
}
