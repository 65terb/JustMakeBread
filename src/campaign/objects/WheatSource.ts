import * as THREE from 'three';
import type { CampaignStageConfig } from '../CampaignConfig';
import type { MaterialWorld } from './MaterialWorld';
import { CAMPAIGN_MAP_ANCHORS, CAMPAIGN_MAP_BOUNDS, type CampaignCollisionBounds } from './CampaignMap';
import { CAMPAIGN_CONFIG } from '../CampaignConfig';
import type { PresentationStep } from '../presentation/PresentationPlayer';

export class WheatSource {
  readonly root = new THREE.Group();
  revealed = false;
  private elapsedSeconds = 0;
  private successfulIssuanceCount = 0;
  private readonly spawnAnchor: THREE.Object3D;
  private readonly exitAnchor: THREE.Object3D;
  private readonly wallAttachmentAnchor: THREE.Object3D;
  private readonly visualPresentationRoot = new THREE.Group();
  private stage0RevealState: 'hidden' | 'scheduled' | 'revealing' | 'revealed' = 'revealed';
  private readonly spawnWorld = new THREE.Vector3();
  private readonly exitWorld = new THREE.Vector3();
  constructor(private readonly materials: MaterialWorld, visual: THREE.Object3D) {
    this.root.name = 'campaign-wheat-source';
    this.root.position.set(CAMPAIGN_MAP_ANCHORS.wheatSource.x, 0, CAMPAIGN_MAP_ANCHORS.wheatSource.z);
    this.root.add(visual);
    const wallAttachment = visual.getObjectByName('wallAttachment');
    const spawn = visual.getObjectByName('wheatSpawn');
    const exit = visual.getObjectByName('wheatExit');
    if (wallAttachment === undefined || spawn === undefined || exit === undefined) throw new Error('WheatSource requires wallAttachment, wheatSpawn and wheatExit.');
    this.wallAttachmentAnchor = wallAttachment;
    this.root.updateWorldMatrix(true, true); wallAttachment.getWorldPosition(this.spawnWorld);
    visual.position.x += CAMPAIGN_MAP_BOUNDS.minX - this.spawnWorld.x;
    this.spawnAnchor = spawn;
    this.exitAnchor = exit;
    this.root.position.y = CAMPAIGN_CONFIG.materialPresentation.wheatOutletHeight - spawn.position.y;
    this.root.updateWorldMatrix(true, true);
    this.root.attach(this.wallAttachmentAnchor); this.root.attach(this.spawnAnchor); this.root.attach(this.exitAnchor);
    visual.removeFromParent();
    this.visualPresentationRoot.name = 'campaign-wheat-source-visual-presentation';
    this.root.add(this.visualPresentationRoot); this.visualPresentationRoot.add(visual);
  }
  update(deltaSeconds: number, config: CampaignStageConfig, spawnWheat: (spawn: THREE.Vector3, exit: THREE.Vector3) => boolean): void {
    if (!this.revealed || this.materials.activeWheatCount() >= config.maxActiveWheatCount || this.budgetExhausted(config)) return;
    this.elapsedSeconds += deltaSeconds;
    while (this.elapsedSeconds >= config.wheatSpawnIntervalSeconds &&
      this.materials.activeWheatCount() < config.maxActiveWheatCount && !this.budgetExhausted(config)) {
      this.spawnAnchor.getWorldPosition(this.spawnWorld);
      this.exitAnchor.getWorldPosition(this.exitWorld);
      if (!spawnWheat(this.spawnWorld, this.exitWorld)) break;
      this.successfulIssuanceCount += 1;
      this.elapsedSeconds -= config.wheatSpawnIntervalSeconds;
    }
  }
  beginAttempt(): void { this.elapsedSeconds = 0; this.successfulIssuanceCount = 0; }
  resetTimer(): void { this.elapsedSeconds = 0; }
  readTimerSeconds(): number { return this.elapsedSeconds; }
  restoreTimerSeconds(value: number): void { this.elapsedSeconds = value; }
  readSuccessfulIssuanceCount(): number { return this.successfulIssuanceCount; }
  restoreSuccessfulIssuanceCount(value: number): void { this.successfulIssuanceCount = value; }
  hideForStage0Reveal(): void {
    this.revealed = false; this.stage0RevealState = 'hidden'; this.root.visible = true;
    this.visualPresentationRoot.visible = false; this.restoreStage0RevealTerminalTransform();
  }
  showImmediately(): void {
    this.revealed = true; this.stage0RevealState = 'revealed'; this.root.visible = true;
    this.visualPresentationRoot.visible = true; this.restoreStage0RevealTerminalTransform();
  }
  createStage0RevealStep(durationSeconds: number, startScale: number): PresentationStep | null {
    if (this.stage0RevealState !== 'hidden') return null;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(startScale) || startScale <= 0 || startScale >= 1) {
      throw new Error('Invalid Stage0 WheatSource reveal profile.');
    }
    this.stage0RevealState = 'scheduled';
    const terminalize = (): void => this.showImmediately();
    return Object.freeze({
      id: 'stage0-wheat-source-scale-reveal', durationSeconds,
      start: () => {
        if (this.stage0RevealState !== 'scheduled') return;
        this.stage0RevealState = 'revealing'; this.revealed = true; this.root.visible = true;
        this.visualPresentationRoot.visible = true; this.visualPresentationRoot.position.set(0, 0, 0);
        this.visualPresentationRoot.quaternion.identity(); this.visualPresentationRoot.scale.setScalar(startScale);
      },
      update: (progress) => {
        if (this.stage0RevealState !== 'revealing') return;
        const clamped = THREE.MathUtils.clamp(progress, 0, 1);
        const eased = 1 - Math.pow(1 - clamped, 3);
        this.visualPresentationRoot.scale.setScalar(startScale + (1 - startScale) * eased);
      },
      finish: terminalize,
      cancel: terminalize,
    });
  }
  readStage0RevealDiagnostics(): Readonly<{ state: string; revealed: boolean; visualVisible: boolean; visualScale: number }> {
    return Object.freeze({ state: this.stage0RevealState, revealed: this.revealed,
      visualVisible: this.visualPresentationRoot.visible, visualScale: this.visualPresentationRoot.scale.x });
  }
  readVisualPresentationRoot(): THREE.Object3D { return this.visualPresentationRoot; }
  readSpawnPosition(target = this.spawnWorld): THREE.Vector3 { return this.spawnAnchor.getWorldPosition(target); }
  readSuctionPosition(target = this.spawnWorld): THREE.Vector3 { return this.exitAnchor.getWorldPosition(target); }
  readWallAttachmentPosition(target = this.spawnWorld): THREE.Vector3 { return this.wallAttachmentAnchor.getWorldPosition(target); }
  readCollisionBounds(target: CampaignCollisionBounds): CampaignCollisionBounds {
    target.minX = CAMPAIGN_MAP_BOUNDS.minX; target.maxX = CAMPAIGN_MAP_BOUNDS.minX + 0.856868579055786;
    target.minZ = this.root.position.z - 0.430001; target.maxZ = this.root.position.z + 0.430001; return target;
  }
  private budgetExhausted(config: CampaignStageConfig): boolean {
    return config.wheatSpawnBudgetPerAttempt !== null && this.successfulIssuanceCount >= config.wheatSpawnBudgetPerAttempt;
  }
  private restoreStage0RevealTerminalTransform(): void {
    this.visualPresentationRoot.position.set(0, 0, 0); this.visualPresentationRoot.quaternion.identity();
    this.visualPresentationRoot.scale.setScalar(1);
  }
}
