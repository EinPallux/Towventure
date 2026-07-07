/**
 * Honor Merchant catalogue (CONTENT §8, GDD §7.3/§10.2). Two shelves spendable with
 * Valor Marks — cosmetics (pure prestige, owned forever) and War Chest boons (the only
 * gameplay purchase, one armed per run, mild) — plus a Vault shelf gated by Champion's
 * Keys. Cosmetics are flags until the Phase 4 art pass; boon effects live in run/boons.
 */

export type MerchantKind = 'boon' | 'trail' | 'aura' | 'banner' | 'title';

export interface MerchantItem {
  id: string;
  name: string;
  kind: MerchantKind;
  /** Marks price (0 for Vault items, which cost Keys instead). */
  price: number;
  /** Vault items cost Champion's Keys, not Marks (GDD §9). */
  vault?: boolean;
  /** Boon items carry the run-start effect id applied by run/boons.ts. */
  boon?: string;
  flavor: string;
}

/** id → MerchantItem (or undefined). Iterates the array, never a key-order map. */
export function findMerchantItem(id: string): MerchantItem | undefined {
  return MERCHANT_ITEMS.find((m) => m.id === id);
}

export const MERCHANT_ITEMS: MerchantItem[] = [
  // ─── War Chest boons (Marks; arm one, consumed at the next run's start) ───
  {
    id: 'boon_purse',
    name: 'Heavy Purse',
    kind: 'boon',
    price: 40,
    boon: 'boon_purse',
    flavor: 'Start the climb 50 gold richer.',
  },
  {
    id: 'boon_wide_pack',
    name: 'Wide Straps',
    kind: 'boon',
    price: 40,
    boon: 'boon_wide_pack',
    flavor: 'Two more backpack slots for the run.',
  },
  {
    id: 'boon_travel_kit',
    name: "Traveler's Kit",
    kind: 'boon',
    price: 50,
    boon: 'boon_travel_kit',
    flavor: 'Begin with a Whetstone in your pack.',
  },
  // ─── Cosmetics (Marks; owned forever — prestige flags until Phase 4 VFX) ───
  {
    id: 'trail_emberwake',
    name: 'Emberwake Trail',
    kind: 'trail',
    price: 60,
    flavor: 'Your weapon leaves a wake of embers.',
  },
  {
    id: 'aura_lanternwake',
    name: 'Lanternwake Aura',
    kind: 'aura',
    price: 80,
    flavor: 'Your Echo glows with a lantern haze.',
  },
  {
    id: 'banner_ashen',
    name: 'Ashen Banner',
    kind: 'banner',
    price: 60,
    flavor: 'A banner of grey for your profile.',
  },
  {
    id: 'title_the_unbowed',
    name: 'the Unbowed',
    kind: 'title',
    price: 100,
    flavor: 'A title worn under your name.',
  },
  // ─── Vault of Champions (3 Keys each; season-exclusive) ───
  {
    id: 'vault_aura_gilded',
    name: 'Gilded Echo Aura',
    kind: 'aura',
    price: 0,
    vault: true,
    flavor: "The Vault's own gold, wreathing your corpse.",
  },
  {
    id: 'boon_prime',
    name: 'War Chest Prime',
    kind: 'boon',
    price: 0,
    vault: true,
    boon: 'boon_prime',
    flavor: 'The best boon in the tower — +100 gold and +2 slots.',
  },
];
