# Towventure — Content Bible

> Companion to [GDD.md](GDD.md). This file is the **authored catalog**: classes, items, materials, enemies, biomes, bosses, events, Vows.
> **Rule of authorship:** nothing in this game is procedurally *designed*. Every item, enemy, and event is hand-written here first, then implemented as data in `packages/shared/src/content/`. The catalog below fully specifies the launch anchor set (~60 items written out) and defines the quota + design constraints for the rest (to be authored *in this file first* during Phase 2 — the doc is the source of truth, code follows it).
>
> Notation: `[trigger] → effect`. Tiers: values given at ★1; stats scale ×1.35 per ★ (see [BALANCE.md](BALANCE.md) §4). **★3 Awakened** adds the second line. **★5 Zenith** renames + transforms as listed.

---

## 1. Classes

Base stats & scaling in [BALANCE.md](BALANCE.md) §2.

### 1.1 Vanguard — "the wall that hits back"
- **Relic — Bulwark Sigil:** every 4th weapon hit grants **6 Armor** (fight-scoped, stacks). `[OnBlock]` → 15% chance to instantly retaliate for **Thorns ×3**.
- **Start:** Rusty Cleaver (weapon), Dented Pot-Helm, 1× Small Ale (consumable).
- **Stat identity:** +HP, +Armor, −Speed. Wants: Bulwark/Ember tags, big slow weapons, Thorns, `OnBlock`/`OnHurt` triggers.
- **Signature failure mode we preserve:** slow builds fear Doomfall — Vanguards must actively buy damage or die rich and sturdy at 60s.

### 1.2 Duelist — "speed, crits, bleed, greed" *(unlocks at Honor tier 2)*
- **Relic — Twin-Fang Oath:** your two weapons alternate — each weapon's hit gives the **other** +15% Speed for 2s (stacks to 3). If wielding a two-hander instead: every 3rd hit is an automatic crit.
- **Start:** Sawtooth Dirk, Quickstep Boots, 1× Adrenal Vial.
- **Stat identity:** +Speed, +Crit, −HP. Wants: Blade/Shadow, paired fast weapons, Bleed snowballs, `OnCrit`/`OnDodge`.

### 1.3 Arcanist — "cooldowns, statuses, detonations" *(unlocks at Honor tier 3)*
- **Relic — Cinderheart:** `[Every 8s]` → recast your most recently triggered **non-weapon** effect for free. Status damage you deal +15%.
- **Start:** Apprentice Sparkrod, Singed Grimoire (trinket), 1× Cinder Phial.
- **Stat identity:** low weapon damage, high effect throughput. Wants: Arcane/Ember/Frost/Venom, trinkets with `Every(Xs)` effects, status detonation payoffs.

---

## 2. Tags & synergies

Each item carries 1–2 of 8 tags. Equipped tags count toward thresholds **2 / 4 / 6** across the 8 equip slots.

| Tag | (2) | (4) | (6) |
|---|---|---|---|
| **Blade** | +8% Speed on Blade weapons | every 3rd weapon hit applies 1 Bleed | your Bleed can crit |
| **Bulwark** | +8 Armor | `[OnBlock]` → gain 2 Ward | blocks reflect 30% of prevented damage as Thorns damage |
| **Arcane** | your `Every(Xs)` effects run 10% faster | duplicate the first `OnFightStart` effect each fight | non-weapon effects deal +25% damage |
| **Ember** | +15% Burn damage | `[OnCrit]` → apply 2 Burn | Burn on enemies above 8 stacks spreads 2 stacks to other enemies every 2s |
| **Venom** | Venom ramps +1 faster per tick-up | `[OnHit]` vs Venomed enemies: +12% damage | enemy heals are 50% less effective while Venomed |
| **Frost** | +15% Chill effectiveness | `[OnStatusApplied(Chill)]` → 20% to add Shock | Chilled enemies take +20% crit damage from you |
| **Shadow** | +6% Dodge | `[OnDodge]` → your next hit +40% damage | first hit each fight from stealth: guaranteed crit ×2.5 |
| **Wild** | +6% Lifesteal | `[OnEnemyDeath]` → heal 8% Max HP | `[OnHpBelow 50%]` → +20% Speed and +20% damage (once per fight) |

