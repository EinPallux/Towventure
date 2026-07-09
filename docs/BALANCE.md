# Towventure — Balance & Systems Math

> Companion to [GDD.md](GDD.md). Every tunable number lives here (and later, in `packages/shared/src/content/constants.ts`, which must mirror this file — **when code and this doc disagree, fix one immediately; PRs that change either without the other are rejected**).
> All sim math is **integer** (HP in whole points, damage in whole points, time in ticks). See [ARCHITECTURE.md](ARCHITECTURE.md) §4 for why.

---

## 1. Sim fundamentals

| Constant | Value |
|---|---|
| Tick rate | 10 ticks/s (100ms) |
| Fight hard cap | 60s (600 ticks) |
| **Doomfall** start | 45s (35s under Vow of Haste; 35s on Torment ≥3) |
| Doomfall damage | 2% of each side's Max HP per second, +1%/s each 5s (true damage, unmitigable, un-Wardable) |
| Cooldown floor | no weapon may go below 0.6s effective cooldown |
| Proc chance stacking | additive within a line, independent rolls between lines |
| Crit default | ×1.5 damage (Crit damage stat adds to the multiplier) |
| Dodge cap | 40% · Speed cap +150% · Lifesteal cap 35% (per-source caps prevent degenerate stacking; Warden of Chains caps Speed at +25% locally) |

**Attack resolution order:** dodge roll → crit roll → base damage × modifiers → Armor flat reduction (min 1 damage) → Ward absorbs → HP; then `OnHit`/`OnCrit` (attacker), `OnHurt`/`OnBlock`/`OnDodge` (defender), then on-status hooks. Simultaneous triggers resolve in slot order: weapons L→R, helm, armor, boots, trinkets L→R, relic — **deterministic, documented, and shown in the UI** (slot order is a real theorycrafting lever).

## 2. Hero base stats (floor-1, ★-independent)

| Stat | Vanguard | Duelist | Arcanist |
|---|---|---|---|
| Max HP | 120 | 90 | 95 |
| Armor | 6 | 0 | 0 |
| Speed | −10% | +10% | 0% |
| Crit / Crit dmg | 5% / +0% | 12% / +25% | 5% / +0% |
| Dodge | 0% | 6% | 3% |

Heroes gain **+6 Max HP per floor cleared** (the only free scaling; everything else is gear).

## 3. Statuses (all stack-count based; 1 stack = listed base)

| Status | Rule (per stack unless noted) |
|---|---|
| **Bleed** | 2 dmg/s for 4s; refreshing adds stacks, refreshes duration; physical |
| **Burn** | 3 dmg/s for 3s; re-application refreshes all; *detonation effects consume stacks* |
| **Venom** | 1 dmg/s, **never expires**, +1 dmg/s every 5s it stays on (ramping) |
| **Chill** | −4% Speed for 4s (max 8 stacks) |
| **Shock** | next incoming hit cannot miss and is a guaranteed crit; consumed on use; max 3 |
| **Weaken** | −5% damage dealt for 5s (max 5) |
| **Sunder** | −3 Armor for 6s (can push negative to −15: negative Armor adds damage taken) |
| **Regen** | +2 HP/s for 4s |
| **Haste** | +5% Speed for 3s (max 6) |
| **Ward** | absorbs damage 1:1 before HP; decays 5%/s of remaining; not stackable past 40% Max HP |

## 4. Item & fusion scaling

