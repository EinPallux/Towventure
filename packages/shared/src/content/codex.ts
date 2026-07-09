/**
 * Codex lore (CONTENT §7). Discovery shows an entry's base flavor (on the item/enemy
 * def); these are the *extra* lore lines that unlock deeper in — for items at ★3 then
 * ★5, for enemies at 3 then 10 kills. Tone per ART_DIRECTION §8: wry, melancholy,
 * never explaining the Tower. Only a curated anchor set is authored; entries without
 * lore here still appear in the Codex, they just show the discovery line alone.
 *
 * Each value is `[first unlock, second unlock]`.
 */

export const CODEX_ITEM_LORE: Record<string, [string, string]> = {
  rusty_cleaver: [
    'It has stopped rusting. That is not the same as clean.',
    'The butcher never named it. Butchers rarely name the knife.',
  ],
  sawtooth_dirk: [
    'Each tooth was set by hand, in the dark, from memory.',
    'The smith who made it filed her teeth to match. The Tower keeps her on floor 44.',
  ],
  kindlewhip: [
    'The burns it leaves spell nothing. She checked, once, for years.',
    'Light enough to climb by — if you do not mind what it costs to keep lit.',
  ],
  apprentice_sparkrod: [
    'It has begun finishing your sentences, in sparks, incorrectly.',
    'The apprentice graduated and left. The rod has not noticed yet.',
  ],
  mothlight_blade: [
    'Brighter near the end of every fight. Everything is.',
    'The moths were the patient ones all along. You are only borrowing it.',
  ],
  bulwark_sigil: [
    'The wall learned your name from the inside, where the blows land.',
    'It turned away every blow it was given. It kept a list of each one.',
  ],
  twin_fang_oath: [
    'Two promises, and the narrow space between them where a duelist lives.',
    'The oath outlived both who swore it. Oaths usually do.',
  ],
  cinderheart: [
    'The spare heartbeat has developed opinions about the first one.',
    'It kept beating for someone, a long time ago. You will do for now.',
  ],

  // ── Mythics of the deep tower (biomes 6–10) ──
  the_sleepless_crown: [
    'It replays your best moment because it cannot bear for it to be over.',
    'The Warden wore it and never slept. You wear it and understand why.',
  ],
  pale_candle: [
    'It burns brightest for the version of you that does not make it back.',
    'Die with it lit and your Echo keeps the flame — and doubles the debt owed for it.',
  ],
  the_sleepless_eye: [
    'It blinks on your behalf so that you need never look away.',
    'What it has seen it keeps. What it keeps, it shows you, at the worst moment.',
  ],
  aegis_of_the_sleepless: [
    'The ward it raises is the sleep it was denied, handed to you instead.',
    'It has stood one watch too long. It will stand yours as well, resentfully.',
  ],
  the_long_way_down: [
    'Every floor you climbed is still down there, waiting to be fallen through.',
    'It does not shorten the drop. It only makes very sure you feel each floor.',
  ],
  the_hungering_coin: [
    'It pays out in the currency the Tower actually accepts, which is you.',
    'Spend it and it comes back heavier. It always comes back. It is never quite change.',
  ],
  heartpiercer: [
    'It finds the opening the Bleed already made, and calls it an invitation.',
    'It has never missed a heart. It has, on occasion, been surprised what was in one.',
  ],
  toll_keepers_bell: [
    'It rings for a Keeper who stopped answering a long climb ago.',
    'Everyone pays. You are simply the first to hear it and keep walking.',
  ],
};