Design constraint: **no tag's (6) may be strictly mandatory** for its archetype — (6) is a spike, (4) is the build.

---

## 3. Items

### 3.0 Launch quotas & budget rules

| Slot | Common | Uncommon | Rare | Epic | Mythic | Total |
|---|---|---|---|---|---|---|
| Weapons | 8 | 8 | 7 | 5 | 2 | 30 |
| Helm | 4 | 4 | 3 | 2 | 1 | 14 |
| Armor | 4 | 4 | 3 | 2 | 1 | 14 |
| Boots | 4 | 4 | 3 | 2 | 1 | 14 |
| Trinkets | 8 | 8 | 7 | 6 | 3 | 32 |
| Satchels (backpack size) | 1 | 1 | 1 | — | — | 3 |
| Consumables | — | — | — | — | — | 13 (§3.4) |
| **Total items** | | | | | | **≈120** |

Budget rules: Commons have exactly 1 effect line (+1 at Awakened); Rares may reference one status or one trigger interaction; Epics may cross two systems (e.g., gold + combat); Mythics may bend a rule of the game (and there are only 7 of them). **Every item gets:** a unique procedural model recipe, a signature VFX, one line of flavor, and a Zenith transformation (name + visual). Anchor set below; remaining items are authored here in Phase 2 under the same table format before any code.

### 3.1 Weapons (anchor set)

| Item (rarity, tags, CD) | Effect | ★5 Zenith |
|---|---|---|
| **Rusty Cleaver** (C, Blade, 2.2s) | Plain chops. `[Awakened]` +10% Crit. | **Butcher's Word** — hits vs Bleeding enemies +25% damage |
| **Sawtooth Dirk** (C, Blade, 1.3s) | Every 3rd hit applies 2 Bleed. `[Awakened]` `[OnCrit]` → +2 Bleed. | **Redline** — your crits consume all Bleed, dealing 150% of remaining Bleed damage instantly |
| **Watchman's Maul** (C, Bulwark, 3.4s) | `[OnHit]` → gain 4 Armor. `[Awakened]` hit deals +1% damage per your Armor (cap +50%). | **Curfew** — `[OnHit]` → 25% to Shock |
| **Apprentice Sparkrod** (C, Arcane, 2.0s) | `[Every 5s]` → zap for 120% damage, applies 1 Shock. `[Awakened]` zap bounces to a second enemy. | **Stormtongue** — zap chains to all enemies |
| **Lantern-Hook** (U, Ember/Trick—Shadow, 2.4s) | `[OnHit]` → 30% apply 2 Burn. `[Awakened]` `[OnDodge]` → next hook +3 Burn. | **Kindlewhip → Solarlash** *(see below — reserved name)* |
| **Kindlewhip** (U, Ember, 1.8s) | 40% `[OnHit]` → 2 Burn. `[Awakened]` `[Every 6s]` → next hit +4 Burn. | **Solarlash** — enemies at 10+ Burn **detonate**: consume Burn, AoE 200% of consumed |
| **Coldsnap Pick** (U, Frost, 2.1s) | `[OnHit]` → 1 Chill. `[Awakened]` vs Chilled: +15% Crit chance. | **Winterbite** — `[OnCrit]` vs Chilled: freeze weapon cooldowns of target +1s |
| **Fangback Spear** (U, Wild, 2.3s) | +8% Lifesteal on this weapon. `[Awakened]` `[OnEnemyDeath]` → +20% Speed 5s. | **The Long Hunger** — overheal becomes Ward (cap 20% Max HP) |
| **Gravedigger's Shovel** (R, Bulwark/Shadow, 2.9s) | `[OnFightStart]` → gain 15 Armor. `[Awakened]` `[OnBlock]` → next swing +30%. | **Eulogy** — every 5th swing buries: target skips its next attack |
| **Twin Moon Saif** (R, Blade/Shadow, 1.6s) | `[OnCrit]` → immediately swing again at 50% (once per 2s). `[Awakened]` +10% Crit. | **Eclipse** — the echo-swing can itself crit and echo (max chain 3) |
| **Vipermaw Kris** (R, Venom, 1.5s) | `[OnHit]` → 1 Venom. `[Awakened]` `[OnStatusApplied(Venom)]` by *any* source → 10% +1 extra. | **Widow's Sermon** — your Venom ramps twice as fast vs enemies above 50% HP |
| **Pyrebrand Claymore** (E, Ember/Blade, 3.1s, 2-hand) | `[OnHit]` → 4 Burn. `[OnHpBelow 50%]` → ignite: +25% Speed rest of fight. `[Awakened]` your Burn ticks can crit. | **The Argument of Ash** — `[OnDoomfall]` → all your Burn triples instead of Doomfall damaging you |
| **Choir of Nails** (E, Shadow/Arcane, 1.2s) | Hits 3× per swing at 40% each. `[Awakened]` each nail 10% → 1 Bleed + 1 Shock. | **Congregation** — nails per swing +2 |
| **The Toll-Keeper's Bell** (M, Bulwark/Arcane, 4.0s, 2-hand, boss drop) | `[OnHit]` → **Toll**: stun 0.6s, you gain 10 Armor. `[Awakened]` Toll also removes 1 buff. | **Last Toll** — every 3rd Toll hits all enemies |
| **Mothlight Blade** (M, Frost/Shadow, 1.9s) | Damage scales +2% per second of fight elapsed (no cap). `[Awakened]` `[OnDoomfall]` → +40% immediately. | **The Patient Answer** — at fight start, delay your first swing 3s; it deals 400% |

