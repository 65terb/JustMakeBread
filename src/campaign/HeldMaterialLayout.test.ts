import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HELD_STACK_CONTACT_OVERLAP_METERS, HELD_STACK_LATERAL_OVERLAP_METERS, layoutHeldMaterials } from './HeldMaterialLayout';
import { Player } from './objects/Player';
import type { CampaignMaterial, MaterialType } from './objects/MaterialWorld';
import { testPlayerVisual } from './test/CampaignTestVisuals';
import { CAMPAIGN_PREPARED_HELD_LATERAL_WIDTH_METERS, CAMPAIGN_PREPARED_MATERIAL_HEIGHT_METERS } from './CampaignAssets';

const step = (type: 'flour' | 'bread'): number => CAMPAIGN_PREPARED_HELD_LATERAL_WIDTH_METERS[type] - HELD_STACK_LATERAL_OVERLAP_METERS;

const expectedX: Readonly<Record<MaterialType, Readonly<Record<number, readonly number[]>>>> = Object.freeze({
  wheat: Object.freeze({ 1: [0], 2: [-0.068, 0.068], 3: [-0.068, 0.068, 0], 4: [-0.068, 0.068, -0.068, 0.068], 5: [-0.136, 0, 0.136, -0.068, 0.068] }),
  flour: Object.freeze({ 1: [0], 2: [-step('flour') / 2, step('flour') / 2], 3: [-step('flour') / 2, step('flour') / 2, 0], 4: [-step('flour') / 2, step('flour') / 2, -step('flour') / 2, step('flour') / 2], 5: [-step('flour'), 0, step('flour'), -step('flour') / 2, step('flour') / 2] }),
  bread: Object.freeze({ 1: [0], 2: [-step('bread') / 2, step('bread') / 2], 3: [-step('bread') / 2, step('bread') / 2, 0], 4: [-step('bread') / 2, step('bread') / 2, -step('bread') / 2, step('bread') / 2], 5: [-step('bread'), 0, step('bread'), -step('bread') / 2, step('bread') / 2] }),
});
const anchor = Object.freeze({ wheat: { x: 0.005, y: 0.844, z: -0.27 }, flour: { x: 0.005, y: 0.843, z: -0.451 }, bread: { x: 0.005, y: 0.844, z: -0.548 } });

describe('v5.1 held material layouts', () => {
  for (const type of ['wheat', 'flour', 'bread'] as const) it(`keeps ${type} roots in every authored one-to-five player-local arrangement`, () => {
    for (let count = 1; count <= 5; count += 1) {
      const player = new Player(testPlayerVisual()); player.root.position.set(7, 0, -2); player.root.rotation.y = 0.7;
      const materials: CampaignMaterial[] = Array.from({ length: count }, (_, index) => { const root = new THREE.Group(); const presentationRoot = new THREE.Group(); root.add(presentationRoot); return { id: `${type}-${index}`, type, root, presentationRoot, location: 'held' }; });
      layoutHeldMaterials(player, materials);
      expect(materials.every((material) => material.root.parent === player.root && material.root.scale.equals(new THREE.Vector3(1, 1, 1)))).toBe(true);
      const actualX = materials.map((material) => material.root.position.x - anchor[type].x);
      expectedX[type][count]!.forEach((expected, index) => expect(actualX[index]).toBeCloseTo(expected, 10));
      expect(materials[0]!.root.position.z).toBeCloseTo(anchor[type].z, 6); expect(materials[0]!.root.position.y).toBeCloseTo(anchor[type].y, 6);
      if (type === 'wheat') { expect(materials[0]!.root.rotation.x).toBeCloseTo(-Math.PI / 2, 6); expect(Math.abs(materials[0]!.root.rotation.y - Math.PI / 2)).toBeLessThanOrEqual(2 * Math.PI / 180 + 1e-8); }
      else { expect(materials[0]!.root.rotation.x).toBe(0); expect(materials.every((material) => Math.abs(material.root.rotation.y - (type === 'bread' ? Math.PI / 2 : 0)) < 1e-8)).toBe(true); }
      if (type !== 'wheat') for (let left = 0; left < materials.length; left += 1) for (let right = left + 1; right < materials.length; right += 1) {
        if (materials[left]!.root.position.y === materials[right]!.root.position.y) expect(Math.abs(materials[left]!.root.position.x - materials[right]!.root.position.x)).toBeGreaterThanOrEqual(step(type));
      }
      if (type !== 'wheat' && count >= 3) expect(Math.max(...materials.map((material) => material.root.position.y)) - anchor[type].y)
        .toBeCloseTo(CAMPAIGN_PREPARED_MATERIAL_HEIGHT_METERS[type] - HELD_STACK_CONTACT_OVERLAP_METERS, 10);
    }
  });
});
