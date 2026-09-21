import {
  BILLS,
  COURSE,
  COURSE_END_Z,
  COURSE_SOLIDS,
  DECORATIONS,
  LAVA_SPANS,
  STAGES,
  WIN_PAD,
  WorldCollision,
  billForSlot,
  formatWins,
  type CourseSolid,
  type IslandTheme,
  type SolidKind,
} from '@money/shared';
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  OctahedronGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE, css, shade } from '../config/worldVisuals.js';
import { BillStands } from './BillStands.js';
import { CanvasSign } from './CanvasSign.js';
import { CashPickups } from './CashPickups.js';
import { MoneyBridges } from './MoneyBridges.js';
import { PetShop } from './PetShop.js';
import { Scoreboard } from './Scoreboard.js';
import { Sky } from './Sky.js';
import { StageReveal } from './StageReveal.js';
import { StageSigns } from './StageSigns.js';
import { TrainingZones } from './TrainingZones.js';
import { WinTrophies } from './WinTrophies.js';
import { worldTextures } from './WorldTextures.js';
import { STUD_TILE, texturedBox } from './texturedBox.js';

/** World units one repeat of a stud texture covers. Four studs to it. */
const TILE = STUD_TILE;

/** How many money stacks the meadow is scattered with. Instanced: one draw. */
const STACK_COUNT = 1700;

const WIN_GLOW = { base: 0.3, swing: 0.3, rate: 2.1 } as const;

/**
 * The visible world: the spawn area, the Money Meadow, the lava river and its
 * islands, and everything standing on them.
 *
 * Every solid it draws comes from `COURSE_SOLIDS` - the SAME array the
 * collision model is built from - so a pad the player can see but not stand
 * on is structurally impossible. Geometry is merged per material, the meadow's
 * cash is one instanced mesh, and the bridges and pickups are their own small
 * renderers, so the whole world is a few dozen draw calls.
 */
export class MoneyWorld {
  readonly root = new Group();
  readonly collision = new WorldCollision();

  readonly stands: BillStands;
  readonly zones: TrainingZones;
  readonly shop: PetShop;
  readonly signs: StageSigns;
  readonly scoreboard: Scoreboard;
  readonly sky: Sky;
  readonly bridges = new MoneyBridges();
  readonly pickups = new CashPickups();
  readonly winTrophies = new WinTrophies();

