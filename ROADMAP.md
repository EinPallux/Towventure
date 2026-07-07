# Towventure — Development Roadmap

> Five phases. Each one ships a complete pillar of the game and ends with the game **better and playable**, never half-wired. No phase is "plumbing only" and none is "polish only" except where polish IS the pillar (Phase 4). Exit criteria are contracts: a phase is not done until every box checks on the live VPS (staging), not on localhost.
>
> Source-of-truth docs: [docs/GDD.md](docs/GDD.md) · [docs/CONTENT.md](docs/CONTENT.md) · [docs/BALANCE.md](docs/BALANCE.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) · [docs/OPERATIONS.md](docs/OPERATIONS.md)
> Working agreement for sessions: [AGENTS.md](AGENTS.md). Every phase completion gets a [CHANGELOG.md](CHANGELOG.md) entry.

---

## Phase 0 — The Plan ✅ *(this repository state)*

Full design, architecture, content, balance, art, and ops documentation. Exit: these documents merged.

---

## Phase 1 — **The Heartbeat** (online vertical slice: climb, fight, die, rank)

**The pillar:** a real online game exists. Two people with two accounts can each climb the tower on the production-shaped stack, watch deterministic 3D auto-battles, die, and see each other on a ladder.

**Scope:**
- Monorepo + CI skeleton (typecheck, lint, vitest, golden-test wiring) per [ARCHITECTURE.md](docs/ARCHITECTURE.md) §2.
- `shared/sim` v1: full determinism contract (integer math, xoshiro RNG, golden tests), core stats, weapon cooldowns, trigger set (`OnHit/OnCrit/OnHurt/OnBlock/OnDodge/Every/OnFightStart/OnHpBelow/OnDoomfall`), first 5 statuses (Bleed, Burn, Chill, Regen, Ward), Doomfall.
- `shared/run` v1: floors, door generation (Battle/Elite/Shop minimal/Boss), loot, gold, equip, **fusion ★1–★5 with stat scaling** (Awakened/Zenith effect lines land in Phase 2), sell.
- Server: auth (register/login/guest), sessions, run lifecycle, command route with state versioning, fight route (seed → result), Postgres schema v1 + migrations, honor ledger + climb honor, global ladder.
- Client: Vite+React+Three shell; The Gate (menu) scene; fight diorama with procedural hero + Gatehouse enemy set + playback from seed; hero screen with equip/backpack/fuse (functional drag-drop, pre-juice); death screen v1 with honor tally.
- Content: Vanguard class, ~25 items (anchor Commons/Uncommons from [CONTENT.md](docs/CONTENT.md)), Gatehouse biome (floors 1–10+ looping with scaling as placeholder), Toll-Keeper boss.
- Ops: docker-compose (caddy/app/pg), staging deploy on the VPS, nightly backup cron live from day one, `/healthz`, pino logs.

**Exit criteria:**
- [ ] Two fresh accounts on **staging VPS** can register, run, fight, fuse, die, and appear ranked on the global ladder — from a phone browser and a laptop.
- [ ] Golden replay suite green; a fight replayed on 3 different browsers hash-matches the server.
- [ ] Server survives a 200-VU k6 smoke on commands with p95 < 100ms.
- [ ] Backup cron has produced a restorable dump (restored once, manually).
- [ ] A suspended run resumes correctly on another device.

---

## Phase 2 — **The Hoard** (the full build engine & solo game)

**The pillar:** the hero-building game is complete and *deep*. All systems a solo climber touches: every item, status, trigger, class, shop, event, and the first half of the tower's authored content.

**Scope:**
- Sim completion: all 10 statuses, full trigger vocabulary, Awakened (★3) + Zenith (★5) effect lines, consumable auto-trigger conditions, tag synergy thresholds, slot resolution order UI.
- Content completion wave 1 (authored in [CONTENT.md](docs/CONTENT.md) **first**, then transcribed): all ~120 items with effects + infusion sockets + materials; Duelist & Arcanist classes; biomes 1–5 (floors 1–50) with full enemy rosters, elites, bosses 1–5; 20 events; all 10 Vows; consumables.
- Shop system per GDD §5: Requested Copy slot, rerolls, pity, materials/consumables stock; Sanctum floors.
- Hero screen at full function: infusions, consumable conditions, tooltips with next-★ preview, build tag meter, sell/overflow flow.
- **Balance harness** (`packages/harness`) with policy bots + CI gates per [BALANCE.md](docs/BALANCE.md) §9 — from here on, content merges are gated.
- Codex v1 (discovery + lore unlock), run summary/share-card v1 (PNG render).

