import { PLAYER_HEIGHT } from '@money/shared';
import { Group, Mesh, Object3D } from 'three';
import type { AnimationInput } from '../animation/AnimationInput.js';
import { PlayerAnimator, type AnimationState } from '../animation/PlayerAnimator.js';
import { PlayerRig } from '../animation/rig/PlayerRig.js';
import { PLAYER_MODEL_YAW_OFFSET } from '../config/worldVisuals.js';
import { AuraEffect } from '../effects/AuraEffect.js';
import { MoneyBall } from './MoneyBall.js';
import { PetFollowers } from './PetFollowers.js';
import { playerModelLoader } from './PlayerModelLoader.js';

/**
 * The visual half of a player, arranged so animation can never move them.
 *
 *   root          physics transform (position + facing). Gameplay owns it.
 *     visual      the bob, the bank, the fall-over and the arrival pop
 *       model     the cloned FBX (or a Bloxity body), posed by the rig
 *     ball        THE MONEY BALL, ahead of the player, rolled by their travel
 *     aura        the aura, in the character's own space
 *     pets        the equipped pets, hovering in their slots
 */
export class PlayerCharacter {
  readonly root = new Group();
  readonly ball = new MoneyBall();
  readonly aura = new AuraEffect();
  readonly pets = new PetFollowers();

  private readonly visual = new Group();
  private readonly defaultModel: Object3D;
  private model: Object3D;
  private animator: PlayerAnimator;
  private rig: PlayerRig;

  constructor() {
    this.defaultModel = playerModelLoader.createInstance();
    this.model = this.defaultModel;
    this.model.rotation.y = PLAYER_MODEL_YAW_OFFSET;
    this.root.add(this.visual, this.ball.root, this.aura.root, this.pets.root);
    this.visual.add(this.model);
    this.rig = new PlayerRig(this.model, this.model);
    this.animator = new PlayerAnimator(this.rig, this.visual);
  }

  /** The body currently worn: the bundled FBX or a Bloxity body. */
  get modelRoot(): Object3D {
    return this.model;
  }

  /** The visual node and the model, for the cosmetics layer. */
  get body(): { visual: Group; model: Object3D } {
    return { visual: this.visual, model: this.model };
  }

  /** Height of the whole silhouette, for floating labels. */
  get height(): number {
    return PLAYER_HEIGHT;
  }

  /**
   * Wear a different body, or null for the bundled one. The body goes into
   * the SAME `visual` node, so nothing above it moves, and a fresh rig is
   * bound to it by bone name.
   */
  setModel(next: Object3D | null): Object3D {
    const target = next ?? this.defaultModel;
    if (target === this.model) return target;

    const previous = this.model;
    previous.removeFromParent();
    releaseBody(previous);

    target.rotation.y = PLAYER_MODEL_YAW_OFFSET;
    this.rig = new PlayerRig(target, target);
    this.rig.resetToBindPose();
    target.updateMatrixWorld(true);

    this.model = target;
    this.visual.add(target);
    this.animator.setRig(this.rig);
    return target;
  }

  setPosition(x: number, y: number, z: number): void {
    this.root.position.set(x, y, z);
  }

  setYaw(yaw: number): void {
    this.root.rotation.y = yaw;
  }

  /** Scale the body, for the arrival pop. Never the physics root. */
  setVisualScale(scale: number): void {
    this.visual.scale.setScalar(scale);
  }

  /** What the server says this player wears and carries. */
  setCosmetics(billSlot: number, auraSlot: number, pets: string, equippedPets: string): void {
    this.ball.setBillSlot(billSlot);
    this.aura.setSlot(auraSlot);
    this.pets.set(pets, equippedPets);
  }

  /**
   * @param cash   the cash to draw as the ball, predicted or replicated
   * @param vx, vz the player's velocity, for the roll
   */
  update(delta: number, input: AnimationInput, cash: number, vx: number, vz: number): void {
    this.ball.update(delta, cash, this.root.rotation.y, vx, vz);
    input.push = this.ball.pushWeight;
    this.animator.update(Math.max(0, delta), input);
    this.aura.update(delta, this.root.rotation.y);
    this.pets.update(delta);
  }

  get animationState(): AnimationState {
    return this.animator.currentState;
  }

  resetAnimation(): void {
    this.animator.reset();
    this.visual.scale.setScalar(1);
  }

  dispose(): void {
    this.ball.dispose();
    this.aura.dispose();
    this.pets.dispose();
    this.root.removeFromParent();
  }
}

/**
 * Let go of a body that has been swapped out. ONLY its material, and only
 * when the body was one built for a Bloxity avatar: part meshes are cached
 * and shared between every player wearing the same item.
 */
const releaseBody = (model: Object3D): void => {
  if (model.userData['bloxityBody'] !== true) return;
  model.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material?.dispose();
  });
};