### 3.2 Armor pieces (anchor set)

| Item | Effect | ★5 Zenith |
|---|---|---|
| **Dented Pot-Helm** (C, Bulwark, helm) | +14 HP. `[Awakened]` +6 Armor. | **The Unbowed** — first stun each fight is ignored |
| **Quickstep Boots** (C, Shadow, boots) | +5% Speed. `[Awakened]` +4% Dodge. | **Rumor** — `[OnDodge]` → +8% Speed 3s |
| **Hearthplate** (U, Ember/Bulwark, armor) | +20 HP; attackers take 2 Burn `[OnHurt]` (melee flavor: any hit). `[Awakened]` +15% Burn damage. | **The Standing Fire** — while above 8 Armor, your Burn ticks 20% faster |
| **Verdigris Scale** (R, Venom/Bulwark, armor) | +8 Armor. `[OnHurt]` → 30% apply 1 Venom to attacker. `[Awakened]` your Armor counts +25% vs Venomed enemies. | **Molt** — `[OnHpBelow 50%]` → shed: cleanse all statuses on you, gain 15 Armor (once) |
| **Owl-Eyed Sallet** (R, Arcane, helm) | Your `Every(Xs)` effects run 12% faster. `[Awakened]` `[OnFightStart]` → trigger your slowest `Every` effect immediately. | **Midnight Faculty** — +1 charge: your fastest `Every` effect fires twice each cycle |
| **Greaves of the Late Guest** (E, Shadow/Wild, boots) | `[OnFightStart]` → 25% Dodge for 4s. `[Awakened]` `[OnDodge]` → 1s of your weapon cooldowns refunded. | **Never Quite There** — every 7s, become untargetable 0.5s |
| **Aegis of the Sleepless** (M, Bulwark/Arcane, armor, floor-100 boss drop) | Start each fight with Ward = 20% Max HP. `[Awakened]` while Ward holds, +15% damage. | **The Dream Refuses** — when Ward breaks, Shock all enemies and regain 50% of it (once) |

### 3.3 Trinkets (anchor set) — where the builds get weird

