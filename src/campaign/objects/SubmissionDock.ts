import * as THREE from 'three';
import { CAMPAIGN_MAP_ANCHORS, type CampaignCollisionBounds } from './CampaignMap';
import { CAMPAIGN_APPROVED_BREAD_PICTOGRAM_ID, drawCampaignApprovedBreadPictogram } from '../presentation/ApprovedBreadPictogram';
import { CAMPAIGN_SCOREBOARD_TYPOGRAPHY, campaignScoreboardFont } from '../presentation/CampaignScoreboardTypography';
import { createCampaignPhysicalScoreboardContract } from '../presentation/PhysicalScoreboardTemplate';
import { createCampaignThreePhysicalScoreboard, type CampaignThreePhysicalScoreboard } from '../presentation/PhysicalScoreboardThreeAdapter';
import type { PresentationStep } from '../presentation/PresentationPlayer';

export const CAMPAIGN_DOCK_GOAL_BOARD_PRESENTATION = Object.freeze({
  instanceId: 'i9-dock-goal-scoreboard', uniformScale: 0.75,
  localPosition: Object.freeze({ x: 0, y: 2.2, z: -0.04 }), localRotationY: Math.PI,
});

const submissionDockResetReceiptBrand: unique symbol = Symbol('submission-dock-reset-receipt');
export type SubmissionDockResetReceipt = Readonly<{
  [submissionDockResetReceiptBrand]: true;
  owner: SubmissionDock;
  generation: number;
}>;

export class SubmissionDock {
  readonly root = new THREE.Group();
  submittedBreadCount = 0;
  targetBreadCount = 1;
  readonly submitRadiusMeters = 1.55;
  private readonly gameplayAnchor: THREE.Object3D;
  private readonly breadContactAnchor: THREE.Object3D;
  private readonly suctionAnchor: THREE.Object3D;
  private readonly visualPresentationRoot = new THREE.Group();
  private readonly goalBoard: THREE.Group;
  readonly goalScoreboard: CampaignThreePhysicalScoreboard;
  private readonly boardCanvas: HTMLCanvasElement;
  private readonly boardTexture: THREE.CanvasTexture;
  private readonly worldScratch = new THREE.Vector3();
  private readonly directionScratch = new THREE.Vector3(); private readonly quaternionScratch = new THREE.Quaternion();
  private readonly goalBoardAuthoredPosition = new THREE.Vector3();
  private readonly goalBoardAuthoredQuaternion = new THREE.Quaternion();
  private readonly goalBoardAuthoredScale = new THREE.Vector3();
  private stage0RevealState: 'hidden' | 'scheduled' | 'revealing' | 'revealed' = 'revealed';
  private preparedReset: Readonly<{ receipt: SubmissionDockResetReceipt; submittedBreadCount: number }> | null = null;
  private resetGeneration = 0;
  private resultCountBlank = false;
  private boardDrawCount = 0;

