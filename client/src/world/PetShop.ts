import { EGGS, EGG_PEDESTAL, formatWins } from '@money/shared';
import { Group, Mesh, MeshLambertMaterial, SphereGeometry, type BufferGeometry } from 'three';
import { CanvasSign } from './CanvasSign.js';

interface Egg {
  readonly root: Group;
  readonly phase: number;
}

/**
 * THE PET SHOP: two floating eggs on stud pedestals, just past the spawn area
 * and before the lava. Walking up to one opens its odds; the eggs themselves
 * only bob and turn.
 */
export class PetShop {
  readonly root = new Group();

  private readonly eggs: Egg[] = [];
  private readonly signs: CanvasSign[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshLambertMaterial[] = [];
  private time = 0;

  constructor() {
    const shell = new SphereGeometry(2.6, 18, 14);
    shell.scale(1, 1.3, 1);
    const spot = new SphereGeometry(0.55, 8, 6);
    this.geometries.push(shell, spot);

    EGGS.forEach((egg, i) => {
      const group = new Group();
      group.position.set(egg.x, EGG_PEDESTAL.height + EGG_PEDESTAL.floatY - 2, egg.z);

      const body = new Mesh(shell, this.lambert(egg.color, 0.08));
      body.castShadow = true;
      group.add(body);

      // A scatter of spots around the shell.
      const spots = this.lambert(egg.spots, 0);
      for (let k = 0; k < 9; k += 1) {
        const a = (k / 9) * Math.PI * 2 + i;
        const b = -0.6 + (k % 3) * 0.6;
        const mesh = new Mesh(spot, spots);
        mesh.position.set(Math.cos(a) * 2.35 * Math.cos(b), Math.sin(b) * 3.1, Math.sin(a) * 2.35 * Math.cos(b));
        mesh.scale.setScalar(0.7 + (k % 2) * 0.5);
        group.add(mesh);
      }

      const sign = new CanvasSign(11, 4.4, [
        { text: egg.name, size: 1, fill: '#ffffff', stroke: '#1c2233', strokeWidth: 0.16 },
        { text: `${formatWins(egg.cost)} Wins`, size: 0.7, fill: '#ffe08a', stroke: '#2a1a05', strokeWidth: 0.15 },
      ]);
      sign.mesh.position.set(0, 5.6, 0);
      // Facing the spawn: the player arrives from -Z.
      sign.mesh.rotation.y = Math.PI;
      group.add(sign.mesh);
      this.signs.push(sign);

      this.root.add(group);
      this.eggs.push({ root: group, phase: i * 1.9 });
    });
  }

  update(delta: number): void {
    this.time += delta;
    for (const egg of this.eggs) {
      egg.root.position.y = EGG_PEDESTAL.height + EGG_PEDESTAL.floatY - 2 + Math.sin(this.time * 1.4 + egg.phase) * 0.35;
      egg.root.rotation.y = this.time * 0.5 + egg.phase;
      egg.root.rotation.z = Math.sin(this.time * 1.1 + egg.phase) * 0.08;
    }
  }

  private lambert(color: number, emissive: number): MeshLambertMaterial {
    const material = new MeshLambertMaterial({ color });
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
