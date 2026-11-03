import type { CampaignMaterial, MaterialType } from './objects/MaterialWorld';
import type { Player } from './objects/Player';
import { CAMPAIGN_PREPARED_HELD_LATERAL_WIDTH_METERS, CAMPAIGN_PREPARED_MATERIAL_HEIGHT_METERS } from './CampaignAssets';

interface HeldOffset { readonly x: number; readonly y: number; readonly yaw: number; }
const radians = Math.PI / 180;
const tiers = (lowerStep: number, upperY: number): Readonly<Record<number, readonly HeldOffset[]>> => Object.freeze({
  1: [{ x: 0, y: 0, yaw: 0 }],
  2: [{ x: -lowerStep / 2, y: 0, yaw: 0 }, { x: lowerStep / 2, y: 0, yaw: 0 }],
  3: [{ x: -lowerStep / 2, y: 0, yaw: 0 }, { x: lowerStep / 2, y: 0, yaw: 0 }, { x: 0, y: upperY, yaw: 0 }],
  4: [{ x: -lowerStep / 2, y: 0, yaw: 0 }, { x: lowerStep / 2, y: 0, yaw: 0 }, { x: -lowerStep / 2, y: upperY, yaw: 0 }, { x: lowerStep / 2, y: upperY, yaw: 0 }],
  5: [{ x: -lowerStep, y: 0, yaw: 0 }, { x: 0, y: 0, yaw: 0 }, { x: lowerStep, y: 0, yaw: 0 }, { x: -lowerStep / 2, y: upperY, yaw: 0 }, { x: lowerStep / 2, y: upperY, yaw: 0 }],
});
const wheat: Readonly<Record<number, readonly HeldOffset[]>> = Object.freeze({
  1: [{ x: 0, y: 0, yaw: 0 }], 2: [{ x: -0.068, y: 0, yaw: -2 * radians }, { x: 0.068, y: 0, yaw: 2 * radians }],
  3: [{ x: -0.068, y: 0, yaw: -2 * radians }, { x: 0.068, y: 0, yaw: 2 * radians }, { x: 0, y: 0.089, yaw: 0 }],
  4: [{ x: -0.068, y: 0, yaw: -2 * radians }, { x: 0.068, y: 0, yaw: 2 * radians }, { x: -0.068, y: 0.089, yaw: radians }, { x: 0.068, y: 0.089, yaw: -radians }],
  5: [{ x: -0.136, y: 0, yaw: -2 * radians }, { x: 0, y: 0, yaw: 0 }, { x: 0.136, y: 0, yaw: 2 * radians }, { x: -0.068, y: 0.089, yaw: radians }, { x: 0.068, y: 0.089, yaw: -radians }],
});
export const HELD_STACK_CONTACT_OVERLAP_METERS = 0.01;
export const HELD_STACK_LATERAL_OVERLAP_METERS = 0.01;
const heldLateralStep = (type: 'flour' | 'bread'): number => CAMPAIGN_PREPARED_HELD_LATERAL_WIDTH_METERS[type] - HELD_STACK_LATERAL_OVERLAP_METERS;
const supportedRise = (type: 'flour' | 'bread'): number => CAMPAIGN_PREPARED_MATERIAL_HEIGHT_METERS[type] - HELD_STACK_CONTACT_OVERLAP_METERS;
const flour = tiers(heldLateralStep('flour'), supportedRise('flour'));
const bread = tiers(heldLateralStep('bread'), supportedRise('bread'));
const anchor: Readonly<Record<MaterialType, Readonly<{ lateral: number; forward: number; height: number }>>> = Object.freeze({
  wheat: { lateral: 0.005, forward: 0.270, height: 0.844 }, flour: { lateral: 0.005, forward: 0.451, height: 0.843 }, bread: { lateral: 0.005, forward: 0.548, height: 0.844 },
});

export function layoutHeldMaterials(player: Player, materials: readonly CampaignMaterial[]): void {
  if (materials.length === 0) return; const type = materials[0]!.type; const offsets = (type === 'wheat' ? wheat : type === 'flour' ? flour : bread)[materials.length] ?? [];
  materials.forEach((material, index) => { const offset = offsets[index]!; player.root.attach(material.root); material.root.position.set(anchor[type].lateral + offset.x, anchor[type].height + offset.y, -anchor[type].forward); material.root.rotation.set(type === 'wheat' ? -Math.PI / 2 : 0, (type === 'wheat' || type === 'bread' ? Math.PI / 2 : 0) + offset.yaw, 0); material.root.scale.setScalar(1); });
}
