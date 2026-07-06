# Towventure — Game Design Document

> **Version:** 1.0 (planning baseline) · **Status:** Approved for development
> Companion documents: [CONTENT.md](CONTENT.md) (item/enemy/biome catalog), [BALANCE.md](BALANCE.md) (all numbers), [ARCHITECTURE.md](ARCHITECTURE.md) (how it runs online), [ART_DIRECTION.md](ART_DIRECTION.md) (how it looks and feels).

---

## 1. Vision

**Towventure** is an **online, async-multiplayer auto-battler roguelite** about climbing an endless tower, building an absurdly strong hero out of fused weapons and gear, dying, and leaving your corpse behind as a challenge — an *Echo* — for every other player who climbs after you.

**One-sentence pitch:** *Backpack Battles' build-tinkering meets The Bazaar's async ghosts and Slay the Spire's climb — in a moody, heavily animated 3D tower where your death makes the game better for everyone else.*

### 1.1 Design pillars

1. **The build is the game.** Combat is automatic; every decision happens *between* fights: what to buy, what to fuse, what to equip, which door to take. Depth comes from item interactions, not reflexes. If a player can't theorycraft it in a Discord channel at midnight, we cut it.
2. **Online by blood, not by bolt-on.** Every run happens on the server. Other players are woven into the climb itself — their Echoes haunt the floors where they died, their builds appear in your duels, their names sit above yours on the ladder. There is no offline mode and no design assumption of one.
3. **Death is content.** Dying ends your run but *creates* something: an Echo other players can hunt for Honor and loot, and a defense snapshot rivals can duel. The tower is built out of everyone's failures.
4. **Every item is a character.** No "+5 sword". Each of the ~120 launch items has a unique effect, a unique procedural 3D model, a signature animation and sound. Fusing an item to its final tier visually *transforms* it.
5. **Juice is a feature, not polish.** Hit-stop, camera punch, fusion ceremonies, damage-number typography, Zenith transformation VFX — the moment-to-moment feel is a first-class deliverable with its own roadmap phase, not an afterthought.
6. **Bounded complexity.** Slot-based inventory (not spatial grid), one currency per layer, no trading, no guilds, no chat at launch. Depth through item interactions and tag synergies, not through system sprawl.

### 1.2 Inspirations (and what we take / leave)

| Game | We take | We leave |
|---|---|---|
| **Backpack Battles** | Async PvP vs. snapshots, item fusion/recipes, the "just one more tweak" shop loop | Spatial-grid inventory (too fiddly for our scope), pure-PvP structure |
| **The Bazaar** | Cooldown-based auto-combat, PvE climb + async ghost opponents, item tiers that upgrade effects | Monetized card-pack economy, hero-locked item pools |
| **Super Auto Pets** | Deterministic replayable fights, low-stress async pacing | Team-of-units model (we build ONE hero) |
| **Slay the Spire** | Floor/door choice structure, elite-risk decisions, ascension-style difficulty knobs ("Vows") | Deckbuilding, turn-based play |
| **Backpack Hero** | Meta-progression warmth, item personality | Grid puzzling, town-building meta |
| **Dark Souls / Nemesis system** | Ghosts of real player deaths as world content with names attached | Real-time invasion (everything here is async) |

### 1.3 Target platform & session shape

- **Platform:** Web (desktop-first, playable on tablet). Ships as a website on the owner's Ubuntu VPS. Chromium/Firefox/Safari, WebGL2.
- **Session shape:** 15–45 min run sessions; 2–5 min "check my duels / hunt one Echo" snack sessions. A run can be suspended anytime (state is server-side) and resumed on any device.
- **Audience:** roguelite/autobattler enjoyers who play with friends on Discord and compete via ranks, daily challenges, and screenshots of broken builds.

---

## 2. Core fantasy & world

