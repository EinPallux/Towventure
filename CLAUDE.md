# CLAUDE.md

Read **[AGENTS.md](AGENTS.md)** first — it is the full working agreement (project summary, doc hierarchy, invariants, definition of done). Everything there applies to Claude Code sessions verbatim.

## Session quick-start

1. `git log --oneline -15` + [CHANGELOG.md](CHANGELOG.md) → what's been built.
2. [ROADMAP.md](ROADMAP.md) → current phase and its exit criteria. Work the current phase.
3. Design questions are answered by docs, in this order: [docs/GDD.md](docs/GDD.md) → [docs/BALANCE.md](docs/BALANCE.md) / [docs/CONTENT.md](docs/CONTENT.md) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) / [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) / [docs/OPERATIONS.md](docs/OPERATIONS.md). Don't re-derive decided things.

## Hard rules most likely to bite you (full list in AGENTS.md §3)

- No floats / `Math.random` / `Date` / key-order iteration inside `packages/shared` sim & run code. Seeded RNG only. Golden-hash changes must be explicit and explained.
- Client renders and sends commands; the server decides everything. No client-trust shortcuts "for now".
- `packages/shared` has zero dependencies. Content and constants are authored in docs/CONTENT.md and docs/BALANCE.md **before** code, and kept in lockstep in the same PR.
- No binary assets in the repo — all art/audio is procedural (docs/ART_DIRECTION.md §2).
- Honor/Marks move only via ledger rows, transactionally.

## Verification bar

Before ending a session: `pnpm typecheck && pnpm lint && pnpm test` green (plus `pnpm harness` once it exists, for content changes), and if you touched fight playback or UI, actually run the client and watch a fight. Prefer finishing one vertical unit over many fragments.