**Exit criteria:**
- [~] All ~120 items implemented (launch quotas met in `content/items.ts`: 30 weapons / 14 helm / 14 armor / 14 boots / 32 trinkets / 3 satchels / 3 relics, count-tested). Harness release gates print (BALANCE §9) — the per-item ±8% cohort gate needs item-tagged policy sims (follow-up); model recipes + signature VFX/sound are Phase 3 polish-as-pillar.
- [x] Floors 1–50 authored (Gardens/Archive/Foundry/Chapel rosters + bosses 2–5; some enemy sub-mechanics deferred per CONTENT §4); the floor-50 Prior of Teeth wall behaves per design (status-density self-heal modelled, verified by golden + unit + harness).
- [x] All 3 classes playable with distinct harness death-floor profiles (Vanguard sturdy, Duelist deepest via crit+Haste, Arcanist high-variance).
- [x] A designer can add a complete item by editing CONTENT.md + one data file, no engine changes — proven live (the catalogue buildout added ~80 items, several whole commits pure content with zero engine edits).
- [ ] Playtest: 3 humans each report at least one "one more floor" session ≥30 min unprompted.

Systems complete this phase: 10 statuses + full trigger/effect vocabulary; fusion + infusion; consumable auto-triggers; tag synergies; events (door type); vows (Honor multiplier); Codex v1 with cross-run persistence; two live Zenith transforms; harness release gates. Remaining Phase-2-adjacent follow-ups (mostly Phase-3-blocked): per-item win-rate cohorts, the Echo/Sanctum/substat-dependent vows and events, weapon-echo/per-Armor/Burn-spread ops, and VFX/audio.

---

## Phase 3 — **The Living Tower** (every multiplayer system)

**The pillar:** other players become content. Echoes, Skirmishes, Honor society, and the social scaffolding — the game's reason to be online.