The **Tower** is the dream of a sleeping god, growing a new floor every time someone dreams of climbing it — which is why it is endless. Climbers take a Vow at the gates and become **Vowbound**. The Tower keeps what it kills: die on floor 61 and your **Echo** — armor, weapons, grudges and all — stands on floor 61 forever (well, until three other climbers put it down), guarding a shard of your **Honor**.

Tone: **melancholy-cozy dark fantasy.** The Tower is ancient, quiet, and warmly lit by lanterns; the horror is architectural, not gory. Flavor text is wry and short. (Full art direction in [ART_DIRECTION.md](ART_DIRECTION.md).)

Naming glossary used across all docs and code:

| Term | Meaning |
|---|---|
| **Vowbound** | A player character on a run |
| **Echo** | Ghost of a dead player's build, placed on their death floor |
| **Honor** | Seasonal rank points (the competitive number) |
| **Gold** | Run-scoped currency, lost on death |
| **Valor Marks** | Persistent currency from Echo hunts & duels |
| **Skirmish** | An async PvP duel vs. another player's snapshot |
| **Vows** | Optional run modifiers taken at the gate for bonus Honor (difficulty dial) |
| **Torments** | Stacking difficulty modifiers on floors 100+ |
| **The Unnumbered** | The top-100 ladder tier |

---

## 3. The core loop

```
 ┌──────────── META (persistent, account-wide) ─────────────┐
 │  Honor rank · Ladders · Valor Marks · Honor Merchant     │
 │  Codex collection · Cosmetics · Daily Gauntlet · Friends │
 └──────────────────────────▲───────────────────────────────┘
                            │ honor, marks, codex entries,
                            │ your Echo, your defense snapshot
 ┌──────────────────────────┴───────────────────────────────┐
 │                        THE RUN                           │
 │                                                          │
 │   Gate: pick class, pick Vows                            │
 │      └─▶ FLOOR n: choose a door                          │
 │             Battle / Elite / Event / Echo / Shop / Boss  │
 │      └─▶ auto-battle plays out (watch, skip, or 2×)      │
 │      └─▶ loot → backpack → fuse / infuse / equip / sell  │
 │      └─▶ next floor (n+1)… forever, until you die        │
 └──────────────────────────────────────────────────────────┘
```

A floor takes 30–90 seconds: pick a door, watch (or fast-forward) a fight, make 1–3 inventory decisions. The loop must feel like eating chips.

### 3.1 Starting a run

1. **Pick a class** (3 at launch — §6). Class fixes your Relic (a build-defining passive), starting weapon, and base stats.
2. **Pick Vows** (0–5). Each Vow is a named handicap (e.g., *Vow of Hunger: shops stock 1 fewer item*) granting +15% Honor each, multiplicative with floor Honor. Vows unlock at Honor tiers, so the difficulty dial is also a flex. Full list in [CONTENT.md](CONTENT.md) §6.
3. Server creates the run with a secret seed. Everything random in the run (drops, shop stock, events, enemy compositions, fight RNG) derives from that seed — see [ARCHITECTURE.md](ARCHITECTURE.md) §4.

Only **one active run per account.** The run is server-side; closing the browser suspends it, dying ends it.

### 3.2 The floor: doors

Each floor presents **2–3 doors** (Slay the Spire-style forward choice, no map backtracking — the Tower grows behind you). Door types:

| Door | Frequency | What happens |
|---|---|---|
| **Battle** | default | Standard fight vs. 1–3 enemies of the biome. Loot: gold + item drop roll. |
| **Elite** | ~1 in 4 offered | Harder fight (named enemy, mechanic that *checks* your build). Guaranteed item at +1 rarity bias, more gold. |
| **Event** | ~1 in 5 offered | No fight: shrines, gambles, the Tithe-Collector, forges, cursed chests. Text + choice, meaningful and occasionally cruel. Catalog in [CONTENT.md](CONTENT.md) §5. |
| **Echo** | when a real dead player is banked near this floor | Fight a real player's death build for a big Honor bounty + loot copy. §8. |
| **Shop** | guaranteed every 5th floor (floor is the shop, no fight) | The Wandering Merchant. §5. |
| **Boss** | every 10th floor (no choice, single door) | Biome boss with signature mechanics + guaranteed Epic-biased drop + full heal after. |
| **Sanctum** | floor after each boss | Breather: free heal already applied, one free shop reroll token, fusion altar with a discount, and your run's stats so far (screenshot bait). |

