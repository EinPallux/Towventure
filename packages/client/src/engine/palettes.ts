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
};

export function paletteForBiome(biomeId: string): Palette {
  return PALETTES[biomeId] ?? PALETTES.gatehouse!;
}
