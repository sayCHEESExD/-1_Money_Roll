import { TRAINING, TRAINING_ZONES, trainingZoneX, trainingZoneZ } from '@money/shared';
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { css, shade } from '../config/worldVisuals.js';
import { CanvasSign } from './CanvasSign.js';
import { STUD_TILE, texturedBox } from './texturedBox.js';
import { worldTextures } from './WorldTextures.js';

/** One zone's dressing: what changes with the player's rebirth count. */
interface Zone {
  readonly index: number;
  readonly lock: Mesh;
  readonly lockSign: CanvasSign;
  readonly rim: Mesh;
  readonly rimMaterial: MeshLambertMaterial;
  readonly lamps: MeshLambertMaterial;
}

/** A city's colours: what its houses, roofs, awnings and lamps are made of. */
interface CityStyle {
  readonly buildings: readonly number[];
  readonly roofs: readonly number[];
  readonly glass: number;
  readonly awnings: readonly number[];
  readonly lamp: number;
  readonly leaf: number;
  readonly trunk: number;
  readonly ground: number;
  /** Building heights, min and max. */
  readonly rise: readonly [number, number];
  readonly towers: boolean;
  readonly palms: boolean;
  readonly columns: boolean;
}

/**
 * The three cities. Each training theme keeps its key and its name; what the
 * key now selects is a miniature city in that mood: a sunny seaside town, a
 * lit-up downtown, and a gold district.
 */
const STYLES: Readonly<Record<'desert' | 'office' | 'temple', CityStyle>> = {
  desert: {
    buildings: [0xf6d8a8, 0xffb37a, 0xa8e6c8, 0xffe08a, 0xf9a8c9],
    roofs: [0xd9603b, 0xc94f2f, 0xe07a4a],
    glass: 0x7fd8ff,
    awnings: [0xff5f5f, 0x3fa9ff, 0x5ed64f, 0xffd23f],
    lamp: 0xffe9a6,
    leaf: 0x4fbf47,
    trunk: 0x8a5a2b,
    ground: 0xe8c86a,
    rise: [2.4, 3.8],
    towers: false,
    palms: true,
    columns: false,
  },
  office: {
    buildings: [0x6c7a9c, 0x4a5a7a, 0x8fb3ff, 0x2f3a55, 0x9aa8c4],
    roofs: [0x2b3554, 0x3c4a6e],
    glass: 0xbfe6ff,
    awnings: [0xff5fb3, 0x5ee0ff, 0xffd23f, 0x9b6bff],
    lamp: 0xd6f4ff,
    leaf: 0x3a9a34,
    trunk: 0x5a4632,
    ground: 0x8e97a8,
    rise: [4.5, 7.5],
    towers: true,
    palms: false,
    columns: false,
  },
  temple: {
    buildings: [0xfff1c2, 0xf4efe4, 0xffe08a, 0xfff8e8],
    roofs: [0xffd23f, 0xf0c040],
    glass: 0xfff3b0,
    awnings: [0xffd23f, 0xff5252, 0xffffff],
    lamp: 0xffe066,
    leaf: 0x5ed64f,
    trunk: 0x9c6b2f,
    ground: 0xf0e0b0,
    rise: [3.0, 5.0],
    towers: false,
    palms: false,
    columns: true,
  },
};

const ROAD = 0x3a3f4a;
const ROAD_LINE = 0xffd23f;
const CURB = 0xd6d9e0;
const INK = 0x2b3554;

/**
 * THE TRAINING ZONES, on the player's RIGHT: three miniature cities - a
 * sunny town, a downtown and a gold district - each under a sign with its
 * name and multiplier, as the reference's "TRAIN ZONES - AFK for free CASH!"
 * area. A zone the player's rebirth count has not unlocked wears a red
 * shimmer and an "UNLOCK NOW! - N REBIRTHS" sign; the simulation is what
 * actually keeps them off it.
 *
 * Every city is built from studded blocks in the world's own material
 * language and merged per material, so a whole city is a handful of draw
 * calls. The city is scenery: the pad is the only solid, and the crossroads
 * at its centre is left open for the player to stand and train in.
 */
export class TrainingZones {
  readonly root = new Group();

  private readonly zones: Zone[] = [];
  private readonly signs: CanvasSign[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private rebirths = -1;
  private time = 0;

  constructor() {
    const size = TRAINING.size;
    const lockGeometry = new BoxGeometry(size + 0.4, 8, size + 0.4);
    const rimGeometry = texturedBox(size + 1.2, 0.5, size + 1.2, STUD_TILE);
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

      const lamps = this.city(group, STYLES[zone.theme], zone.index);

      // The lock: a red shimmer over a zone the player cannot enter yet.
      const lockMaterial = new MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.18, depthWrite: false, fog: false });
      this.materials.push(lockMaterial);
      const lock = new Mesh(lockGeometry, lockMaterial);
      lock.position.y = 4;
      group.add(lock);