Door previews are honest but partial: a Battle door shows enemy silhouettes and tags ("Beasts ×3 · Venom"), an Elite door names the elite, an Event door shows only an omen icon.

### 3.3 Combat (the auto-battle)

Combat is a **deterministic, tick-simulated real-time brawl** between your hero and 1–3 enemies, fully server-computed and replayed by the client as a cinematic (see [ARCHITECTURE.md](ARCHITECTURE.md) §4 for the determinism contract). The player does not act during combat — but *everything* they chose beforehand acts.

**Model (the short version — every number lives in [BALANCE.md](BALANCE.md)):**

- Sim runs at **10 ticks/second**, fights hard-capped at 60s; at 45s **Doomfall** begins (escalating true damage to both sides) so fights always resolve.
- Each weapon has its **own cooldown** (fast dirks ~1.3s, huge mauls ~3.4s) and swings automatically. Two 1-hand weapons alternate independently; a 2-hand weapon occupies both slots.
- Core stats: **Max HP, Armor** (flat reduction per hit, partially pierced by some effects), **Speed** (global cooldown multiplier), **Crit chance / Crit damage, Dodge, Lifesteal, Thorns**.
- **Statuses (10 at launch):** Bleed, Burn, Venom, Chill, Shock, Weaken, Sunder, Regen, Haste, Ward. Each has one crisp rule (e.g., *Venom: ramping DoT that never expires — it only grows*; *Shock: next incoming hit on the target cannot miss and crits*). Definitions in [BALANCE.md](BALANCE.md) §3.
- **Triggers** are the language every item effect is written in: `OnHit`, `OnCrit`, `OnHurt`, `OnBlock` (armor absorbed the hit), `OnDodge`, `OnStatusApplied(X)`, `Every(Xs)`, `OnFightStart`, `OnHpBelow(50%)`, `OnEnemyDeath`, `OnDoomfall`. Items are data: `trigger → effect` pairs. This vocabulary is closed and small on purpose — depth comes from combinations.
- **Enemy design checks builds.** Enemies aren't stat sticks: the Cinder Widow *heals* from Burn, the Warden of Chains caps your attack speed, the Rustling Mimic eats your gold every time it hits you. A build that autopilots dies to the biome designed against it. Enemy catalog in [CONTENT.md](CONTENT.md) §4.

**Presentation:** the fight is a staged 3D diorama — hero left, enemies right, on a slice of tower architecture with the biome's palette. Watchable at 1×, 2×, or **skippable to the killcam summary** after the first viewing of any enemy composition (respect the player's time; the first encounter of anything new always plays out). Damage numbers, status icons, and a live DPS strip make theorycrafting legible.

**Defeat is legible:** the death screen shows the fight timeline (when your HP fell, which enemy skill did it) so every death teaches ("Doomfall got me — my build was too slow", "Shock burst — needed Ward").

### 3.4 After the fight: the real game

Loot resolves (gold + drop rolls per [BALANCE.md](BALANCE.md) §5), then the player is in the **Hero screen** — the heart of Towventure:

- **Equip window:** 8 slots — Weapon ×2 (or one 2-hand), Helm, Armor, Boots, Trinket ×2, **Relic** (class slot, never changes).
- **Backpack:** 12 slots at start, expandable to 20 via rare Satchel items. Holds spare copies (fusion fodder), consumables, and materials.
- Actions: **equip, fuse (§4.1), infuse (§4.2), drink/use consumable, sell** (gold at 40% of value), inspect (full tooltip with current *and* next-tier effect text — always show the player what fusing will do).

