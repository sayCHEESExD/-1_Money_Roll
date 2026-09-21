import { RARITY_COLOR, RARITY_LABEL, decodeIndices, decodePets, petById, type PetDefinition, type PetRarity } from '@money/shared';
import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RingGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { css, shade } from '../config/worldVisuals.js';
import { worldTextures } from '../world/WorldTextures.js';

/** Where the pets settle, in the character's own space: behind and beside. */
const SLOTS: readonly { x: number; z: number }[] = [
  { x: -2.4, z: -1.8 },
  { x: 2.4, z: -1.8 },
  { x: -3.4, z: -4.2 },
  { x: 3.4, z: -4.2 },
  { x: 0, z: -4.8 },
  { x: -4.6, z: -6.4 },
  { x: 4.6, z: -6.4 },
  { x: 0, z: -7.6 },
];

/** Feet height above the floor, so the legs stand on it. */
const FEET_Y = 0.62;
/** How quickly a pet catches up with its slot, per second. Lower is lazier. */
const FOLLOW_RATE = 6;
/** Faster than this and the pet is bounding after the player. */
const BOUND_SPEED = 1.2;

// ------------------------------------------------------------- materials

const geometries = new Map<string, BufferGeometry>();
const box = (w: number, h: number, d: number): BufferGeometry => {
  const key = `b:${w}:${h}:${d}`;
  let geometry = geometries.get(key);
  if (!geometry) {
    geometry = new BoxGeometry(w, h, d);
    geometries.set(key, geometry);
  }
  return geometry;
};
const cone = (radius: number, height: number): BufferGeometry => {
  const key = `c:${radius}:${height}`;
  let geometry = geometries.get(key);
  if (!geometry) {
    geometry = new ConeGeometry(radius, height, 6);
    geometries.set(key, geometry);
  }
  return geometry;
};

const materials = new Map<string, Material>();
/** A studded block in this colour: the world's own material language, on the pets. */
const fur = (color: number): Material => {
  const key = `fur:${color}`;
  let material = materials.get(key);
  if (!material) {
    material = new MeshLambertMaterial({ map: worldTextures.studs(css(color), shade(color, 0.72), 2) });
    materials.set(key, material);
  }
  return material;
};
/** A plain block: small parts where studs would be noise. */
const plain = (color: number, emissive = 0): Material => {
  const key = `plain:${color}:${emissive}`;
  let material = materials.get(key);
  if (!material) {
    const lambert = new MeshLambertMaterial({ color });
    if (emissive > 0) {
      lambert.emissive.setHex(color);
      lambert.emissiveIntensity = emissive;
    }
    material = lambert;
    materials.set(key, material);
  }
  return material;
};
/** Money notes, for the one pet made of them. */
const notes = (color: number, ink: number): Material => {
  const key = `notes:${color}:${ink}`;
  let material = materials.get(key);
  if (!material) {
    material = new MeshLambertMaterial({ map: worldTextures.bills(css(color), css(ink)) });
    materials.set(key, material);
  }
  return material;
};
const glow = (color: number, opacity: number): Material => {
  const key = `glow:${color}:${opacity}`;
  let material = materials.get(key);
  if (!material) {
    material = new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: false });
    materials.set(key, material);
  }
  return material;
};

const INK = 0x1c2233;
const WHITE = 0xffffff;

/** The moving parts of one pet, for the idle and the bound. */
export interface PetRig {
  readonly root: Group;
  /** The body and everything on it, bobbed as one. */
  readonly body: Group;
  readonly legs: Mesh[];
  readonly tail: Mesh | null;
  readonly wings: Mesh[];
  readonly ears: Mesh[];
  readonly aura: Mesh | null;
  readonly sparkles: Mesh[];
}

// ------------------------------------------------------------- the models

/**
 * BUILD ONE PET: a finished, blocky collectible in the world's stud material.
 *
 * Every pet shares a skeleton - body, head, four legs, two eyes - and each
 * shape adds what makes it itself: a fox's white bib and black socks, a
 * tiger's stripes, a bunny's tall ears, a dragon's wings and belly plate, the
 * Money King's crown and cape and a body made of notes. Rarer pets stand on a
 * ring of their rarity's colour, and the legendary ones carry sparkles.
 *
 * Shared by the followers in the world and the portrait renderer for the
 * menus, so a pet looks the same in both.
 */