  constructor(visual: THREE.Object3D) {
    this.root.name = 'campaign-submission-dock';
    this.root.position.set(CAMPAIGN_MAP_ANCHORS.submissionDockWallMount.x, 0.9, CAMPAIGN_MAP_ANCHORS.submissionDockWallMount.z);
    this.root.rotation.y = Math.PI;
    this.root.add(visual);
    const gameplayAnchor = visual.getObjectByName('interactionProxyReference');
    const breadContactAnchor = visual.getObjectByName('breadContact');
    const suctionAnchor = visual.getObjectByName('suctionTarget');
    const boardMount = visual.getObjectByName('goalBoardMount');
    const outwardNormal = visual.getObjectByName('outwardNormal');
    if (gameplayAnchor === undefined || breadContactAnchor === undefined || suctionAnchor === undefined || boardMount === undefined || outwardNormal === undefined) throw new Error('SubmissionDock named anchors are required.');
    this.gameplayAnchor = gameplayAnchor; this.breadContactAnchor = breadContactAnchor; this.suctionAnchor = suctionAnchor;
    this.root.updateWorldMatrix(true, true);
    this.root.attach(this.gameplayAnchor); this.root.attach(this.breadContactAnchor); this.root.attach(this.suctionAnchor);
    visual.removeFromParent();
    this.visualPresentationRoot.name = 'campaign-submission-dock-visual-presentation';
    this.root.add(this.visualPresentationRoot); this.visualPresentationRoot.add(visual);
    this.boardCanvas = document.createElement('canvas'); this.boardCanvas.width = 1200; this.boardCanvas.height = 400;
    this.boardTexture = new THREE.CanvasTexture(this.boardCanvas); this.boardTexture.colorSpace = THREE.SRGBColorSpace;
    const authored = CAMPAIGN_DOCK_GOAL_BOARD_PRESENTATION;
    this.goalScoreboard = createCampaignThreePhysicalScoreboard(createCampaignPhysicalScoreboardContract(
      authored.instanceId, 'dock-goal', authored.localPosition, authored.uniformScale), this.boardTexture);
    this.goalBoard = this.goalScoreboard.root;
    this.goalBoard.rotation.y = authored.localRotationY;
    this.goalBoard.userData.breadPictogramSource = CAMPAIGN_APPROVED_BREAD_PICTOGRAM_ID;
    this.goalBoard.userData.typography = CAMPAIGN_SCOREBOARD_TYPOGRAPHY;
    this.root.add(this.goalBoard);
    this.goalBoardAuthoredPosition.copy(this.goalBoard.position);
    this.goalBoardAuthoredQuaternion.copy(this.goalBoard.quaternion);
    this.goalBoardAuthoredScale.copy(this.goalBoard.scale);
    this.drawBoard();
  }
  configure(targetBreadCount: number): void { this.targetBreadCount = targetBreadCount; this.drawBoard(); }
  configureForStage(targetBreadCount: number): void {
    this.targetBreadCount = targetBreadCount; this.submittedBreadCount = 0; this.resultCountBlank = false; this.drawBoard();
  }
  submit(count = 1): number { const accepted = Math.min(count, Math.max(0, this.targetBreadCount - this.submittedBreadCount)); this.submittedBreadCount += accepted; this.drawBoard(); return accepted; }
  reset(): void { this.submittedBreadCount = 0; this.drawBoard(); }
  prepareResetProjection(): SubmissionDockResetReceipt {
    this.drawBoard(0);
    const receipt: SubmissionDockResetReceipt = Object.freeze({ [submissionDockResetReceiptBrand]: true as const, owner: this, generation: ++this.resetGeneration });
    this.preparedReset = Object.freeze({ receipt, submittedBreadCount: 0 }); return receipt;
  }
  isCurrentResetReceipt(receipt: SubmissionDockResetReceipt | null): receipt is SubmissionDockResetReceipt {
    return receipt !== null && this.preparedReset?.receipt === receipt && receipt.owner === this;
  }
  commitPreparedReset(receipt: SubmissionDockResetReceipt): void {
    if (!this.isCurrentResetReceipt(receipt)) throw new Error('SubmissionDock reset projection receipt is missing or stale.');
    const prepared = this.preparedReset!; this.submittedBreadCount = prepared.submittedBreadCount; this.preparedReset = null;
  }
  cancelPreparedReset(receipt?: SubmissionDockResetReceipt | null): void {
    if (receipt === undefined || receipt === null || this.preparedReset?.receipt === receipt) this.preparedReset = null;
    this.drawBoard(this.submittedBreadCount);
  }
  restoreSubmittedBreadCount(count: number): void { this.submittedBreadCount = count; this.preparedReset = null; this.drawBoard(); }
  createResultCountProjectionStep(id: string): PresentationStep {
    let admitted = false;
    return Object.freeze({
      id, durationSeconds: 0,
      start: () => { admitted = true; this.resultCountBlank = true; this.drawBoard(); },
      cancel: () => { if (!admitted) return; this.resultCountBlank = false; this.drawBoard(); },
    });
  }
  readGoalBoardProjectionDiagnostics(): Readonly<{ numbersVisible: boolean; numericText: string; drawCount: number }> {
    return Object.freeze({ numbersVisible: !this.resultCountBlank,
      numericText: this.resultCountBlank ? '' : `${this.submittedBreadCount} / ${this.targetBreadCount}`, drawCount: this.boardDrawCount });
  }
  get interactionAvailable(): boolean { return this.stage0RevealState === 'revealed'; }
  hideForStage0Reveal(): void {
    this.stage0RevealState = 'hidden'; this.root.visible = true;
    this.visualPresentationRoot.visible = false; this.goalBoard.visible = false;
    this.restoreStage0RevealTerminalTransforms();
  }
  showImmediately(): void {
    this.stage0RevealState = 'revealed'; this.root.visible = true;
    this.visualPresentationRoot.visible = true; this.goalBoard.visible = true;
    this.restoreStage0RevealTerminalTransforms();
  }
  createStage0RevealStep(durationSeconds: number, startScale: number, goalBoardRiseMeters: number): PresentationStep | null {
    if (this.stage0RevealState !== 'hidden') return null;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(startScale) || startScale <= 0 || startScale >= 1 ||
      !Number.isFinite(goalBoardRiseMeters) || goalBoardRiseMeters <= 0) throw new Error('Invalid Stage0 SubmissionDock reveal profile.');
    this.stage0RevealState = 'scheduled';
    const terminalize = (): void => this.showImmediately();
    return Object.freeze({
      id: 'stage0-submission-dock-reveal', durationSeconds,
      start: () => {
        if (this.stage0RevealState !== 'scheduled') return;
        this.stage0RevealState = 'revealing'; this.root.visible = true;
        this.visualPresentationRoot.visible = true; this.goalBoard.visible = true;
        this.visualPresentationRoot.position.set(0, 0, 0); this.visualPresentationRoot.quaternion.identity();
        this.visualPresentationRoot.scale.setScalar(startScale);
        this.goalBoard.position.copy(this.goalBoardAuthoredPosition); this.goalBoard.position.y -= goalBoardRiseMeters;
        this.goalBoard.quaternion.copy(this.goalBoardAuthoredQuaternion); this.goalBoard.scale.copy(this.goalBoardAuthoredScale);
      },
      update: (progress) => {
        if (this.stage0RevealState !== 'revealing') return;
        const clamped = THREE.MathUtils.clamp(progress, 0, 1);
        const eased = 1 - Math.pow(1 - clamped, 3);
        this.visualPresentationRoot.scale.setScalar(startScale + (1 - startScale) * eased);
        this.goalBoard.position.copy(this.goalBoardAuthoredPosition);
        this.goalBoard.position.y -= goalBoardRiseMeters * (1 - eased);
      },
      finish: terminalize,
      cancel: terminalize,
    });
  }
  readStage0RevealDiagnostics(): Readonly<{ state: string; interactionAvailable: boolean; visualVisible: boolean;
    visualScale: number; goalBoardVisible: boolean; goalBoardLocalY: number }> {
    return Object.freeze({ state: this.stage0RevealState, interactionAvailable: this.interactionAvailable,
      visualVisible: this.visualPresentationRoot.visible, visualScale: this.visualPresentationRoot.scale.x,
      goalBoardVisible: this.goalBoard.visible, goalBoardLocalY: this.goalBoard.position.y });
  }
  readVisualPresentationRoot(): THREE.Object3D { return this.visualPresentationRoot; }
  readGameplayPosition(target = this.worldScratch): THREE.Vector3 { return this.gameplayAnchor.getWorldPosition(target); }
  readSuctionPosition(target = this.worldScratch): THREE.Vector3 { return this.suctionAnchor.getWorldPosition(target); }
  readGoalBoardWorldPosition(target = this.worldScratch): THREE.Vector3 { return this.goalBoard.getWorldPosition(target); }
  readGoalBoardWorldDirection(target = this.directionScratch): THREE.Vector3 { return target.set(0, 0, 1).applyQuaternion(this.goalBoard.getWorldQuaternion(this.quaternionScratch)).normalize(); }
  commitBreadRoot(root: THREE.Object3D): void { root.getWorldPosition(this.worldScratch); root.parent?.attach(root); root.position.copy(this.breadContactAnchor.getWorldPosition(this.worldScratch)); }
  readCollisionBounds(target: CampaignCollisionBounds): CampaignCollisionBounds {
    const centerX = CAMPAIGN_MAP_ANCHORS.submissionDockGameplay.x; const centerZ = CAMPAIGN_MAP_ANCHORS.submissionDockGameplay.z;
    target.minX = centerX - 0.885; target.maxX = centerX + 0.885;
    target.minZ = centerZ - 0.315; target.maxZ = centerZ + 0.315; return target;
  }
  distanceToIntakeSurface(x: number, z: number): number {
    const centerX = CAMPAIGN_MAP_ANCHORS.submissionDockGameplay.x; const centerZ = CAMPAIGN_MAP_ANCHORS.submissionDockGameplay.z;
    return Math.hypot(Math.max(Math.abs(x - centerX) - 0.885, 0), Math.max(Math.abs(z - centerZ) - 0.315, 0));
  }
  dispose(): void { this.boardTexture.dispose(); this.goalScoreboard.panelMaterial.dispose(); this.root.removeFromParent(); }
  private restoreStage0RevealTerminalTransforms(): void {
    this.visualPresentationRoot.position.set(0, 0, 0); this.visualPresentationRoot.quaternion.identity(); this.visualPresentationRoot.scale.setScalar(1);
    this.goalBoard.position.copy(this.goalBoardAuthoredPosition);
    this.goalBoard.quaternion.copy(this.goalBoardAuthoredQuaternion); this.goalBoard.scale.copy(this.goalBoardAuthoredScale);
  }
  private drawBoard(displayCount = this.submittedBreadCount): void {
    const context = this.boardCanvas.getContext('2d'); if (context === null) throw new Error('Goal board canvas unavailable.');
    context.fillStyle = '#263746'; context.fillRect(0, 0, 1200, 400);
    drawCampaignApprovedBreadPictogram(context, 210, 200, 210);
    context.fillStyle = '#f2f1ea'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = campaignScoreboardFont(76);
    context.font = campaignScoreboardFont(176);
    const numericText = this.resultCountBlank ? '' : `${displayCount} / ${this.targetBreadCount}`;
    if (numericText.length > 0) context.fillText(numericText, 760, 206);
    this.goalBoard.userData.numericText = numericText; this.goalBoard.userData.numbersVisible = numericText.length > 0;
    this.boardDrawCount += 1; this.goalBoard.userData.drawCount = this.boardDrawCount; this.boardTexture.needsUpdate = true;
  }
}