If the backpack overflows on pickup, the player must sell/fuse on the spot — a real decision, not an inconvenience popup.

---

## 4. Item system (the build engine)

Items are the entire progression surface. Full catalog with all effects: [CONTENT.md](CONTENT.md) §2–3.

**Anatomy of an item:**

- **Rarity** (drop-weight & power budget): Common / Uncommon / Rare / Epic / **Mythic**. Rarity is fixed at drop; it never changes.
- **Star tier ★1–★5** (fusion level): what the *player* grows.
- **Tags** (1–2 of 8): `Blade · Bulwark · Arcane · Ember · Venom · Frost · Shadow · Wild` — feed tag synergies (§4.3).
- **Effect script**: 1 trigger→effect pair at ★1 (Commons) up to 2–3 pairs (Epics/Mythics).
- **Infusion sockets** (0–3 by rarity): §4.2.

### 4.1 Fusion (★ tiers)

**Two identical items at the same ★ fuse into one at ★+1.** (Same content ID; rarity is inherent to the ID.) Fusion is free at any time from the backpack, with a short ceremony animation that must feel *fantastic* (see [ART_DIRECTION.md](ART_DIRECTION.md) §6).

| Tier | Stat effect | Effect evolution |
|---|---|---|
| ★2 | +35% base stats | numbers in the effect scale up |
| ★3 — **Awakened** | +35% again | item gains its **second effect line** (a new trigger→effect) |
| ★4 | +35% again | numbers scale |
| ★5 — **Zenith** | +35% again | item **transforms**: new name, upgraded model & VFX, effect gains its final twist (e.g., *Kindlewhip* ★5 becomes ***Solarlash*** — Burn you apply can now detonate) |

Reaching ★5 requires **16 copies total** — a whole-run project for one item, which is exactly the point: a Zenith is a run's *thesis statement*. Shops sell targeted copies (§5) so the pursuit is plannable, not pure slot machine. Every first-time Zenith is recorded in the Codex and on the player's profile.

### 4.2 Infusions (materials)

Materials drop from elites/events/shops and socket **permanent substats or micro-effects** onto gear (e.g., **Whetstone**: +flat damage; **Emberdust**: 15% of hits apply 1 Burn; **Leadweave**: +Armor but −3% Speed — yes, some infusions have teeth). Sockets: Common 0 · Uncommon 1 · Rare 2 · Epic/Mythic 3. Infusing is permanent (overwriting a socket destroys the old infusion). Material list in [CONTENT.md](CONTENT.md) §3.5.

**The tension we're engineering:** fuse two infused items and the *better* socket set survives — so "do I infuse now or wait until ★3?" is a real question with no autopilot answer.

### 4.3 Tag synergies

Each equipped item's tags count toward thresholds at **2 / 4 / 6** across your 8 equip slots. Examples (full table in [CONTENT.md](CONTENT.md) §2.2): `Blade (2): +8% Speed for Blade weapons · (4): every 3rd weapon hit applies 1 Bleed · (6): Bleed you apply can crit`. Tags turn every shop visit into a portfolio decision — is this Rare off-tag item better than a Common that completes my Ember (4)?

### 4.4 Consumables

Backpack items that **auto-trigger in combat** under a declared condition (set by the player when slotting them): *drink below 40% HP*, *at fight start*, *at Doomfall*. Potions, bombs, warding candles — 1 use, gone. They make Doomfall and Elite doors plannable without adding mid-combat input. Catalog in [CONTENT.md](CONTENT.md) §3.4.

---

## 5. Shops & economy

**The Wandering Merchant** appears every 5th floor (guaranteed, is the whole floor). Stock scales with floor and biome:

