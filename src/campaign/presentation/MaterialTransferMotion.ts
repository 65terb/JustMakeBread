export type MaterialTransferProfile = 'pickup' | 'floor-drop';

export const MATERIAL_FLOOR_DROP_HOLD_SECONDS = 0.03;
export const MATERIAL_FLOOR_DROP_TRAVEL_SECONDS = 0.42;
export const MATERIAL_FLOOR_DROP_DURATION_SECONDS =
  MATERIAL_FLOOR_DROP_HOLD_SECONDS + MATERIAL_FLOOR_DROP_TRAVEL_SECONDS;
export const MATERIAL_FLOOR_DROP_ARC_METERS = 0.03;

export interface MaterialTransferSampleTarget {
  x: number;
  y: number;
  z: number;
  complete: boolean;
}

const PICKUP_RATE = 4;
const PICKUP_DENOMINATOR = 1 + 3 * Math.exp(-PICKUP_RATE);

/** Samples the approved acquisition/drop presentation into one retained target. */
export function sampleMaterialTransferInto(
  target: MaterialTransferSampleTarget,
  profile: MaterialTransferProfile,
  elapsedSeconds: number,
  pickupDurationSeconds: number,
  startX: number,
  startY: number,
  startZ: number,
): void {
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  if (profile === 'pickup') {
    if (elapsed >= pickupDurationSeconds) {
      target.x = 0; target.y = 0; target.z = 0; target.complete = true;
      return;
    }
    const normalized = elapsed / pickupDurationSeconds;
    const exponential = Math.exp(-PICKUP_RATE * normalized);
    const polynomial = 1 + PICKUP_RATE * normalized - 8 * normalized * normalized;
    const progress = (1 - polynomial * exponential) / PICKUP_DENOMINATOR;
    const remaining = Math.max(0, Math.min(1, 1 - progress));
    target.x = startX * remaining;
    target.y = startY * remaining;
    target.z = startZ * remaining;
    target.complete = false;
    return;
  }

  if (elapsed >= MATERIAL_FLOOR_DROP_DURATION_SECONDS) {
    target.x = 0; target.y = 0; target.z = 0; target.complete = true;
    return;
  }
  if (elapsed < MATERIAL_FLOOR_DROP_HOLD_SECONDS) {
    target.x = startX; target.y = startY; target.z = startZ; target.complete = false;
    return;
  }
  const normalized = Math.min(1,
    (elapsed - MATERIAL_FLOOR_DROP_HOLD_SECONDS) / MATERIAL_FLOOR_DROP_TRAVEL_SECONDS);
  const value = 1 - (1 - normalized) * (1 - normalized);
  const remaining = 1 - value;
  target.x = startX * remaining;
  target.y = startY * remaining + Math.sin(Math.PI * value) * MATERIAL_FLOOR_DROP_ARC_METERS;
  target.z = startZ * remaining;
  target.complete = false;
}
