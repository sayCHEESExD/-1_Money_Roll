import { auraBySlot, type AuraStyle } from '@money/shared';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  RingGeometry,
} from 'three';
import { createPointsMaterial } from './pointsMaterial.js';

/** Motes orbiting the player. Fixed, so an aura's cost is known. */
const MOTES = 56;

interface StyleTuning {
  readonly radius: number;
  readonly height: number;
  /** Turns per second. */
  readonly spin: number;
  readonly size: number;
  /** How many of the motes are drawn. */
  readonly share: number;
  /** Ground disc opacity. */
  readonly disc: number;
  /** The ring breathes in and out. */
  readonly breathe: number;
  /** Motes climb as they orbit. */
  readonly rise: number;
  /** Hue cycles through the rainbow. The troll. */
  readonly rainbow: boolean;
}

const STYLES: Readonly<Record<AuraStyle, StyleTuning>> = {
  dust: { radius: 1.6, height: 1.2, spin: 0.45, size: 1.0, share: 0.55, disc: 0.22, breathe: 0.1, rise: 0.25, rainbow: false },
  nature: { radius: 1.7, height: 3.0, spin: 0.35, size: 1.5, share: 0.7, disc: 0.3, breathe: 0.08, rise: 0.4, rainbow: false },
  fire: { radius: 1.5, height: 3.6, spin: 0.9, size: 1.7, share: 0.9, disc: 0.4, breathe: 0.2, rise: 1.1, rainbow: false },
  troll: { radius: 2.2, height: 3.8, spin: 0.8, size: 1.9, share: 1, disc: 0.45, breathe: 0.35, rise: 0.6, rainbow: true },
};

/**
 * THE AURA: the swirl of dust, leaves, flame or rainbow that visibly
 * surrounds a player wearing one.
 *
 * Parented to the character's root so it follows for free, and cheap on
 * purpose: it is drawn for every visible player. Fifty-six motes on one
 * `Points` mesh and a ground disc. Motes are placed by a formula of time
 * rather than simulated, so the per-frame cost is a loop of sines and one
 * upload.
 */
export class AuraEffect {
  readonly root = new Group();

  private readonly geometry = new BufferGeometry();
  private readonly positions = new Float32Array(MOTES * 3);
  private readonly colors = new Float32Array(MOTES * 3);
  private readonly sizes = new Float32Array(MOTES);
  private readonly lives = new Float32Array(MOTES);
  private readonly points: Points;
  private readonly material = createPointsMaterial(true);

  private readonly discMaterial = new MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  });
  private readonly discGeometry = new RingGeometry(0.5, 2.1, 32);
  private readonly disc: Mesh;

  private slot = 0;
  private tuning: StyleTuning = STYLES.dust;
  private time = 0;
  private readonly color = new Color();
  private readonly scratch = new Color();

  constructor() {
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aColor', new BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('aSize', new BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aLife', new BufferAttribute(this.lives, 1));
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;

    this.disc = new Mesh(this.discGeometry, this.discMaterial);
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.position.y = 0.06;

    this.root.add(this.points, this.disc);
    this.root.visible = false;
  }

  setSlot(slot: number): void {
    if (slot === this.slot) return;
    this.slot = slot;
    const tier = auraBySlot(slot);
    this.root.visible = tier !== undefined;
    if (!tier) return;
    this.tuning = STYLES[tier.style];
    this.color.setHex(tier.color);
    this.discMaterial.color.setHex(tier.color);
    this.discMaterial.opacity = this.tuning.disc;
    this.paint(0);
    (this.geometry.getAttribute('aSize') as BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('aLife') as BufferAttribute).needsUpdate = true;
  }

  /** @param yaw the character's facing, unused by the swirl but kept for parity. */
  update(delta: number, _yaw: number): void {
    if (!this.root.visible) return;
    this.time += Math.max(0, delta);
    const t = this.tuning;
    const breathe = 1 + t.breathe * Math.sin(this.time * 2.2);
    const radius = t.radius * breathe;
    const count = Math.floor(MOTES * t.share);

    for (let i = 0; i < count; i += 1) {
      const k = i / count;
      const angle = k * Math.PI * 2 + this.time * t.spin * Math.PI * 2;
      // A helix: motes climb as they orbit, then wrap.
      const height = ((k * 3 + this.time * t.rise) % 1) * t.height + 0.25;
      const at = i * 3;
      const r = radius * (0.8 + (i % 4) * 0.08);
      this.positions[at] = Math.cos(angle) * r;
      this.positions[at + 1] = height;
      this.positions[at + 2] = Math.sin(angle) * r;
    }
    this.geometry.setDrawRange(0, count);
    (this.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;

    if (t.rainbow) {
      this.paint(this.time);
      this.discMaterial.color.setHSL((this.time * 0.25) % 1, 0.9, 0.6);
    }

    this.disc.rotation.z = this.time * 0.8;
    this.disc.scale.setScalar(radius / 1.8);
  }

  /** Write the mote colours: the tier's, or a rainbow cycled by time. */
  private paint(time: number): void {
    for (let i = 0; i < MOTES; i += 1) {
      const at = i * 3;
      const bright = i % 3 === 0 ? 1.25 : 1;
      const color = this.tuning.rainbow
        ? this.scratch.setHSL((i / MOTES + time * 0.25) % 1, 0.95, 0.62)
        : this.color;
      this.colors[at] = Math.min(1, color.r * bright);
      this.colors[at + 1] = Math.min(1, color.g * bright);
      this.colors[at + 2] = Math.min(1, color.b * bright);
      this.sizes[i] = this.tuning.size * (0.7 + (i % 5) * 0.12);
      this.lives[i] = i < MOTES * this.tuning.share ? 0.9 : 0;
    }
    (this.geometry.getAttribute('aColor') as BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.discGeometry.dispose();
    this.discMaterial.dispose();
    this.root.removeFromParent();
  }
}
