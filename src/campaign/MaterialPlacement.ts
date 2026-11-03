import * as THREE from 'three';
import type { CampaignCollisionBounds, CampaignWorldBounds } from './objects/CampaignMap';
import type { CampaignMaterial, MaterialType } from './objects/MaterialWorld';
import type { Module } from './objects/Module';
import { CAMPAIGN_CONFIG } from './CampaignConfig';

export const MATERIAL_FOOTPRINT_RADIUS: Readonly<Record<MaterialType, number>> = CAMPAIGN_CONFIG.materialPresentation.footprintRadiusMeters;
const AUTHORED_RING_DISTANCES = Object.freeze([0.42, 0.84, 1.26, 1.68, 2.1]);

export function findMaterialLanding(
  type: MaterialType,
  preferred: THREE.Vector3,
  bounds: CampaignWorldBounds,
  obstacles: readonly CampaignCollisionBounds[],
  player: Readonly<{ x: number; y: number }>,
  materials: Iterable<CampaignMaterial>,
  modules: readonly Module[],
  excludeId?: string,
): THREE.Vector3 | null {
  const radius = MATERIAL_FOOTPRINT_RADIUS[type];
  const candidate = new THREE.Vector3();
  const valid = (candidate: THREE.Vector3): boolean => {
    if (Math.hypot(candidate.x - player.x, candidate.z - player.y) < radius + CAMPAIGN_CONFIG.movement.playerRadiusMeters) return false;
    for (const obstacle of obstacles) {
      if (candidate.x > obstacle.minX - radius && candidate.x < obstacle.maxX + radius &&
        candidate.z > obstacle.minZ - radius && candidate.z < obstacle.maxZ + radius) return false;
    }
    for (const material of materials) {
      if (material.id === excludeId || (material.location !== 'world' && material.location !== 'output' && material.location !== 'reserved')) continue;
      const otherRadius = MATERIAL_FOOTPRINT_RADIUS[material.type];
      const reserved = material.root.userData.campaignReservedLanding as THREE.Vector3 | undefined;
      const x = reserved?.x ?? material.root.position.x; const z = reserved?.z ?? material.root.position.z;
      if (Math.hypot(candidate.x - x, candidate.z - z) < radius + otherRadius + 0.04) return false;
    }
    for (const module of modules) if (module.location.kind === 'world' && Math.hypot(candidate.x - module.root.position.x, candidate.z - module.root.position.z) < radius + 0.34) return false;
    return true;
  };
  const sample = (x: number, z: number): THREE.Vector3 | null => {
    candidate.set(THREE.MathUtils.clamp(x, bounds.minX + radius, bounds.maxX - radius), 0,
      THREE.MathUtils.clamp(z, bounds.minZ + radius, bounds.maxZ - radius));
    return valid(candidate) ? candidate.clone() : null;
  };
  let terminal = sample(preferred.x, preferred.z); if (terminal !== null) return terminal;
  for (const distance of AUTHORED_RING_DISTANCES) for (let index = 0; index < 16; index += 1) {
    const angle = index * Math.PI / 8; terminal = sample(preferred.x + Math.cos(angle) * distance, preferred.z + Math.sin(angle) * distance);
    if (terminal !== null) return terminal;
  }
  let bestX = 0; let bestZ = 0; let bestDistance = Number.POSITIVE_INFINITY; let found = false;
  for (let z = bounds.minZ + radius; z <= bounds.maxZ - radius + 1e-8; z += 0.5) for (let x = bounds.minX + radius; x <= bounds.maxX - radius + 1e-8; x += 0.5) {
    candidate.set(x, 0, z); if (!valid(candidate)) continue;
    const distance = candidate.distanceToSquared(preferred);
    if (distance < bestDistance - 1e-8 || (Math.abs(distance - bestDistance) <= 1e-8 && (z < bestZ || (z === bestZ && x < bestX)))) {
      found = true; bestDistance = distance; bestX = x; bestZ = z;
    }
  }
  return found ? new THREE.Vector3(bestX, 0, bestZ) : null;
}