**Scope:**
- **Echoes** end-to-end per GDD §8: death snapshot, placement/offer algorithm (friends-first), Echo fights with AI bonus + staleness decay, bounty/Grave-Copy rewards, defender notifications + Marks, 3-defeat/14-day lifecycle, house-Echo seeding for onboarding, profile Echo display.
- **Skirmishes** per GDD §9: defense snapshots + pinning, rival board, tickets, Elo honor, Champion's Keys + Vault of Champions, duel cards (shareable PNG), anti-farm decay.
- Honor tiers + unlock wiring (classes/Vows/tickets); Valor Marks + Honor Merchant (cosmetics: weapon trails, Echo auras, banners, titles; War Chest boons).
- Ladders: global/weekly/friends/Echo-kills/Unnumbered top-100, materialized + paginated with pinned self-row.
- **Daily Gauntlet** (shared seed, class rotation, its own ladder + honor pot).
- Friends (request/accept), profiles/Hall of Echoes, feed events, inbox + WS toasts.
- Seasons **data model + placement math** live (the rollover job ships here, first real rollover happens in Phase 5's season 1).

**Exit criteria:**
- [ ] Die on staging → within one minute your Echo is encounterable by another account near that floor, kills pay bounty + Grave-Copy, your account gets the notification and Marks when your Echo wins.
- [ ] Full Skirmish loop: attack from rival board, watch replay, honor moves per Elo, keys → Vault purchase works; defender risk-free confirmed.
- [ ] Two friends see each other's feed events (floor milestone, Zenith forge, Echo kill) within seconds via WS.
- [ ] Gauntlet: two accounts, same day → identical drops/doors/shops; separate ladder pays out at UTC close.
- [ ] Every honor/mark movement traces to a ledger row; economy audit query balances to zero drift.

---

## Phase 4 — **The Spectacle** (content back half + the juice constitution)

**The pillar:** the game becomes *gorgeous and finished-feeling*, and the tower gets its endgame. This phase is polish-as-pillar, plus biomes 6–10 — the two belong together because bosses ARE set pieces.

**Scope:**
- Content wave 2: biomes 6–10 (floors 51–100) — Menagerie, Vault, **Gallery of Mirrors** (Mirrorkin/Understudy/Curator mirror-match), Court, Crown; bosses 6–10 incl. the Sleepless Warden; **Torments** system for 100+; Mythic items.
- Full [ART_DIRECTION.md](docs/ART_DIRECTION.md) execution: Icon Baker, per-item signature VFX + synthesized SFX, Fusion Ceremony + Zenith set piece, hit-stop/camera/killcam, damage-number typography, status VFX vocabulary, death ritual, The Gate final scene, generative music per biome, fight speed 2×/skip rules.
- Onboarding per GDD §12 (first-run guided beats, house Echo, 25-minute-to-first-death target measured with telemetry).
- Settings & accessibility: reduced motion, colorblind-safe status palette, volume mixers, keybinds; performance pass (60fps mid-fight on iGPU; bundle ≤900KB gz).
- Share cards final (death + duel), Codex complete with all lore.

**Exit criteria:**
- [ ] Floors 1–100 fully authored + Torments beyond; Sleepless Warden first-clear grants The Sleepless Crown.
- [ ] The §9 ART acceptance bar passes with a cold audience (stranger test on 3 people).
- [ ] Every item demonstrably has: unique model, signature VFX, signature sound, Zenith transform (spot-audited 20 random items).
- [ ] New-account telemetry: median time-to-first-death ≤ 25 min, and ≥80% of testers reach it without asking a question.
- [ ] 60fps fight playback on the reference iGPU laptop; Lighthouse perf ≥ 85 on The Gate.

---

## Phase 5 — **The Opening of the Gates** (season 1, hardening, release)

**The pillar:** Towventure 1.0, live on the owner's domain, operable by one person, with its first competitive season running.

**Scope:**
- Season 1: rollover executed for real (placement compression, ladder reset, Vault rotation), season end-date UI, rewards (titles/banners/auras), Lifetime Honor display.
- Balance release pass: full harness sweep vs. every gate + structured human playtest round; final constants locked and mirrored to [BALANCE.md](docs/BALANCE.md).
- Live-ops: `/admin` per [OPERATIONS.md](docs/OPERATIONS.md) §6 (bans, run-repair, Echo takedown, content kill-switch, broadcast), anomaly reports.
- Hardening: k6 load test at 1k VU sustained, rate-limit tuning, security pass (headers, authz audit on every route, dependency audit), error pages, legal pages.
- Ops finalization: prod compose on the VPS, monitoring + alert list live (§OPS 7), **restore drill executed and documented**, deploy-tag pipeline proven with a rollback rehearsal.
- Launch: DNS/TLS, staging soak week, day-1 Gauntlet seed, announcement post + press-kit screenshots (the share-card pipeline makes these).

**Exit criteria:**
- [ ] `https://<domain>` serves the game; a stranger can register and play to their first death with zero operator involvement.
- [ ] Season 1 live with a visible end date; rollover rehearsed on staging with real data copied from prod.
- [ ] Restore drill: prod backup → staging restore → login → resume run, documented in OPERATIONS.md.
- [ ] 1k-VU load test: p95 within targets, zero 5xx, no memory creep over 2h.
- [ ] Admin panel: ban, repair, kill-switch each exercised once on staging.
- [ ] Every earlier phase's exit criteria still green (full regression pass) — **then tag `v1.0.0` and open the gates.**

---

## After 1.0 (parking lot, explicitly out of scope until shipped)

Discord OAuth + rich presence · web push · seasonal mechanical wrinkles (new Vow/event/Torment per season) · spectate links for shared replays (seed + build = a URL — cheap and huge) · mobile layout pass · localization · community item-design contests (author in CONTENT.md, ship in a season).
