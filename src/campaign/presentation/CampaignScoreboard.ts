import * as THREE from 'three';
import type { CampaignStage } from '../CampaignConfig';
import type { ScoreBreakdownEntry } from '../CampaignState';
import type { PresentationStep } from './PresentationPlayer';
import { CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE, createCampaignPhysicalScoreboardContract } from './PhysicalScoreboardTemplate';
import { createCampaignThreePhysicalScoreboard, type CampaignThreePhysicalScoreboard } from './PhysicalScoreboardThreeAdapter';
import { campaignScoreboardFont } from './CampaignScoreboardTypography';

const HIDDEN_Y = 1.385;
const RAISED_Y = 2.975;
const WORLD_Z = -3.84;
const AUX_X = 3.83125;
const AUX_SCALE = 0.75;
const AUX_RAISED_Y = RAISED_Y - CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.frame.height * (1 - AUX_SCALE) * 0.5;
const AUX_HIDDEN_Y = HIDDEN_Y - CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.frame.height * (1 - AUX_SCALE) * 0.5;
const activeProjectionReceiptBrand: unique symbol = Symbol('campaign-scoreboard-active-receipt');
export type CampaignScoreboardActiveReceipt = Readonly<{
  [activeProjectionReceiptBrand]: true;
  owner: CampaignScoreboard;
  generation: number;
}>;
export class CampaignScoreboard {
  readonly root = new THREE.Group();
  readonly central: CampaignThreePhysicalScoreboard; readonly auxiliary: CampaignThreePhysicalScoreboard;
  private readonly centralCanvas: HTMLCanvasElement; private readonly auxiliaryCanvas: HTMLCanvasElement;
  private readonly centralTexture: THREE.CanvasTexture; private readonly auxiliaryTexture: THREE.CanvasTexture;
  private lastSignature = '';
  private activeStage: CampaignStage | null = null;
  private activeWholeSeconds = -1;
  private centralDrawCount = 0;
  private preparedActive: Readonly<{ receipt: CampaignScoreboardActiveReceipt; signature: string; stage: CampaignStage | null; wholeSeconds: number; score: number }> | null = null;
  private activeProjectionGeneration = 0;
  private activeProjectionState: 'hidden' | 'entering' | 'active' = 'hidden';
  private centralText = '';
  constructor() {
    this.root.name = 'campaign-scoreboard';
    this.centralCanvas = this.canvas(); this.auxiliaryCanvas = this.canvas();
    this.centralTexture = this.texture(this.centralCanvas); this.auxiliaryTexture = this.texture(this.auxiliaryCanvas);
    this.central = createCampaignThreePhysicalScoreboard(createCampaignPhysicalScoreboardContract('i9-central-lifecycle-scoreboard', 'central-lifecycle', { x: 0, y: HIDDEN_Y, z: WORLD_Z }), this.centralTexture);
    this.auxiliary = createCampaignThreePhysicalScoreboard(createCampaignPhysicalScoreboardContract('i9-result-auxiliary-scoreboard', 'result-auxiliary', { x: AUX_X, y: AUX_RAISED_Y, z: WORLD_Z }, AUX_SCALE), this.auxiliaryTexture);
    this.root.add(this.central.root, this.auxiliary.root); this.hide();
  }
  createClearStep(stage: CampaignStage, stageScore: number, _totalScore: number, breakdown: readonly ScoreBreakdownEntry[], scoreCountSeconds: number, scoreHoldSeconds: number): PresentationStep {
    const riseSeconds = 0.28; const clearHoldSeconds = 0.36; const lowerSeconds = 0.28;
    const durationSeconds = riseSeconds + scoreCountSeconds + scoreHoldSeconds + clearHoldSeconds + lowerSeconds;
    let phase = -1; let componentIndex = -1;
    const showComponent = (index: number): void => {
      const entry = breakdown[Math.min(Math.max(index, 0), Math.max(0, breakdown.length - 1))];
      if (entry === undefined || index === componentIndex) return;
      componentIndex = index; this.drawAuxiliaryComponent(entry);
      this.auxiliary.root.userData.earnedComponentIndex = index;
      this.auxiliary.root.userData.earnedComponent = Object.freeze({ label: entry.label, score: entry.score });
    };
    const setPhase = (next: number): void => {
      if (next === phase) return; phase = next;
      if (next === 0) { this.drawCentral('0'); showComponent(0); }
      else if (next === 1) { showComponent(0); }
      else if (next === 2) { this.drawCentral('CLEAR'); }
    };
    return Object.freeze({ id: `${stage}-physical-scoreboard-lifecycle`, durationSeconds,
      start: () => { phase = -1; this.central.root.visible = true; this.auxiliary.root.visible = true; this.central.root.position.y = HIDDEN_Y; this.auxiliary.root.position.y = AUX_HIDDEN_Y; setPhase(0); },
      update: (progress) => {
        const elapsed = progress * durationSeconds;
        const rise = Math.min(1, elapsed / riseSeconds);
        const lowerStart = riseSeconds + scoreCountSeconds + scoreHoldSeconds + clearHoldSeconds;
        const lower = elapsed < lowerStart ? 0 : (elapsed - lowerStart) / lowerSeconds;
        this.central.root.position.y = THREE.MathUtils.lerp(HIDDEN_Y, RAISED_Y, rise) - (RAISED_Y - HIDDEN_Y) * lower;
        this.auxiliary.root.position.y = THREE.MathUtils.lerp(AUX_HIDDEN_Y, AUX_RAISED_Y, rise) - (AUX_RAISED_Y - AUX_HIDDEN_Y) * lower;
        if (elapsed < riseSeconds + scoreCountSeconds + scoreHoldSeconds) {
          setPhase(elapsed < riseSeconds ? 0 : 1);
          const countProgress = THREE.MathUtils.clamp((elapsed - riseSeconds) / scoreCountSeconds, 0, 1);
          if (elapsed >= riseSeconds && breakdown.length > 0) showComponent(Math.min(breakdown.length - 1, Math.floor(countProgress * breakdown.length)));
          this.drawCentral(`${Math.round(stageScore * countProgress)}`);
        } else setPhase(2);
      },
      finish: () => { setPhase(2); this.central.root.position.y = HIDDEN_Y; this.auxiliary.root.position.y = AUX_HIDDEN_Y; this.hide(); },
      cancel: () => this.hide(),
    });
  }
  showActive(stage: CampaignStage, remainingSeconds: number | null, _currentScore: number): void {
    if (stage === 'stage0') { this.hide(); return; }
    const whole = Math.max(0, Math.ceil(remainingSeconds ?? 0));
    if (this.activeStage === stage && this.activeWholeSeconds === whole &&
      this.central.root.visible && !this.auxiliary.root.visible && this.central.root.position.y === RAISED_Y) return;
    this.drawCentral(`${Math.floor(whole / 60).toString().padStart(2, '0')}:${(whole % 60).toString().padStart(2, '0')}`);
    this.activeStage = stage; this.activeWholeSeconds = whole;
    this.lastSignature = `active:${stage}:${whole}`;
    this.central.root.position.y = RAISED_Y; this.central.root.visible = true; this.auxiliary.root.visible = false;
    this.activeProjectionState = 'active';
  }
  prepareActiveProjection(stage: CampaignStage, remainingSeconds: number | null, currentScore: number): CampaignScoreboardActiveReceipt {
    const receipt: CampaignScoreboardActiveReceipt = Object.freeze({ [activeProjectionReceiptBrand]: true as const, owner: this, generation: ++this.activeProjectionGeneration });
    if (stage === 'stage0') { this.preparedActive = Object.freeze({ receipt, signature: 'hidden', stage: null, wholeSeconds: -1, score: 0 }); return receipt; }
    const whole = Math.max(0, Math.ceil(remainingSeconds ?? 0)); const signature = `active:${stage}:${whole}`;
    if (signature === this.lastSignature) { this.preparedActive = Object.freeze({ receipt, signature, stage, wholeSeconds: whole, score: currentScore }); return receipt; }
    this.drawCentral(`${Math.floor(whole / 60).toString().padStart(2, '0')}:${(whole % 60).toString().padStart(2, '0')}`);
    this.preparedActive = Object.freeze({ receipt, signature, stage, wholeSeconds: whole, score: currentScore }); return receipt;
  }
  isCurrentActiveProjectionReceipt(receipt: CampaignScoreboardActiveReceipt | null): receipt is CampaignScoreboardActiveReceipt {
    return receipt !== null && this.preparedActive?.receipt === receipt && receipt.owner === this;
  }
  commitPreparedActiveProjection(receipt: CampaignScoreboardActiveReceipt): void {
    if (!this.isCurrentActiveProjectionReceipt(receipt)) throw new Error('CampaignScoreboard active projection receipt is missing or stale.');
    const prepared = this.preparedActive; this.preparedActive = null;
    if (prepared?.signature === 'hidden') { this.hide(); return; }
    if (prepared === null) return;
    this.lastSignature = prepared.signature; this.activeStage = prepared.stage; this.activeWholeSeconds = prepared.wholeSeconds;
    this.central.root.position.y = HIDDEN_Y;
    this.central.root.visible = true; this.auxiliary.root.visible = false;
    this.activeProjectionState = 'entering';
  }
  createActiveEntranceStep(stage: CampaignStage, remainingSeconds: number | null, currentScore: number,
    durationSeconds: number, preparedReceipt?: () => CampaignScoreboardActiveReceipt | null): PresentationStep {
    if (stage === 'stage0' || remainingSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new Error('Invalid timed-stage scoreboard entrance.');
    }
    let receipt: CampaignScoreboardActiveReceipt | null = null;
    return Object.freeze({
      id: `${stage}-physical-scoreboard-entrance`, durationSeconds,
      start: () => {
        receipt = preparedReceipt?.() ?? this.prepareActiveProjection(stage, remainingSeconds, currentScore);
        if (receipt === null || !this.isCurrentActiveProjectionReceipt(receipt)) {
          throw new Error('CampaignScoreboard entrance projection receipt is missing or stale.');
        }
        this.commitPreparedActiveProjection(receipt);
      },
      update: (progress) => {
        const clamped = THREE.MathUtils.clamp(progress, 0, 1);
        const eased = clamped * clamped * (3 - 2 * clamped);
        this.central.root.position.y = THREE.MathUtils.lerp(HIDDEN_Y, RAISED_Y, eased);
      },
      finish: () => {
        this.central.root.position.y = RAISED_Y; this.central.root.visible = true; this.auxiliary.root.visible = false;
        this.activeProjectionState = 'active';
      },
      cancel: () => { this.cancelPreparedActiveProjection(receipt); receipt = null; },
    });
  }
  cancelPreparedActiveProjection(receipt?: CampaignScoreboardActiveReceipt | null): void {
    if (receipt === undefined || receipt === null || this.preparedActive?.receipt === receipt) this.preparedActive = null;
    this.hide();
  }
  readActiveProjectionDiagnostics(): Readonly<{ receiptGeneration: number; centralDrawCount: number; state: string;
    centralY: number; hiddenY: number; raisedY: number; centralVisible: boolean; auxiliaryVisible: boolean;
    signature: string; text: string }> {
    return Object.freeze({ receiptGeneration: this.activeProjectionGeneration, centralDrawCount: this.centralDrawCount,
      state: this.activeProjectionState, centralY: this.central.root.position.y, hiddenY: HIDDEN_Y, raisedY: RAISED_Y,
      centralVisible: this.central.root.visible, auxiliaryVisible: this.auxiliary.root.visible,
      signature: this.lastSignature, text: this.centralText });
  }
  readOverviewBounds(target: THREE.Box3, includeAuxiliary: boolean): THREE.Box3 {
    const frame = CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.frame;
    target.set(
      new THREE.Vector3(-frame.width * 0.5, RAISED_Y - frame.height * 0.5, WORLD_Z - frame.depth * 0.5),
      new THREE.Vector3(frame.width * 0.5, RAISED_Y + frame.height * 0.5, WORLD_Z + frame.depth * 0.5),
    );
    if (includeAuxiliary) target.union(new THREE.Box3(
      new THREE.Vector3(AUX_X - frame.width * AUX_SCALE * 0.5, AUX_RAISED_Y - frame.height * AUX_SCALE * 0.5, WORLD_Z - frame.depth * AUX_SCALE * 0.5),
      new THREE.Vector3(AUX_X + frame.width * AUX_SCALE * 0.5, AUX_RAISED_Y + frame.height * AUX_SCALE * 0.5, WORLD_Z + frame.depth * AUX_SCALE * 0.5),
    ));
    return target;
  }
  createGameOverStep(durationSeconds: number): PresentationStep {
    return Object.freeze({
      id: 'physical-scoreboard-game-over', durationSeconds,
      start: () => { this.lastSignature = 'failure'; this.central.root.visible = true; this.auxiliary.root.visible = false; this.central.root.position.y = HIDDEN_Y; this.drawCentral('GAME OVER'); },
      update: (progress) => {
        const rise = Math.min(1, progress / 0.24);
        const lower = progress < 0.7 ? 0 : (progress - 0.7) / 0.3;
        this.central.root.position.y = THREE.MathUtils.lerp(HIDDEN_Y, RAISED_Y, rise) - (RAISED_Y - HIDDEN_Y) * lower;
      },
      finish: () => { this.central.root.position.y = HIDDEN_Y; this.hide(); },
      cancel: () => this.hide(),
    });
  }
  createFinalScoreStep(totalScore: number, durationSeconds: number): PresentationStep {
    return Object.freeze({
      id: 'physical-scoreboard-final-score', durationSeconds,
      start: () => { this.lastSignature = `final:${totalScore}`; this.central.root.visible = true; this.auxiliary.root.visible = false; this.central.root.position.y = HIDDEN_Y; this.drawCentral(`${totalScore}`); },
      update: (progress) => { this.central.root.position.y = THREE.MathUtils.lerp(HIDDEN_Y, RAISED_Y, progress * progress * (3 - 2 * progress)); },
      finish: () => { this.central.root.position.y = RAISED_Y; this.central.root.visible = true; },
      cancel: () => this.hide(),
    });
  }
  hide(): void { this.central.root.visible = false; this.auxiliary.root.visible = false; this.lastSignature = 'hidden';
    this.activeStage = null; this.activeWholeSeconds = -1; this.activeProjectionState = 'hidden'; }
  dispose(): void { this.centralTexture.dispose(); this.auxiliaryTexture.dispose(); this.central.panelMaterial.dispose(); this.auxiliary.panelMaterial.dispose(); this.root.removeFromParent(); }
  private canvas(): HTMLCanvasElement { const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 256; return canvas; }
  private texture(canvas: HTMLCanvasElement): THREE.CanvasTexture { const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture; }
  private drawCentral(text: string): void { const context = this.centralCanvas.getContext('2d'); if (context === null) throw new Error('Central physical scoreboard canvas unavailable.'); this.background(context); context.font = campaignScoreboardFont(text.length > 10 ? 72 : 112); context.fillText(text, 384, 132); this.centralText = text; this.central.root.userData.typography = CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.font; this.centralTexture.needsUpdate = true; this.centralDrawCount += 1; }
  private drawAuxiliaryComponent(entry: ScoreBreakdownEntry): void { const context = this.auxiliaryCanvas.getContext('2d'); if (context === null) throw new Error('Auxiliary physical scoreboard canvas unavailable.'); this.background(context); context.font = campaignScoreboardFont(54); context.fillText(entry.label, 384, 72); context.font = campaignScoreboardFont(76); context.fillText(`+ ${entry.score}`, 384, 166); this.auxiliary.root.userData.typography = CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.font; this.auxiliaryTexture.needsUpdate = true; }
  private background(context: CanvasRenderingContext2D): void { context.fillStyle = CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.panel.backgroundColor; context.fillRect(0, 0, 768, 256); context.fillStyle = CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.panel.glyphColor; context.textAlign = 'center'; context.textBaseline = 'middle'; }
}