| Item | Effect | ★5 Zenith |
|---|---|---|
| **Cracked Hourglass** (R, Arcane) | The first time you would die each fight, instead rewind your HP 3s (once). `[Awakened]` rewind also cleanses statuses. | **The Undecided Hour** — rewind window 5s, and your cooldowns reset on rewind |
| **Singed Grimoire** (C, Arcane/Ember) | `[Every 7s]` → cast Cinder Dart: 80% damage + 2 Burn. `[Awakened]` every 3rd dart is ×2. | **Unfinished Chapter** — dart count +1 |
| **Butcher's Ledger** (U, Blade) | `[OnEnemyDeath]` → permanently +1% weapon damage this run (cap +25%). `[Awakened]` cap +40%. | **Debts Collected** — also +0.5% Speed per entry |
| **Tax-Stamp of the Gate** (U, Bulwark) | +3 gold per fight won. `[Awakened]` +5. | **Seal of the Auditor** — shops: 1 free reroll each |
| **The Wrong Key** (R, Shadow) | `[OnFightStart]` → steal 1 random buff-granting trigger from the enemy for this fight. `[Awakened]` also gain 5% Dodge. | **It Fits Everything** — steal 2; Elite enemies drop +1 material |
| **Moth-Eaten Standard** (R, Wild/Bulwark) | `[OnHpBelow 50%]` → rally: +15% damage rest of fight. `[Awakened]` also 10 Armor. | **The Banner Still** — rally twice (at 50% and 25%) |
| **Chime of Small Mercies** (U, Frost/Arcane) | `[OnHurt]` (≥10% Max HP in one hit) → gain 3 Regen. `[Awakened]` also 1 Chill on attacker. | **Kindness, Weaponized** — your Regen ticks also deal equal damage to the nearest enemy |
| **Glutton's Fork** (E, Wild) | `[OnEnemyDeath]` → eat the corpse: +6% Max HP this run (cap +30%). `[Awakened]` also heal 15%. | **Second Helpings** — cap +50%, and Elites count double |
| **The Cartographer's Regret** (E, Shadow/Arcane) | See all doors' contents fully revealed. `[Awakened]` +1 door offered per floor. | **Where It All Went Wrong** — once per 10 floors, re-roll a floor's doors |
| **Pale Candle** (M, Shadow/Frost) | Your Echo, when you die with this equipped, gets +30% stats and drops double bounty. While alive: +10% all stats after floor 50. `[Awakened]` +15%. | **Vigil** — your Echo gains this fight-start line: Shock all challengers 1s |
| **The Sleepless Crown** (M, Arcane/Bulwark, floor-100 first-clear guarantee) | `[Every 10s]` → replay the last 2s of all damage you dealt. `[Awakened]` every 8s. | **Insomnia** — every 6s |

### 3.4 Consumables (13 at launch — auto-trigger, player sets condition)

Small Ale (heal 25%), Adrenal Vial (+25% Speed 6s), Cinder Phial (6 Burn to all), Frostjar (4 Chill to all), Leadbelly Draught (+20 Armor 8s), Blackout Bomb (enemies miss 2s), Bottled Yesterday (cleanse self), Honey of the Gardens (12 Regen), Powder of Sundering (8 Sunder to target), Vial of the Widow (5 Venom to target), Doomglass (start Doomfall 10s early — *for slow-proof builds that want it*), Wick-Oil (your next 5 hits apply 2 Burn), The Modest Fanfare (+15% damage 10s). Conditions selectable: fight start / HP<70% / HP<40% / Doomfall / vs Elite+.

### 3.5 Materials (infusions)

| Material | Socket effect | Drops from |
|---|---|---|
| Whetstone | +6% weapon damage | everywhere |
| Emberdust | 15% `[OnHit]` → 1 Burn | Ember biomes, elites |
| Hollowfang | +4% Lifesteal | Wild enemies |
| Leadweave | +8 Armor, **−3% Speed** | Bulwark elites |
| Glimmergrit | +5% Crit chance | shops only |
| Frostmote | 12% `[OnHit]` → 1 Chill | Frost biomes |
| Grave-Salt | +6% damage vs Echoes & in Skirmishes | Echo bounties only |
| Quickquill | `Every(Xs)` effects −4% interval | Archive biome |
| Blood-Amber | +10 Max HP | events |
| Void-Tallow | effect procs +5% chance (any "% chance" line) | Torment floors only |

---

## 4. Enemies

Rule: **every enemy past floor 10 checks a build axis** (speed, burst, sustain, status, armor, gold). Stats/scaling in [BALANCE.md](BALANCE.md) §6. Anchor roster per biome (3 regulars + 1 elite each). **Biomes 1–5 (floors 1–50) are authored in code** (`content/enemies.ts`, `content/biomes.ts`); Menagerie…Crown remain anchor notes for later phases. `✓` marks a check the sim models directly today; *(deferred)* marks a check that awaits vocabulary the sim/run layers don't have yet — the enemy still fights as an honest stat check meanwhile.

