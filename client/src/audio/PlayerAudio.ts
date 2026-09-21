import type { AudioManager } from './AudioManager.js';

/** Below this, the player is not really moving and should be silent. */
const MIN_AUDIBLE_SPEED = 2.5;

/** World units of travel between two FOOTFALLS at a walk. */
const STRIDE_DISTANCE = 2.6;

/** Most footfalls a second, so a fast walk patters rather than buzzes. */
const MAX_STEPS_PER_SECOND = 7;

export interface PlayerAudioInput {
  readonly horizontalSpeed: number;
  readonly maxRunSpeed: number;
  readonly isGrounded: boolean;
  readonly justJumped: boolean;
  readonly justLanded: boolean;
  readonly justBuilt: number;
  readonly justCrossed: number;
  readonly isDying: boolean;
}

/**
 * Turns what the local player is doing into sounds.
 *
 * ONLY the local player is fed through here. Footfalls per stride from
 * distance covered; the jump and the death are the supplied recordings; a
 * note laid on the lava is a soft tick and a completed crossing a chime.
 */
export class PlayerAudio {
  private readonly audio: AudioManager;
  private stride = 0;
  private sinceBeat = 0;
  private wasDying = false;

  constructor(audio: AudioManager) {
    this.audio = audio;
  }

  update(delta: number, player: PlayerAudioInput): void {
    if (player.isDying) {
      if (!this.wasDying) {
        this.wasDying = true;
        this.audio.play('death');
      }
      this.stride = 0;
      this.audio.setFootsteps(false, 0);
      return;
    }
    this.wasDying = false;

    if (player.justJumped) this.audio.play('jump');
    if (player.justLanded) this.audio.play('land', this.loudness(player));
    if (player.justBuilt > 0) this.audio.play('claim', 0.35);
    if (player.justCrossed > 0) this.audio.play('unlock');

    this.sinceBeat += delta;

    const pace = player.horizontalSpeed;
    const walking = player.isGrounded && pace >= MIN_AUDIBLE_SPEED;
    const looped = this.audio.setFootsteps(walking, pace / Math.max(1, player.maxRunSpeed));
    if (!walking || looped) {
      this.stride = 0;
      return;
    }

    this.stride += pace * delta;
    if (this.stride < STRIDE_DISTANCE) return;
    if (this.sinceBeat < 1 / MAX_STEPS_PER_SECOND) {
      this.stride = 0;
      return;
    }

    this.stride = 0;
    this.sinceBeat = 0;
    this.audio.play('step', 0.3 + this.loudness(player) * 0.5);
  }

  private loudness(player: PlayerAudioInput): number {
    const top = Math.max(1, player.maxRunSpeed * 1.4);
    return Math.min(player.horizontalSpeed / top, 1);
  }
}