      // The name sign stands well clear of the rooftops and of the lock sign
      // beneath it: the two never share a height, whatever the angle.
      const sign = new CanvasSign(13, 5, [
        { text: zone.name, size: 1, fill: '#ffffff', stroke: '#1c2233', strokeWidth: 0.16 },
        { text: `x${zone.multiplier} Cash`, size: 0.7, fill: css(zone.color), stroke: '#1c2233', strokeWidth: 0.15 },
      ]);
      sign.mesh.position.set(0, 13.5, 0);
      // Facing the meadow, which is +X from the zones.
      sign.mesh.rotation.y = Math.PI / 2;
      group.add(sign.mesh);
      this.signs.push(sign);

      const lockSign = new CanvasSign(11, 3.8, [
        { text: 'UNLOCK NOW!', size: 1, fill: '#ff5252', stroke: '#2a0a0a', strokeWidth: 0.16 },
        { text: `${zone.rebirthsRequired} REBIRTHS`, size: 0.8, fill: '#ffffff', stroke: '#2a0a0a', strokeWidth: 0.15 },
      ]);
      lockSign.mesh.position.set(0, 9.6, 0);
      lockSign.mesh.rotation.y = Math.PI / 2;
      group.add(lockSign.mesh);
      this.signs.push(lockSign);

