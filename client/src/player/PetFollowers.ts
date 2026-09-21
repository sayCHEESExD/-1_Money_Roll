import { RARITY_COLOR, RARITY_LABEL, decodeIndices, decodePets, petById, type PetDefinition } from '@money/shared';
import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  Group,
  LinearFilter,
  Mesh,
  MeshLambertMaterial,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  type BufferGeometry,
} from 'three';
import { css } from '../config/worldVisuals.js';

/** Where the pets hover, in the character's own space: behind and beside. */
const SLOTS: readonly { x: number; z: number }[] = [
  { x: -2.4, z: -1.6 },
  { x: 2.4, z: -1.6 },
  { x: -3.4, z: -4.0 },
  { x: 3.4, z: -4.0 },
  { x: 0, z: -4.6 },
  { x: -4.6, z: -6.2 },
  { x: 4.6, z: -6.2 },
  { x: 0, z: -7.4 },
];

const HOVER_Y = 1.1;

/** Shared geometry: every pet is a handful of these. */
const BODY = new BoxGeometry(1.1, 0.8, 1.5);
const HEAD = new BoxGeometry(0.95, 0.85, 0.85);
const EAR = new BoxGeometry(0.28, 0.5, 0.18);
const LONG_EAR = new BoxGeometry(0.26, 0.9, 0.16);
const TAIL = new BoxGeometry(0.22, 0.22, 0.7);
const HORN = new ConeGeometry(0.16, 0.7, 6);
const WING = new BoxGeometry(0.9, 0.14, 0.5);
const CROWN = new BoxGeometry(0.7, 0.3, 0.7);
const SNOUT = new BoxGeometry(0.5, 0.36, 0.34);

const materials = new Map<number, MeshLambertMaterial>();
const materialFor = (color: number): MeshLambertMaterial => {
  let material = materials.get(color);
  if (!material) {
    material = new MeshLambertMaterial({ color });
    materials.set(color, material);
  }
  return material;
};

interface Follower {
  readonly id: string;
  readonly root: Group;
  readonly label: Sprite;
  readonly labelMaterial: SpriteMaterial;
  readonly labelTexture: CanvasTexture;
  readonly phase: number;
}

/**
 * THE EQUIPPED PETS, following the player.
 *
 * Built from the replicated inventory and equipped set, so the local player
 * and every remote wear exactly what the server says. Each pet is a small
 * blocky creature - a body, a head and the one or two parts that make its
 * shape - hovering in a fixed slot beside or behind the character with a
 * gentle bob, under a label with its name and rarity, as the reference shows.
 */
export class PetFollowers {
  readonly root = new Group();

  private readonly followers: Follower[] = [];
  private signature = '';
  private time = 0;

  /** Rebuild only when the equipped set actually changed. */
  set(pets: string, equipped: string): void {
    const signature = `${pets}|${equipped}`;
    if (signature === this.signature) return;
    this.signature = signature;

    for (const follower of this.followers) this.release(follower);
    this.followers.length = 0;

    const owned = decodePets(pets);
    const worn = decodeIndices(equipped);
    let slot = 0;
    for (const index of worn) {
      const id = owned[index];
      const pet = id ? petById(id) : undefined;
      if (!pet || slot >= SLOTS.length) continue;
      this.followers.push(this.build(pet, slot));
      slot += 1;
    }
  }

  update(delta: number): void {
    this.time += Math.max(0, delta);
    for (let i = 0; i < this.followers.length; i += 1) {
      const follower = this.followers[i];
      const slot = SLOTS[i];
      if (!follower || !slot) continue;
      const bob = Math.sin(this.time * 2.4 + follower.phase) * 0.18;
      follower.root.position.set(slot.x, HOVER_Y + bob, slot.z);
      follower.root.rotation.y = Math.sin(this.time * 0.9 + follower.phase) * 0.18;
    }
  }

