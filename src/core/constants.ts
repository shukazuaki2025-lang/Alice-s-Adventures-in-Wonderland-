/**
 * Canonical metric constants and standards for Alice: Down the Rabbit-Hole
 */

export const ALICE_HEIGHTS = {
  NORMAL: 1.20, // meters
  SMALL: 0.254, // meters (10 inches)
  GIANT: 2.90,  // meters (>9 feet)
} as const;

export const ALICE_SCALES = {
  NORMAL: 1.0,
  SMALL: 0.2117,
  GIANT: 2.417,
} as const;

export const CAPSULE_DIMENSIONS = {
  NORMAL: { radius: 0.18, height: 1.20 },
  SMALL: { radius: 0.04, height: 0.254 },
  GIANT: { radius: 0.43, height: 2.90 },
} as const;

export const CAMERA_PROFILES = {
  NORMAL: { distance: 3.20, height: 1.40, fov: 55.0 },
  SMALL: { distance: 0.80, height: 0.30, fov: 65.0 },
  GIANT: { distance: 6.50, height: 3.20, fov: 50.0 },
} as const;

export const ENVIRONMENT_METRICS = {
  HALL_LENGTH: 24.0,
  HALL_WIDTH: 7.0,
  HALL_HEIGHT: 2.85,
  TABLE_HEIGHT: 0.72,
  TABLE_RADIUS: 0.25,
  LITTLE_DOOR_WIDTH: 0.24,
  LITTLE_DOOR_HEIGHT: 0.381,
} as const;

export const PALETTE = {
  INK_OUTLINE: 0x2b2420,
  PAPER_GRAIN: 0xf7f3ea,
  INK_STRING: '#2B2420',
  PAPER_STRING: '#F7F3EA',
} as const;
