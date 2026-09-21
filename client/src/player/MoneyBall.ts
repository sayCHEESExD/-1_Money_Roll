import { billForSlot } from '@money/shared';
import { Group, Mesh, MeshLambertMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { css } from '../config/worldVisuals.js';
import { worldTextures } from '../world/WorldTextures.js';

/** How the ball's radius follows the cash carried. */
const BALL = {
  /** Radius at the smallest pile that is still shown. */
  min: 0.55,
  /** Largest radius, however much is carried. */
  max: 5.6,
  /** Cash below which there is no ball at all. */
  hideBelow: 1,
  /** How fast the radius eases toward the cash, per second. */
  growRate: 6,
  /** Gap between the player's body and the ball's surface. */
  standOff: 0.55,
} as const;

/** One shared sphere, scaled per ball. */
const GEOMETRY = new SphereGeometry(1, 22, 16);

const UP = new Vector3(0, 1, 0);
const AXIS = new Vector3();
const SPIN = new Quaternion();

/**
 * Radius of the money ball for a cash figure. Logarithmic, so the first few
 * hundred cash grow it fast and a million is only twice a thousand - the
 * reference's ball is about twice the player's height at three thousand.
 */
export const ballRadiusFor = (cash: number): number => {
  if (!Number.isFinite(cash) || cash < BALL.hideBelow) return 0;
  return Math.min(BALL.max, BALL.min + 1.35 * Math.log10(1 + cash / 20));
};

/**
 * THE MONEY BALL: the pile of cash the player pushes in front of them.
 *
 * A sphere skinned in the equipped bill's notes, sat on the ground directly
 * ahead of the player and ROLLED by the distance they cover, so it reads as
 * pushed along rather than carried. It grows as cash is earned and shrinks
 * as the bridge is bought out of it. Hidden when there is nothing to push.
 *
 * Parented to the CHARACTER ROOT, so it follows for free and sits ahead of
 * whichever way the player faces; its own rotation is accumulated in world
 * terms so the roll matches the ground going by.
 */
export class MoneyBall {
  readonly root = new Group();

  private readonly mesh: Mesh;
  private readonly material: MeshLambertMaterial;
  private radius = 0;
  private targetRadius = 0;
  private slot = -1;
  private readonly spin = new Quaternion();

  constructor() {
    this.material = new MeshLambertMaterial({ map: worldTextures.bills('#46d66a', '#1d7a36') });
    this.mesh = new Mesh(GEOMETRY, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.visible = false;
    this.root.add(this.mesh);
  }

  /** The current eased radius, for the animator's push blend and the camera. */
  get currentRadius(): number {
    return this.radius;
  }

  /** How much of a ball there is, 0..1, for the animator. */
  get pushWeight(): number {
    if (this.radius <= 0) return 0;
    return Math.min(1, (this.radius - BALL.min) / (BALL.max - BALL.min) + 0.18);
  }

  /** Wear the equipped bill's colour. */
  setBillSlot(slot: number): void {
    if (slot === this.slot) return;
    this.slot = slot;
    const bill = billForSlot(slot);
    this.material.map = worldTextures.bills(css(bill.color), css(bill.ink));
    this.material.needsUpdate = true;
  }

  /** Snap the ball to a cash figure without easing - a respawn, a first patch. */
  snap(cash: number): void {
    this.targetRadius = ballRadiusFor(cash);
    this.radius = this.targetRadius;
    this.apply();
  }

  /**
   * @param cash      what the player carries, predicted
   * @param yaw       the player's facing, so the ball sits ahead of them
   * @param vx, vz    the player's velocity, so the ball rolls the right way
   */
  update(delta: number, cash: number, yaw: number, vx: number, vz: number): void {
    this.targetRadius = ballRadiusFor(cash);
    const alpha = 1 - Math.exp(-BALL.growRate * Math.max(0, delta));
    this.radius += (this.targetRadius - this.radius) * alpha;
    if (this.targetRadius === 0 && this.radius < 0.05) this.radius = 0;

    const speed = Math.hypot(vx, vz);
    if (this.radius > 0.05 && speed > 0.05) {
      // Roll about the axis perpendicular to the travel, by the ground covered.
      AXIS.set(vz, 0, -vx).normalize();
      // The ball is a child of a yawed root, so the world axis is undone by it.
      AXIS.applyAxisAngle(UP, -yaw);
      SPIN.setFromAxisAngle(AXIS, (speed * delta) / this.radius);
      this.spin.premultiply(SPIN);
    }
    this.apply();
  }

  private apply(): void {
    if (this.radius <= 0.02) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.mesh.scale.setScalar(this.radius);
    this.mesh.quaternion.copy(this.spin);
    // Ahead of the player along +Z in root space, resting on the ground.
    this.mesh.position.set(0, this.radius, this.radius + BALL.standOff);
  }

  dispose(): void {
    this.material.dispose();
    this.root.removeFromParent();
  }
}
