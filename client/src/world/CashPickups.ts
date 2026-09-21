import { COURSE, formatCash } from '@money/shared';
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshLambertMaterial,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
} from 'three';
import type { NetPickupState } from '../net/netTypes.js';
import { worldTextures } from './WorldTextures.js';

/** Pickups the server can have out at once. Matches the server's pool. */
const POOL = 12;

interface Slot {
  readonly root: Group;
  readonly stack: Mesh;
  readonly label: Sprite;
  readonly canvas: HTMLCanvasElement;
  readonly texture: CanvasTexture;
  amount: number;
  bornAt: number;
}

/**
 * THE CASH PICKUPS on the lava route: a stack of notes hovering over the
 * river under a "+100 Bills" label. Drawn from the replicated pool and
 * nothing else; the server decides when one appears and who took it.
 */
export class CashPickups {
  readonly root = new Group();

  private readonly slots: Slot[] = [];
  private readonly geometry = new BoxGeometry(1.6, 0.9, 1.1);
  private readonly material: MeshLambertMaterial;
  private time = 0;

  constructor() {
    this.material = new MeshLambertMaterial({ map: worldTextures.bills('#5ed64f', '#1d7a36') });
    this.material.emissive.setHex(0x46d66a);
    this.material.emissiveIntensity = 0.3;

    for (let i = 0; i < POOL; i += 1) {
      const root = new Group();
      root.visible = false;
      const stack = new Mesh(this.geometry, this.material);
      stack.castShadow = true;
      root.add(stack);
      const second = new Mesh(this.geometry, this.material);
      second.position.set(0.3, 0.9, 0.2);
      second.rotation.y = 0.5;
      root.add(second);

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 80;
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = LinearFilter;
      const label = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: false }));
      label.scale.set(5.2, 1.6, 1);
      label.position.y = 3.2;
      root.add(label);

      this.root.add(root);
      this.slots.push({ root, stack, label, canvas, texture, amount: -1, bornAt: 0 });
    }
  }

  /** Mirror the replicated pool. Cheap: a compare per slot. */
  apply(pickups: ArrayLike<NetPickupState> | null): void {
    for (let i = 0; i < POOL; i += 1) {
      const slot = this.slots[i];
      const state = pickups?.[i];
      if (!slot) continue;
      if (!state || !state.active) {
        slot.root.visible = false;
        continue;
      }
      slot.root.visible = true;
      slot.root.position.x = state.x;
      slot.root.position.z = state.z;
      slot.bornAt = state.bornAt;
      if (state.amount !== slot.amount) {
        slot.amount = state.amount;
        this.paint(slot);
      }
    }
  }

  advance(delta: number, _elapsed: number): void {
    this.time += delta;
    for (let i = 0; i < this.slots.length; i += 1) {
      const slot = this.slots[i];
      if (!slot || !slot.root.visible) continue;
      slot.root.position.y = COURSE.bridgeTopY + 1.4 + Math.sin(this.time * 2 + i) * 0.3;
      slot.root.rotation.y = this.time * 1.2 + i;
    }
  }

  private paint(slot: Slot): void {
    const ctx = slot.canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = slot.canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = '700 44px "Fredoka", "Baloo 2", "Segoe UI", system-ui, sans-serif';
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(20, 24, 40, 0.92)';
    const text = `+${formatCash(slot.amount)} Bills`;
    ctx.strokeText(text, width / 2, height / 2);
    ctx.fillStyle = '#8dff7a';
    ctx.fillText(text, width / 2, height / 2);
    slot.texture.needsUpdate = true;
  }

  dispose(): void {
    for (const slot of this.slots) {
      slot.texture.dispose();
      (slot.label.material as SpriteMaterial).dispose();
    }
    this.geometry.dispose();
    this.material.dispose();
    this.root.removeFromParent();
  }
}