export const CODEX_ENEMY_LORE: Record<string, [string, string]> = {
  tunnel_rat: [
    'They were here before the walls, and take a long view of the matter.',
    'You have killed the same rat ten times. It continues to disagree.',
  ],
  gate_bandit: [
    'The toll was never his to charge. He charges it regardless.',
    'Somewhere a gate stands open and unmanned, and does not feel free.',
  ],
  toll_keeper: [
    'The Bell answers to no one who has met the Bell.',
    'He keeps the change. He has always kept the change.',
  ],
  bramble_shambler: [
    'It grew around a climber who stopped, once, to rest.',
    'The Garden has filed you under "returning". It is very patient.',
  ],
  cinder_widow: [
    'She married the forge and kept the fire in the settlement.',
    'The burns feed her. She remembers that you tried them anyway.',
  ],
  prior_of_teeth: [
    'Every tooth was someone who, at the end, smiled back.',
    'He is patient. He is, after all this, still smiling.',
  ],

  // ── The Menagerie (51–60) ──
  gloom_panther: [
    'You will see it once. The Menagerie only ever loans it out once.',
    'Its cage door has been open for years. It stays for the company.',
  ],
  hollow_bear: [
    'They took the inside of it for a coat. The wanting they left in.',
    'It is emptiest at the middle of the fight, and angriest there too.',
  ],
  collectors_favorite: [
    'Someone loved it best. That is why it is behind the thickest glass.',
    "It wears a stolen build the way a taxidermy wears a life — almost.",
  ],
  the_collector: [
    'It does not fight to win. It fights to make room on the shelf.',
    'Ask it what it collects and it will simply, patiently, begin.',
  ],

  // ── The Vault (61–70) ──
  drowned_bailiff: [
    'Still holding the writ. Still expecting the drowned to sign.',
    'The depth reads your name off the writ and gets it slightly wrong.',
  ],
  pressure_wraith: [
    'The deep remembers every climber it pressed the shape out of.',
    'One blow, five times, before your Ward decides it happened once.',
  ],
  the_escrow: [
    'It holds what you give it, and fully intends to return it. Later.',
    'The account it keeps is you. The interest it charges is also you.',
  ],
  bailiff_of_the_deep: [
    'It reads the depth its charges drowned in, aloud, forever.',
    'The room floods to the same line each time. It is not the room rising.',
  ],

  // ── The Gallery of Mirrors (71–80) ──
  mirrorkin: [
    'It fights the way you do. It has your one bad habit, too.',
    'Break the glass and it simply moves to the next pane. There is always a next pane.',
  ],
  the_understudy: [
    'It learned your part by watching you die of it, last time.',
    'It has been word-perfect for a while now. It is waiting for the cue.',
  ],
  the_curator: [
    'It curates one exhibit: the exact shape of your mistakes.',
    'The plaque under the mirror already has your name. It is very tidy.',
  ],

  // ── The Court (81–90) ──
  ember_courtier: [
    'It holds a candle it does not fear. It fears only being unlit.',
    'Burn will not touch it. It finds your attempt charmingly provincial.',
  ],
  duel_bond_twins: [
    'One bleeds when the other is cut. Neither will say which is which.',
    'They have been dueling each other, politely, since before you arrived.',
  ],
  master_of_ceremonies: [
    'It calls each of your blows before you throw it. It is never late.',
    'The tempo is its idea. You are only permitted to keep up.',
  ],
  princess_of_cinders: [
    'She was crowned in a fire she started, herself, to stay warm.',
    'When the burning ends she does not cool. She simply turns the cold on you.',
  ],

  // ── The Crown (91–100) ──
  somnambulist: [
    'It walks the Crown at night, asleep, and will not be woken kindly.',
    'It has never once seen the tower it guards. It guards it perfectly.',
  ],
  dream_larva: [
    'It dreams of what it will become. The dream is getting closer.',
    'Leave it alone for a moment and the moment is what it eats.',
  ],
  the_apology: [
    'It is sorry. It has always been sorry. It will be sorry over you.',
    'It borrows your relic to apologize with. The apology is worse than the theft.',
  ],
  the_sleepless_warden: [
    'It has not slept since the first climber. It will not sleep after you.',
    'Every wall you passed was a rehearsal. This is the wall. It knows the ending.',
  ],
};
