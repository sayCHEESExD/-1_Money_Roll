import { TRAINING, TRAINING_ZONES, trainingZoneX, trainingZoneZ } from '@money/shared';
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type BufferGeometry,
} from 'three';
import { css, shade } from '../config/worldVisuals.js';
import { worldTextures } from './WorldTextures.js';
import { CanvasSign } from './CanvasSign.js';
import { texturedBox } from './texturedBox.js';

/** One zone's dressing: what changes with the player's rebirth count. */
interface Zone {
  readonly index: number;
  readonly lock: Mesh;
  readonly lockSign: CanvasSign;
  readonly rim: Mesh;
  readonly rimMaterial: MeshLambertMaterial;
}

/**
 * THE TRAINING ZONES, on the player's RIGHT: three themed pads - a desert
 * camp, an office and a golden temple - each under a sign with its name and
 * multiplier, exactly as the reference's "TRAIN ZONES - AFK for free CASH!"
 * area. A zone the player's rebirth count has not unlocked wears a red
 * shimmer and an "UNLOCK NOW! - N REBIRTHS" sign; the simulation is what
 * actually keeps them off it.
 */
export class TrainingZones {
  readonly root = new Group();

  private readonly zones: Zone[] = [];
  private readonly signs: CanvasSign[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: (MeshLambertMaterial | MeshBasicMaterial)[] = [];
  private rebirths = -1;
  private time = 0;

  constructor() {
    const size = TRAINING.size;
    const lockGeometry = new BoxGeometry(size + 0.4, 6, size + 0.4);
    const rimGeometry = new BoxGeometry(size + 1.2, 0.5, size + 1.2);
    this.geometries.push(lockGeometry, rimGeometry);

    for (const zone of TRAINING_ZONES) {
      const x = trainingZoneX(zone.index);
      const z = trainingZoneZ(zone.index);
      const top = TRAINING.padY;
      const group = new Group();
      group.position.set(x, top, z);

      // A coloured rim around the pad, so each zone reads as its own place.
      const rimMaterial = this.lambert(zone.color, 0.35);
      const rim = new Mesh(rimGeometry, rimMaterial);
      rim.position.y = -0.3;
      group.add(rim);

      this.dress(group, zone.theme);

      // The lock: a red shimmer over a zone the player cannot enter yet.
      const lockMaterial = new MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.18, depthWrite: false, fog: false });
      this.materials.push(lockMaterial);
      const lock = new Mesh(lockGeometry, lockMaterial);
      lock.position.y = 3;
      group.add(lock);

      const sign = new CanvasSign(14, 5.5, [
        { text: zone.name, size: 1, fill: '#ffffff', stroke: '#1c2233', strokeWidth: 0.16 },
        { text: `x${zone.multiplier} Cash`, size: 0.7, fill: css(zone.color), stroke: '#1c2233', strokeWidth: 0.15 },
      ]);
      sign.mesh.position.set(0, 10.5, 0);
      // Facing the meadow, which is +X from the zones.
      sign.mesh.rotation.y = Math.PI / 2;
      group.add(sign.mesh);
      this.signs.push(sign);

      const lockSign = new CanvasSign(12, 4.2, [
        { text: 'UNLOCK NOW!', size: 1, fill: '#ff5252', stroke: '#2a0a0a', strokeWidth: 0.16 },
        { text: `${zone.rebirthsRequired} REBIRTHS`, size: 0.8, fill: '#ffffff', stroke: '#2a0a0a', strokeWidth: 0.15 },
      ]);
      lockSign.mesh.position.set(0, 7.2, 0);
      lockSign.mesh.rotation.y = Math.PI / 2;
      group.add(lockSign.mesh);
      this.signs.push(lockSign);

      this.root.add(group);
      this.zones.push({ index: zone.index, lock, lockSign, rim, rimMaterial });
    }

    // The area's board, behind the pads on two posts.
    const boardX = TRAINING.x - 14;
    const boardZ = trainingZoneZ(2);
    const post = texturedBox(1.2, 16, 1.2, 4);
    this.geometries.push(post);
    const postMaterial = this.lambert(0x2b3554, 0);
    for (const dz of [-14, 14]) {
      const mesh = new Mesh(post, postMaterial);
      mesh.position.set(boardX, 8, boardZ + dz);
      this.root.add(mesh);
    }
    const board = new CanvasSign(34, 12, [
      { text: 'TRAIN ZONES', size: 1, fill: '#ffffff', stroke: '#1c2233', strokeWidth: 0.16 },
      { text: 'AFK for free CASH!', size: 0.55, fill: '#7fe6ff', stroke: '#1c2233', strokeWidth: 0.14 },
    ]);
    board.mesh.position.set(boardX + 0.8, 15, boardZ);
    board.mesh.rotation.y = Math.PI / 2;
    this.root.add(board.mesh);
    this.signs.push(board);
    const backing = new Mesh(texturedBox(1.4, 12, 36, 4), this.lambert(0x5ee0ff, 0.1));
    backing.position.set(boardX - 0.4, 15, boardZ);
    this.root.add(backing);