  private readonly materials: Material[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private meadowMaterial: MeshLambertMaterial | null = null;
  private stackMaterial: MeshLambertMaterial | null = null;
  private winPadMaterial: MeshLambertMaterial | null = null;
  private lavaMaterial: MeshLambertMaterial | null = null;
  private winReveal: StageReveal | null = null;
  private billSlot = -1;
  private glowTime = 0;

  constructor() {
    this.buildSolids();
    this.buildLava();
    this.buildMeadowStacks();
    this.buildDecorations();
    this.buildHubWalls();
    this.buildHorizon();
    this.buildWinPadSigns();

    this.stands = new BillStands();
    this.root.add(this.stands.root);
    this.zones = new TrainingZones();
    this.root.add(this.zones.root);
    this.shop = new PetShop();
    this.root.add(this.shop.root);
    this.signs = new StageSigns();
    this.root.add(this.signs.root);
    this.scoreboard = new Scoreboard();
    this.root.add(this.scoreboard.root);
    this.sky = new Sky();
    this.root.add(this.sky.root);
    this.root.add(this.bridges.root, this.pickups.root, this.winTrophies.root);

    this.setBillSlot(1);
  }

  addTo(scene: Scene): void {
    scene.add(this.root);
  }

  revealNear(z: number): void {
    this.signs.revealNear(z);
    this.winReveal?.revealNear(z);
  }

  /** The equipped bill decides the colour of the meadow and every stack in it. */
  setBillSlot(slot: number): void {
    if (slot === this.billSlot) return;
    this.billSlot = slot;
    const bill = billForSlot(slot);
    const map = worldTextures.bills(css(bill.color), css(bill.ink));
    if (this.meadowMaterial) {
      this.meadowMaterial.map = map;
      this.meadowMaterial.needsUpdate = true;
    }
    if (this.stackMaterial) {
      this.stackMaterial.map = map;
      this.stackMaterial.needsUpdate = true;
    }
  }

  update(delta: number, elapsed: number, viewerX: number, viewerZ: number): void {
    this.glowTime += delta;
    const breath = (Math.sin(this.glowTime * WIN_GLOW.rate) + 1) / 2;
    if (this.winPadMaterial) this.winPadMaterial.emissiveIntensity = WIN_GLOW.base + breath * WIN_GLOW.swing;
    if (this.lavaMaterial) this.lavaMaterial.emissiveIntensity = 0.55 + breath * 0.25;
    this.stands.update(delta, viewerX, viewerZ);
    this.zones.update(delta);
    this.shop.update(delta);
    this.pickups.advance(delta, elapsed);
    this.winTrophies.update(delta);
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    this.winReveal?.dispose();
    this.stands.dispose();
    this.zones.dispose();
    this.shop.dispose();
    this.signs.dispose();
    this.scoreboard.dispose();
    this.sky.dispose();
    this.bridges.dispose();
    this.pickups.dispose();
    this.winTrophies.dispose();
    this.root.removeFromParent();
  }

  /** Draw every solid, grouped by material so each group is one mesh. */
  private buildSolids(): void {
    const groups = new Map<string, { material: Material; parts: BufferGeometry[]; shadow: boolean }>();
    const into = (key: string, material: () => Material, shadow: boolean): BufferGeometry[] => {
      let group = groups.get(key);
      if (!group) {
        group = { material: material(), parts: [], shadow };
        groups.set(key, group);
      }
      return group.parts;
    };

    for (const solid of COURSE_SOLIDS) {
      const kind: SolidKind = solid.kind;
      let parts: BufferGeometry[];
      switch (kind) {
        case 'lobby':
          parts = into('lobby', () => this.studMaterial(PALETTE.grass, PALETTE.grassEdge), false);
          break;
        case 'meadow':
          parts = into(
            'meadow',
            () => {
              const material = new MeshLambertMaterial({ map: worldTextures.bills('#46d66a', '#1d7a36') });
              this.materials.push(material);
              this.meadowMaterial = material;
              return material;
            },
            false,
          );
          break;
        case 'island': {
          const stage = STAGES[solid.stage - 1];
          const theme: IslandTheme = stage?.theme ?? 'grass';
          const colours = ISLAND_COLOURS[theme];
          parts = into(`island:${theme}`, () => this.studMaterial(colours[0], colours[1]), false);
          break;
        }
        case 'wall':
          parts = into('wall', () => this.texturedMaterial(worldTextures.brick(PALETTE.brick, PALETTE.brickEdge)), true);
          break;
        case 'winPad':
          parts = into(
            'winPad',
            () => {
              const material = new MeshLambertMaterial({ map: worldTextures.studs(PALETTE.winPad, PALETTE.winPadEdge) });
              material.emissive.setHex(PALETTE.winPadGlow);
              material.emissiveIntensity = WIN_GLOW.base;
              this.materials.push(material);
              this.winPadMaterial = material;
              return material;
            },
            false,
          );
          break;
        case 'billPad':
          parts = into('pad', () => this.studMaterial(PALETTE.pad, PALETTE.padEdge), true);
          break;
        case 'deck':
        case 'stair':
          parts = into('deck', () => this.studMaterial(PALETTE.deck, PALETTE.deckEdge), true);
          break;
        case 'training':
          parts = into('training', () => this.studMaterial(PALETTE.sand, PALETTE.sandEdge), true);
          break;
        case 'pedestal':
          parts = into('pedestal', () => this.studMaterial(PALETTE.pedestal, PALETTE.pedestalEdge), true);
          break;
        case 'plinth':
          parts = into('plinth', () => this.studMaterial(PALETTE.plinth, PALETTE.plinthEdge), true);
          break;
        default:
          parts = into('other', () => this.studMaterial(PALETTE.deck, PALETTE.deckEdge), true);
      }
      parts.push(boxFor(solid, TILE));
    }

    for (const group of groups.values()) this.addMerged(group.parts, group.material, true, group.shadow);
  }

  /** The lava: a glowing slab under every stretch of river. */
  private buildLava(): void {
    const parts: BufferGeometry[] = [];
    for (const lava of LAVA_SPANS) {
      const geometry = texturedBox(lava.maxX - lava.minX, 3, lava.maxZ - lava.minZ, TILE);
      geometry.translate((lava.minX + lava.maxX) / 2, lava.surfaceY - 1.5, (lava.minZ + lava.maxZ) / 2);
      parts.push(geometry);
    }
    const material = new MeshLambertMaterial({ map: worldTextures.lava(PALETTE.lava, PALETTE.lavaHot) });
    material.emissive.setHex(PALETTE.lavaGlow);
    material.emissiveIntensity = 0.6;
    this.materials.push(material);
    this.lavaMaterial = material;
    this.addMerged(parts, material, false, false);
  }

  /**
   * THE MONEY MEADOW'S CASH: seventeen hundred stacks of notes as ONE
   * instanced mesh. Scattered deterministically, a third of them doubled up
   * into taller piles, all of them the equipped bill's colour.
   */
  private buildMeadowStacks(): void {
    const geometry = new BoxGeometry(1.5, 0.5, 1.0);
    this.geometries.push(geometry);
    const material = new MeshLambertMaterial({ map: worldTextures.bills('#46d66a', '#1d7a36') });
    this.materials.push(material);
    this.stackMaterial = material;

    const mesh = new InstancedMesh(geometry, material, STACK_COUNT);
    mesh.receiveShadow = true;
    const random = seeded(0x2a5c);
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const up = new Vector3(0, 1, 0);
    for (let i = 0; i < STACK_COUNT; i += 1) {
      const x = COURSE.meadowMinX + 1 + random() * (COURSE.meadowMaxX - COURSE.meadowMinX - 2);
      const z = COURSE.meadowMinZ + 1 + random() * (COURSE.meadowMaxZ - COURSE.meadowMinZ - 2);
      const tier = random();
      const layers = tier > 0.7 ? 2 : 1;
      const y = COURSE.floorY + 0.25 + (layers - 1) * 0.25;
      position.set(x, y, z);
      rotation.setFromAxisAngle(up, random() * Math.PI * 2);
      scale.set(0.85 + random() * 0.4, layers, 0.85 + random() * 0.4);
      matrix.compose(position, rotation, scale);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.root.add(mesh);
  }

  /** The scenery: palms, trees, rocks, crystals, cacti, mushrooms, lamps and chests, merged per material. */
  private buildDecorations(): void {
    const trunks: BufferGeometry[] = [];
    const leaves: BufferGeometry[] = [];
    const leavesDark: BufferGeometry[] = [];
    const rocks: BufferGeometry[] = [];
    const rocksDark: BufferGeometry[] = [];
    const crystals: BufferGeometry[] = [];
    const cacti: BufferGeometry[] = [];
    const caps: BufferGeometry[] = [];
    const stems: BufferGeometry[] = [];
    const posts: BufferGeometry[] = [];
    const lamps: BufferGeometry[] = [];
    const chests: BufferGeometry[] = [];
    const gold: BufferGeometry[] = [];

    // World-scaled UVs, so a tree's studs are the floor's studs.
    const box = (into: BufferGeometry[], w: number, h: number, d: number, x: number, y: number, z: number, ry = 0): void => {
      const geometry = texturedBox(w, h, d, TILE);
      geometry.rotateY(ry);
      geometry.translate(x, y, z);
      into.push(geometry);
    };

    for (const decoration of DECORATIONS) {
      const { x, y, z, scale: s, rotationY } = decoration;
      switch (decoration.kind) {
        case 'palm': {
          // A leaning trunk of stacked blocks and a crown of flat leaf slabs.
          for (let i = 0; i < 5; i += 1) {
            box(trunks, 1.1 * s, 1.6 * s, 1.1 * s, x + Math.sin(rotationY) * i * 0.25 * s, y + (i + 0.5) * 1.5 * s, z + Math.cos(rotationY) * i * 0.25 * s);
          }
          const top = y + 7.8 * s;
          const cx = x + Math.sin(rotationY) * 1.1 * s;
          const cz = z + Math.cos(rotationY) * 1.1 * s;
          for (let i = 0; i < 6; i += 1) {
            const angle = rotationY + (i / 6) * Math.PI * 2;
            box(leaves, 4.8 * s, 0.35 * s, 1.4 * s, cx + Math.cos(angle) * 2.2 * s, top + 0.2 * s, cz + Math.sin(angle) * 2.2 * s, -angle);
          }
          break;
        }
        case 'tree': {
          box(trunks, 1.3 * s, 4 * s, 1.3 * s, x, y + 2 * s, z);
          box(leaves, 5 * s, 3.2 * s, 5 * s, x, y + 5.4 * s, z, rotationY);
          box(leavesDark, 3.4 * s, 2.6 * s, 3.4 * s, x, y + 7.8 * s, z, rotationY + 0.4);
          break;
        }
        case 'rock': {
          box(rocks, 3.2 * s, 2.2 * s, 2.6 * s, x, y + 1.1 * s, z, rotationY);
          box(rocksDark, 2.0 * s, 1.5 * s, 1.8 * s, x + 1.4 * s, y + 0.75 * s, z + 0.6 * s, rotationY + 0.7);
          break;
        }
        case 'crystal': {
          const gem = new OctahedronGeometry(1.3 * s, 0);
          gem.scale(1, 2.2, 1);
          gem.rotateY(rotationY);
          gem.translate(x, y + 2.6 * s, z);
          crystals.push(gem);
          break;
        }
        case 'cactus': {
          box(cacti, 1.3 * s, 5 * s, 1.3 * s, x, y + 2.5 * s, z);
          box(cacti, 0.9 * s, 2.4 * s, 0.9 * s, x + 1.4 * s, y + 3.6 * s, z);
          box(cacti, 1.6 * s, 0.9 * s, 0.9 * s, x + 1.0 * s, y + 2.6 * s, z);
          break;
        }
        case 'mushroom': {
          const stem = new CylinderGeometry(0.6 * s, 0.75 * s, 2.2 * s, 8);
          stem.translate(x, y + 1.1 * s, z);
          stems.push(stem);
          const cap = new SphereGeometry(1.9 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
          cap.translate(x, y + 2.0 * s, z);
          caps.push(cap);
          break;
        }
        case 'lamp': {
          box(posts, 0.5 * s, 6 * s, 0.5 * s, x, y + 3 * s, z);
          box(lamps, 1.3 * s, 1.2 * s, 1.3 * s, x, y + 6.4 * s, z);
          break;
        }
        case 'chest': {
          box(chests, 3 * s, 1.6 * s, 2 * s, x, y + 0.8 * s, z, rotationY);
          box(gold, 3.1 * s, 0.6 * s, 2.1 * s, x, y + 1.9 * s, z, rotationY);
          break;
        }
      }
    }

    // Every prop is a studded block in its own colour: one material system.
    this.addMerged(trunks, this.propMaterial(PALETTE.trunk), true, true);
    this.addMerged(leaves, this.propMaterial(PALETTE.leaf), true, true);
    this.addMerged(leavesDark, this.propMaterial(PALETTE.leafDark), true, true);
    this.addMerged(rocks, this.propMaterial(PALETTE.rock), true, true);
    this.addMerged(rocksDark, this.propMaterial(PALETTE.rockDark), true, true);
    this.addMerged(crystals, this.propMaterial(PALETTE.crystal, 0.7), false, false);
    this.addMerged(cacti, this.propMaterial(PALETTE.cactus), true, true);
    this.addMerged(stems, this.propMaterial(PALETTE.mushroomStem), true, true);
    this.addMerged(caps, this.propMaterial(PALETTE.mushroomCap), true, true);
    this.addMerged(posts, this.propMaterial(PALETTE.lamp), true, true);
    this.addMerged(lamps, this.propMaterial(PALETTE.lampGlow, 0.9), false, false);
    this.addMerged(chests, this.propMaterial(PALETTE.chest), true, true);
    this.addMerged(gold, this.propMaterial(PALETTE.chestGold, 0.25), true, true);
  }

  /** The block walls around the spawn area. Scenery: the clamp is what holds the player. */
  private buildHubWalls(): void {
    const parts: BufferGeometry[] = [];
    const h = COURSE.wallHeight;
    const t = 6;
    const wall = (w: number, d: number, x: number, z: number): void => {
      const geometry = texturedBox(w, h, d, TILE);
      geometry.translate(x, COURSE.floorY + h / 2, z);
      parts.push(geometry);
    };
    const span = COURSE.hubMaxZ - COURSE.hubMinZ;
    wall(t, span, COURSE.hubMinX - t / 2, (COURSE.hubMinZ + COURSE.hubMaxZ) / 2);
    wall(t, span, COURSE.hubMaxX + t / 2, (COURSE.hubMinZ + COURSE.hubMaxZ) / 2);
    wall(COURSE.hubMaxX - COURSE.hubMinX + t * 2, t, 0, COURSE.hubMinZ - t / 2);
    this.addMerged(parts, this.texturedMaterial(worldTextures.brick(PALETTE.brick, PALETTE.brickEdge)), true, true);
  }

  /** A green field under everything and blocky hills on the horizon, so the world never floats in sky. */
  private buildHorizon(): void {
    const ground = texturedBox(2400, 4, 2400, TILE * 6);
    ground.translate(0, COURSE.floorY - COURSE.floorThickness - 2, (COURSE.hubMinZ + COURSE_END_Z) / 2);
    this.addMerged([ground], this.studMaterial(PALETTE.grassDeep, PALETTE.grassDeepEdge), false, false);

    const hills: BufferGeometry[] = [];
    const hillsDark: BufferGeometry[] = [];
    const random = seeded(0x4111);
    for (let i = 0; i < 46; i += 1) {
      const angle = (i / 46) * Math.PI * 2;
      const distance = 260 + random() * 160;
      const cx = Math.cos(angle) * distance;
      const cz = (COURSE.hubMinZ + COURSE_END_Z) / 2 + Math.sin(angle) * (distance + 140);
      const w = 40 + random() * 60;
      const h = 14 + random() * 26;
      const base = texturedBox(w, h, w * (0.7 + random() * 0.6), TILE);
      base.rotateY(random() * Math.PI);
      base.translate(cx, COURSE.floorY - 4 + h / 2, cz);
      hills.push(base);
      const cap = texturedBox(w * 0.6, h * 0.5, w * 0.5, TILE);
      cap.translate(cx, COURSE.floorY - 4 + h + h * 0.2, cz);
      hillsDark.push(cap);
    }
    this.addMerged(hills, this.propMaterial(PALETTE.hill), false, false);
    this.addMerged(hillsDark, this.propMaterial(PALETTE.hillDark), false, false);
  }

  /** "+5 Wins / Return" over every win pad, built as the player reaches the stage. */
  private buildWinPadSigns(): void {
    this.winReveal = new StageReveal(this.root, (stage) => {
      const sign = new CanvasSign(12, 5, [
        { text: `+${formatWins(stage.winReward)} Wins`, size: 1, fill: '#ffc51f', stroke: '#231502', strokeWidth: 0.17 },
        { text: 'Return', size: 0.58, fill: '#ffffff', stroke: '#231502', strokeWidth: 0.15 },
      ]);
      sign.mesh.position.set(stage.winPadX, stage.padY + 5.4, stage.winPadZ);
      sign.mesh.rotation.y = Math.PI;
      return sign;
    });

    // A halo under each pad, so it reads from the far bank.
    const halos: BufferGeometry[] = [];
    for (const stage of STAGES) {
      const halo = texturedBox(WIN_PAD.size + 3, 0.12, WIN_PAD.size + 3, TILE);
      halo.translate(stage.winPadX, stage.padY + 0.1, stage.winPadZ);
      halos.push(halo);
    }
    this.addMerged(halos, this.propMaterial(0xffe08a, 0.6), false, false);
  }

  private addMerged(geometries: BufferGeometry[], material: Material, receiveShadow: boolean, castShadow: boolean): void {
    if (geometries.length === 0) return;
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) return;
    this.geometries.push(merged);
    const mesh = new Mesh(merged, material);
    mesh.receiveShadow = receiveShadow;
    mesh.castShadow = castShadow;
    this.root.add(mesh);
  }

  private studMaterial(base: string, edge: string, cells = 4): Material {
    return this.texturedMaterial(worldTextures.studs(base, edge, cells));
  }

  /**
   * A prop's material: its colour as studs, outlined in the same colour
   * shaded darker, glowing if asked. Trees, rocks, lamps and hills all go
   * through here, so they share the floor's texture language and differ only
   * in colour and glow - which is what "same material system" means.
   */
  private propMaterial(color: number, emissive = 0): Material {
    const material = new MeshLambertMaterial({ map: worldTextures.studs(css(color), shade(color, 0.68)) });
    if (emissive > 0) {
      material.emissive.setHex(color);
      material.emissiveIntensity = emissive;
    }
    this.materials.push(material);
    return material;
  }

  private texturedMaterial(map: Texture): Material {
    const material = new MeshLambertMaterial({ map });
    this.materials.push(material);
    return material;
  }

}

/** Each island theme's stud colours. */
const ISLAND_COLOURS: Readonly<Record<IslandTheme, readonly [string, string]>> = {
  grass: [PALETTE.island, PALETTE.islandEdge],
  sand: [PALETTE.sand, PALETTE.sandEdge],
  snow: [PALETTE.snow, PALETTE.snowEdge],
  jungle: [PALETTE.jungle, PALETTE.jungleEdge],
  volcanic: [PALETTE.volcanic, PALETTE.volcanicEdge],
  gold: [PALETTE.goldFloor, PALETTE.goldFloorEdge],
};

const boxFor = (solid: CourseSolid, tile: number): BufferGeometry => {
  const geometry = texturedBox(solid.maxX - solid.minX, solid.maxY - solid.minY, solid.maxZ - solid.minZ, tile);
  geometry.translate((solid.minX + solid.maxX) / 2, (solid.minY + solid.maxY) / 2, (solid.minZ + solid.maxZ) / 2);
  return geometry;
};

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

export { BILLS, STAGES };
