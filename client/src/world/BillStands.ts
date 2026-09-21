import {
  BILLS,
  BILL_ROW,
  billPadX,
  billPadY,
  billPadZ,
  formatGain,
  formatWins,
  ownsBill,
} from '@money/shared';
import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type BufferGeometry,
} from 'three';
import { PALETTE, css, shade } from '../config/worldVisuals.js';
import { CanvasSign } from './CanvasSign.js';
import { texturedBox } from './texturedBox.js';
import { worldTextures } from './WorldTextures.js';

/** One pad's dressing: what changes with the player's inventory. */
interface Stand {
  readonly slot: number;
  readonly face: Mesh;
  readonly beam: Mesh;
  readonly beamMaterial: MeshBasicMaterial;
  readonly note: Mesh;
}

/**
 * THE BILL STANDS, on the player's LEFT: two rows of five, the back row on a
 * raised deck, exactly as the reference's "BILLS - EARN money FASTER!" area.
 *
 * Each pad carries a floating, turning note in its bill's colour, a column of
 * light under it and a sign saying "+N Cash" and what it costs in Wins.
 * Three states, decided by REPLICATED state and nothing else: OWNED (green
 * face, steady beam), AFFORDABLE (the face and beam pulse, so a player can see
 * from the meadow which pad is waiting for them) and LOCKED (dim red).
 */
export class BillStands {
  readonly root = new Group();

  private readonly stands: Stand[] = [];
  private readonly signs: CanvasSign[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: (MeshLambertMaterial | MeshBasicMaterial)[] = [];

  private readonly owned: MeshLambertMaterial;
  private readonly ready: MeshLambertMaterial;
  private readonly locked: MeshLambertMaterial;

  private ownedMask = 0;
  private wins = 0;
  private time = 0;

  constructor() {
    this.owned = this.lambert(PALETTE.padReady, 0.35);
    this.ready = this.lambert(0xffe066, 0.7);
    this.locked = this.lambert(PALETTE.padLocked, 0.05);

    const size = BILL_ROW.padSize;
    const faceGeometry = new BoxGeometry(size - 1.2, 0.14, size - 1.2);
    const beamGeometry = new CylinderGeometry(1.2, 1.8, 7, 12, 1, true);
    const noteGeometry = new BoxGeometry(3.2, 1.8, 0.14);
    this.geometries.push(faceGeometry, beamGeometry, noteGeometry);

    for (const bill of BILLS) {
      const x = billPadX(bill.slot);
      const y = billPadY(bill.slot);
      const z = billPadZ(bill.slot);

      const face = new Mesh(faceGeometry, this.locked);
      face.position.set(x, y + 0.08, z);
      face.receiveShadow = true;
      this.root.add(face);

      const beamMaterial = new MeshBasicMaterial({
        color: bill.color,
        transparent: true,
        opacity: 0.16,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      this.materials.push(beamMaterial);
      const beam = new Mesh(beamGeometry, beamMaterial);
      beam.position.set(x, y + 3.5, z);
      this.root.add(beam);

      // The bill itself, floating and turning over the pad.
      const noteMaterial = new MeshLambertMaterial({ map: worldTextures.bills(css(bill.color), css(bill.ink)) });
      noteMaterial.emissive.setHex(bill.color);
      noteMaterial.emissiveIntensity = 0.15;
      this.materials.push(noteMaterial);
      const note = new Mesh(noteGeometry, noteMaterial);
      note.position.set(x, y + 3.4, z);
      note.castShadow = true;
      this.root.add(note);

      const requirement = bill.winsRequired === 0 ? 'FREE' : `${formatWins(bill.winsRequired)} Wins`;
      const sign = new CanvasSign(9, 3.6, [
        { text: `+${formatGain(bill.gain)} Cash`, size: 1, fill: css(bill.color), stroke: '#1c2233', strokeWidth: 0.16 },
        {
          text: requirement,
          size: 0.62,
          fill: bill.winsRequired === 0 ? '#9dff8a' : '#ffffff',
          stroke: '#1c2233',
          strokeWidth: 0.15,
        },
      ]);
      sign.mesh.position.set(x, y + 7.2, z);
      // Facing the meadow, which is -X from the stands.
      sign.mesh.rotation.y = -Math.PI / 2;
      this.root.add(sign.mesh);
      this.signs.push(sign);

      this.stands.push({ slot: bill.slot, face, beam, beamMaterial, note });
    }

    // The area's board, behind the back row on two posts, as the reference has it.
    const boardX = BILL_ROW.deckMaxX + 2;
    const boardZ = (BILL_ROW.firstZ + BILL_ROW.firstZ + BILL_ROW.spacingZ * (BILL_ROW.perRow - 1)) / 2;
    const post = texturedBox(1.2, 22, 1.2, 4);
    this.geometries.push(post);
    const postMaterial = this.lambert(0x2b3554, 0);
    for (const dz of [-14, 14]) {
      const mesh = new Mesh(post, postMaterial);
      mesh.position.set(boardX, BILL_ROW.deckY + 11, boardZ + dz);
      this.root.add(mesh);
    }
    const board = new CanvasSign(34, 12, [
      { text: 'BILLS', size: 1, fill: '#ffffff', stroke: '#1c2233', strokeWidth: 0.16 },
      { text: 'EARN money FASTER!', size: 0.55, fill: '#ffe08a', stroke: '#1c2233', strokeWidth: 0.14 },
    ]);
    board.mesh.position.set(boardX - 0.8, BILL_ROW.deckY + 19, boardZ);
    board.mesh.rotation.y = -Math.PI / 2;
    this.root.add(board.mesh);
    this.signs.push(board);
    const backing = new Mesh(texturedBox(1.4, 12, 36, 4), this.lambert(0xf0c95a, 0.1));
    backing.position.set(boardX + 0.4, BILL_ROW.deckY + 19, boardZ);
    this.root.add(backing);

    this.apply();
  }

  /** Mirror the replicated inventory and wallet. */
  setInventory(ownedMask: number, wins: number): void {
    if (ownedMask === this.ownedMask && wins === this.wins) return;
    this.ownedMask = ownedMask;
    this.wins = wins;
    this.apply();
  }

  update(delta: number, _viewerX: number, _viewerZ: number): void {
    this.time += delta;
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 4);
    for (let i = 0; i < this.stands.length; i += 1) {
      const stand = this.stands[i];
      if (!stand) continue;
      const bill = BILLS[stand.slot - 1];
      if (!bill) continue;
      const owned = ownsBill(this.ownedMask, stand.slot);
      const ready = !owned && this.wins >= bill.winsRequired;
      stand.beamMaterial.opacity = owned ? 0.24 : ready ? 0.14 + pulse * 0.3 : 0.07;
      stand.beam.rotation.y = this.time * 0.8;
      stand.note.rotation.y = this.time * 1.1 + i * 0.6;
      stand.note.position.y = billPadY(stand.slot) + 3.4 + Math.sin(this.time * 1.6 + i) * 0.25;
      if (ready) this.ready.emissiveIntensity = 0.4 + pulse * 0.6;
    }
  }

  private apply(): void {
    for (const stand of this.stands) {
      const bill = BILLS[stand.slot - 1];
      if (!bill) continue;
      const owned = ownsBill(this.ownedMask, stand.slot);
      const ready = !owned && this.wins >= bill.winsRequired;
      stand.face.material = owned ? this.owned : ready ? this.ready : this.locked;
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
