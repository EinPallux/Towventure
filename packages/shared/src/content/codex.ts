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
};