export const buildPetModel = (pet: PetDefinition): PetRig => {
  const root = new Group();
  const body = new Group();
  root.add(body);
  const main = pet.shape === 'king' ? notes(pet.color, 0x1d7a36) : fur(pet.color);
  const accent = fur(pet.accent);
  const accentPlain = plain(pet.accent);
  const legs: Mesh[] = [];
  const wings: Mesh[] = [];
  const ears: Mesh[] = [];
  const sparkles: Mesh[] = [];
  let tail: Mesh | null = null;

  const add = (
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    parent: Object3D = body,
  ): Mesh => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // The skeleton. Proportions per family: stocky, slim or long.
  const stocky = pet.shape === 'panda' || pet.shape === 'golem' || pet.shape === 'king';
  const slim = pet.shape === 'cat' || pet.shape === 'fox' || pet.shape === 'unicorn';
  const bw = stocky ? 1.3 : slim ? 0.9 : 1.05;
  const bh = stocky ? 1.0 : 0.78;
  const bd = slim ? 1.55 : 1.4;
  const bodyY = FEET_Y + bh / 2 - 0.12;
  const legMaterial = pet.shape === 'fox' || pet.shape === 'panda' ? plain(pet.accent) : main;
  const legSpots: readonly (readonly [number, number])[] = [
    [-bw / 2 + 0.2, bd / 2 - 0.25],
    [bw / 2 - 0.2, bd / 2 - 0.25],
    [-bw / 2 + 0.2, -bd / 2 + 0.25],
    [bw / 2 - 0.2, -bd / 2 + 0.25],
  ];
  for (const [lx, lz] of legSpots) {
    legs.push(add(box(0.3, FEET_Y, 0.3), legMaterial, lx, FEET_Y / 2, lz));
  }
  add(box(bw, bh, bd), main, 0, bodyY, 0);

  const hw = stocky ? 1.05 : 0.9;
  const headY = bodyY + bh / 2 + 0.28;
  const headZ = bd / 2 + 0.15;
  const head = add(box(hw, 0.82, 0.82), main, 0, headY, headZ);
  // The eyes: ink with a white glint, always forward.
  for (const sx of [-1, 1]) {
    add(box(0.16, 0.2, 0.06), plain(INK), sx * 0.24, headY + 0.1, headZ + 0.42);
    add(box(0.06, 0.06, 0.03), plain(WHITE, 1), sx * 0.24 + 0.04, headY + 0.16, headZ + 0.46);
  }

  const snout = (color: Material, w = 0.46, h = 0.3): void => {
    add(box(w, h, 0.3), color, 0, headY - 0.14, headZ + 0.5);
    add(box(0.16, 0.1, 0.08), plain(INK), 0, headY - 0.04, headZ + 0.68);
  };
  const pointyEars = (material: Material, spread = 0.3, size = 0.34): void => {
    for (const sx of [-1, 1]) ears.push(add(cone(size * 0.55, size * 1.4), material, sx * spread, headY + 0.55, headZ - 0.1, 0, 0, sx * -0.18));
  };
  const roundEars = (material: Material, spread = 0.36): void => {
    for (const sx of [-1, 1]) ears.push(add(box(0.34, 0.34, 0.16), material, sx * spread, headY + 0.5, headZ - 0.12));
  };
  const spots = (material: Material, count: number, seed: number): void => {
    let a = seed;
    for (let i = 0; i < count; i += 1) {
      a = (a * 1664525 + 1013904223) >>> 0;
      const t = a / 4294967296;
      a = (a * 1664525 + 1013904223) >>> 0;
      const u = a / 4294967296;
      const sx = t < 0.5 ? -1 : 1;
      add(box(0.26, 0.26, 0.06), material, sx * (bw / 2 + 0.01), bodyY - 0.2 + u * 0.5, (t * 2 - Math.floor(t * 2) - 0.5) * (bd - 0.4), 0, Math.PI / 2, 0);
    }
  };
  const stripes = (material: Material): void => {
    for (let i = -1; i <= 1; i += 1) {
      add(box(bw + 0.04, 0.14, 0.2), material, 0, bodyY + 0.2, i * 0.42);
    }
    add(box(hw + 0.04, 0.12, 0.16), material, 0, headY + 0.3, headZ - 0.1);
  };

  switch (pet.shape) {
    case 'dog': {
      // A Dalmatian: white, black spots, floppy black ears and a wagging tail.
      spots(accentPlain, 7, 11);
      add(box(0.24, 0.24, 0.06), accentPlain, 0.2, headY + 0.2, headZ + 0.42);
      for (const sx of [-1, 1]) ears.push(add(box(0.22, 0.5, 0.16), accent, sx * (hw / 2 + 0.02), headY + 0.05, headZ - 0.05, 0, 0, sx * -0.25));
      snout(fur(pet.color));
      tail = add(box(0.18, 0.18, 0.7), main, 0, bodyY + 0.25, -bd / 2 - 0.25, -0.6);
      add(box(0.7, 0.16, 0.16), plain(0xff4d4d), 0, headY - 0.38, headZ - 0.05);
      break;
    }
    case 'cat': {
      // A tabby: stripes, pointed ears, a long curling tail and a pink nose.
      stripes(accentPlain);
      pointyEars(accent, 0.3, 0.3);
      add(box(0.1, 0.08, 0.06), plain(0xff7fb5), 0, headY - 0.06, headZ + 0.44);
      tail = add(box(0.16, 0.16, 0.9), main, 0.25, bodyY + 0.3, -bd / 2 - 0.3, -0.9, 0, 0.3);
      add(box(0.16, 0.5, 0.16), accent, 0.25, bodyY + 0.95, -bd / 2 - 0.55);
      break;
    }
    case 'bunny': {
      // Tall ears with pink insides, a cotton tail, big front teeth.
      for (const sx of [-1, 1]) {
        const ear = add(box(0.26, 0.95, 0.16), main, sx * 0.24, headY + 0.85, headZ - 0.1, 0, 0, sx * -0.12);
        ears.push(ear);
        add(box(0.14, 0.7, 0.05), accentPlain, 0, 0.02, 0.07, 0, 0, 0, ear);
      }
      add(box(0.12, 0.12, 0.08), accentPlain, 0, headY - 0.08, headZ + 0.44);
      add(box(0.22, 0.16, 0.06), plain(WHITE), 0, headY - 0.26, headZ + 0.42);
      tail = add(box(0.34, 0.34, 0.34), plain(WHITE), 0, bodyY + 0.1, -bd / 2 - 0.1);
      break;
    }
    case 'fox': {
      // Orange with a white bib and tail tip, black socks, sharp ears.
      add(box(bw - 0.3, bh - 0.3, 0.1), plain(WHITE), 0, bodyY - 0.1, bd / 2 + 0.03);
      add(box(hw - 0.4, 0.34, 0.06), plain(WHITE), 0, headY - 0.22, headZ + 0.42);
      pointyEars(accent, 0.32, 0.36);
      snout(main, 0.4, 0.26);
      tail = add(box(0.3, 0.3, 0.9), main, 0, bodyY + 0.2, -bd / 2 - 0.4, -0.35);
      add(box(0.32, 0.32, 0.3), plain(WHITE), 0, 0, -0.55, 0, 0, 0, body);
      break;
    }
    case 'panda': {
      // White with black ears, eye patches, legs and a black band.
      roundEars(accent, 0.4);
      for (const sx of [-1, 1]) add(box(0.34, 0.36, 0.06), accentPlain, sx * 0.24, headY + 0.1, headZ + 0.4);
      add(box(bw + 0.04, 0.42, bd * 0.5), accent, 0, bodyY + 0.05, 0);
      snout(fur(pet.color), 0.42, 0.26);
      break;
    }
    case 'dragon': {
      // A baby dragon: gold belly plate, wings, horns, a spiked tail.
      add(box(bw - 0.3, bh - 0.2, 0.1), accentPlain, 0, bodyY - 0.05, bd / 2 + 0.03);
      for (const sx of [-1, 1]) {
        const wing = add(box(1.0, 0.1, 0.6), accent, sx * (bw / 2 + 0.45), bodyY + 0.45, -0.1, 0, 0, sx * 0.55);
        wings.push(wing);
      }
      for (const sx of [-1, 1]) ears.push(add(cone(0.14, 0.5), accentPlain, sx * 0.28, headY + 0.55, headZ - 0.1, 0, 0, sx * -0.3));
      snout(main, 0.5, 0.3);
      tail = add(box(0.22, 0.22, 0.9), main, 0, bodyY + 0.15, -bd / 2 - 0.4, -0.25);
      for (let i = 0; i < 3; i += 1) add(box(0.12, 0.28, 0.14), accentPlain, 0, bodyY + bh / 2 + 0.12, -0.45 + i * 0.4);
      break;
    }
    case 'wolf': {
      // Grey with a dark back and muzzle, tall ears, a bushy tail.
      add(box(bw + 0.04, 0.28, bd - 0.2), accent, 0, bodyY + bh / 2 - 0.1, -0.05);
      pointyEars(accent, 0.32, 0.4);
      snout(accent, 0.46, 0.32);
      tail = add(box(0.34, 0.34, 0.8), accent, 0, bodyY + 0.2, -bd / 2 - 0.38, -0.5);
      break;
    }
    case 'tiger': {
      // Orange, black stripes, round ears and white cheeks.
      stripes(accentPlain);
      roundEars(fur(pet.color), 0.38);
      for (const sx of [-1, 1]) add(box(0.26, 0.24, 0.06), plain(WHITE), sx * 0.3, headY - 0.18, headZ + 0.42);
      snout(fur(pet.color), 0.44, 0.28);
      tail = add(box(0.18, 0.18, 0.9), main, 0, bodyY + 0.25, -bd / 2 - 0.4, -0.4);
      break;
    }
    case 'unicorn': {
      // White with a gold horn, a pink mane and tail.
      add(cone(0.13, 0.75), plain(0xffd23f, 0.35), 0, headY + 0.72, headZ + 0.05);
      for (let i = 0; i < 3; i += 1) add(box(0.24, 0.3, 0.22), accent, 0, headY + 0.3 - i * 0.06, headZ - 0.35 - i * 0.24);
      for (const sx of [-1, 1]) ears.push(add(box(0.16, 0.34, 0.12), main, sx * 0.3, headY + 0.5, headZ - 0.15));
      snout(main, 0.4, 0.3);
      tail = add(box(0.3, 0.3, 0.7), accent, 0, bodyY + 0.2, -bd / 2 - 0.3, -0.6);
      break;
    }
    case 'phoenix': {
      // A fire bird: beak, crest, broad wings and long tail feathers, glowing.
      for (const sx of [-1, 1]) {
        const wing = add(box(1.15, 0.12, 0.75), accent, sx * (bw / 2 + 0.55), bodyY + 0.35, -0.05, 0, 0, sx * 0.45);
        wings.push(wing);
        add(box(0.5, 0.1, 0.4), plain(pet.color, 0.6), sx * 0.45, 0.04, -0.1, 0, 0, 0, wing);
      }
      add(cone(0.14, 0.4), plain(0xffd23f), 0, headY - 0.05, headZ + 0.55, Math.PI / 2);
      for (let i = 0; i < 3; i += 1) ears.push(add(box(0.14, 0.4, 0.12), plain(pet.accent, 0.5), (i - 1) * 0.2, headY + 0.6, headZ - 0.1 + Math.abs(i - 1) * 0.1, 0, 0, (i - 1) * 0.3));
      tail = add(box(0.7, 0.1, 0.9), plain(pet.accent, 0.5), 0, bodyY, -bd / 2 - 0.45, 0.35);
      add(box(bw - 0.2, bh - 0.2, 0.08), plain(0xffd23f, 0.4), 0, bodyY - 0.05, bd / 2 + 0.03);
      break;
    }
    case 'golem': {
      // A gold golem: big cubic blocks, glowing eyes, a stone crown.
      add(box(bw + 0.3, 0.4, bd + 0.3), accent, 0, bodyY - bh / 2 + 0.2, 0);
      for (const sx of [-1, 1]) add(box(0.5, 0.7, 0.5), main, sx * (bw / 2 + 0.3), bodyY + 0.15, 0.1);
      for (const sx of [-1, 1]) add(box(0.2, 0.2, 0.08), plain(0x7fe6ff, 1), sx * 0.24, headY + 0.1, headZ + 0.44);
      add(box(hw + 0.1, 0.24, 0.9), accent, 0, headY + 0.5, headZ);
      for (const sx of [-1, 0, 1]) add(box(0.22, 0.28, 0.22), accent, sx * 0.34, headY + 0.72, headZ);
      break;
    }
    case 'king': {
      // The Money King: a body of notes, a gold crown, a cape and a dollar seal.
      add(box(0.8, 0.28, 0.8), plain(0xffd23f, 0.3), 0, headY + 0.52, headZ);
      for (const sx of [-1, 0, 1]) add(cone(0.12, 0.34), plain(0xffd23f, 0.3), sx * 0.3, headY + 0.8, headZ);
      add(box(bw + 0.2, bh + 0.1, 0.12), plain(0xd8347f), 0, bodyY, -bd / 2 - 0.02);
      add(box(0.44, 0.44, 0.06), plain(0xffd23f, 0.3), 0, bodyY, bd / 2 + 0.04);
      tail = add(box(0.18, 0.18, 0.6), accent, 0, bodyY + 0.25, -bd / 2 - 0.3, -0.5);
      break;
    }
  }
  void head;

  // The rarity beneath: a ring for the uncommon and up, sparkles for the top.
  let aura: Mesh | null = null;
  const tier: readonly PetRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  const rank = tier.indexOf(pet.rarity);
  if (rank >= 1) {
    const ring = new Mesh(new RingGeometry(0.85 + rank * 0.05, 1.2 + rank * 0.08, 28), glow(RARITY_COLOR[pet.rarity], 0.35 + rank * 0.08));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    root.add(ring);
    aura = ring;
  }
  if (rank >= 4) {
    for (let i = 0; i < 4; i += 1) {
      const sparkle = new Mesh(box(0.14, 0.14, 0.14), plain(RARITY_COLOR[pet.rarity], 1));
      sparkle.position.set(Math.cos((i / 4) * Math.PI * 2) * 1.1, 0.8 + (i % 2) * 0.4, Math.sin((i / 4) * Math.PI * 2) * 1.1);
      root.add(sparkle);
      sparkles.push(sparkle);
    }
  }

  return { root, body, legs, tail, wings, ears, aura, sparkles };
};

