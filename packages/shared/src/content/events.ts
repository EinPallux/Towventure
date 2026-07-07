/**
 * Events (door type, CONTENT.md §5) — an anchor slice of the 20-event quota. Each is
 * a choice the player makes at an event door; the display copy lives here, the
 * bespoke state change per option lives in run/events (keyed by id + option index).
 * Events whose payoff needs systems that aren't built yet (Echoes, Sanctum, Honor
 * mid-run, boss modifiers) are authored in CONTENT §5 and land with those systems.
 */

import type { EventDef } from './types.js';

export const EVENTS: EventDef[] = [
  {
    id: 'shrine_of_mended_blade',
    name: 'Shrine of the Mended Blade',
    flavor: 'Leave something whole; take something sharper.',
    options: [
      { label: 'Accept the mending', blurb: 'Upgrade a random item +1★; a random material is consumed' },
      { label: 'Leave it be', blurb: 'Touch nothing; lose nothing' },
    ],
  },
  {
    id: 'sleepwalkers_bargain',
    name: "Sleepwalker's Bargain",
    flavor: 'It offers a trade you would never make awake.',
    options: [
      { label: 'Swap the tiers', blurb: "Trade your two trinkets' ★ tiers" },
      { label: 'Refuse', blurb: 'Keep your trinkets as they are' },
    ],
  },
  {
    id: 'gamblers_alcove',
    name: "Gambler's Alcove",
    flavor: 'The house always climbs.',
    options: [
      { label: 'Wager', blurb: 'Stake a quarter of your gold — double or nothing' },
      { label: 'Walk away', blurb: 'Your purse stays exactly as heavy' },
    ],
  },
  {
    id: 'cursed_reliquary',
    name: 'Cursed Reliquary',
    flavor: 'The seal is already broken. It was always going to be.',
    options: [
      { label: 'Take the Epic', blurb: 'A random Epic drop — the Tower always collects later' },
      { label: 'Leave it sealed', blurb: 'Some debts are not worth the interest' },
    ],
  },
];
