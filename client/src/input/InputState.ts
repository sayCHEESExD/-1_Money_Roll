/** Normalised, device-agnostic input snapshot consumed by the player controller. */
export interface InputState {
  /** -1 (left) .. 1 (right), camera-relative. */
  moveX: number;
  /** -1 (back) .. 1 (forward), camera-relative. */
  moveZ: number;
  /** The jump control (Space, or the on-screen JUMP button), HELD. */
  jump: boolean;
}

export const createInputState = (): InputState => ({
  moveX: 0,
  moveZ: 0,
  jump: false,
});
