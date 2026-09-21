import { COURSE } from '@money/shared';
import { BoxGeometry, InstancedMesh, Matrix4, MeshLambertMaterial, Quaternion, Vector3, type Texture } from 'three';
import { worldTextures } from './WorldTextures.js';

/** Stacks of notes across the meadow. One instanced mesh, whatever the count. */
const STACK_COUNT = 1700;

/** Seconds a collected stack stays gone, plus up to `RESPAWN_JITTER` more. */
const RESPAWN_SECONDS = 7;
const RESPAWN_JITTER = 5;
/** How fast a stack vanishes under a player and how fast it grows back. */
const VANISH_RATE = 14;
const GROW_RATE = 4;

/** The meadow is split into cells this wide so a collect only visits the stacks nearby. */
const CELL = 6;

interface Stack {
  readonly x: number;
  readonly z: number;
  readonly base: Matrix4;
  /** 0 gone, 1 standing. Eased toward `target`. */
  scale: number;
  target: number;
  /** World time the stack grows back, or -1 while standing. */
  respawnAt: number;
}

/**
 * THE MONEY MEADOW'S CASH: a grass field covered in stacks of notes.
 *
 * Seventeen hundred stacks as ONE instanced mesh, scattered deterministically
 * so every client sees the same field. A player (or the ball they push)
 * passing over a stack COLLECTS it: it shrinks away under them and grows back
 * a few seconds later with a small pop, so a walk leaves a cleared path that
 * fills in behind. Purely visual - the server credits cash by distance walked
 * and never looks at a stack - and cheap: a collect visits only the cells
 * around the player, and the instance matrix is uploaded only on frames
 * something changed.
 */
export class MeadowField {
  readonly mesh: InstancedMesh;

  private readonly material: MeshLambertMaterial;
  private readonly geometry: BoxGeometry;
  private readonly stacks: Stack[] = [];
  private readonly cells = new Map<number, number[]>();
  private readonly columns: number;
  private readonly scratch = new Matrix4();
  private readonly scaleMatrix = new Matrix4();
  private elapsed = 0;
  private dirty = false;
  /** Stacks that are mid-motion, so the update walks only those. */
  private readonly moving = new Set<number>();

  constructor() {
    this.geometry = new BoxGeometry(1.5, 0.5, 1.0);
    this.material = new MeshLambertMaterial({ map: worldTextures.bills('#46d66a', '#1d7a36') });
    this.mesh = new InstancedMesh(this.geometry, this.material, STACK_COUNT);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.columns = Math.ceil((COURSE.meadowMaxX - COURSE.meadowMinX) / CELL) + 1;

    const random = seeded(0x2a5c);
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const up = new Vector3(0, 1, 0);
    for (let i = 0; i < STACK_COUNT; i += 1) {
      const x = COURSE.meadowMinX + 1 + random() * (COURSE.meadowMaxX - COURSE.meadowMinX - 2);
      const z = COURSE.meadowMinZ + 1 + random() * (COURSE.meadowMaxZ - COURSE.meadowMinZ - 2);
      const tier = random();
      const layers = tier > 0.7 ? 2 : 1;
      // Sat on the grass, not in it: the box's bottom is on the floor.
      const y = COURSE.floorY + 0.25 * layers;
      position.set(x, y, z);
      rotation.setFromAxisAngle(up, random() * Math.PI * 2);
      scale.set(0.85 + random() * 0.4, layers, 0.85 + random() * 0.4);
      const base = new Matrix4().compose(position, rotation, scale);
      this.mesh.setMatrixAt(i, base);
      this.stacks.push({ x, z, base, scale: 1, target: 1, respawnAt: -1 });
      const key = this.cellKey(x, z);
      let list = this.cells.get(key);
      if (!list) {
        list = [];
        this.cells.set(key, list);
      }
      list.push(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** The equipped bill's notes. */
  setMap(map: Texture): void {
    this.material.map = map;
    this.material.needsUpdate = true;
  }

  /** Something passed over (x, z) with this reach: every standing stack under it is collected. */
  collect(x: number, z: number, radius: number): void {
    if (x < COURSE.meadowMinX - radius || x > COURSE.meadowMaxX + radius) return;
    if (z < COURSE.meadowMinZ - radius || z > COURSE.meadowMaxZ + radius) return;
    const r2 = radius * radius;
    const cx0 = Math.floor((x - radius - COURSE.meadowMinX) / CELL);
    const cx1 = Math.floor((x + radius - COURSE.meadowMinX) / CELL);
    const cz0 = Math.floor((z - radius - COURSE.meadowMinZ) / CELL);
    const cz1 = Math.floor((z + radius - COURSE.meadowMinZ) / CELL);
    for (let cx = cx0; cx <= cx1; cx += 1) {
      for (let cz = cz0; cz <= cz1; cz += 1) {
        const list = this.cells.get(cz * this.columns + cx);
        if (!list) continue;
        for (const index of list) {
          const stack = this.stacks[index];
          if (!stack || stack.target === 0) continue;
          const dx = stack.x - x;
          const dz = stack.z - z;
          if (dx * dx + dz * dz > r2) continue;
          stack.target = 0;
          stack.respawnAt = this.elapsed + RESPAWN_SECONDS + Math.random() * RESPAWN_JITTER;
          this.moving.add(index);
        }
      }
    }
  }

  update(delta: number, elapsed: number): void {
    this.elapsed = elapsed;
    if (this.moving.size === 0) return;
    const dt = Math.max(0, Math.min(delta, 0.1));
    for (const index of this.moving) {
      const stack = this.stacks[index];
      if (!stack) {
        this.moving.delete(index);
        continue;
      }
      if (stack.target === 0 && stack.respawnAt >= 0 && elapsed >= stack.respawnAt) {
        stack.target = 1;
        stack.respawnAt = -1;
      }
      const rate = stack.target === 0 ? VANISH_RATE : GROW_RATE;
      const before = stack.scale;
      stack.scale += (stack.target - stack.scale) * (1 - Math.exp(-rate * dt));
      // Snap the last sliver, so a stack is exactly gone or exactly back.
      if (Math.abs(stack.target - stack.scale) < 0.01) stack.scale = stack.target;
      if (stack.scale !== before) {
        // A little overshoot as it grows back: the pop that says "new".
        const pop = stack.target === 1 && stack.scale < 1 ? 1 + Math.sin(stack.scale * Math.PI) * 0.18 : 1;
        const s = stack.scale * pop;
        this.scaleMatrix.makeScale(s, s, s);
        // Scale about the stack's own base (its bottom sits on the floor), not the world origin.
        this.scratch.copy(stack.base).multiply(this.scaleMatrix);
        this.mesh.setMatrixAt(index, this.scratch);
        this.dirty = true;
      }
      if (stack.scale === stack.target && stack.target === 1) this.moving.delete(index);
    }
    if (this.dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.dirty = false;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }

  private cellKey(x: number, z: number): number {
    return Math.floor((z - COURSE.meadowMinZ) / CELL) * this.columns + Math.floor((x - COURSE.meadowMinX) / CELL);
  }
}

/** Deterministic PRNG, so every client scatters the same field. */
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