- **6 item slots** (rarity weights per [BALANCE.md](BALANCE.md) §5), of which **one is always a "Requested Copy" slot**: a copy of an item you currently own, at the item's current ★1 base — the fusion-targeting valve that makes Zenith pursuits plannable. Requested copies get pricier each purchase (escalating fusion tax).
- **2 material slots**, **1 consumable slot**.
- **Reroll** for gold (escalating within a shop, resets at next shop). Sanctum floors grant one free-reroll token.
- **Bad-luck protection:** if the player has seen no Epic+ in 12 shop slots, the next shop pity-forces one.

**Currencies (strictly layered, never convertible):**

| Currency | Scope | Earned | Spent |
|---|---|---|---|
| **Gold** | run only, lost at death | fights, selling, events | shop, rerolls, some events |
| **Valor Marks** | account, persistent | Echo bounties, Skirmish wins (both sides — §8, §9) | Honor Merchant: cosmetics, titles, banner pieces, **War Chest boons** |
| **Honor** | seasonal rank points, not spendable | climbing, Echo bounties, Skirmishes | nothing — it *is* the score |

**War Chest boons** (the only gameplay purchase with Marks, deliberately mild and capped): consumable next-run perks like *start with +50 gold* or *first shop has +1 slot*. One boon per run, max. Everything else at the Honor Merchant is cosmetic prestige (weapon trails, Echo auras, profile banners, titles). No real-money anything at launch.

---

## 6. Classes

Three at launch — each is a *build philosophy*, not a stat spread. The Relic (unremovable class item) is the philosophy made mechanical. Class kits in [CONTENT.md](CONTENT.md) §1.

| Class | Fantasy | Relic (signature passive) |
|---|---|---|
| **Vanguard** | the wall that hits back | **Bulwark Sigil** — every 4th weapon hit grants 6 Armor for the fight; `OnBlock`: 15% to retaliate for your Thorns ×3 |
| **Duelist** | speed, crits, bleed, greed | **Twin-Fang Oath** — your two weapons alternate: each weapon's hit gives the *other* +15% Speed for 2s (stacks ×3). Two-handers instead get: every 3rd hit is an automatic crit |
| **Arcanist** | cooldowns, statuses, detonations | **Cinderheart** — `Every(8s)`: recast your most recently triggered non-weapon effect for free; status damage you deal is +15% |

