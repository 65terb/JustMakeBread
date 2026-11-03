import * as THREE from 'three';
import { CAMPAIGN_CONFIG } from '../CampaignConfig';
import {
  sampleMaterialTransferInto,
  type MaterialTransferProfile,
  type MaterialTransferSampleTarget,
} from '../presentation/MaterialTransferMotion';

export type MaterialType = 'wheat' | 'flour' | 'bread';
export type MaterialLocation = 'world' | 'held' | 'stored' | 'reserved' | 'processing' | 'output' | 'submitted';

export interface CampaignMaterial {
  readonly id: string;
  readonly type: MaterialType;
  readonly root: THREE.Object3D;
  readonly presentationRoot: THREE.Object3D;
  location: MaterialLocation;
}

interface MaterialMotion {
  readonly material: CampaignMaterial;
  readonly start: THREE.Vector3;
  readonly end: THREE.Vector3;
  readonly durationSeconds: number;
  readonly finalLocation: 'world' | 'output';
  readonly onComplete?: () => void;
  readonly profile: 'wheat' | 'output';
  readonly burstEnd: THREE.Vector3 | null;
  elapsedSeconds: number;
}

interface MaterialTransferMotion {
  readonly material: CampaignMaterial;
  readonly startOffset: THREE.Vector3;
  readonly profile: MaterialTransferProfile;
  elapsedSeconds: number;
}

const transferSample: MaterialTransferSampleTarget = { x: 0, y: 0, z: 0, complete: false };

export class MaterialWorld implements Iterable<CampaignMaterial> {
  private sequence = 1;
  private readonly materials = new Map<string, CampaignMaterial>();
  private readonly motions = new Map<string, MaterialMotion>();
  private readonly transfers = new Map<string, MaterialTransferMotion>();
  constructor(
    private readonly scene: THREE.Scene,
    private readonly visualFactory: (type: MaterialType) => THREE.Object3D,
    private readonly pickupDurationSeconds: number,
  ) {
    if (!Number.isFinite(pickupDurationSeconds) || pickupDurationSeconds <= 0) {
      throw new Error('Material pickup duration must be positive.');
    }
  }

  create(type: MaterialType, position: THREE.Vector3): CampaignMaterial {
    const visual = this.visualFactory(type);
    const root = new THREE.Group(); const presentationRoot = new THREE.Group();
    presentationRoot.name = `campaign-material-${type}-presentation`; presentationRoot.add(visual); root.add(presentationRoot);
    root.name = `campaign-material-${type}-${this.sequence}`;
    root.position.copy(position);
    root.traverse((node) => { node.castShadow = true; });
    this.scene.add(root);
    const material: CampaignMaterial = { id: `${type}-${this.sequence++}`, type, root, presentationRoot, location: 'world' };
    this.materials.set(material.id, material);
    return material;
  }
  beginTransfer(material: CampaignMaterial, startWorldPosition: THREE.Vector3, profile: MaterialTransferProfile): void {
    this.terminalizeTransfer(material.id);
    const parent = material.root.parent; if (parent === null) throw new Error(`${material.id}: transfer parent required.`);
    const startLocal = parent.worldToLocal(startWorldPosition.clone());
    const offset = startLocal.sub(material.root.position);
    material.presentationRoot.position.copy(offset);
    material.presentationRoot.quaternion.identity(); material.presentationRoot.scale.setScalar(1);
    this.transfers.set(material.id, { material, startOffset: offset.clone(), profile, elapsedSeconds: 0 });
  }
  terminalizeTransfer(id: string): void {
    const material = this.materials.get(id); if (material === undefined) return;
    material.presentationRoot.position.set(0, 0, 0);
    material.presentationRoot.quaternion.identity(); material.presentationRoot.scale.setScalar(1);
    this.transfers.delete(id);
  }
  terminalizeTransfers(ids: readonly string[]): void { for (const id of ids) this.terminalizeTransfer(id); }
  terminalizeAllTransfers(): void {
    for (const material of this.materials.values()) {
      material.presentationRoot.position.set(0, 0, 0);
      material.presentationRoot.quaternion.identity(); material.presentationRoot.scale.setScalar(1);
    }
    this.transfers.clear();
  }

