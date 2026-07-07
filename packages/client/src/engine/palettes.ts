/**
 * Biome palettes (ART_DIRECTION §1 "Lanternlight Gloom"): a muted stone base, a
 * cool shadow, and one saturated accent — the biome's soul. Data, applied by the
 * same materials everywhere so biome identity comes for free.
 */

export interface Palette {
  base: number; // stone / mid architecture
  shadow: number; // cool dark shell
  accent: number; // the biome's signature
  hero: number; // hero body
  bg: string; // CSS background gradient
}

export const PALETTES: Record<string, Palette> = {
  gatehouse: {
    base: 0x5b5346,
    shadow: 0x211d26,
    accent: 0xf2a13a, // amber
    hero: 0xc9d2dd,
    bg: 'radial-gradient(120% 100% at 50% 0%, #2a2431 0%, #16131b 60%, #0d0b11 100%)',
  },
  gardens: {
    base: 0x4c5744,
    shadow: 0x18211c,
    accent: 0x4bbf94, // verdigris
    hero: 0xd0d6c6,
    bg: 'radial-gradient(120% 100% at 50% 0%, #202c26 0%, #131c16 60%, #0a110c 100%)',
  },
  archive: {
    base: 0x585044,
    shadow: 0x211d20,
    accent: 0xe9d9a2, // candle-ivory
    hero: 0xd7cdb8,
    bg: 'radial-gradient(120% 100% at 50% 0%, #2b2620 0%, #191510 60%, #0e0b08 100%)',
  },
  foundry: {
    base: 0x5a4a42,
    shadow: 0x231917,
    accent: 0xff7a33, // ember-orange
    hero: 0xd9c7bd,
    bg: 'radial-gradient(120% 100% at 50% 0%, #2f2019 0%, #1c1310 60%, #100a08 100%)',
  },
  chapel: {
    base: 0x555056,
    shadow: 0x1f1b23,
    accent: 0xb14a5e, // bone & wine
    hero: 0xd8cfc4,
    bg: 'radial-gradient(120% 100% at 50% 0%, #2a2430 0%, #18131b 60%, #0d0a10 100%)',
  },
};

export function paletteForBiome(biomeId: string): Palette {
  return PALETTES[biomeId] ?? PALETTES.gatehouse!;
}