  dispose(): void {
    for (const follower of this.followers) this.release(follower);
    this.followers.length = 0;
    this.root.removeFromParent();
  }

  private build(pet: PetDefinition, slot: number): Follower {
    const group = new Group();
    const main = materialFor(pet.color);
    const accent = materialFor(pet.accent);

    const add = (geometry: BufferGeometry, material: MeshLambertMaterial, x: number, y: number, z: number, ry = 0, rz = 0): Mesh => {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.set(0, ry, rz);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };

    add(BODY, main, 0, 0, 0);
    add(HEAD, main, 0, 0.55, 0.85);

    switch (pet.shape) {
      case 'dog':
      case 'wolf':
        add(EAR, accent, -0.32, 1.0, 0.75, 0, 0.35);
        add(EAR, accent, 0.32, 1.0, 0.75, 0, -0.35);
        add(SNOUT, accent, 0, 0.4, 1.35);
        add(TAIL, main, 0, 0.35, -0.95, 0, 0.5);
        break;
      case 'cat':
      case 'tiger':
      case 'fox':
        add(EAR, accent, -0.3, 1.05, 0.8);
        add(EAR, accent, 0.3, 1.05, 0.8);
        add(TAIL, pet.shape === 'fox' ? accent : main, 0.3, 0.3, -1.0, 0.4, 0.7);
        break;
      case 'bunny':
        add(LONG_EAR, accent, -0.26, 1.35, 0.7);
        add(LONG_EAR, accent, 0.26, 1.35, 0.7);
        break;
      case 'panda':
        add(EAR, accent, -0.36, 1.0, 0.8);
        add(EAR, accent, 0.36, 1.0, 0.8);
        add(SNOUT, accent, 0, 0.5, 1.3);
        break;
      case 'unicorn':
        add(HORN, accent, 0, 1.25, 0.95);
        add(TAIL, accent, 0, 0.35, -0.95, 0, 0.6);
        break;
      case 'dragon':
      case 'phoenix':
        add(WING, accent, -0.9, 0.5, -0.2, 0, 0.5);
        add(WING, accent, 0.9, 0.5, -0.2, 0, -0.5);
        add(TAIL, main, 0, 0.3, -1.0);
        break;
      case 'golem':
        add(CROWN, accent, 0, 1.1, 0.85);
        break;
      case 'king':
        add(CROWN, accent, 0, 1.12, 0.85);
        add(TAIL, main, 0, 0.35, -0.95, 0, 0.5);
        break;
    }

    // The label: name over rarity, in the rarity's colour.
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.font = '700 40px "Fredoka", "Baloo 2", "Segoe UI", system-ui, sans-serif';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(20, 24, 40, 0.9)';
      ctx.strokeText(pet.name, 128, 30);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(pet.name, 128, 30);
      ctx.font = '700 28px "Fredoka", "Baloo 2", "Segoe UI", system-ui, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeText(RARITY_LABEL[pet.rarity], 128, 70);
      ctx.fillStyle = css(RARITY_COLOR[pet.rarity]);
      ctx.fillText(RARITY_LABEL[pet.rarity], 128, 70);
    }
    const labelTexture = new CanvasTexture(canvas);
    labelTexture.colorSpace = SRGBColorSpace;
    labelTexture.generateMipmaps = false;
    labelTexture.minFilter = LinearFilter;
    const labelMaterial = new SpriteMaterial({ map: labelTexture, transparent: true, depthWrite: false, fog: false });
    const label = new Sprite(labelMaterial);
    label.scale.set(3.2, 1.2, 1);
    label.position.set(0, 1.9, 0.4);
    group.add(label);

    this.root.add(group);
    return { id: pet.id, root: group, label, labelMaterial, labelTexture, phase: slot * 1.7 };
  }

  private release(follower: Follower): void {
    follower.labelTexture.dispose();
    follower.labelMaterial.dispose();
    follower.root.removeFromParent();
  }
}
