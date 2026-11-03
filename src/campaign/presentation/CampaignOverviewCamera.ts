import * as THREE from 'three';
import type { CampaignConfig } from '../CampaignConfig';
import type { CampaignWorldBounds } from '../objects/CampaignMap';

export interface CampaignOverviewCameraPose {
  readonly position: THREE.Vector3;
  readonly lookAt: THREE.Vector3;
  readonly bounds: THREE.Box3;
  readonly far: number;
}

const scratchBounds = new THREE.Box3();
const scratchCenter = new THREE.Vector3();
const scratchDirection = new THREE.Vector3();
const scratchForward = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchUp = new THREE.Vector3();
const scratchRelative = new THREE.Vector3();

export function fitCampaignOverviewCamera(camera: THREE.PerspectiveCamera, config: CampaignConfig['camera'], mapBounds: CampaignWorldBounds,
  roots: readonly THREE.Object3D[], authoredBounds: readonly THREE.Box3[]): CampaignOverviewCameraPose {
  const bounds = new THREE.Box3(
    new THREE.Vector3(mapBounds.minX, 0, mapBounds.minZ),
    new THREE.Vector3(mapBounds.maxX, 2.2, mapBounds.maxZ),
  );
  for (const root of roots) {
    scratchBounds.setFromObject(root, true);
    if (!scratchBounds.isEmpty()) bounds.union(scratchBounds);
  }
  for (const authored of authoredBounds) bounds.union(authored);
  bounds.getCenter(scratchCenter);
  scratchDirection.set(config.offsetX, config.offsetY, config.offsetZ).normalize();
  scratchForward.copy(scratchDirection).multiplyScalar(-1);
  scratchRight.copy(scratchForward).cross(new THREE.Vector3(0, 1, 0)).normalize();
  scratchUp.copy(scratchRight).cross(scratchForward).normalize();
  const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
  const tanHorizontal = tanVertical * camera.aspect;
  const padding = 1.08;
  let distance = camera.near * 2;
  for (let mask = 0; mask < 8; mask += 1) {
    scratchRelative.set(mask & 1 ? bounds.max.x : bounds.min.x, mask & 2 ? bounds.max.y : bounds.min.y, mask & 4 ? bounds.max.z : bounds.min.z).sub(scratchCenter);
    const forwardOffset = scratchRelative.dot(scratchForward);
    distance = Math.max(distance,
      Math.abs(scratchRelative.dot(scratchRight)) * padding / tanHorizontal - forwardOffset,
      Math.abs(scratchRelative.dot(scratchUp)) * padding / tanVertical - forwardOffset,
      camera.near * 2 - forwardOffset);
  }
  let maximumDepth = 0;
  for (let mask = 0; mask < 8; mask += 1) {
    scratchRelative.set(mask & 1 ? bounds.max.x : bounds.min.x, mask & 2 ? bounds.max.y : bounds.min.y, mask & 4 ? bounds.max.z : bounds.min.z).sub(scratchCenter);
    maximumDepth = Math.max(maximumDepth, distance + scratchRelative.dot(scratchForward));
  }
  return Object.freeze({
    position: scratchCenter.clone().addScaledVector(scratchDirection, distance),
    lookAt: scratchCenter.clone(),
    bounds: bounds.clone(),
    far: Math.max(camera.far, maximumDepth * 1.05),
  });
}
