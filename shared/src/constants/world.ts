import type { Vec3 } from '../types/math.js';

/**
 * World-space constants shared by the renderer and the authoritative server.
 *
 * Units are "world units" (1 unit ~= 1 Roblox stud in feel). The supplied
 * player.fbx is authored at 320 units tall, so it is scaled down on load.
 */

/** Multiplier applied to the loaded FBX so the character is PLAYER_HEIGHT tall. */
export const FBX_TO_WORLD_SCALE = 0.01;

/** Player height in world units (320 * FBX_TO_WORLD_SCALE). */
export const PLAYER_HEIGHT = 3.2;

/**
 * Horizontal half-width of the player's collision body. A cylinder, because
 * the character turns; a little wider than the hips so the feet can stand on
 * a bridge edge rather than falling the instant the centre passes it.
 */
export const PLAYER_RADIUS = 0.8;

/** How large the head is drawn: Roblox-style proportions. */
export const HEAD_SCALE = 1.12;

export const neckScale = (portalHeadScale = 1): number => {
  const chosen =
    Number.isFinite(portalHeadScale) && portalHeadScale > 0 ? portalHeadScale : 1;
  return HEAD_SCALE * chosen;
};

/** The course runs along +Z. Players travel *along* it, never across it. */
export const COURSE_FORWARD_AXIS = 'z' as const;

/**
 * Spawn transform: the back of the spawn area, on the centre line, facing
 * +Z down the Money Meadow toward the lava river. The bill stands are on the
 * player's LEFT (+X) and the training zones on their RIGHT (-X).
 */
export const SPAWN_POSITION: Readonly<Vec3> = { x: 0, y: 0, z: -140 };

/** Spawn yaw in radians (facing +Z, down the course). */
export const SPAWN_ROTATION_Y = 0;

/** Y below which the player has fallen out of the world. Below the lava. */
export const DEATH_PLANE_Y = -14;

/**
 * Seconds a dead player stays where they fell before being placed at the
 * spawn. The client's `DEATH.duration` is this number.
 */
export const DEATH_HOLD_SECONDS = 0.55;

/** Extra seconds the SERVER waits beyond the animation before placing. */
export const DEATH_PLACE_MARGIN = 0.1;
