/**
 * Share cards (GDD §7.1) — a one-click PNG of a run's death or a Skirmish duel, drawn
 * on a 2D canvas (procedural, zero binary assets). The share-card pipeline is a core
 * retention feature (Discord bragging), and doubles as the press-kit screenshot source.
 * Everything here is pure canvas drawing + a download/clipboard helper.
 */

const W = 800;
const H = 420;

export interface DeathCard {
  kind: 'death';
  name: string;
  className: string;
  floor: number;
  bestFloor: number;
  fightsWon: number;
  damageDealt: number;
  honor: number;
  tier: string;
  killer: string;
  accent: string; // biome accent as a CSS colour
}

export interface DuelCard {
  kind: 'duel';
  attacker: string;
  defender: string;
  won: boolean;
  honorDelta: number;
  keyAwarded: boolean;
  accent: string;
}

export type ShareCard = DeathCard | DuelCard;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function base(ctx: CanvasRenderingContext2D, accent: string): void {
  const g = ctx.createRadialGradient(W / 2, 0, 40, W / 2, H, H);
  g.addColorStop(0, '#2a2431');
  g.addColorStop(0.6, '#16131b');
  g.addColorStop(1, '#0d0b11');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  roundRect(ctx, 8, 8, W - 16, H - 16, 18);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = '700 20px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('TOWVENTURE', 40, 56);
}

function stat(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, value: string): void {
  ctx.fillStyle = '#9a9186';
  ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(label.toUpperCase(), x, y);
  ctx.fillStyle = '#e9e3d6';
  ctx.font = '800 26px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(value, x, y + 30);
}

function drawDeath(ctx: CanvasRenderingContext2D, c: DeathCard): void {
  base(ctx, c.accent);
  ctx.fillStyle = '#9a9186';
  ctx.font = '600 14px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('HERE THEY FELL', 40, 108);
  ctx.fillStyle = '#e9e3d6';
  ctx.font = '800 40px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${c.name} · Floor ${c.floor}`, 40, 152);
  ctx.fillStyle = c.accent;
  ctx.font = '600 18px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${c.className}  ·  ${c.tier}`, 40, 182);
  ctx.fillStyle = '#9a9186';
  ctx.font = 'italic 16px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${c.killer} put them down.`, 40, 210);

  const y = 300;
  stat(ctx, 40, y, 'Deepest', `${c.bestFloor}`);
  stat(ctx, 200, y, 'Fights won', `${c.fightsWon}`);
  stat(ctx, 400, y, 'Damage', `${c.damageDealt}`);
  stat(ctx, 620, y, 'Honor', `${c.honor}`);
  ctx.fillStyle = '#6a6252';
  ctx.font = '500 13px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('The Tower keeps what it kills. Climb anyway.', 40, H - 34);
}

function drawDuel(ctx: CanvasRenderingContext2D, c: DuelCard): void {
  base(ctx, c.accent);
  ctx.fillStyle = '#9a9186';
  ctx.font = '600 14px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('SKIRMISH', 40, 108);
  ctx.fillStyle = '#e9e3d6';
  ctx.font = '800 38px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${c.attacker}  vs  ${c.defender}`, 40, 156);
  ctx.fillStyle = c.won ? '#6fbf73' : '#d8564e';
  ctx.font = '800 30px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(c.won ? 'VICTORY' : 'DEFEATED', 40, 210);

  const y = 300;
  stat(ctx, 40, y, 'Honor', `${c.honorDelta >= 0 ? '+' : ''}${c.honorDelta}`);
  if (c.keyAwarded) stat(ctx, 260, y, "Champion's Key", '🗝 +1');
  ctx.fillStyle = '#6a6252';
  ctx.font = '500 13px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('Attack from the Rival Board. The defender risks nothing.', 40, H - 34);
}

/** Render a card to a canvas and return it (caller downloads or draws it). */
export function renderCard(card: ShareCard): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    if (card.kind === 'death') drawDeath(ctx, card);
    else drawDuel(ctx, card);
  }
  return canvas;
}

/** Trigger a PNG download of a share card. */
export function downloadCard(card: ShareCard, filename = 'towventure.png'): void {
  const canvas = renderCard(card);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