  beginMotion(material: CampaignMaterial, start: THREE.Vector3, end: THREE.Vector3, durationSeconds: number,
    finalLocation: 'world' | 'output', profile: 'wheat' | 'output', burstEnd: THREE.Vector3 | null = null, onComplete?: () => void): void {
    this.terminalizeTransfer(material.id);
    this.scene.attach(material.root); material.root.position.copy(start); material.root.scale.setScalar(profile === 'wheat' ? 0.84 : 1); material.location = 'reserved';
    material.root.userData.campaignReservedLanding = end.clone();
    this.motions.set(material.id, { material, start: start.clone(), end: end.clone(), durationSeconds, finalLocation, profile, burstEnd: burstEnd?.clone() ?? null, onComplete, elapsedSeconds: 0 });
  }
  update(deltaSeconds: number): void {
    for (const [id, transfer] of this.transfers) {
      transfer.elapsedSeconds += Math.max(0, deltaSeconds);
      sampleMaterialTransferInto(transferSample, transfer.profile, transfer.elapsedSeconds, this.pickupDurationSeconds,
        transfer.startOffset.x, transfer.startOffset.y, transfer.startOffset.z);
      transfer.material.presentationRoot.position.set(transferSample.x, transferSample.y, transferSample.z);
      if (transferSample.complete) this.terminalizeTransfer(id);
    }
    for (const [id, motion] of this.motions) {
      motion.elapsedSeconds += Math.max(0, deltaSeconds);
      const progress = THREE.MathUtils.clamp(motion.elapsedSeconds / motion.durationSeconds, 0, 1);
      if (motion.profile === 'wheat' && motion.burstEnd !== null) {
        const burstPhase = 0.22;
        if (progress <= burstPhase) {
          const burst = progress / burstPhase; motion.material.root.position.lerpVectors(motion.start, motion.burstEnd, 1 - Math.pow(1 - burst, 3));
        } else {
          const flight = (progress - burstPhase) / (1 - burstPhase); const eased = flight * flight * (3 - 2 * flight);
          motion.material.root.position.lerpVectors(motion.burstEnd, motion.end, eased); motion.material.root.position.y += Math.sin(flight * Math.PI) * 0.12;
        }
        motion.material.root.scale.setScalar(0.84 + progress * 0.16 + Math.sin(progress * Math.PI) * 0.04);
      } else {
        const timing = CAMPAIGN_CONFIG.materialPresentation;
        const holdEnd = timing.outputSourceHoldSeconds / timing.outputSeconds;
        const departureEnd = (timing.outputSourceHoldSeconds + timing.outputDepartureSeconds) / timing.outputSeconds;
        const flightEnd = (timing.outputSourceHoldSeconds + timing.outputDepartureSeconds + timing.outputFlightSeconds) / timing.outputSeconds;
        const contactEnd = (timing.outputSourceHoldSeconds + timing.outputDepartureSeconds + timing.outputFlightSeconds + timing.outputContactSeconds) / timing.outputSeconds;
        let amount = 0;
        if (progress > holdEnd && progress <= departureEnd) amount = ((progress - holdEnd) / (departureEnd - holdEnd)) * 0.18;
        else if (progress > departureEnd && progress <= flightEnd) { const phase = (progress - departureEnd) / (flightEnd - departureEnd); amount = 0.18 + (1 - Math.pow(1 - phase, 3)) * 0.67; }
        else if (progress > flightEnd && progress <= contactEnd) amount = 0.85 + ((progress - flightEnd) / (contactEnd - flightEnd)) * 0.18;
        else if (progress > contactEnd) amount = 1.03 - ((progress - contactEnd) / (1 - contactEnd)) * 0.03;
        motion.material.root.position.lerpVectors(motion.start, motion.end, amount); motion.material.root.position.y += Math.sin(Math.min(1, amount) * Math.PI) * 0.14;
      }
      if (progress < 1) continue;
      motion.material.root.position.copy(motion.end); motion.material.root.scale.setScalar(1); motion.material.location = motion.finalLocation; delete motion.material.root.userData.campaignReservedLanding;
      this.motions.delete(id); motion.onComplete?.();
    }
  }

  get(id: string): CampaignMaterial | null { return this.materials.get(id) ?? null; }
  retire(id: string, location: MaterialLocation): void {
    const material = this.materials.get(id);
    if (material === undefined) return;
    material.location = location;
    this.motions.delete(id);
    this.terminalizeTransfer(id);
    delete material.root.userData.campaignReservedLanding;
    material.root.removeFromParent();
    if (location === 'processing' || location === 'submitted') this.materials.delete(id);
  }
  all(): readonly CampaignMaterial[] { return [...this.materials.values()]; }
  values(): IterableIterator<CampaignMaterial> { return this.materials.values(); }
  [Symbol.iterator](): IterableIterator<CampaignMaterial> { return this.materials.values(); }
  get size(): number { return this.materials.size; }
  activeWheatCount(): number {
    let count = 0;
    for (const material of this.materials.values()) {
      if (material.type === 'wheat' && (material.location === 'world' || material.location === 'reserved')) count += 1;
    }
    return count;
  }
  removeAttemptMaterials(): readonly THREE.Object3D[] {
    const roots: THREE.Object3D[] = [];
    this.terminalizeAllTransfers();
    for (const material of this.materials.values()) {
      roots.push(material.root);
      material.root.removeFromParent();
      this.materials.delete(material.id);
    }
    this.motions.clear();
    this.transfers.clear();
    return roots;
  }
  takeAttemptMaterialRoots(): readonly THREE.Object3D[] {
    this.terminalizeAllTransfers();
    const roots = [...this.materials.values()].map((material) => material.root);
    this.materials.clear();
    this.motions.clear();
    this.transfers.clear();
    return Object.freeze(roots);
  }
  dispose(): void { this.terminalizeAllTransfers(); for (const material of this.materials.values()) material.root.removeFromParent(); this.materials.clear(); this.motions.clear(); }
}
