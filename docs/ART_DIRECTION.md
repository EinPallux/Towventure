# Towventure — Art Direction & Asset Pipeline

> Companion to [GDD.md](GDD.md) §1.1 pillar 5 ("Juice is a feature"). Implementation home: `packages/client/src/engine/`.

---

## 1. The look: **"Lanternlight Gloom"**

Stylized low-poly 3D dioramas: a quiet, ancient tower interior lit by warm lanterns against cool stone darkness. Strong silhouettes, flat-shaded facets with a painterly gradient ramp, one saturated accent color per biome cutting through a muted base. Melancholy, not grimdark; cozy, not cute.

- **Values first:** every scene reads in 3 values (dark shell, mid architecture, bright actors). If a screenshot fails a squint test, the scene is wrong.
- **Silhouette law:** every item and enemy must be identifiable at 64px by outline alone. Design the outline, then the surface.
- **Per-biome palette:** base (stone), shadow (cool), **accent** (the biome's soul): Gatehouse amber · Gardens verdigris · Archive candle-ivory · Foundry ember-orange · Chapel bone & wine · Menagerie moss-gold · Vault abyssal teal · Gallery mirror-silver · Court cinder-rose · Crown dream-violet. Palettes are data (`engine/palettes.ts`), applied by the same shaders everywhere — biome identity for free.

## 2. Zero-binary-asset policy

**No image, model, or audio binary files in the repo.** Everything is generated at runtime from code + data:

- **Meshes:** procedural builders (§3) from Three.js primitives, lathe/extrude profiles, and seeded deformation.
- **Textures:** none diffuse — vertex colors + gradient-ramp toon shading + a generated 64×64 noise/AO canvas where needed.
- **Icons:** the **Icon Baker** (§4) renders each item's actual 3D model to a texture atlas at runtime.
- **Audio:** WebAudio synthesis (§7).
- Why: perfect stylistic consistency, tiny transfers, no license risk, agents can iterate on "art" with code review, and the client stays under the 900KB gz budget ([ARCHITECTURE.md](ARCHITECTURE.md) §8).

## 3. Procedural mesh system (`engine/meshes/`)

Family builders, parameterized and composable — this is how 120 items each get a *unique* model without 120 artists:

- `bladeWeapon({profile, length, curve, guard, grip, gemCount…})` — blade outline as a 2D spline, extruded, beveled; guards/pommels from a parts kit.
- `bluntWeapon`, `rodWeapon` (orbiting focus crystals), `hookWeapon`, `bowMissing` — no bows at launch; kit grows with content.
- `armorShell({rig, coverage, plates, trim})` fitted to the hero rig; `helm`, `boots` variants.
- `trinketBuilder` — the fun one: books with animated pages, hourglasses with particle sand, keys, bells, candles with real flame sprites.
- `creatureBuilder({bodyPlan: biped|quad|swarm|amorphous, mass, headKit, limbKit})` for enemies; bosses are bespoke compositions of the same kits, always with one *mechanical* animated element (the Toll-Keeper's bell actually swings on the cadence that stuns you — telegraphy through art).
- Heroes: one shared rig (8 bones, code-skinned primitives), class differentiated by silhouette blocks + palette + idle pose.
- Every builder takes a `seed` for micro-variation (nicks, tilt, wear) so two Rusty Cleavers are twins, not clones. ★5 Zenith models are **authored variants** of the base recipe (bigger silhouette change + emissive channel + bespoke particle rig) — the transformation must be legible across the room.

## 4. Icon Baker

At startup (and content-patch), an offscreen `WebGLRenderTarget` photographs every item model against the item-rarity backdrop into a texture atlas → inventory icons **always match** the in-fight model, ★ tier and Zenith transformations included. Cost: ~1s at boot, cached per content version in IndexedDB.

## 5. Animation principles (the juice constitution)

1. **Nothing teleports.** Every value change animates: HP drains, gold counts up, items arc into slots.
2. **Anticipation → strike → settle** on every weapon: wind-up scaled to cooldown (mauls telegraph long, dirks flick), 1-frame strike smear, follow-through wobble.
3. **Hit-stop:** 40ms normal hits, 90ms crits, 140ms + radial shock + camera punch on kills. Doomfall gets a screen-edge ember vignette that intensifies.
4. **Damage numbers are typography:** normal = small drift-up; crit = big, slams down with squash; status ticks = colored micro-numbers on a metronome; healing arcs green. Numbers pool and never overlap the hero's face.
5. **Status VFX vocabulary** (one visual verb each, composable): Bleed = falling red drips · Burn = clinging flame + char darkening · Venom = rising green motes · Chill = frost rim + slowed animation speed (the *model* slows — legibility through art) · Shock = jagged arc + white flash · Ward = soap-bubble shell · Sunder = cracking armor plates that visibly fall off.
6. **The Fusion Ceremony:** both copies orbit, accelerate, slam together with hit-stop → white-out → the new tier drops in with its upgraded model, ★ pips ping on one-by-one. ★3 Awakened adds a rune-circle flourish; **★5 Zenith is a 3.5s set piece** with the item's rename card ("*Kindlewhip has become SOLARLASH*"). This animation sells the entire fusion economy. Skippable after first view per item.
7. **Fight cameras:** locked diorama by default; subtle dolly-in below 25% HP either side; killcam = 400ms slow-mo on the final blow. 2× speed compresses timings, never skips reads.
8. **UI motion:** tooltips spring in 120ms; door cards tilt on hover; ladders count-shuffle rows on refresh. Every interactive element has hover/press states. Reduced-motion setting swaps all of it for fades (accessibility is in scope).

## 6. Scenes

- **The Gate (main menu):** the tower door at night, lantern moths, your hero idling in current gear (gear IS the menu screen — progression is always visible). Ladder/duels/gauntlet as physical signposts.
- **Fight diorama:** a floor-slice of the current biome, parallax depth, background silhouettes of the tower's interior lattice. Echo fights tint the whole scene with the Echo's aura cosmetic.
- **Hero screen:** the hero steps forward under a lantern; equipment changes render instantly on the model (try-on is free dopamine).
- **Death ritual:** the fight freezes on the killing blow, drains to the biome's shadow palette, the Echo rises from the body facing the *other* way (it now waits for climbers), Honor tally, share card.

## 7. Audio (WebAudio synthesis, `engine/audio/`)

- **SFX synth:** layered oscillator/noise recipes per event family (hits = pitched noise bursts with body by weapon mass; crits add a sub-thump; statuses each own a timbre — Burn crackles via filtered noise LFO, Shock is an FM zap; UI = soft wooden ticks). Every item's signature effect gets a signature sound recipe (data-driven like meshes).
- **Music:** generative ambient sequencer per biome — a chord field (2 sine/triangle pads), a sparse pentatonic arp whose density follows fight intensity, biome-tuned scale + tempo. Fights add a low pulse; bosses add a second pulse at a tense interval; Doomfall detunes the field. Never loops audibly because it never repeats.
- Ducking: SFX duck music −6dB; kill-blow gets 200ms of near-silence before the settle (the "oof" of space).

*Implementation status (Phase 4, Slice C):* **live** — `engine/audio.ts` is a fully procedural `AudioEngine` (Web Audio oscillators + a deterministic noise buffer, zero binary assets), one per fight, driven off the `Playback` listeners: swing whoosh, crit/normal impact (pitched + noise), DoT tick, heal glide, death thud, a swelling Doomfall drone, and a win/lose sting. A generative pad plays a slow pentatonic on a biome-accent-seeded root. The context resumes on the (gesture-driven) fight entry; volumes come from the settings store (0 = no nodes built). The per-item *signature* SFX recipes and the music's intensity-following arp/ducking are the remaining follow-ups. The fight also gained: biome-correct palettes (a real bug — the diorama was hardcoded to the Gatehouse), hit-stop + decaying camera-shake + a killcam push toward the fallen, a status-colour edge-pulse VFX vocabulary, crit damage-number typography (scale-pop + stroke), and a Fusion Ceremony overlay (grandest at ★5 — the Zenith forge). All motion is gated by the reduced-motion setting (both the CSS layer and the Three.js loop).

## 8. Writing style

Flavor lines: ≤140 chars, wry, concrete, melancholy; the Tower is never explained. UI copy: plain and warm ("Your Echo stands on Floor 61."). Numbers in tooltips always exact — flavor never obscures math. Forbidden: lore dumps, exclamation marks in system text, fantasy-name word salad.

## 9. Acceptance bar (Phase 4 exit)

A stranger watching 30 seconds of a mid-game fight should be able to say what weapon archetype is winning and why (legibility), and want to press the fuse button themselves (desire). Screenshot of any screen should be pasteable in a Discord without embarrassment. That's the bar; [ROADMAP.md](../ROADMAP.md) Phase 4 doesn't close under it.
