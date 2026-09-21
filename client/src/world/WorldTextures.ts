import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

/**
 * Every texture in the game, drawn at runtime on a canvas.
 *
 * There is not one image file in this build's WORLD. Square Roblox-style
 * studs on grass, brick and stone; the money bills the meadow, the ball and
 * the bridges are made of; the lava - all cost a few kilobytes of code and
 * nothing against the 12 MB budget. Textures are cached and shared, so ten
 * bill colours are ten textures for the whole client.
 */
export class WorldTextures {
  private readonly cache = new Map<string, Texture>();

  /**
   * SQUARE STUDS: the environment's signature surface, straight from the
   * reference texture - a grid of rounded squares, each outlined in a darker
   * shade with a lighter inner face, on a flat base colour. Four to a tile.
   */
  studs(base: string, edge: string, cells = 4): Texture {
    return this.cached(`studs:${base}:${edge}:${cells}`, () => {
      const size = 128;
      const ctx = context(size);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      const pitch = size / cells;
      const inset = pitch * 0.2;
      const stud = pitch - inset * 2;
      const radius = stud * 0.18;
      for (let ix = 0; ix < cells; ix += 1) {
        for (let iy = 0; iy < cells; iy += 1) {
          const x = ix * pitch + inset;
          const y = iy * pitch + inset;
          // The dark outline, then the face a touch lighter than the base.
          ctx.fillStyle = edge;
          roundRect(ctx, x, y, stud, stud, radius);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.13)';
          roundRect(ctx, x + stud * 0.14, y + stud * 0.14, stud * 0.72, stud * 0.72, radius * 0.8);
          ctx.fill();
          ctx.fillStyle = base;
          roundRect(ctx, x + stud * 0.14, y + stud * 0.14, stud * 0.72, stud * 0.72, radius * 0.8);
          ctx.globalAlpha = 0.85;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      return ctx.canvas;
    });
  }

  /**
   * MONEY BILLS: the meadow's paving, the ball's skin and the bridge's notes.
   *
   * Two bills to a tile, each a rounded note with a double border, an oval
   * seal carrying a dollar sign, and denomination squares in the corners. The
   * base colour is the equipped bill's, so the whole money economy is
   * visibly one colour.
   */
  bills(base: string, ink: string): Texture {
    return this.cached(`bills:${base}:${ink}`, () => {
      const size = 128;
      const ctx = context(size);
      ctx.fillStyle = ink;
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 2; i += 1) {
        const y = i * (size / 2);
        const noteX = 3;
        const noteY = y + 4;
        const noteW = size - 6;
        const noteH = size / 2 - 8;
        ctx.fillStyle = base;
        roundRect(ctx, noteX, noteY, noteW, noteH, 5);
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2;
        roundRect(ctx, noteX + 5, noteY + 5, noteW - 10, noteH - 10, 4);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        roundRect(ctx, noteX + 8, noteY + 8, noteW - 16, noteH - 16, 3);
        ctx.stroke();
        // The seal.
        const cx = size / 2;
        const cy = noteY + noteH / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 15, 19, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = ink;
        ctx.font = '900 26px "Arial Black", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', cx, cy + 1);
        // Corner denominations.
        ctx.font = '900 11px "Arial Black", Arial, sans-serif';
        for (const [dx, dy] of [
          [noteX + 15, noteY + 14],
          [noteX + noteW - 15, noteY + 14],
          [noteX + 15, noteY + noteH - 14],
          [noteX + noteW - 15, noteY + noteH - 14],
        ] as const) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillRect(dx - 8, dy - 7, 16, 14);
          ctx.fillStyle = ink;
          ctx.fillText('1', dx, dy + 1);
        }
      }
      return ctx.canvas;
    });
  }

  /**
   * LAVA: an orange stud plate with hot squares glowing through it, as the
   * reference has it. The material carries the glow; this is the pattern.
   */
  lava(base: string, hot: string): Texture {
    return this.cached(`lava:${base}:${hot}`, () => {
      const size = 128;
      const ctx = context(size);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      const cells = 4;
      const pitch = size / cells;
      const random = seeded(0x1a4a);
      for (let ix = 0; ix < cells; ix += 1) {
        for (let iy = 0; iy < cells; iy += 1) {
          const x = ix * pitch + pitch * 0.18;
          const y = iy * pitch + pitch * 0.18;
          const s = pitch * 0.64;
          const heat = 0.35 + random() * 0.65;
          ctx.fillStyle = 'rgba(120,30,0,0.35)';
          roundRect(ctx, x, y, s, s, 4);
          ctx.fill();
          ctx.globalAlpha = heat;
          ctx.fillStyle = hot;
          roundRect(ctx, x + 2, y + 2, s - 4, s - 4, 3);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      return ctx.canvas;
    });
  }

  /**
   * BLOCK WALLS: the same square-stud language as the floor, at wall scale.
   *
   * Four blocks to a tile - the same pitch as the floor's studs - each a
   * rounded square outlined in the seam colour with a bevel, a light top-left
   * edge and a dark bottom-right, so a wall reads as stacked toy blocks
   * rather than as mortar and brick, and still as a different, chunkier
   * material than the ground it stands on.
   */
  brick(base: string, seam: string): Texture {
    return this.cached(`blocks:${base}:${seam}`, () => {
      const size = 128;
      const ctx = context(size);
      ctx.fillStyle = seam;
      ctx.fillRect(0, 0, size, size);
      const cells = 4;
      const pitch = size / cells;
      const inset = pitch * 0.07;
      const block = pitch - inset * 2;
      const radius = block * 0.12;
      for (let ix = 0; ix < cells; ix += 1) {
        for (let iy = 0; iy < cells; iy += 1) {
          const x = ix * pitch + inset;
          const y = iy * pitch + inset;
          // The block face.
          ctx.fillStyle = base;
          roundRect(ctx, x, y, block, block, radius);
          ctx.fill();
          // The bevel: light along the top and left, dark along the bottom and right.
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          roundRect(ctx, x, y, block, block * 0.16, radius);
          ctx.fill();
          roundRect(ctx, x, y, block * 0.14, block, radius);
          ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.16)';
          roundRect(ctx, x, y + block * 0.84, block, block * 0.16, radius);
          ctx.fill();
          roundRect(ctx, x + block * 0.86, y, block * 0.14, block, radius);
          ctx.fill();
          // The stud on the face: the floor's motif, one per block.
          const stud = block * 0.46;
          const sx = x + (block - stud) / 2;
          const sy = y + (block - stud) / 2;
          ctx.fillStyle = seam;
          roundRect(ctx, sx, sy, stud, stud, stud * 0.18);
          ctx.fill();
          ctx.fillStyle = base;
          ctx.globalAlpha = 0.9;
          roundRect(ctx, sx + stud * 0.14, sy + stud * 0.14, stud * 0.72, stud * 0.72, stud * 0.14);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(255,255,255,0.14)';
          roundRect(ctx, sx + stud * 0.14, sy + stud * 0.14, stud * 0.72, stud * 0.3, stud * 0.14);
          ctx.fill();
        }
      }
      return ctx.canvas;
    });
  }

  /**
   * LIT WINDOWS: a building's walls. Two floors of two windows to a tile on
   * the wall colour, each a glass pane in a dark frame; a seeded few glow
   * warm, so a city looks lived in without a single light source.
   */
  windows(base: string, frame: string): Texture {
    return this.cached(`windows:${base}:${frame}`, () => {
      const size = 128;
      const ctx = context(size);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      const random = seeded(0x5150);
      const cols = 2;
      const rows = 2;
      const pw = size / cols;
      const ph = size / rows;
      for (let ix = 0; ix < cols; ix += 1) {
        for (let iy = 0; iy < rows; iy += 1) {
          const x = ix * pw + pw * 0.22;
          const y = iy * ph + ph * 0.18;
          const w = pw * 0.56;
          const h = ph * 0.6;
          ctx.fillStyle = frame;
          roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 4);
          ctx.fill();
          const lit = random() < 0.45;
          ctx.fillStyle = lit ? '#ffe9a6' : '#8fd3ff';
          roundRect(ctx, x, y, w, h, 3);
          ctx.fill();
          ctx.fillStyle = lit ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.45)';
          roundRect(ctx, x + 3, y + 3, w * 0.4, h * 0.35, 2);
          ctx.fill();
          ctx.fillStyle = frame;
          ctx.fillRect(x + w / 2 - 1.5, y, 3, h);
          ctx.fillRect(x, y + h / 2 - 1.5, w, 3);
        }
      }
      // The block seam along the top and left, like every other block face.
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(0, 0, size, 5);
      ctx.fillRect(0, 0, 5, size);
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(0, size - 5, size, 5);
      ctx.fillRect(size - 5, 0, 5, size);
      return ctx.canvas;
    });
  }

  dispose(): void {
    for (const texture of this.cache.values()) texture.dispose();
    this.cache.clear();
  }

  private cached(key: string, draw: () => HTMLCanvasElement, repeat = true): Texture {
    const existing = this.cache.get(key);
    if (existing) return existing;
    const texture = new CanvasTexture(draw());
    texture.colorSpace = SRGBColorSpace;
    if (repeat) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
    }
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    this.cache.set(key, texture);
    return texture;
  }
}

const context = (size: number): CanvasRenderingContext2D => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

/** Deterministic PRNG, so every client draws exactly the same surface. */
const seeded = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** THE ONE texture cache for the client. The ball, the bridges and the world all share it. */
export const worldTextures = new WorldTextures();
