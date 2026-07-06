/** Deterministic combat sim — the load-bearing wall (ARCHITECTURE.md §4). */
export * from './constants.js';
export * from './types.js';
export { Rng, mixSeed } from './rng.js';
export { RollingHash, hashInts } from './hash.js';
export { simulate } from './engine.js';