| Enemy (biome) | The check |
|---|---|
| Tunnel Rat / Gate Bandit / Toll Shirker (Gatehouse 1–10) | none — teaching dummies with visible telegraphs |
| **Elite: Two-Coin Ferryman** (Gatehouse) | steals 2 gold `[OnHit]` — kill fast or pay *(gold-steal deferred)* |
| Bramble Shambler (Gardens 11–20) | ✓ applies Venom `[OnHit]`; checks cleanse/sustain |
| Pollen Drone ×N (Gardens) | ✓ swarm (door multiplies regulars) — checks AoE/fast weapons |
| Bloodthorn Creeper (Gardens) | ✓ applies Bleed `[OnHit]` — the Garden opens what it touches |
| **Elite: Rustling Mimic** (Gardens) | burst — kill it fast *(gold-bribe economy deferred)* |
| Inkbound Folio (Archive 21–30) | copies your fastest weapon at 60% *(copy deferred)* |
| Redaction Wisp (Archive) | every 6s *silences* a random trinket 3s *(silence deferred)* |
| Marginalia Wisp (Archive) | ✓ applies Weaken `[OnHit]` — its notes sap your blows |
| **Elite: The Unshelved** (Archive) | ✓ **immune to crits** (even Shock's) — honest-damage check |
| Slagling ×N (Foundry 31–40) | brittle rusher *(death-explosion deferred)* |
| Vow-Forged Sentinel (Foundry) | ✓ gains Armor over time `[Every 3s]` — punishes the slow, turtling mirror |
| Slag Imp (Foundry) | ✓ applies Burn `[OnHit]` — and mind what feeds on it |
| **Elite: Cinder Widow** (Foundry) | ✓ **heals from Burn** — the anti-autopilot wall for Ember builds |
| Chained Penitent (Chapel 41–50) | halves your Lifesteal aura *(aura deferred)* |
| Bell-Starved Acolyte ×N (Chapel) | one rings a bell buffing others *(bell deferred)* |
| Ash Chorister (Chapel) | ✓ applies Chill `[OnHit]` — its hymn drags you toward Doomfall |
| **Elite: Warden of Chains** (Chapel) | caps your Speed at +25% — big-hit check *(cap deferred)* |
| Gloom Panther (Menagerie 51–60) | high Dodge; Shock/Sure-hit check |
| Hollow Bear (Menagerie) | enrages below 50% — burst-past-threshold check |
| **Elite: The Collector's Favorite** (Menagerie) | starts with a random *player item* from the Codex pool equipped |
| Drowned Bailiff (Vault 61–70) | Chills on hit; stacks slow you into Doomfall |
| Pressure Wraith (Vault) | damage split into 5 rapid ticks — anti-Ward/anti-rewind check |
| **Elite: The Escrow** (Vault) | banks 30% of damage dealt to it, returns it at 50% HP as one hit — Ward/Armor timing check |
| Mirrorkin (Gallery 71–80) | **is you**: your gear at 85% stats, AI-driven |
| Frame Ghoul (Gallery) | reflects the first status you apply each 5s |
| **Elite: The Understudy** (Gallery) | your *previous run's* final build, 90% stats — memento mori |
| Ember Courtier (Court 81–90) | Burn immune, applies Weaken elegantly |
| Duel-Bond Twins (Court) | share HP; alternate guard (attacked one takes 50% less) — cadence check |
| **Elite: The Master of Ceremonies** (Court) | fight runs at 1.25× sim speed for both sides |
| Somnambulist (Crown 91–100) | sleeps 3s (invulnerable) after every 6s awake — burst-window check |
| Dream Larva (Crown) | grows +5% stats/2s — race check |
| **Elite: The Apology** (Crown) | copies your Relic |

### 4.1 Bosses (every 10th floor; signature Mythic-adjacent drop table each)

1. **Floor 10 — The Toll-Keeper.** Giant with a bell: every 6s, **Toll** stuns you 0.5s *unless* you landed 15 hits since the last Toll. Teaches: attack cadence matters. Drops: Toll-Keeper's Bell (M, rare chance), Bulwark pool. — *sim: ✓ the 6s Toll stun; the 15-hit reprieve is deferred.*
2. **Floor 20 — Root-Queen Marrow.** Summons 2 Bramble Shamblers at 66%/33%; Venom ramps on you throughout. Checks sustain + AoE. — *sim: ✓ a beatable Venom tide `[Every 5s]`; mid-fight summons are deferred.*
3. **Floor 30 — The Unread.** Every 8s *rewrites*: swaps which of your weapons is on cooldown. Checks weapon parity builds. — *sim: a brief `[Every 8s]` stagger stands in; the cooldown-swap rewrite is deferred.*
4. **Floor 40 — Forgetide Colossus.** Armor 60, sheds 10 per Sunder stack; at 0 Armor, staggers 5s (your burst window). The Sunder tutorial made of iron. — *sim: ✓ high Armor that Sunder already melts (3/stack, min −15); the 10/stack shed + 0-Armor stagger are deferred.*
5. **Floor 50 — Prior of Teeth.** Heals 3% per second; halves at 10+ total statuses on him. Checks status density. *(Mid-game wall by design.)* — *sim: ✓ fully modelled (`selfHealPctPerSec` + `healHalvedAtStacks`).*
6. **Floor 60 — The Collector.** Opens with 3 random Codex items equipped; on defeat, **offers you one of them** as loot (the boss *is* a shop).
7. **Floor 70 — Bailiff of the Deep.** Room floods: +1 Chill to you every 4s, cleansed each time *you* land a crit.
8. **Floor 80 — The Curator.** **Fights you with your exact current build** at 100%, plus 15% Max HP. The mirror match is the build report card. Drops: choice of any 1 material ×3.
9. **Floor 90 — Princess of Cinders.** Phases: pure Burn aggression → at 50% snuffs *all* Burn (yours too) and becomes Frost. Checks dual-axis builds.
10. **Floor 100 — The Sleepless Warden.** Three phases, uses Toll + rewrite + flood callbacks; at 25% begins permanent Doomfall. First clear per account: **The Sleepless Crown** (M) guaranteed. Torments begin beyond.

---

## 5. Events (door type — anchor set of 14; quota 20 by Phase 2)

Shrine of the Mended Blade (upgrade a random item's ★, destroy a random material), The Tithe-Collector (pay 30% gold or he *marks* the next 3 fights: enemies +10% but +1 drop), The Quiet Forge (free infusion socket use; 25% the item comes back Weakened −5% for 10 floors), A Door Left Ajar (skip 1 floor; the skipped floor's Echo — if any — moves 1 floor up to wait for you), Cursed Reliquary (take a random Epic; your next boss gains The Apology's Relic-copy), The Beggar Who Knows You (give any item, receive its sell value in Honor — *the only gold→Honor valve, terrible rate, once per run*), Sleepwalker's Bargain (swap your two trinkets' ★ tiers), Fountain of Verdigris (heal 50%; 30% gain 2 Venom permanently until next Sanctum), The Lost Courier (deliver a package 5 floors up for escalating gold; it *ticks*), Gambler's Alcove (double-or-nothing one item's sell value, 3 max), Hall of Small Portraits (see the next 5 floors' door types), The Molting Wall (sacrifice 10% Max HP this run, gain a material choice), An Honest Mirror (reroll your class Relic's numbers ±15%, keep the result), The Last Merchant's Grave (buy from a dead shop at 60% price; 20% each item is cursed: −1 random substat).

---

## 6. Vows (run modifiers; +15% Honor each, pick ≤5; unlock across tiers 1–5)

Vow of Hunger (shops stock −1 item), Vow of Haste (Doomfall at 35s), Vow of Poverty (fights pay −40% gold), Vow of the Open Door (Echo doors *cannot* be declined when offered), Vow of Silence (no consumables), Vow of the Mirror (Gallery Mirrorkin at 100% stats, all biomes can spawn 1), Vow of Rust (items drop at −1 substat until infused), Vow of the Long Night (no Sanctum heals), Vow of the Numbered (your Echo hunts *you*: your previous Echo appears once, somewhere, at full strength), Vow of Glass (you: +25% damage, −25% Max HP).

---

## 7. Codex & flavor

Every item, enemy, boss, and event gets a Codex entry: 1 line at discovery, +1 lore line at ★3, +1 at ★5 (items) or 3/10 kills (enemies). Tone per [ART_DIRECTION.md](ART_DIRECTION.md) §8: wry, melancholy, never explaining the Tower. Example (Sawtooth Dirk ★5): *"The smith who made it filed her teeth to match. The Tower keeps her on floor 44."* — lore is allowed to point at real floors; players will look.
