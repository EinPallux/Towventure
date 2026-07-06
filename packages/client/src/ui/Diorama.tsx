import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface DioramaHandle {
  update?: (dtMs: number) => void;
  dispose?: () => void;
}

/**
 * A self-contained Three.js canvas. `setup` builds the scene once and returns an
 * optional per-frame `update` and `dispose`. The scene lives entirely outside
 * React (ARCHITECTURE §1) — React never re-renders it. Pass a stable `setup`
 * (memoize it) or remount via `key` when the fight changes.
 */
export function Diorama({
  setup,
  className,
}: {
  setup: (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => DioramaHandle;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 2.4, 8);
    camera.lookAt(0, 1.2, 0);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width || window.innerWidth));
      const h = Math.max(1, Math.round(rect.height || window.innerHeight));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const handle = setup(scene, camera);

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      handle.update?.(dt);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    // ResizeObserver corrects the drawing buffer after layout settles (fixes the
    // 0/partial-size first paint) and on any subsequent resize.
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      handle.dispose?.();
      // Free GPU resources so many fights in a session don't leak (ART pass Phase 4
      // refines this; the correctness of releasing geometries/materials is here now).
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      });
      scene.clear();
      renderer.dispose();
    };
  }, [setup]);

  return <canvas ref={ref} className={className ?? 'scene-canvas'} />;
}

/** Shared warm-lantern lighting for every diorama. */
export function addLanternLighting(scene: THREE.Scene, accent: number): void {
  scene.add(new THREE.AmbientLight(0x3a3550, 0.7));
  const key = new THREE.PointLight(accent, 40, 40, 2);
  key.position.set(2.5, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6a7fb0, 0.5);
  rim.position.set(-4, 3, -2);
  scene.add(rim);
}
