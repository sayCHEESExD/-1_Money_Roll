import { COURSE, formatCash } from '@money/shared';
import { Group } from 'three';
import { CanvasSign } from './CanvasSign.js';
import type { SignLine } from './CanvasSign.js';
import { StageReveal } from './StageReveal.js';

/**
 * The stage indicator at the head of each stretch of lava: "STAGE N" over
 * "N RECOMMENDED", exactly as the reference frames it. Floating text, no
 * panel, hung high over the river and facing back at the player approaching.
 * Built as the player reaches it.
 */
export class StageSigns {
  readonly root = new Group();

  private readonly reveal = new StageReveal(this.root, (stage) => {
    const lines: SignLine[] = [
      { text: `Stage ${stage.index}`, size: 1, fill: '#ffffff', stroke: '#1c2233', strokeWidth: 0.16 },
      { text: `${formatCash(stage.crossCost)} Recommended`, size: 0.5, fill: '#b9ffb0', stroke: '#1c2233', strokeWidth: 0.14 },
    ];
    const sign = new CanvasSign(34, 11, lines);
    sign.mesh.position.set(0, COURSE.floorY + 15, stage.lavaStartZ + 14);
    sign.mesh.rotation.y = Math.PI;
    return sign;
  });

  revealNear(z: number): void {
    this.reveal.revealNear(z);
  }

  dispose(): void {
    this.reveal.dispose();
    this.root.removeFromParent();
  }
}