      this.root.add(group);
      this.zones.push({ index: zone.index, lock, lockSign, rim, rimMaterial, lamps });
    }

    // The area's board, behind the pads, high enough that no zone's sign is
    // ever drawn across it from the meadow. The panel faces +X; its two posts
    // and the crossbar stand entirely BEHIND the backing plate, so nothing
    // passes through the face.
    const boardX = TRAINING.x - 14;
    const boardZ = trainingZoneZ(2);
    const boardY = 23;
    const backingThickness = 1.4;
    const postMaterial = this.lambert(INK, 0);
    const post = texturedBox(1.2, boardY + 6, 1.2, STUD_TILE);
    this.geometries.push(post);
    const postX = boardX - backingThickness - 0.2;
    for (const dz of [-14, 14]) {
      const mesh = new Mesh(post, postMaterial);
      mesh.position.set(postX, (boardY + 6) / 2, boardZ + dz);
      this.root.add(mesh);
    }
    const crossbar = new Mesh(texturedBox(1.2, 1.2, 30, STUD_TILE), postMaterial);
    crossbar.position.set(postX, boardY - 7, boardZ);
    this.root.add(crossbar);
    const backing = new Mesh(texturedBox(backingThickness, 12, 36, STUD_TILE), this.lambert(0x5ee0ff, 0.1));
    backing.position.set(boardX - backingThickness / 2, boardY, boardZ);
    this.root.add(backing);
    const board = new CanvasSign(34, 12, [
      { text: 'TRAIN ZONES', size: 1, fill: '#ffffff', stroke: '#1c2233', strokeWidth: 0.16 },
      { text: 'AFK for free CASH!', size: 0.55, fill: '#7fe6ff', stroke: '#1c2233', strokeWidth: 0.14 },
    ]);
    // A hair proud of the backing's face: never in it, never floating off it.
    board.mesh.position.set(boardX + 0.03, boardY, boardZ);
    board.mesh.rotation.y = Math.PI / 2;
    this.root.add(board.mesh);
    this.signs.push(board);

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
      zone.lamps.emissiveIntensity = 0.75 + 0.2 * Math.sin(this.time * 3.3 + i * 1.3);
      if (zone.lock.visible) {
        (zone.lock.material as MeshBasicMaterial).opacity = 0.12 + 0.08 * Math.sin(this.time * 3 + i);
      }
    }
  }

  /**
   * A MINIATURE CITY on a 20x20 pad: a crossroads with a yellow centre line
   * and pale kerbs through the middle, four blocks around it each holding a
   * tall building at the back corner and a storefront at the road, street
   * lights at the crossing, trees, benches and hydrants, and a signboard on
   * one shop. The centre of the crossroads is left open to stand in.
   *
   * @returns the lamp material, so the room can make the lights breathe
   */
  private city(group: Group, style: CityStyle, seed: number): MeshLambertMaterial {
    const parts = new Map<Material, BufferGeometry[]>();
    const put = (material: Material, geometry: BufferGeometry, x: number, y: number, z: number, ry = 0): void => {
      const g = geometry.clone();
      if (ry) g.rotateY(ry);
      g.translate(x, y, z);
      let list = parts.get(material);
      if (!list) {
        list = [];
        parts.set(material, list);
      }
      list.push(g);
    };
    // World-scaled UVs: a building's studs are the floor's studs.
    const box = (w: number, h: number, d: number): BufferGeometry => texturedBox(w, h, d, STUD_TILE);
    let rnd = seed * 7919 + 17;
    const random = (): number => {
      rnd = (rnd * 1664525 + 1013904223) >>> 0;
      return rnd / 4294967296;
    };
    const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;

    const road = this.lambert(ROAD, 0);
    const line = this.plain(ROAD_LINE, 0.4);
    const kerb = this.lambert(CURB, 0);
    const ground = this.lambert(style.ground, 0);
    const lampMaterial = this.lambert(style.lamp, 0.85);
    const post = this.lambert(INK, 0);
    const leaf = this.lambert(style.leaf, 0);
    const trunk = this.lambert(style.trunk, 0);
    const glassMaterial = this.facade(style.glass);

    /*
     * THE CROSSROADS, TILED RATHER THAN STACKED. Nothing here shares a face
     * with anything else: the road along X is one slab, the road along Z is
     * two slabs that stop at its edges, each block's ground is its own slab
     * that stops at the kerb, and the kerbs stand a hair off the road edge.
     * Every slab lifts a hair above the pad, so no face is coplanar with the
     * pad's top either. That is what keeps the surfaces from fighting.
     */
    const half = TRAINING.size / 2;
    const roadHalf = 2.1;
    const kerbW = 1.1;
    const gap = 0.05;
    const lift = 0.02;
    const roadTop = lift + 0.08;
    // The road along X, full length; the road along Z in two halves that stop at it.
    put(road, box(TRAINING.size, roadTop - lift, roadHalf * 2), 0, (lift + roadTop) / 2, 0);
    for (const sz of [-1, 1]) {
      const length = half - roadHalf;
      put(road, box(roadHalf * 2, roadTop - lift, length), 0, (lift + roadTop) / 2, sz * (roadHalf + length / 2));
    }
    // Centre dashes, sat on the road and clear of the crossing.
    for (let t = -8.4; t <= 8.4; t += 2.4) {
      if (Math.abs(t) < roadHalf + 0.9) continue;
      put(line, box(1.2, 0.03, 0.2), t, roadTop + 0.015, 0);
      put(line, box(0.2, 0.03, 1.2), 0, roadTop + 0.015, t);
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        // The block's own ground: from the kerb's outer edge to the pad's edge.
        const inner = roadHalf + gap + kerbW;
        const groundSpan = half - inner;
        put(ground, box(groundSpan, 0.08, groundSpan), sx * (inner + groundSpan / 2), lift + 0.04, sz * (inner + groundSpan / 2));
        // Kerbs: an L along the block's two road-facing sides, the two arms meeting without overlap.
        const kerbInner = roadHalf + gap;
        const kerbMid = kerbInner + kerbW / 2;
        const armAlongX = half - kerbInner;
        put(kerb, box(armAlongX, 0.14, kerbW), sx * (kerbInner + armAlongX / 2), lift + 0.07, sz * kerbMid);
        const armAlongZ = half - (kerbInner + kerbW);
        put(kerb, box(kerbW, 0.14, armAlongZ), sx * kerbMid, lift + 0.07, sz * (kerbInner + kerbW + armAlongZ / 2));

        // The tall building at the back corner.
        const rise = style.rise[0] + random() * (style.rise[1] - style.rise[0]);
        const bw = 4.2 + random() * 0.6;
        const bd = 4.2 + random() * 0.6;
        const bx = sx * (10 - bw / 2 - 0.2);
        const bz = sz * (10 - bd / 2 - 0.2);
        const wall = this.facade(pick(style.buildings));
        put(wall, texturedBox(bw, rise, bd, STUD_TILE / 2), bx, rise / 2 + lift + 0.08, bz);
        const roofColour = pick(style.roofs);
        put(this.lambert(roofColour, 0), box(bw + 0.4, 0.3, bd + 0.4), bx, rise + 0.2, bz);
        if (style.towers) {
          // Rooftop plant and a blinking beacon.
          put(this.lambert(0x9aa8c4, 0), box(1.2, 0.8, 1.2), bx + sx * 0.8, rise + 0.75, bz + sz * 0.6);
          put(lampMaterial, box(0.3, 0.6, 0.3), bx, rise + 0.65, bz);
        } else if (style.columns) {
          // A gold crown and a little dome.
          put(this.lambert(pick(style.roofs), 0.25), box(bw * 0.6, 0.8, bd * 0.6), bx, rise + 0.75, bz);
        } else {
          // A pitched cap of two steps.
          put(this.lambert(roofColour, 0), box(bw * 0.7, 0.4, bd * 0.7), bx, rise + 0.55, bz);
        }

        // The storefront on the road, with a door, an awning and a sign.
        const sw = 2.4;
        const sd = 2.2;
        const sh = 2.2 + random() * 0.6;
        const sxPos = sx * 4.4;
        const szPos = sz * (10 - sd / 2 - 0.2);
        const shopWall = this.facade(pick(style.buildings));
        put(shopWall, texturedBox(sw, sh, sd, STUD_TILE / 2), sxPos, sh / 2 + lift + 0.08, szPos);
        put(this.lambert(pick(style.roofs), 0), box(sw + 0.3, 0.24, sd + 0.3), sxPos, sh + 0.18, szPos);
        // The door and the awning face the road along Z (toward the crossroads).
        const face = -sz;
        put(this.plain(INK, 0), box(0.7, 1.2, 0.08), sxPos, 0.66, szPos + face * (sd / 2 + 0.03));
        put(this.plain(pick(style.awnings), 0.15), box(sw + 0.5, 0.14, 0.9), sxPos, 1.55, szPos + face * (sd / 2 + 0.4));
        put(this.plain(pick(style.awnings), 0.6), box(1.6, 0.4, 0.1), sxPos, sh - 0.35, szPos + face * (sd / 2 + 0.06));
        put(glassMaterial, box(0.9, 0.6, 0.06), sxPos - 0.7, 0.9, szPos + face * (sd / 2 + 0.03));

        // The corner of each block: a tree on two of them, street furniture on the others.
        const px = sx * 4.3;
        const pz = sz * 4.3;
        if (sx === sz) {
          if (style.palms) {
            put(trunk, box(0.34, 2.6, 0.34), px, 1.3, pz);
            for (let k = 0; k < 4; k += 1) put(leaf, box(1.7, 0.16, 0.5), px, 2.65, pz, (k / 4) * Math.PI);
          } else {
            put(trunk, box(0.34, 1.2, 0.34), px, 0.6, pz);
            put(leaf, box(1.4, 1.2, 1.4), px, 1.75, pz);
            put(leaf, box(0.9, 0.7, 0.9), px, 2.6, pz);
          }
        } else {
          // A bench and a hydrant.
          put(trunk, box(1.4, 0.12, 0.5), px, 0.55, pz);
          put(trunk, box(1.4, 0.4, 0.1), px, 0.85, pz - sz * 0.22);
          put(post, box(0.12, 0.45, 0.12), px - 0.55, 0.3, pz);
          put(post, box(0.12, 0.45, 0.12), px + 0.55, 0.3, pz);
          put(this.plain(0xff4d4d, 0.1), box(0.3, 0.6, 0.3), px + sx * 1.2, 0.42, pz - sz * 1.2);
          put(this.plain(0xff4d4d, 0.1), box(0.5, 0.14, 0.5), px + sx * 1.2, 0.72, pz - sz * 1.2);
        }
      }
    }

    // Street lights at the four corners of the crossing.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        put(post, box(0.2, 3.4, 0.2), sx * 2.9, 1.7, sz * 2.9);
        put(post, box(0.2, 0.2, 0.9), sx * 2.9, 3.4, sz * 2.9 - sz * 0.35);
        put(lampMaterial, box(0.5, 0.3, 0.5), sx * 2.9, 3.35, sz * 2.9 - sz * 0.7);
      }
    }
    if (style.columns) {
      // The gold district's entrance columns at the front of the crossroads.
      const column = new CylinderGeometry(0.35, 0.4, 3.2, 8);
      for (const sz of [-1, 1]) put(this.lambert(0xfff8e8, 0), column, 9.2, 1.66, sz * 3.2);
      put(this.lambert(pick(style.roofs), 0.25), box(0.9, 0.4, 8.2), 9.2, 3.45, 0);
      column.dispose();
    }

    for (const [material, list] of parts) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      this.geometries.push(merged);
      const mesh = new Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return lampMaterial;
  }

  /** A studded block in the given colour: the world's one material language. */
  private lambert(color: number, emissive: number): MeshLambertMaterial {
    const material = new MeshLambertMaterial({ map: worldTextures.studs(css(color), shade(color, 0.68)) });
    if (emissive > 0) {
      material.emissive.setHex(color);
      material.emissiveIntensity = emissive;
    }
    this.materials.push(material);
    return material;
  }

  /** A flat colour, for the small parts studs would only muddy. */
  private plain(color: number, emissive: number): MeshLambertMaterial {
    const material = new MeshLambertMaterial({ color });
    if (emissive > 0) {
      material.emissive.setHex(color);
      material.emissiveIntensity = emissive;
    }
    this.materials.push(material);
    return material;
  }

  /** A building's walls: blocks with rows of lit windows. */
  private facade(color: number): MeshLambertMaterial {
    const material = new MeshLambertMaterial({ map: worldTextures.windows(css(color), shade(color, 0.7)) });
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
