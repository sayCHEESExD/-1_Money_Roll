import { COURSE, billForSlot, cellCentre } from '@money/shared';
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshLambertMaterial, Quaternion, Vector3 } from 'three';
import { worldTextures } from './WorldTextures.js';

/** Most cells drawn at once, across every visible player. */
const CAPACITY = 900;

/** One bridge to draw: whose cells, in whose colour. */
export interface BridgeSource {
  readonly cells: ReadonlySet<number>;
  readonly billSlot: number;
}

const MATRIX = new Matrix4();
const POSITION = new Vector3();
const ROTATION = new Quaternion();
const SCALE = new Vector3();
const UP = new Vector3(0, 1, 0);
const COLOR = new Color();

/**
 * THE MONEY BRIDGES: every cell every visible player has laid across the
 * lava, as ONE instanced mesh.
 *
 * A cell is a slab of notes the size of the grid cell, in its builder's bill
 * colour, given a little hash-driven yaw and lift so a lane of them reads as
 * notes piled on the lava rather than as tiles. Rebuilt only when a bridge
 * changed, which a caller says by handing over a fresh version number.
 */
export class MoneyBridges {
  readonly root = new Group();

  private readonly mesh: InstancedMesh;
  private readonly material: MeshLambertMaterial;
  private lastVersion = -1;

  constructor() {
    const geometry = new BoxGeometry(COURSE.cellSize * 0.96, COURSE.bridgeThickness, COURSE.cellSize * 0.96);
    // White notes: the instance colour tints them to the builder's bill.
    this.material = new MeshLambertMaterial({ map: worldTextures.bills('#f4f6f2', '#5a6270') });
    this.mesh = new InstancedMesh(geometry, this.material, CAPACITY);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.root.add(this.mesh);
  }

  /**
   * Redraw from the given bridges if `version` moved.
   *
   * @param version any number that changes when any source changed
   */
  sync(version: number, sources: Iterable<BridgeSource>): void {
    if (version === this.lastVersion) return;
    this.lastVersion = version;

    let count = 0;
    for (const source of sources) {
      const bill = billForSlot(source.billSlot);
      COLOR.setHex(bill.color);
      for (const id of source.cells) {
        if (count >= CAPACITY) break;
        const centre = cellCentre(id);
        if (!centre) continue;
        const hash = (id * 2654435761) >>> 0;
        const yaw = ((hash & 0xff) / 255 - 0.5) * 0.18;
        const lift = ((hash >>> 8) & 0xff) / 255 * 0.08;
        POSITION.set(centre.x, COURSE.bridgeTopY - COURSE.bridgeThickness / 2 + lift, centre.z);
        ROTATION.setFromAxisAngle(UP, yaw);
        SCALE.set(1, 1, 1);
        MATRIX.compose(POSITION, ROTATION, SCALE);
        this.mesh.setMatrixAt(count, MATRIX);
        this.mesh.setColorAt(count, COLOR);
        count += 1;
      }
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.root.removeFromParent();
  }
}
