import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAMPAIGN_CONFIG } from '../CampaignConfig';
import { MaterialWorld } from '../objects/MaterialWorld';
import {
  MATERIAL_FLOOR_DROP_DURATION_SECONDS,
  MATERIAL_FLOOR_DROP_HOLD_SECONDS,
  sampleMaterialTransferInto,
  type MaterialTransferSampleTarget,
} from './MaterialTransferMotion';

const sample = (): MaterialTransferSampleTarget => ({ x: 0, y: 0, z: 0, complete: false });

describe('campaign material transfer presentation', () => {
  it('uses the canonical 180ms held acquisition profile and reaches identity exactly', () => {
    const start = { x: 1.2, y: -0.4, z: 0.8 }; const direct = sample(); const split = sample();
    const duration = CAMPAIGN_CONFIG.materialPresentation.heldTransferSeconds;
    sampleMaterialTransferInto(direct, 'pickup', duration / 2, duration, start.x, start.y, start.z);
    sampleMaterialTransferInto(split, 'pickup', duration / 4, duration, start.x, start.y, start.z);
    sampleMaterialTransferInto(split, 'pickup', duration / 2, duration, start.x, start.y, start.z);
    expect(split).toEqual(direct); expect(direct.complete).toBe(false); expect(Math.hypot(direct.x, direct.y, direct.z)).toBeGreaterThan(0);
    sampleMaterialTransferInto(direct, 'pickup', duration, duration, start.x, start.y, start.z);
    expect(direct).toEqual({ x: 0, y: 0, z: 0, complete: true });
  });

  it('holds, arcs, soft-settles, and terminalizes a floor drop deterministically', () => {
    const start = { x: -0.8, y: 1.1, z: 0.3 }; const target = sample();
    sampleMaterialTransferInto(target, 'floor-drop', MATERIAL_FLOOR_DROP_HOLD_SECONDS / 2, 0.3, start.x, start.y, start.z);
    expect(target).toEqual({ ...start, complete: false });
    sampleMaterialTransferInto(target, 'floor-drop', MATERIAL_FLOOR_DROP_HOLD_SECONDS + 0.21, 0.3, start.x, start.y, start.z);
    expect(target.y).toBeGreaterThan(start.y * 0.25); expect(target.complete).toBe(false);
    sampleMaterialTransferInto(target, 'floor-drop', MATERIAL_FLOOR_DROP_DURATION_SECONDS, 0.3, start.x, start.y, start.z);
    expect(target).toEqual({ x: 0, y: 0, z: 0, complete: true });
  });

  it('merges every visible child into its authoritative root before a campaign takeover', () => {
    const scene = new THREE.Scene(); const world = new MaterialWorld(scene, () => new THREE.Group(), CAMPAIGN_CONFIG.materialPresentation.heldTransferSeconds);
    const material = world.create('bread', new THREE.Vector3(2, 0, 1)); const start = new THREE.Vector3(-1, 1, 3);
    world.beginTransfer(material, start, 'floor-drop'); world.update(0.1);
    material.presentationRoot.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.2); material.presentationRoot.scale.setScalar(0.8);
    expect(material.presentationRoot.position.length()).toBeGreaterThan(0);
    const roots = world.takeAttemptMaterialRoots();
    expect(roots).toEqual([material.root]); expect(material.presentationRoot.position.length()).toBe(0);
    expect(material.presentationRoot.quaternion.equals(new THREE.Quaternion())).toBe(true);
    expect(material.presentationRoot.scale.equals(new THREE.Vector3(1, 1, 1))).toBe(true);
  });

  it('keeps the production transfer owner invariant under frame partitioning', () => {
    for (const profile of ['pickup', 'floor-drop'] as const) {
      const duration = CAMPAIGN_CONFIG.materialPresentation.heldTransferSeconds;
      const directWorld = new MaterialWorld(new THREE.Scene(), () => new THREE.Group(), duration);
      const splitWorld = new MaterialWorld(new THREE.Scene(), () => new THREE.Group(), duration);
      const direct = directWorld.create('wheat', new THREE.Vector3());
      const split = splitWorld.create('wheat', new THREE.Vector3());
      const start = new THREE.Vector3(0.7, -0.6, 1.1);
      directWorld.beginTransfer(direct, start, profile); splitWorld.beginTransfer(split, start, profile);
      directWorld.update(0.1); splitWorld.update(0.04); splitWorld.update(0.06);
      expect(split.presentationRoot.position.distanceTo(direct.presentationRoot.position)).toBeLessThan(1e-10);
      directWorld.dispose(); splitWorld.dispose();
    }
  });

  it('uses the owner-supplied pickup duration instead of a presentation-local constant', () => {
    const duration = 0.3;
    const world = new MaterialWorld(new THREE.Scene(), () => new THREE.Group(), duration);
    const material = world.create('flour', new THREE.Vector3());
    world.beginTransfer(material, new THREE.Vector3(1, 0.5, -0.25), 'pickup');
    world.update(0.19); expect(material.presentationRoot.position.length()).toBeGreaterThan(0);
    world.update(0.11); expect(material.presentationRoot.position.length()).toBe(0);
    world.dispose();
  });
});