    this.setRebirths(0);
  }

  /** Mirror the replicated rebirth count: which zones are open. */
  setRebirths(rebirths: number): void {
    if (rebirths === this.rebirths) return;
    this.rebirths = rebirths;
    for (const zone of this.zones) {
      const definition = TRAINING_ZONES[zone.index - 1];
      const locked = definition ? rebirths < definition.rebirthsRequired : true;
      zone.lock.visible = locked;
      zone.lockSign.mesh.visible = locked;
    }
  }

  update(delta: number): void {
    this.time += delta;
    for (let i = 0; i < this.zones.length; i += 1) {
      const zone = this.zones[i];
      if (!zone) continue;
      zone.rimMaterial.emissiveIntensity = 0.3 + 0.2 * Math.sin(this.time * 2 + i);
      if (zone.lock.visible) {
        (zone.lock.material as MeshBasicMaterial).opacity = 0.12 + 0.08 * Math.sin(this.time * 3 + i);
      }
    }
  }

  /** The themed props on each pad: a few boxes that say desert, office or temple. */
  private dress(group: Group, theme: 'desert' | 'office' | 'temple'): void {
    const add = (geometry: BufferGeometry, material: MeshLambertMaterial, x: number, y: number, z: number, ry = 0): void => {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      mesh.castShadow = true;
      group.add(mesh);
    };
    const box = (w: number, h: number, d: number): BufferGeometry => {
      const geometry = new BoxGeometry(w, h, d);
      this.geometries.push(geometry);
      return geometry;
    };
    switch (theme) {
      case 'desert': {
        const sand = this.lambert(0xe8c86a, 0);
        const wood = this.lambert(0x8a5a2b, 0);
        const canvas = this.lambert(0xf6e7c0, 0);
        add(box(3, 2.2, 3), sand, -6, 1.1, -6, 0.4);
        add(box(2, 1.4, 2), sand, -3.5, 0.7, -4, 0.9);
        add(box(0.5, 4, 0.5), wood, 6, 2, -6);
        add(box(6, 0.3, 6), canvas, 6, 4, -6, 0.2);
        const barrel = new CylinderGeometry(0.9, 0.9, 1.8, 10);
        this.geometries.push(barrel);
        add(barrel, wood, 5, 0.9, 6);
        break;
      }
      case 'office': {
        const wood = this.lambert(0x7a4d26, 0);
        const paper = this.lambert(0xf2f2f2, 0);
        const screen = this.lambert(0x3fa9ff, 0.7);
        add(box(6, 0.4, 3), wood, -5, 2.2, -5);
        for (const [dx, dz] of [[-2.6, -1.2], [2.6, -1.2], [-2.6, 1.2], [2.6, 1.2]] as const) add(box(0.4, 2.2, 0.4), wood, -5 + dx, 1.1, -5 + dz);
        add(box(2.6, 1.8, 0.3), screen, -5, 3.3, -5.5);
        add(box(1.6, 0.6, 1.2), paper, -3, 2.7, -4.5, 0.3);
        add(box(4, 4, 1.2), wood, 6, 2, 6);
        add(box(3.4, 0.2, 1.0), paper, 6, 1.6, 6);
        add(box(3.4, 0.2, 1.0), paper, 6, 3.1, 6);
        break;
      }
      case 'temple': {
        const gold = this.lambert(0xffd23f, 0.3);
        const stone = this.lambert(0xf4efe4, 0);
        for (const [dx, dz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]] as const) {
          const column = new CylinderGeometry(0.8, 1.0, 7, 10);
          this.geometries.push(column);
          add(column, stone, dx, 3.5, dz);
          add(box(2.2, 0.6, 2.2), gold, dx, 7.2, dz);
        }
        add(box(3, 1.2, 3), gold, 0, 0.6, -5);
        add(box(2, 1, 2), gold, 0, 1.7, -5, 0.6);
        break;
      }
    }
  }

  /** A studded block in the given colour: the world's one material language. */
  private lambert(color: number, emissive: number): MeshLambertMaterial {
    const material = new MeshLambertMaterial({ map: worldTextures.studs(css(color), shade(color, 0.68), 2) });
    if (emissive > 0) {
      material.emissive.setHex(color);
      material.emissiveIntensity = emissive;
    }
    this.materials.push(material);
    return material;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const sign of this.signs) sign.dispose();
    this.root.removeFromParent();
  }
}