Classes unlock: Vanguard from the start; Duelist at Honor tier 2; Arcanist at tier 3 (fast unlocks — days, not weeks; they're onboarding pacing, not grind gates).

---

## 7. Death, Honor & rank (meta-progression)

### 7.1 Dying

Death ends the run — gold, backpack, gear: gone (into the Echo, §8). The death screen is a **ritual, not a punishment screen**: fight timeline, run summary (floors, damage dealt, Zeniths forged, best fight), Honor earned, and the Echo placement ("*Your Echo now stands on Floor 61. Make them regret finding it.*"). One-click **"Share card"** renders a PNG run-summary for Discord bragging — this is a core retention feature, not a nicety.

### 7.2 Honor

Honor is the competitive number. Per season (§11), Honor accrues from:

1. **Climb milestones** — first time reaching each floor this season grants Honor on a superlinear curve (deep floors worth much more per floor; formula in [BALANCE.md](BALANCE.md) §7). Vows multiply this. Repeating a floor you've already banked this season gives nothing — Honor tracks your *frontier*, so the only way up is a deeper run.
2. **Echo bounties** — killing other players' Echoes (§8).
3. **Skirmishes** — Elo-style gains/losses vs. rivals' snapshots (§9). *Only the attacker's rating moves; defenders never lose Honor* (asynchronous fairness — being offline can't hurt you).

**Honor tiers** (thresholds in [BALANCE.md](BALANCE.md) §7): **Ashbound → Stairborn → Gatekeeper → Vaultbreaker → Lanternbearer → Wardenslayer → Crownseeker → The Unnumbered** (top-100 ladder, displayed with live rank number: "*The Unnumbered — №41*"). Tier badges render on profiles, leaderboards, Echo nameplates, and duel cards.

### 7.3 What Honor unlocks

Prestige first, small utilities second, **never raw power**: tier badges/borders and titles; classes (tiers 2–3); Vows (spread across tiers 1–5); +1 daily Skirmish ticket at tiers 4 and 6; Echo aura cosmetics at 5+. A Crownseeker and an Ashbound in identical gear fight identically.

---

## 8. Echoes (async death PvP — the signature system)

When you die on floor *n*, the server snapshots your **entire combat build** (gear, ★ tiers, infusions, tag synergies, remaining consumables) as an **Echo** standing on floor *n*.

**Placement into other players' runs:** when a climber approaches floor *n*, the door generator may offer an **Echo door** (at most one per 5 floors offered; never two in a row). Selection prefers: friends' Echoes (always surfaced when in range — fighting your friend's corpse is the game's best Discord moment), then Echoes near the climber's own Honor, then fresh Echoes. The door shows the dead player's name, tier badge, class, and death date: "*Here fell **Maro**, Lanternbearer — 3 days ago.*"

**The fight:** the Echo is the player's build driven by the same combat sim (it fights exactly as its owner's build fought — same items, same triggers). Echoes get a small AI aggression bonus scaled down by how stale they are, so fresh corpses are the scary ones.

**Rewards (hunter):** a large Honor bounty (scales with the Echo's floor and the gap between your Honor and theirs — punching *up* pays best), Valor Marks, and a **Grave-Copy**: pick 1 of 3 items from the Echo's build, granted as a ★1 copy at your current floor's level. Copies, never theft — the dead lose nothing.

**Rewards (the dead):** your Echo fights for you after death. Each challenger it *defeats* sends you Valor Marks and a small Honor trickle, plus a notification ("*Your Echo on Floor 61 has slain Kess, Vaultbreaker.*"). Dying deep with a nasty build is a genuine strategy — some players will engineer "trap corpses," and we love that for them.

**Lifecycle:** an Echo fades after **3 defeats or 14 days**, whichever first (keeps the tower haunted by *current* metas). One Echo per account (a new death replaces the old one — replacing is a real choice for trap-corpse builders). Your own Echo is visible on your profile with its kill count: "*Your Echo has slain 7 climbers.*"

Losing to an Echo is a normal fight loss during a run (you die, your Echo replaces theirs on that floor — poetic and true).

---

## 9. Skirmishes (free async PvP)

From the main menu, anytime — no run required, no consent required, defenders can't decline (async by design, and defenders risk nothing).

- **Defense snapshot:** your best build of your current or most recent run, auto-updated at each boss kill. Players can pin an older snapshot instead ("defend with the ★5 Solarlash build, not my current experiment").
- **Attacking:** 5 tickets/day (up to 7 via Honor tiers). The Rival Board offers 3 opponents around your Honor (one slightly below, one even, one above — the *above* pick pays best). Refresh once free/day.
- **The fight:** your defense snapshot vs. theirs, same deterministic sim, both sides AI-driven, seeded by the server. You watch it like a boxing match you bet on. Rematch button re-rolls the seed for 1 gold-free ticket… no — rematches cost a ticket; seeds are per-fight.
- **Stakes:** attacker gains/loses Honor Elo-style; **defender only ever gains** (win: Marks + small Honor; loss: nothing, not even a notification unless they opt in). Winning vs. equal-or-higher Honor also drops a **Champion's Key** — 3 Keys open the **Vault of Champions**, a special Honor-Merchant page stocking that season's exclusive cosmetics and one *War Chest Prime* boon (the best boon in the game, still mild).
- **Anti-farm:** same opponent at most once/day; Honor gain fully decayed after 3 wins over the same account per week.

Skirmish results render as **duel cards** (both builds side-by-side, fight timeline, one highlight stat) — shareable as PNG, same pipeline as death cards.

---

## 10. The competitive & social layer

- **Ladders:** Global (season Honor), **Weekly climb** (best floor this week), **Friends** (default tab — the one that matters), **Daily Gauntlet**, Echo kills, and the Unnumbered top-100. All server-rendered, paginated, with your row pinned.
- **Daily Gauntlet:** one shared seed per day, fixed class rotation, everyone gets identical drops/shops/doors — pure decision-quality leaderboard, separate small Honor pot, closes at midnight UTC. The theorycrafter's arena and the friend group's daily argument.
- **Friends:** add by name#tag. Friend feed: "*Liv reached Floor 74*", "*Your Echo slew Bram*", "*Ana forged Solarlash*". Feed events are the bragging infrastructure.
- **Profiles (Hall of Echoes):** tier badge, best floor, current Echo (with kill count), pinned best build (full gear inspect), Zenith gallery, Codex %, season history. Every profile element is screenshot-composed.
- **Codex:** every item/enemy/boss discovered, with flavor lore unlocked at first ★3 and ★5. Collection % is a ladder-adjacent brag stat.
- **Notifications:** in-game inbox + live toasts (WebSocket) for Echo kills, Skirmish results vs. your defense, friend milestones. Web push optional post-launch.

No chat at launch (Discord *is* the chat); no trading ever (economy integrity, §5).

---

## 11. Seasons & endgame

- **Seasons run 8 weeks.** Honor resets to a placement derived from last season (compressed), ladders clear, Vault cosmetics rotate, one new mechanical wrinkle per season (a new Vow, a new event, a Torment variant — content-sized, not system-sized). Lifetime Honor (never resets) shows on profiles for the long-haul flex.
- **Floors 100+ — Torments:** past the Sleepless Warden (floor 100 boss), biomes loop with **Torments**: stacking modifiers (+enemy speed, elites in pairs, shops charge Honor… no — shops charge steeper gold, Doomfall starts at 35s, etc.) added every 10 floors. Numbers scale forever; Torments make *kinds* of pressure, not just bigger numbers. The endless race lives here.
- **Season rewards:** titles, banner pieces, Echo auras by peak tier; Unnumbered finishers get the numbered title permanently ("*Unnumbered №7, Season 2*").

---

## 12. Onboarding

- **First run is the tutorial** — no separate mode. Floors 1–3 introduce doors/fighting/loot with 4 total tooltips; the first fusion is guided once (two Rusty Cleavers guaranteed by floor 3); the first Echo door is guaranteed a fresh soft target around floor 8 (a seeded "house Echo" if no real one fits). Everything else is discovered.
- A player must reach their first death (and see the Echo ritual + share card) **within 25 minutes** of account creation. That moment is the hook — the game's entire retention thesis is *death felt cool*.
- Account creation: name + password only (email optional for recovery). Guest→account upgrade preserves progress. Discord OAuth post-launch.

---

## 13. Scope fence (what Towventure is NOT at launch)

Real-time PvP · trading/gifting · guilds/clans · chat · mobile-native builds · real-money shop · procedural item generation (all items are authored) · pet/companion systems · housing. If it's not in this GDD, it waits for a season.

---

## 14. Release definition

Towventure 1.0 is **released**, not prototyped, meaning: all systems in this document live on the production VPS behind a domain with TLS; 120+ items, 10 biomes, 10 bosses, 3 classes, Echoes, Skirmishes, Gauntlet, ladders, seasons, and the full juice pass shipped; onboarding tested on fresh accounts; balance validated by the Monte Carlo harness ([BALANCE.md](BALANCE.md) §9) and human playtests; operations runbook proven by a restore-from-backup drill ([OPERATIONS.md](OPERATIONS.md)). The [ROADMAP.md](../ROADMAP.md) exit criteria are the contract.