// ------------------------------------------------------------ followers

interface Follower {
  readonly id: string;
  readonly rig: PetRig;
  readonly label: Sprite;
  readonly labelMaterial: SpriteMaterial;
  readonly labelTexture: CanvasTexture;
  readonly phase: number;
  /** Where the pet IS, in world space: it trails its slot rather than riding it. */
  readonly worldPosition: Vector3;
  placed: boolean;
  gait: number;
}

const scratchTarget = new Vector3();
const scratchLocal = new Vector3();

/**
 * THE EQUIPPED PETS, following the player.
 *
 * Built from the replicated inventory and equipped set, so the local player
 * and every remote wear exactly what the server says. Each pet stands in a
 * slot beside or behind the character and CHASES it rather than riding
 * rigidly: it eases toward the slot in world space, bounds when the player
 * runs, turns to face where it is going, and settles into an idle bob with a
 * wagging tail and flicking ears when the player stops.
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
    const dt = Math.max(0, Math.min(delta, 0.1));
    this.time += dt;
    const parent = this.root.parent;
    if (!parent) return;
    parent.updateWorldMatrix(true, false);

    for (let i = 0; i < this.followers.length; i += 1) {
      const follower = this.followers[i];
      const slot = SLOTS[i];
      if (!follower || !slot) continue;
      const rig = follower.rig;

      // Where the slot is right now, in the world.
      scratchTarget.set(slot.x, 0, slot.z);
      parent.localToWorld(scratchTarget);
      if (!follower.placed) {
        follower.worldPosition.copy(scratchTarget);
        follower.placed = true;
      }
      const before = scratchLocal.copy(follower.worldPosition);
      const ease = 1 - Math.exp(-FOLLOW_RATE * dt);
      follower.worldPosition.lerp(scratchTarget, ease);
      // A pet that fell too far behind (a teleport) simply arrives.
      if (follower.worldPosition.distanceToSquared(scratchTarget) > 60 * 60) follower.worldPosition.copy(scratchTarget);
      const moved = before.distanceTo(follower.worldPosition);
      const speed = dt > 0 ? moved / dt : 0;

      // Back into the character's space, where the group lives.
      scratchLocal.copy(follower.worldPosition);
      parent.worldToLocal(scratchLocal);
      rig.root.position.set(scratchLocal.x, 0, scratchLocal.z);

      // Face the way it is going; at rest, the way the player faces.
      if (speed > BOUND_SPEED) {
        const dx = scratchLocal.x - rig.root.position.x;
        void dx;
        const towardX = slot.x - scratchLocal.x;
        const towardZ = slot.z - scratchLocal.z;
        const yaw = Math.atan2(towardX, towardZ);
        rig.root.rotation.y += (yaw - rig.root.rotation.y) * Math.min(1, dt * 8);
      } else {
        rig.root.rotation.y += (Math.sin(this.time * 0.9 + follower.phase) * 0.15 - rig.root.rotation.y) * Math.min(1, dt * 4);
      }

      // The gait: idle bob at rest, a bound when chasing.
      const bounding = Math.min(1, Math.max(0, (speed - BOUND_SPEED) / 6));
      follower.gait += dt * (4 + bounding * 10);
      const bob = bounding > 0.05 ? Math.abs(Math.sin(follower.gait)) * 0.45 * bounding : Math.sin(this.time * 2.4 + follower.phase) * 0.06;
      rig.body.position.y = bob;
      rig.body.rotation.x = bounding * -0.25 * Math.sin(follower.gait);
      const stride = bounding * 0.7;
      rig.legs.forEach((leg, index) => {
        leg.rotation.x = Math.sin(follower.gait + (index % 2 === 0 ? 0 : Math.PI)) * stride;
      });
      if (rig.tail) rig.tail.rotation.y = Math.sin(this.time * 6 + follower.phase) * 0.45;
      for (const ear of rig.ears) ear.rotation.z += (Math.sin(this.time * 3.1 + follower.phase) * 0.06 - ear.rotation.z) * 0.1;
      rig.wings.forEach((wing, index) => {
        wing.rotation.z = (index === 0 ? 1 : -1) * (0.5 + Math.sin(this.time * 5 + follower.phase) * (0.25 + bounding * 0.5));
      });
      if (rig.aura) rig.aura.rotation.z = this.time * 0.6;
      rig.sparkles.forEach((sparkle, index) => {
        const angle = this.time * 1.4 + (index / rig.sparkles.length) * Math.PI * 2;
        sparkle.position.set(Math.cos(angle) * 1.1, 0.8 + Math.sin(this.time * 2 + index) * 0.3, Math.sin(angle) * 1.1);
        sparkle.rotation.set(angle, angle * 0.7, 0);
      });
    }
  }

  dispose(): void {
    for (const follower of this.followers) this.release(follower);
    this.followers.length = 0;
    this.root.removeFromParent();
  }

  private build(pet: PetDefinition, slot: number): Follower {
    const rig = buildPetModel(pet);

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
    label.position.set(0, 2.5, 0.2);
    rig.root.add(label);

    this.root.add(rig.root);
    return { id: pet.id, rig, label, labelMaterial, labelTexture, phase: slot * 1.7, worldPosition: new Vector3(), placed: false, gait: slot };
  }

  private release(follower: Follower): void {
    follower.labelTexture.dispose();
    follower.labelMaterial.dispose();
    follower.rig.root.removeFromParent();
  }
}
