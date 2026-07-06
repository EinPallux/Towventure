/**
 * @towventure/shared — the heart. Deterministic sim, run reducers, authored
 * content, and protocol schemas. Zero workspace deps; the shipped lib is Node-free
 * (ARCHITECTURE §2). Import subpaths (`@towventure/shared/sim`, `/run`, `/content`,
 * `/protocol`) for narrower surfaces.
 */
export * as sim from './sim/index.js';
export * as run from './run/index.js';
export * as content from './content/index.js';
export * as protocol from './protocol/index.js';
