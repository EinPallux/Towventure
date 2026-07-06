/**
 * Deterministic RNG — xoshiro128** (32-bit), the single source of randomness in
 * the sim (ARCHITECTURE.md §4.2). Every draw goes through here; draw order is
 * fixed by the resolution order in BALANCE.md §1. No `Math.random`, ever.
 *
 * All arithmetic is uint32. `Math.imul` gives us 32-bit multiplication with
 * wraparound; `>>> 0` coerces back to unsigned after XOR/shift/add. The stream
 * is bit-identical on Node and every browser — that is the whole point.
 */

const U32 = 0xffffffff;

function rotl(x: number, k: number): number {
  return (((x << k) | (x >>> (32 - k))) & U32) >>> 0;
}

/**
 * splitmix32 — expands a single 32-bit seed into the four state words xoshiro
 * needs, and avoids the all-zero state (which xoshiro cannot escape).
 */
function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad) >>> 0;
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97) >>> 0;
    return (t ^ (t >>> 15)) >>> 0;
  };
}

export class Rng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number) {
    const sm = splitmix32(seed >>> 0);
    this.s0 = sm();
    this.s1 = sm();
    this.s2 = sm();
    this.s3 = sm();
    // Guard against the degenerate all-zero state.
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1;
  }

  /** Next raw 32-bit unsigned integer. */
  nextU32(): number {
    const result = (Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7) >>> 0, 9) & U32) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  /**
   * Uniform integer in [0, n). Modulo is used deliberately: it is fully
   * deterministic and the tiny bias at game-sized `n` is irrelevant, whereas
   * rejection sampling would make the number of draws data-dependent and
   * complicate cross-checking draw order.
   */
  nextInt(n: number): number {
    if (n <= 1) return 0;
    return this.nextU32() % n;
  }

  /** Roll a percentage chance: true `pct`% of the time (pct is an integer 0..100). */
  chance(pct: number): boolean {
    if (pct <= 0) return false;
    if (pct >= 100) return true;
    return this.nextInt(100) < pct;
  }

  /** Pick an element by index; caller must ensure the array is non-empty. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.nextInt(arr.length)] as T;
  }

  /** Snapshot the four state words (for debugging / test introspection). */
  state(): [number, number, number, number] {
    return [this.s0, this.s1, this.s2, this.s3];
  }
}

/**
 * Derive a fresh 32-bit seed by mixing several integers (e.g. runSeed + floor +
 * counter). Order-sensitive and collision-resistant enough for seed derivation;
 * NOT a security primitive. Uses the same splitmix mixing as the RNG so it is
 * identical across platforms.
 */
export function mixSeed(...parts: number[]): number {
  let h = 0x811c9dc5 >>> 0;
  for (const p of parts) {
    let x = p >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0;
    x = (x ^ (x >>> 15)) >>> 0;
    h = (h ^ x) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