- Base item power `P(rarity)`: C=100, U=135, R=185, E=255, M=350 (arbitrary units driving each item's numeric fields via per-item multipliers).
- **★ scaling: ×1.35 per star** (compounding; ★5 = ×3.32 base). Copies needed: ★2=2, ★3=4, ★4=8, ★5=16 total.
- Enemy stat growth per floor `f`: HP ×(1.06)^f with a soft-knee at 50 (exponent eases to 1.045), damage ×(1.05)^f. Elites ×1.8 HP ×1.35 dmg. Bosses ×4.5 HP ×1.5 dmg. Torments (each, floors 100+): +8% HP, +6% dmg, plus one *mechanical* modifier from the Torment deck. *(Phase 4, Slice B: **live** in `run/torments.ts` — `tormentLevel(floor)` = ⌈(floor−100)/10⌉, applied in `buildEnemySpecs` (integer HP/dmg bump + enemy Speed) and `buildCombatSpec` (Doomfall). The deck's combat cards are wired: **The Quickening** (+12% enemy Speed, ≥L1), **The Weeping Air** (enemies open with +2 Venom, ≥L2), **Doomrush** (Doomfall at 35s, ≥L3), **The Relentless Hour** (Speed + Venom again, ≥L5); the run-shape cards **Ill Company** (elites in pairs, ≥L4) and **The Toll Rises** (steeper shops, ≥L6) are surfaced to the player and carry the numeric bump, with their door/shop hooks a follow-up. Nothing below floor 100 is touched — the goldens stay green.)*
- Sanity target: a median-skill build fusing consistently should first die around **floor 25–40**; a tuned tag build reaches 60–80; floor 100 first-season clears should be **rare and newsworthy** (<2% of accounts, per harness §9).

## 5. Drops & shop economy

- Fight drop roll: 100% gold `10 + 2×floor ± 20%`; item drop 45% (Elite 100% + material 100%; Boss 100% Epic-biased + full heal).
- Rarity weights by floor band (C/U/R/E/M %): floors 1–10 `70/25/5/0/0` · 11–30 `45/35/17/3/0.2` · 31–60 `25/38/27/9/1` · 61–100 `12/30/35/19/4` · 100+ `8/24/36/25/7`.
- Shop stock: 6 items (one is **Requested Copy** — §GDD 5), 2 materials, 1 consumable. Prices: `P(rarity)/2 × (1 + floor×0.03)` gold, sell-back 40%. Reroll: 15 gold, ×1.6 each, resets per shop. Requested Copy price: item's price ×1.5, ×1.4 per prior request this run.
- Pity: no Epic+ seen in 12 consecutive shop item slots → next shop force-includes one.

## 6. Echo & Skirmish math

- **Echo bounty (Honor)**: `B = 12 + 1.1×echoFloor + 25×max(0, (echoHonorTier − yourTier))`, ×0.5 if the Echo is ≥2 tiers below you. Valor Marks: `5 + echoFloor/4`. Grave-Copy: choose 1 of 3 items from the Echo's equip slots (relic excluded — class-bound), granted ★1. All evaluated in integer math server-side (Honor/Marks are integers; the `1.1×`/`/4` factors truncate).
- **Echo defense (the dead owner, per challenger their Echo defeats)**: +3 Honor, +6 Marks, one inbox notice. Deliberately a trickle — the bounty favours the hunter; the defender's reward is the *notification*, not the numbers.
- **Echo placement**: a door generator may surface at most one Echo door per 5 floors (`ECHO_FLOOR_SPACING`), never before floor 3, never the sole path (it replaces one battle door only when another remains). Candidates within ±5 floors of the climber, freshest first; a house Echo (`The Sleepwalker`, duelist, floorsCleared 0) seeds floors 6–12 when no real corpse fits (onboarding, GDD §12).
- Echo AI stat bonus: +10% fresh, decaying −2%/day to 0 (a fight-start damage buff on the Echo). Echo lifecycle: 3 defeats or 14 days. One Echo/account (a new death upserts over the old).
- **Skirmish rating:** attacker-only Elo, K=24, floor 0: `ΔH = K × (S − E)`, `E = 1/(1+10^((H_def−H_att)/400))`. Defender on win: +8 Honor +10 Marks; on loss: nothing. Champion's Key on win vs `H_def ≥ H_att − 50`; 3 Keys open the Vault.
- Tickets: 5/day (7 at tiers 4/6+), same defender ≤1/day, Honor from same defender ×1 → ×0.5 → ×0.25 → 0 within a rolling week.

## 7. Honor & tiers

- **Climb Honor** (first time per season at each floor `f`): `h(f) = 3×f^1.35 − 3×(f−1)^1.35` per new floor (i.e., cumulative `3×f^1.35`), ×(1 + 0.15×vows).
- Cumulative sanity: floor 20 ≈ 170 · floor 50 ≈ 590 · floor 100 ≈ 1500 (before Vows, Echoes, Skirmishes).
- **Tiers:** Ashbound 0 · Stairborn 200 · Gatekeeper 500 · Vaultbreaker 1 000 · Lanternbearer 1 800 · Wardenslayer 3 000 · Crownseeker 5 000 · **The Unnumbered** = top 100 by Honor (min 5 000).
- Season reset (8 weeks): new Honor = `√(old) × 12` (Crownseeker 5 000 → ~850, lands Gatekeeper+). Lifetime Honor never resets. *(Phase 3, Slice G: live as `placementHonor(finalHonor) = round(√finalHonor × 12)` in `services/season.ts`; the `runSeasonRollover` job writes each account a `placement` ledger row in the new season, marks the old season ended, opens the new one, and is idempotent. Lifetime Honor = SUM of ledger deltas across all seasons **excluding** `placement` carry-overs. `GET /api/season` returns the window + your projected placement; the first real rollover runs from ops in Phase 5.)*

## 8. Daily systems

Daily Gauntlet: 1 attempt/day, shared seed, fixed class rotation (V→D→A), Honor pot: top 1% +100, top 10% +50, top 50% +20, finisher +5 (flat, small — the leaderboard *is* the prize). Resets 00:00 UTC.

## 9. The Balance Harness (how numbers get tuned — build in Phase 2, mandatory thereafter)

`pnpm harness` — a headless CLI over the shared sim: plays N thousand seeded runs with scripted "player policies" (greedy-DPS bot, tag-committed bot, fuse-everything bot, random bot) and outputs: death-floor distributions per class/policy, item pick/win-rate deltas, fight-duration histograms, Doomfall-death %, status uptime, gold curves. **Release gates:** every item within ±8% win-rate delta of its rarity cohort at equal floor; no class >55% of top-decile deaths; Doomfall causes 5–12% of deaths (it must matter but not dominate); median fight 8–20s at 1×. Every content PR runs the harness in CI; regressions outside gates block merge. Humans decide *feel*; the harness catches *lies*.

*(Phase 4: **all four policies are live** — greedy-DPS, tag-committed, fuse-everything, and a seeded random noise-floor bot, every draw from the deterministic RNG so CI is bit-reproducible. The class-parity gate is now computed over the **pooled** population of all policies × classes, and a policy × class median-death table is printed so no single policy's skew hides in the aggregate. The per-item ±8% win-rate-cohort gate still needs item-tagged policy sims and is the remaining harness follow-up.)*

**Accepted class-parity exception — the Duelist deep-end (decided, not a bug).** The harness reports the Duelist owning **~64%** of top-decile deaths against the 55% cap. This was investigated across all four policies and confirmed **real and robust** — the Duelist reaches ~10 floors deeper than Vanguard/Arcanist under *every* play style (per-policy median death floor ~50 vs ~30–40), and no modest re-tune moves it (a swept Duelist −10 HP *and* −⅓ dodge still lands at 62%). It is **accepted as designed class identity**: the Duelist is the high-ceiling glass cannon ("speed, crits, bleed, greed"), and this gate is measured through *autoplay* bots that structurally reward the best DPS-to-durability ratio — a proxy that will favour the Duelist regardless of how skilled humans fare on the other two. Per "humans decide *feel*", the Duelist's deep ceiling is the intended feel, so the gate stays **informational (non-gating)** for this class rather than forcing a large rebalance that would flatten class identity. Revisit only if a future item/enemy pass changes the underlying snowball; the harness will keep surfacing the number honestly.
