import * as THREE from 'three';
import { CAMPAIGN_CONFIG, nextCampaignStage, type CampaignStage, type ModuleType } from './CampaignConfig';
import { CampaignState, type StageAttemptBaseline, type TimedCampaignStage } from './CampaignState';
import { CampaignScore } from './CampaignScore';
import { CampaignInput } from './CampaignInput';
import { CampaignInteraction, type CampaignInteractionTarget, type FloorDropCandidate } from './CampaignInteraction';
import { CampaignAudio } from './CampaignAudio';
import { createStage0TutorialSteps, Stage0TutorialController } from './Stage0TutorialController';
import { Player, WheatSource, SubmissionDock, MaterialWorld, ProductionBlock, Module, CampaignMap,
  type ModuleEffectResetTransition, type ModulePresentationSnapshot } from './objects';
import { PresentationPlayer, type PresentationStep } from './presentation/PresentationPlayer';
import { revealModule } from './presentation/PresentationLibrary';
import { callbackStep, moveCamera, suctionMaterialRoots, turnAndSwapBlocks } from './presentation/PresentationLibrary';
import { createFinalStagePlan, createRetryPlan, createStageClearPlan } from './presentation/StagePresentationPlans';
import { CampaignScoreboard } from './presentation/CampaignScoreboard';
import { WorldInteractionKeycap } from './presentation/WorldInteractionKeycap';
import { fitCampaignOverviewCamera, type CampaignOverviewCameraPose } from './presentation/CampaignOverviewCamera';
import { GameOverOverlay } from './ui/GameOverOverlay';
import { FinalScoreOverlay } from './ui/FinalScoreOverlay';
import { AudioSettingsPanel } from './ui/AudioSettingsPanel';
import { TipPanel, type CampaignTipId } from './ui/TipPanel';
import { TopRightControls } from './ui/TopRightControls';
import type { CampaignAssets } from './CampaignAssets';
import { advanceModuleEffects, readFastActiveProcessingMultiplier, readProductionModifiers } from './CampaignMechanics';
import type { CampaignCollisionBounds } from './objects/CampaignMap';
import { CAMPAIGN_COLLISION_EPSILON_METERS, CAMPAIGN_PLAYER_SPAWN, resolveEscapeAwareAxisDelta,
  resolveEscapeAwareBoundsDelta } from './objects/CampaignMap';
import type { CampaignMaterial } from './objects/MaterialWorld';
import { layoutHeldMaterials } from './HeldMaterialLayout';
import { findMaterialLanding } from './MaterialPlacement';

export interface CampaignGameOptions {
  readonly document: Document;
  readonly window: Window;
  readonly mount: HTMLElement;
  readonly tutorialSurface: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly assets: CampaignAssets;
  readonly maxTextureAnisotropy?: number;
}

const movement = new THREE.Vector2();
const materialPosition = new THREE.Vector3();
const blockPosition = new THREE.Vector3();
const requestedPlayerDelta = new THREE.Vector2();
const resolvedPlayerPosition = new THREE.Vector2();
const blockNextPlayer = new THREE.Vector2();
const blockCandidatePosition = new THREE.Vector2();
const blockFacingDirection = new THREE.Vector2();
const retryFallbackPosition = new THREE.Vector2();
const retryFallbackFacing = new THREE.Vector2();
const materialPreferred = new THREE.Vector3();
const materialExitDirection = new THREE.Vector3();
const materialExitPosition = new THREE.Vector3();
const materialDirection = new THREE.Vector2();
const moduleCollisionWorldPosition = new THREE.Vector3();
const BLOCK_CONTACT_ALLOWANCE_METERS = 0.35;

interface MaterialInteractionCandidate {
  material: CampaignMaterial;
  distance: number;
  facingAngle: number;
}

type CampaignSpaceAction =
  | Readonly<{ kind: 'block-release'; block: ProductionBlock; root: THREE.Object3D; label: 'SPACE' }>
  | Readonly<{ kind: 'block-capture'; candidate: BlockManipulationCandidate; root: THREE.Object3D; label: 'SPACE' }>;
type CampaignEAction =
  | Readonly<{ kind: 'material-e'; material: CampaignMaterial | null; root: THREE.Object3D; label: 'E' }>
  | Readonly<{ kind: 'interaction-e'; target: CampaignInteractionTarget; root: THREE.Object3D; label: 'E' }>;
interface MaterialDropCandidate {
  readonly materialIds: readonly string[];
  readonly landings: readonly THREE.Vector3[];
}
type CampaignQAction =
  | Readonly<{ kind: 'material-q'; candidate: MaterialDropCandidate; root: THREE.Object3D; label: 'Q' }>
  | Readonly<{ kind: 'module-q'; target: FloorDropCandidate; root: THREE.Object3D; label: 'Q' }>;
type CampaignSelectedAction = CampaignSpaceAction | CampaignEAction | CampaignQAction;
interface CampaignActionSnapshot {
  readonly space: CampaignSpaceAction | null;
  readonly interact: CampaignEAction | null;
  readonly drop: CampaignQAction | null;
  readonly prompt: CampaignSelectedAction | null;
}
const EMPTY_ACTION_SNAPSHOT: CampaignActionSnapshot = Object.freeze({ space: null, interact: null, drop: null, prompt: null });

interface BlockManipulationCandidate {
  readonly block: ProductionBlock;
  readonly side: 'front' | 'left' | 'right';
  readonly playerX: number;
  readonly playerZ: number;
  readonly facingX: number;
  readonly facingZ: number;
  readonly blockX: number;
  readonly blockZ: number;
  readonly distance: number;
  readonly facingAngle: number;
}

interface RetryPlayerTarget {
  readonly position: Readonly<{ x: number; z: number }>;
  readonly facing: Readonly<{ x: number; z: number }>;
}

interface PendingMaterialPlacement {
  readonly material: CampaignMaterial;
  readonly start: THREE.Vector3;
  readonly preferred: THREE.Vector3;
  readonly finalLocation: 'world' | 'output';
  readonly durationSeconds: number;
  readonly block: ProductionBlock | null;
  readonly profile: 'wheat' | 'output';
  readonly burstEnd: THREE.Vector3 | null;
  nextAttemptSeconds: number;
}

interface RetryBaselineProjectionSnapshot {
  readonly playerPosition: Readonly<{ x: number; z: number }>;
  readonly playerFacing: Readonly<{ x: number; z: number }>;
  readonly cameraCenterX: number;
  readonly block: ProductionBlock | null;
  readonly contact: 'front' | 'left' | 'right';
  readonly playerLaneZ: number;
  readonly playerOffsetX: number;
  readonly lastValidPlayerPosition: Readonly<{ x: number; z: number }>;
  readonly lastValidPlayerFacing: Readonly<{ x: number; z: number }>;
  readonly hasLastValidPlayerPose: boolean;
  readonly carriedBlockStart: THREE.Vector3 | null;
}

interface RetryResetSnapshot {
  readonly modules: readonly Readonly<{ module: Module; fuelSeconds: number; recoverySeconds: number; chargeSeconds: number;
    activeSeconds: number; presentation: ModulePresentationSnapshot }>[];
  readonly submittedBreadCount: number;
  readonly stateSubmittedBreadCount: number;
  readonly score: ReturnType<CampaignScore['snapshot']>;
  readonly remainingSeconds: number | null;
  readonly wheatTimerSeconds: number;
  readonly wheatSuccessfulIssuanceCount: number;
}

export class CampaignGame {
  readonly state = new CampaignState();
  readonly score = new CampaignScore();
  readonly input = new CampaignInput();
  readonly player: Player;
  readonly map: CampaignMap;
  readonly materials: MaterialWorld;
  readonly wheatSource: WheatSource;
  readonly submissionDock: SubmissionDock;
  readonly blocks: readonly ProductionBlock[];
  readonly modules: readonly Module[];
  readonly presentation = new PresentationPlayer();
  readonly scoreboard: CampaignScoreboard;
  readonly interactionKeycap: WorldInteractionKeycap;
  readonly gameOver: GameOverOverlay;
  readonly finalScore: FinalScoreOverlay;
  readonly audio = new CampaignAudio();
  readonly audioSettings: AudioSettingsPanel;
  readonly tipPanel: TipPanel;
  readonly topRightControls: TopRightControls;
  readonly tutorial: Stage0TutorialController;
  private readonly config = CAMPAIGN_CONFIG;
  private readonly interaction: CampaignInteraction;
  private stage: CampaignStage = 'stage0';
  private baseline: StageAttemptBaseline;
  private paused = false;
  private lifecyclePaused = false;
  private settingsPaused = false;
  private disposed = false;
  private retryCount = 0;
  private inputCount = 0;
  private carriedBlockStart: THREE.Vector3 | null = null;
  private activeBlock: ProductionBlock | null = null;
  private activeBlockPlayerLaneZ = 0;
  private activeBlockPlayerOffsetX = 0;
  private activeBlockContact: 'front' | 'left' | 'right' = 'front';
  private readonly activeBlockLastValidPlayerPosition = new THREE.Vector2();
  private readonly activeBlockLastValidPlayerFacing = new THREE.Vector2();
  private hasActiveBlockLastValidPlayerPose = false;
  private readonly lastSafePlayerPosition = new THREE.Vector2(CAMPAIGN_PLAYER_SPAWN.position.x, CAMPAIGN_PLAYER_SPAWN.position.z);
  private readonly lastSafePlayerFacing = new THREE.Vector2(CAMPAIGN_PLAYER_SPAWN.facing.x, CAMPAIGN_PLAYER_SPAWN.facing.z);
  private hasLastSafePlayerPose = true;
  private readonly collisionObstacles: CampaignCollisionBounds[] = Array.from({ length: 4 }, () => ({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 }));
  private readonly worldModuleCollisionObstacles: CampaignCollisionBounds[] = Array.from({ length: 3 }, () => ({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 }));
  private cameraCenterX = -7.8;
  private lastDeltaSeconds = 0;
  private readonly materialCandidate: MaterialInteractionCandidate = { material: null as unknown as CampaignMaterial, distance: 0, facingAngle: 0 };
  private selectedAction: CampaignSelectedAction | null = null;
  private heldMaterialPickupCooldownSeconds = 0;
  private pendingWheat: PendingMaterialPlacement | null = null;
  private readonly pendingOutputs: PendingMaterialPlacement[] = [];
  private simulationSeconds = 0;
  private fastActiveBlockThisFrame: ProductionBlock | null = null;
  private fastActiveSecondsThisFrame = 0;

  constructor(private readonly options: CampaignGameOptions) {
    this.map = new CampaignMap(options.scene);
    options.camera.fov = this.config.camera.fovDegrees; options.camera.near = this.config.camera.near; options.camera.far = this.config.camera.far; options.camera.updateProjectionMatrix();
    this.player = new Player(options.assets.clonePrepared('player'), options.assets.clips('player'), this.map);
    this.materials = new MaterialWorld(options.scene, (type) => options.assets.clonePrepared(type),
      CAMPAIGN_CONFIG.materialPresentation.heldTransferSeconds);
    this.wheatSource = new WheatSource(this.materials, options.assets.clonePrepared('wheat-source'));
    this.submissionDock = new SubmissionDock(options.assets.clonePrepared('submission-dock'));
    const blockVisual = (variant: import('./objects/ProductionBlock').ProductionBlockVariant): THREE.Object3D =>
      options.assets.clonePrepared(variant === 'socketless' ? 'stage0-block' : variant === 'single-socket' ? 'stage1-block' : 'stage2-block');
    this.blocks = Object.freeze([
      new ProductionBlock('mill', 'mill', new THREE.Vector3(this.map.anchors.mill.x, 0, this.map.anchors.mill.z), blockVisual, options.maxTextureAnisotropy ?? 1),
      new ProductionBlock('heater', 'heater', new THREE.Vector3(this.map.anchors.heater.x, 0, this.map.anchors.heater.z), blockVisual, options.maxTextureAnisotropy ?? 1),
    ]);
    this.modules = Object.freeze([
      new Module('fast', 'fast', options.assets.clonePrepared('fast'), options.maxTextureAnisotropy ?? 1),
      new Module('double', 'double', options.assets.clonePrepared('double'), options.maxTextureAnisotropy ?? 1),
      new Module('again', 'again', options.assets.clonePrepared('again'), options.maxTextureAnisotropy ?? 1),
    ]);
    options.scene.add(this.player.root, this.wheatSource.root, this.submissionDock.root);
    for (const block of this.blocks) options.scene.add(block.root);
    for (const module of this.modules) options.scene.add(module.root);
    this.scoreboard = new CampaignScoreboard();
    options.scene.add(this.scoreboard.root);
    this.gameOver = new GameOverOverlay(options.document, () => this.requestRetry());
    this.finalScore = new FinalScoreOverlay(options.document, () => this.restartDocument());
    this.audioSettings = new AudioSettingsPanel(options.document, this.audio);
    this.tipPanel = new TipPanel(options.document);
    this.topRightControls = new TopRightControls(options.document, this.tipPanel, this.audioSettings, (paused) => this.setSettingsPaused(paused));
    options.mount.append(this.gameOver.root, this.finalScore.root, this.topRightControls.root);
    const tutorialSteps = createStage0TutorialSteps({
      revealPipe: () => this.revealStage0WheatSource(),
      revealMill: () => this.revealStage0Block(this.blocks[0]!),
      revealHeater: () => this.revealStage0Block(this.blocks[1]!),
      revealDock: () => this.revealStage0SubmissionDock(),
    });
    this.tutorial = new Stage0TutorialController(options.tutorialSurface, tutorialSteps);
    this.interaction = new CampaignInteraction(this.player, this.blocks, this.modules, this.config.interaction, {
      scene: options.scene, player: this.player, presentation: this.presentation,
      bounds: this.map.bounds,
      minimumModuleSeparationMeters: this.config.moduleReveal.minimumSeparationMeters,
      fixedRoots: [this.wheatSource.root, this.submissionDock.root],
      fixedBounds: [this.wheatSource.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 }), this.submissionDock.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 })],
      durationSeconds: this.config.presentation.moduleInsertSeconds,
      timing: this.config.presentation,
      onAction: (action) => this.audio.playCue(action === 'pickup' ? 'module-pickup' : action === 'attach' ? 'module-attach' : action === 'detach' ? 'module-detach' : 'module-drop'),
    });
    this.interactionKeycap = new WorldInteractionKeycap(options.scene, { E: options.assets.createKeycapTexture('E'), Q: options.assets.createKeycapTexture('Q'), SPACE: options.assets.createKeycapTexture('SPACE') });
    this.configureStage('stage0', true);
    this.baseline = this.captureBaseline();
    this.updateCamera();
  }

  keyDown(code: string, repeat: boolean, nowMilliseconds?: number): boolean {
    if (this.disposed || this.state.phase.kind === 'restarting') return false;
    let handled: boolean;
    if (this.state.phase.kind === 'final-score') handled = ['KeyR', 'Enter', 'Space', 'KeyE'].includes(code);
    else if (this.state.phase.kind === 'game-over') {
      if (code === 'KeyR' && !repeat) { this.inputCount += 1; this.requestRetry('keyboard-r'); return true; }
      handled = ['KeyR', 'KeyE', 'Space', 'Enter'].includes(code);
    } else if (this.paused || this.state.phase.kind !== 'playing') handled = true;
    else handled = this.input.keyDown(code, repeat, nowMilliseconds);
    if (handled && !repeat) this.inputCount += 1;
    return handled;
  }
  keyUp(code: string, nowMilliseconds?: number): boolean {
    const handled = this.input.keyUp(code, nowMilliseconds, this.config.movement.tapMaximumMilliseconds, this.config.movement.tapMinimumDistanceMeters);
    if (code === 'KeyE') this.heldMaterialPickupCooldownSeconds = 0;
    return handled;
  }
  unlockAudio(): void { this.audio.unlock(); }
  cancelGameplayInput(): void { this.endBlockManipulation(); this.input.clear(); this.heldMaterialPickupCooldownSeconds = 0; this.interactionKeycap.hide(); }
  setPaused(paused: boolean): void { this.lifecyclePaused = paused; this.applyPauseState(); }

  private setSettingsPaused(paused: boolean): void {
    if (this.disposed) return;
    this.settingsPaused = paused;
    this.applyPauseState();
  }

  private applyPauseState(): void {
    const paused = this.lifecyclePaused || this.settingsPaused;
    if (this.paused === paused) return;
    this.paused = paused;
    this.presentation.setPaused(paused);
    if (paused) {
      this.endBlockManipulation();
      this.input.clear();
      this.heldMaterialPickupCooldownSeconds = 0;
      this.interactionKeycap.hide();
    }
  }

  update(deltaSeconds: number): void {
    if (this.disposed || this.paused) return;
    const enteredPlaying = this.state.phase.kind === 'playing';
    this.lastDeltaSeconds = deltaSeconds;
    this.presentation.update(deltaSeconds);
    if (enteredPlaying && this.state.phase.kind === 'playing') this.updatePlaying(deltaSeconds);
    const events = this.state.drainEvents();
    this.audio.play(events);
    this.renderRuntimeState();
    this.updateCamera();
  }

  resize(width: number, height: number): void {
    this.options.camera.aspect = Math.max(1, width) / Math.max(1, height);
    this.options.camera.updateProjectionMatrix();
  }

  readOverviewCameraPose(includeAuxiliary = true): CampaignOverviewCameraPose {
    const roots = [this.player.root, this.wheatSource.root, this.submissionDock.root, ...this.blocks.map((block) => block.root),
      ...this.modules.filter((module) => module.location.kind !== 'not-introduced').map((module) => module.root)];
    return fitCampaignOverviewCamera(this.options.camera, this.config.camera, this.map.bounds, roots,
      [this.scoreboard.readOverviewBounds(new THREE.Box3(), includeAuxiliary)]);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.endBlockManipulation();
    this.state.setPhase({ kind: 'disposed' });
    this.input.clear(); this.heldMaterialPickupCooldownSeconds = 0; this.presentation.cancel(); this.materials.dispose(); this.audio.dispose(); this.tutorial.dispose();
    this.gameOver.dispose(); this.finalScore.dispose(); this.topRightControls.dispose(); this.tipPanel.dispose(); this.audioSettings.dispose(); this.scoreboard.dispose(); this.interactionKeycap.dispose(); this.submissionDock.dispose(); this.map.dispose();
    for (const module of this.modules) module.dispose();
    for (const root of [this.player.root, this.wheatSource.root, this.submissionDock.root,
      ...this.blocks.map((block) => block.root), ...this.modules.map((module) => module.root)]) root.removeFromParent();
  }

  private updatePlaying(deltaSeconds: number): void {
    this.simulationSeconds += deltaSeconds;
    const actions = this.input.consumeActions();
    this.input.readMovement(movement);
    const hasTap = this.input.consumeTap(requestedPlayerDelta);
    const tapRunning = this.input.consumeTapRunning();
    const verticalMovementIntent = movement.y !== 0 || (hasTap && requestedPlayerDelta.y !== 0);
    const verticalBlockExitRequested = this.activeBlock !== null && verticalMovementIntent;
    let useTap = hasTap;
    const ordinaryPresentationActive = this.presentation.active;
    const actionSnapshot = ordinaryPresentationActive ? EMPTY_ACTION_SNAPSHOT :
      this.selectActionSnapshot(actions.interactHeld && !actions.interactPressed);
    this.selectedAction = actionSnapshot.prompt;
    let spaceActionConsumed = false;
    if (!ordinaryPresentationActive && actions.moveBlockPressed &&
      actionSnapshot.space !== null) {
      if (actionSnapshot.space.kind === 'block-capture') {
        if (!verticalMovementIntent) { this.beginBlockManipulation(actionSnapshot.space.candidate); spaceActionConsumed = true; }
      }
      else { this.endBlockManipulation(true); spaceActionConsumed = true; }
    }
    if (verticalBlockExitRequested) {
      if (this.activeBlock !== null) this.endBlockManipulation(true);
      movement.x = 0;
      if (hasTap && requestedPlayerDelta.y !== 0) requestedPlayerDelta.x = 0;
      else {
        requestedPlayerDelta.set(0, 0);
        useTap = false;
      }
    }
    if (this.activeBlock !== null) {
      this.advanceBlockManipulation(movement.x, deltaSeconds, useTap ? requestedPlayerDelta.x : 0);
    } else if (movement.lengthSq() > 0 || useTap) {
      const running = useTap ? tapRunning : this.input.isRunning;
      if (!useTap) {
        movement.normalize();
        requestedPlayerDelta.copy(movement).multiplyScalar(deltaSeconds * (running ? this.config.movement.runMetersPerSecond : this.config.movement.walkMetersPerSecond));
      }
      this.wheatSource.readCollisionBounds(this.collisionObstacles[0]!); this.submissionDock.readCollisionBounds(this.collisionObstacles[1]!);
      this.blocks[0]!.readCollisionBounds(this.collisionObstacles[2]!); this.blocks[1]!.readCollisionBounds(this.collisionObstacles[3]!);
      this.map.resolvePlayerMovement(this.player.position, requestedPlayerDelta, this.collisionObstacles, resolvedPlayerPosition);
      this.player.moveTo(resolvedPlayerPosition, running);
      this.rememberSafePlayerPose();
      if (this.stage === 'stage0' && this.player.moving) this.tutorial.observe({ kind: 'moved', running });
    } else this.player.stop();
    this.player.update(deltaSeconds);
    const stageConfig = this.config.stages[this.stage];
    this.wheatSource.update(deltaSeconds, stageConfig, (spawn, exit) => this.spawnWheat(spawn, exit));
    this.updatePendingOutputs();
    this.materials.update(deltaSeconds);
    if (this.updateAutomaticIntake()) return;
    this.updateModuleEffects(deltaSeconds);
    this.updateProcessors(deltaSeconds);
    if (!spaceActionConsumed && actions.dropPressed && actionSnapshot.drop !== null) {
      this.performDropAction(actionSnapshot.drop);
      this.heldMaterialPickupCooldownSeconds = 0;
    } else if (!spaceActionConsumed && !actions.dropPressed) {
      this.advanceHeldInteraction(actions, actionSnapshot.interact, deltaSeconds);
    } else if (!actions.interactHeld) {
      this.heldMaterialPickupCooldownSeconds = 0;
    }
    this.selectedAction = this.presentation.active ? null : this.selectActionSnapshot(actions.interactHeld).prompt;
    if (this.selectedAction === null) this.interaction.clearTarget();
    this.interactionKeycap.update(this.selectedAction?.root ?? null, this.selectedAction?.label ?? null, this.options.camera, true);
    if (this.state.remainingSeconds !== null) {
      this.state.setRemainingSeconds(this.state.remainingSeconds - deltaSeconds);
      if (this.state.remainingSeconds <= 0) this.enterGameOver(this.stage as TimedCampaignStage);
    }
  }

  private advanceHeldInteraction(actions: Readonly<{ interactPressed: boolean; interactHeld: boolean }>,
    admittedAction: CampaignEAction | null, deltaSeconds: number): void {
    if (!actions.interactHeld) { this.heldMaterialPickupCooldownSeconds = 0; return; }
    let action = admittedAction;
    if (actions.interactPressed) {
      if (action === null || this.performSelectedAction(action) !== 'material-picked') {
        this.heldMaterialPickupCooldownSeconds = 0;
        return;
      }
      this.heldMaterialPickupCooldownSeconds = this.config.interaction.heldMaterialPickupIntervalSeconds;
    }
    let remaining = Math.max(0, deltaSeconds);
    let attempts = 0;
    while (this.player.heldMaterialIds.length < this.config.interaction.heldMaterialCapacity && attempts < this.config.interaction.heldMaterialCapacity) {
      if (this.heldMaterialPickupCooldownSeconds > remaining + 1e-12) {
        this.heldMaterialPickupCooldownSeconds -= remaining;
        break;
      }
      remaining -= this.heldMaterialPickupCooldownSeconds;
      this.heldMaterialPickupCooldownSeconds = 0;
      if (action?.kind !== 'material-e') action = this.selectEAction(true);
      if (action === null || this.performSelectedAction(action) !== 'material-picked') break;
      action = null;
      this.heldMaterialPickupCooldownSeconds = this.config.interaction.heldMaterialPickupIntervalSeconds;
      attempts += 1;
    }
  }

  private performSelectedAction(action: CampaignEAction): 'material-picked' | 'interaction' | 'none' {
    if (action.kind === 'interaction-e') {
      return this.interaction.interactTarget(action.target) ? 'interaction' : 'none';
    }
    if (this.player.heldModule !== null) {
      return 'none';
    }
    if (action.material !== null && !this.isMaterialActionStillValid(action.material)) return 'none';
    const held = this.heldMaterials();
    if (held.length > 0) {
      const stackCandidate = action.material?.type === held[0]!.type ? action.material : null;
      if (stackCandidate !== null && held.length < this.config.interaction.heldMaterialCapacity) {
        return this.pickUpMaterial(stackCandidate.id) ? 'material-picked' : 'none';
      }
      return 'none';
    }
    const nearest = action.material;
    if (nearest !== null) {
      return this.pickUpMaterial(nearest.id) ? 'material-picked' : 'none';
    }
    return 'none';
  }

  private isMaterialActionStillValid(material: CampaignMaterial): boolean {
    if ((material.location !== 'world' && material.location !== 'output') || this.materials.get(material.id) !== material) return false;
    material.root.getWorldPosition(materialPosition);
    const centerDistance = Math.hypot(materialPosition.x - this.player.position.x, materialPosition.z - this.player.position.y);
    return Math.max(0, centerDistance - this.config.materialPresentation.footprintRadiusMeters[material.type]) <=
      this.config.interaction.interactionRadiusMeters;
  }

  private selectActionSnapshot(heldMaterialOnly = false): CampaignActionSnapshot {
    if (this.presentation.active) { this.interaction.clearTarget(); return EMPTY_ACTION_SNAPSHOT; }
    if (this.activeBlock !== null) {
      this.interaction.clearTarget();
      const space: CampaignSpaceAction = Object.freeze({ kind: 'block-release', block: this.activeBlock,
        root: this.activeBlock.readInteractionPromptRoot(), label: 'SPACE' });
      return Object.freeze({ space, interact: null, drop: null, prompt: space });
    }
    const blockCandidate = this.selectBlockManipulationTarget();
    if (blockCandidate !== null) {
      this.interaction.clearTarget();
      const space: CampaignSpaceAction = Object.freeze({ kind: 'block-capture', candidate: blockCandidate,
        root: blockCandidate.block.readInteractionPromptRoot(), label: 'SPACE' });
      return Object.freeze({ space, interact: null, drop: null, prompt: space });
    }
    const interact = this.selectEAction(heldMaterialOnly);
    const drop = this.selectQAction();
    return Object.freeze({ space: null, interact, drop, prompt: interact });
  }

  private selectEAction(materialOnly = false): CampaignEAction | null {
    if (materialOnly) {
      this.interaction.clearTarget();
      if (this.player.heldModule !== null) return null;
      const held = this.heldMaterials();
      const material = this.findNearestMaterialCandidate(held[0]?.type)?.material ?? null;
      return material === null ? null : { kind: 'material-e', material, root: material.root, label: 'E' };
    }
    this.interaction.updateTarget();
    const material = this.resolveSelectedMaterial();
    if (this.player.heldModule !== null) {
      const target = this.interaction.selected;
      if (target === null) return null;
      return { kind: 'interaction-e', target, root: this.interactionTargetRoot(target), label: 'E' };
    }
    if (this.player.heldMaterialIds.length > 0) {
      return material === null ? null : { kind: 'material-e', material, root: material.root, label: 'E' };
    }
    if (material !== null) {
      this.interaction.clearTarget();
      return { kind: 'material-e', material, root: material.root, label: 'E' };
    }
    const target = this.interaction.selected;
    return target === null ? null : { kind: 'interaction-e', target, root: this.interactionTargetRoot(target), label: 'E' };
  }

  private selectQAction(): CampaignQAction | null {
    if (this.player.heldMaterialIds.length > 0) {
      const candidate = this.createMaterialDropCandidate();
      return candidate === null ? null : Object.freeze({ kind: 'material-q', candidate, root: this.player.heldAnchor, label: 'Q' });
    }
    if (this.player.heldModule !== null) {
      const target = this.interaction.readHeldModuleDropTarget();
      return target === null ? null : Object.freeze({ kind: 'module-q', target, root: this.player.heldAnchor, label: 'Q' });
    }
    return null;
  }

  private interactionTargetRoot(target: CampaignInteractionTarget): THREE.Object3D {
    return target.kind === 'socket' ? target.socket.anchor : target.module.root;
  }

  private heldMaterials(): ReturnType<MaterialWorld['all']> {
    return this.player.heldMaterialIds
      .map((id) => this.materials.get(id))
      .filter((material): material is NonNullable<typeof material> => material !== null);
  }

  private findNearestMaterialCandidate(type?: ReturnType<MaterialWorld['all']>[number]['type']): MaterialInteractionCandidate | null {
    let nearestMaterial: CampaignMaterial | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    let nearestFacingAngle = Number.POSITIVE_INFINITY;
    const epsilon = this.config.interaction.interactionDistanceTieEpsilonMeters;
    for (const material of this.materials.values()) {
      if ((material.location !== 'world' && material.location !== 'output') || (type !== undefined && material.type !== type)) continue;
      material.root.getWorldPosition(materialPosition);
      materialDirection.set(materialPosition.x - this.player.position.x, materialPosition.z - this.player.position.y);
      const centerDistance = materialDirection.length();
      if (centerDistance > 0) materialDirection.multiplyScalar(1 / centerDistance);
      const distance = Math.max(0, centerDistance - this.config.materialPresentation.footprintRadiusMeters[material.type]);
      if (distance > this.config.interaction.interactionRadiusMeters) continue;
      const facingAngle = Math.acos(THREE.MathUtils.clamp(materialDirection.dot(this.player.facing), -1, 1));
      if (nearestMaterial === null || distance < nearestDistance - epsilon ||
        (Math.abs(distance - nearestDistance) <= epsilon && (facingAngle < nearestFacingAngle ||
          (facingAngle === nearestFacingAngle && material.id.localeCompare(nearestMaterial.id) < 0)))) {
        nearestMaterial = material; nearestDistance = distance; nearestFacingAngle = facingAngle;
      }
    }
    if (nearestMaterial === null) return null;
    this.materialCandidate.material = nearestMaterial; this.materialCandidate.distance = nearestDistance; this.materialCandidate.facingAngle = nearestFacingAngle;
    return this.materialCandidate;
  }

  private pickUpMaterial(id: string): boolean {
    const material = this.materials.get(id);
    if (material === null || this.player.heldMaterialIds.length >= this.config.interaction.heldMaterialCapacity) return false;
    const heldBefore = this.heldMaterials();
    this.materials.terminalizeTransfers(heldBefore.map((entry) => entry.id));
    const starts = new Map<string, THREE.Vector3>();
    for (const entry of [...heldBefore, material]) starts.set(entry.id, entry.root.getWorldPosition(new THREE.Vector3()));
    this.removeOutputId(id); material.location = 'held';
    this.player.heldMaterialIds.push(id);
    const heldAfter = this.heldMaterials(); layoutHeldMaterials(this.player, heldAfter);
    for (const entry of heldAfter) this.materials.beginTransfer(entry, starts.get(entry.id)!, 'pickup');
    this.audio.playCue('material-pickup');
    if (this.stage === 'stage0') this.tutorial.observe({ kind: 'material-picked', materialType: material.type, materialId: material.id });
    return true;
  }

  private createMaterialDropCandidate(): MaterialDropCandidate | null {
    const held = this.heldMaterials();
    if (held.length === 0) return null;
    const landings: THREE.Vector3[] = [];
    const spacing = this.config.materialPresentation.footprintRadiusMeters[held[0]!.type] * 2 + 0.015;
    for (let index = 0; index < held.length; index += 1) {
      const material = held[index]!;
      const forward = 1.15 + Math.floor(index / 3) * spacing;
      const lateral = (index % 3 - 1) * spacing;
      materialPreferred.set(
        this.player.position.x + this.player.facing.x * forward - this.player.facing.y * lateral,
        0,
        this.player.position.y + this.player.facing.y * forward + this.player.facing.x * lateral,
      );
      const landing = this.findLanding(material, materialPreferred);
      if (landing === null) return null;
      landings.push(landing);
    }
    return Object.freeze({ materialIds: Object.freeze(held.map((material) => material.id)), landings: Object.freeze(landings) });
  }

  private performDropAction(action: CampaignQAction): boolean {
    if (action.kind === 'module-q') return this.interaction.interactTarget(action.target);
    return this.dropHeldMaterials(action.candidate);
  }

  private dropHeldMaterials(candidate: MaterialDropCandidate): boolean {
    if (candidate.materialIds.length === 0 || candidate.materialIds.length !== this.player.heldMaterialIds.length ||
      candidate.materialIds.some((id, index) => this.player.heldMaterialIds[index] !== id)) return false;
    const held = this.heldMaterials();
    if (held.length !== candidate.materialIds.length) return false;
    for (let index = 0; index < held.length; index += 1) {
      const current = this.findLanding(held[index]!, candidate.landings[index]!);
      if (current === null || current.distanceToSquared(candidate.landings[index]!) > 1e-12) return false;
    }
    this.materials.terminalizeTransfers(candidate.materialIds);
    const starts = held.map((material) => material.root.getWorldPosition(new THREE.Vector3()));
    const droppedIds = [...candidate.materialIds];
    const droppedType = held[0]?.type;
    for (let index = 0; index < held.length; index += 1) {
      const material = held[index]!; this.options.scene.attach(material.root); material.root.position.copy(candidate.landings[index]!);
      material.location = 'world'; material.root.quaternion.identity(); material.root.scale.setScalar(1);
      this.materials.beginTransfer(material, starts[index]!, 'floor-drop');
    }
    this.player.heldMaterialIds.length = 0;
    this.audio.playCue('material-drop');
    if (this.stage === 'stage0' && droppedType !== undefined) {
      this.tutorial.observe({ kind: 'material-dropped', materialType: droppedType, materialIds: droppedIds });
    }
    return true;
  }

  private updateAutomaticIntake(): boolean {
    const capacity = this.config.stages[this.stage].productionCapacity;
    for (const material of this.materials.values()) {
      if (material.location !== 'world' && material.location !== 'output') continue;
      material.root.getWorldPosition(materialPosition);
      if (material.type === 'bread' && this.submissionDock.interactionAvailable &&
        this.submissionDock.distanceToIntakeSurface(materialPosition.x, materialPosition.z) <= this.config.interaction.automaticIntakeRadiusMeters) {
        if (this.stage === 'stage0' && !this.tutorial.allowsAutomaticIntake(material.id)) continue;
        const accepted = this.submissionDock.submit(1);
        if (accepted === 1) {
          this.removeOutputId(material.id);
          this.submissionDock.commitBreadRoot(material.root);
          this.materials.retire(material.id, 'submitted');
          this.audio.playCue('bread-submitted');
          this.state.submittedBreadCount = this.submissionDock.submittedBreadCount;
          this.tutorial.observe({ kind: 'bread-submitted', materialId: material.id });
          if (this.submissionDock.submittedBreadCount >= this.submissionDock.targetBreadCount) { this.clearStage(); return true; }
        }
        continue;
      }
      const target = material.type === 'wheat' ? this.blocks[0] : material.type === 'flour' ? this.blocks[1] : null;
      if (target === null || target.storedMaterialIds.length >= capacity) continue;
      if (this.stage === 'stage0' && !this.tutorial.allowsAutomaticIntake(material.id)) continue;
      if (target.distanceToIntakeSurface(materialPosition.x, materialPosition.z) > this.config.interaction.automaticIntakeRadiusMeters) continue;
      target.storedMaterialIds.push(material.id);
      this.removeOutputId(material.id);
      material.location = 'stored';
      target.root.attach(material.root); material.root.position.set(0, 0.55, 0); material.root.visible = false;
      const stageConfig = this.config.stages[this.stage];
      const required = target.type === 'mill' ? stageConfig.millProcessSeconds : stageConfig.heaterProcessSeconds;
      target.updatePresentation(target.processingSeconds / required, target.storedMaterialIds.length, stageConfig.productionCapacity);
      this.audio.playCue('material-intake');
      if (this.stage === 'stage0') {
        this.tutorial.observe({ kind: 'material-intake', materialType: material.type as 'wheat' | 'flour', materialId: material.id, blockId: target.id });
      }
    }
    return false;
  }

  private updateModuleEffects(deltaSeconds: number): void {
    const fast = this.modules.find((module) => module.type === 'fast');
    this.fastActiveBlockThisFrame = fast?.location.kind === 'socket' ? fast.location.block : null;
    this.fastActiveSecondsThisFrame = advanceModuleEffects(this.modules, deltaSeconds, this.config, (block) => this.isBlockActivelyProcessing(block));
    for (const module of this.modules) module.updatePresentation(this.config, deltaSeconds);
  }

  private isBlockActivelyProcessing(block: ProductionBlock): boolean {
    if (this.player.heldBlockId === block.id || block.storedMaterialIds.length === 0) return false;
    if (this.stage === 'stage0' && block.type === 'heater' && !this.tutorial.heaterProcessingUnlocked) return false;
    return true;
  }

  private removeOutputId(id: string): void { for (const block of this.blocks) { const index = block.outputMaterialIds.indexOf(id); if (index >= 0) block.outputMaterialIds.splice(index, 1); } }

  private updateProcessors(deltaSeconds: number): void {
    const config = this.config.stages[this.stage];
    for (const block of this.blocks) {
      if (this.player.heldBlockId === block.id) {
        const required = block.type === 'mill' ? config.millProcessSeconds : config.heaterProcessSeconds;
        block.updatePresentation(block.processingSeconds / required, block.storedMaterialIds.length, config.productionCapacity);
        continue;
      }
      if (block.storedMaterialIds.length === 0) { block.processingSeconds = 0; block.updatePresentation(0, 0, config.productionCapacity); continue; }
      if (this.stage === 'stage0' && block.type === 'heater' && !this.tutorial.heaterProcessingUnlocked) {
        block.updatePresentation(0, block.storedMaterialIds.length, config.productionCapacity); continue;
      }
      const modifiers = readProductionModifiers(block, this.config);
      if (block.processingSeconds === 0) this.audio.playCue('process-start');
      const fastActiveSeconds = block === this.fastActiveBlockThisFrame ? Math.min(deltaSeconds, this.fastActiveSecondsThisFrame) : 0;
      block.processingSeconds += deltaSeconds + fastActiveSeconds * (readFastActiveProcessingMultiplier(block, this.config) - 1);
      const required = block.type === 'mill' ? config.millProcessSeconds : config.heaterProcessSeconds;
      block.updatePresentation(block.processingSeconds / required, block.storedMaterialIds.length, config.productionCapacity);
      if (block.processingSeconds < required) continue;
      block.processingSeconds = 0;
      const input = block.storedMaterialIds.shift()!;
      this.materials.retire(input, 'processing');
      this.audio.playCue('process-complete');
      const outputType = block.type === 'mill' ? 'flour' : 'bread';
      const count = modifiers.outputCount;
      block.readOutputMouthPosition(blockPosition); block.readTokenExitPosition(materialExitPosition);
      const outputIds: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const output = this.materials.create(outputType, blockPosition);
        outputIds.push(output.id);
        output.location = 'reserved'; block.outputMaterialIds.push(output.id);
        materialExitDirection.copy(materialExitPosition).sub(blockPosition); materialExitDirection.y = 0;
        if (materialExitDirection.lengthSq() < 1e-8) materialExitDirection.set(0, 0, 1); else materialExitDirection.normalize();
        materialPreferred.copy(materialExitPosition).addScaledVector(materialExitDirection, 0.72);
        materialPreferred.x += (index - (count - 1) / 2) * 0.38;
        const pending: PendingMaterialPlacement = { material: output, start: blockPosition.clone(), preferred: materialPreferred.clone(), finalLocation: 'output', durationSeconds: this.config.materialPresentation.outputSeconds, block, profile: 'output', burstEnd: null, nextAttemptSeconds: 0 };
        if (!this.startPendingPlacement(pending)) this.pendingOutputs.push(pending);
      }
      if (this.stage === 'stage0') {
        const tutorialStep = this.tutorial.currentStepId;
        const advanced = this.tutorial.observe({ kind: 'material-output', materialType: outputType, materialIds: outputIds });
        if (advanced && tutorialStep === 'mill-processing' && outputType === 'flour') {
          this.tipPanel.publish('stage0-absorption', '모든 재료는 블록과 가까이 있으면 흡수됩니다.');
        }
      }
      this.audio.playCue('material-output');
      block.updatePresentation(0, block.storedMaterialIds.length, config.productionCapacity);
    }
  }

  private spawnWheat(spawn: THREE.Vector3, exit: THREE.Vector3): boolean {
    if (this.pendingWheat === null) {
      const material = this.materials.create('wheat', spawn); material.location = 'reserved';
      materialExitDirection.copy(exit).sub(spawn); materialExitDirection.y = 0;
      if (materialExitDirection.lengthSq() < 1e-8) materialExitDirection.set(1, 0, 0); else materialExitDirection.normalize();
      materialPreferred.copy(exit).addScaledVector(materialExitDirection, 0.86); materialPreferred.y = 0;
      const start = spawn.clone().addScaledVector(materialExitDirection, this.config.materialPresentation.wheatMouthForwardOffset);
      const burstEnd = start.clone().addScaledVector(materialExitDirection, this.config.materialPresentation.wheatInitialBurstDistance);
      this.pendingWheat = { material, start, preferred: materialPreferred.clone(), finalLocation: 'world', durationSeconds: this.config.materialPresentation.wheatSpawnSeconds, block: null, profile: 'wheat', burstEnd, nextAttemptSeconds: 0 };
    }
    if (!this.startPendingPlacement(this.pendingWheat)) return false;
    this.pendingWheat = null; return true;
  }

  private updatePendingOutputs(): void {
    for (let index = this.pendingOutputs.length - 1; index >= 0; index -= 1) {
      if (this.startPendingPlacement(this.pendingOutputs[index]!)) this.pendingOutputs.splice(index, 1);
    }
  }

  private startPendingPlacement(pending: PendingMaterialPlacement): boolean {
    if (this.simulationSeconds < pending.nextAttemptSeconds) return false;
    const landing = this.findLanding(pending.material, pending.preferred);
    if (landing === null) { pending.nextAttemptSeconds = this.simulationSeconds + 0.2; return false; }
    pending.material.root.visible = true;
    this.materials.beginMotion(pending.material, pending.start, landing, pending.durationSeconds, pending.finalLocation, pending.profile, pending.burstEnd,
      pending.block === null ? undefined : () => { /* block owns the stable output id */ });
    return true;
  }

  private findLanding(material: CampaignMaterial, preferred: THREE.Vector3): THREE.Vector3 | null {
    this.readCollisionObstacles();
    return findMaterialLanding(material.type, preferred, this.map.bounds, this.collisionObstacles, this.player.position,
      this.materials, this.modules, material.id);
  }

  private readCollisionObstacles(): void {
    this.wheatSource.readCollisionBounds(this.collisionObstacles[0]!); this.submissionDock.readCollisionBounds(this.collisionObstacles[1]!);
    this.blocks[0]!.readCollisionBounds(this.collisionObstacles[2]!); this.blocks[1]!.readCollisionBounds(this.collisionObstacles[3]!);
  }

  private isPlayerPoseCollisionSafe(position: Readonly<{ x: number; y: number }>): boolean {
    const radius = this.config.movement.playerRadiusMeters;
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) ||
      position.x < this.map.bounds.minX + radius - 1e-6 || position.x > this.map.bounds.maxX - radius + 1e-6 ||
      position.y < this.map.bounds.minZ + radius - 1e-6 || position.y > this.map.bounds.maxZ - radius + 1e-6) return false;
    this.readCollisionObstacles();
    for (const obstacle of this.collisionObstacles) if (position.x > obstacle.minX - radius + 1e-6 && position.x < obstacle.maxX + radius - 1e-6 &&
      position.y > obstacle.minZ - radius + 1e-6 && position.y < obstacle.maxZ + radius - 1e-6) return false;
    return true;
  }

  private rememberSafePlayerPose(): void {
    if (!this.isPlayerPoseCollisionSafe(this.player.position) || !Number.isFinite(this.player.facing.x) || !Number.isFinite(this.player.facing.y)) return;
    this.lastSafePlayerPosition.copy(this.player.position); this.lastSafePlayerFacing.copy(this.player.facing); this.hasLastSafePlayerPose = true;
  }

  private selectRetryPlayerTarget(): RetryPlayerTarget {
    if (this.isPlayerPoseCollisionSafe(this.player.position) && Number.isFinite(this.player.facing.x) && Number.isFinite(this.player.facing.y)) {
      return Object.freeze({ position: Object.freeze({ x: this.player.position.x, z: this.player.position.y }),
        facing: Object.freeze({ x: this.player.facing.x, z: this.player.facing.y }) });
    }
    retryFallbackPosition.copy(this.lastSafePlayerPosition); retryFallbackFacing.copy(this.lastSafePlayerFacing);
    if (!this.hasLastSafePlayerPose || !this.isPlayerPoseCollisionSafe(retryFallbackPosition) ||
      !Number.isFinite(retryFallbackFacing.x) || !Number.isFinite(retryFallbackFacing.y)) {
      retryFallbackPosition.set(CAMPAIGN_PLAYER_SPAWN.position.x, CAMPAIGN_PLAYER_SPAWN.position.z);
      retryFallbackFacing.set(CAMPAIGN_PLAYER_SPAWN.facing.x, CAMPAIGN_PLAYER_SPAWN.facing.z);
    }
    return Object.freeze({ position: Object.freeze({ x: retryFallbackPosition.x, z: retryFallbackPosition.y }),
      facing: Object.freeze({ x: retryFallbackFacing.x, z: retryFallbackFacing.y }) });
  }

  private clearStage(): void {
    if (this.state.phase.kind !== 'playing') return;
    if (this.presentation.active && !this.presentation.finishImmediately()) {
      this.handlePresentationFailure();
      return;
    }
    this.validateStageBaseline();
    this.retirePlayingInteractionTransaction(); this.scoreboard.hide();
    const config = this.config.stages[this.stage];
    const stageScore = this.score.commit(this.stage, config, this.submissionDock.submittedBreadCount, this.state.remainingSeconds);
    const score = this.score.snapshot();
    const breadScore = this.submissionDock.submittedBreadCount * config.scorePerBread;
    const timeBonus = stageScore - breadScore;
    const breakdown = Object.freeze([
      Object.freeze({ label: 'BREAD', score: breadScore }),
      ...(this.stage !== 'stage0' && timeBonus > 0 ? [Object.freeze({ label: 'TIME BONUS', score: timeBonus })] : []),
    ]);
    this.state.publish({
      type: 'stage-cleared', stage: this.stage, stageScore, totalScore: score.totalScore,
      breakdown,
    });
    const materialRoots = this.takeAttemptMaterialsForPresentation();
    const overview = this.readOverviewCameraPose(true);
    const scoreboardStep = this.scoreboard.createClearStep(this.stage, stageScore, score.totalScore,
      breakdown,
      this.config.presentation.scoreCountSeconds, this.config.presentation.scoreHoldSeconds);
    const dockGoalProjection = this.submissionDock.createResultCountProjectionStep(`${this.stage}-dock-goal-result-counts`);
    const suction = suctionMaterialRoots(`${this.stage}-material-suction`, this.options.scene, materialRoots,
      this.wheatSource.readSuctionPosition(new THREE.Vector3()), this.config.presentation.clearSeconds * 0.22);
    const resultCamera = moveCamera(`${this.stage}-result-camera`, this.options.camera, overview.position, overview.lookAt,
      this.config.presentation.wideEnterSeconds, overview.far);
    if (this.stage === 'stage3') {
      this.state.setPhase({ kind: 'clear-presentation', stage: 'stage3', nextStage: 'stage3' });
      this.presentation.finishCurrentThenBuildAndPlay(() => createFinalStagePlan({
        dockGoalProjection, scoreboard: scoreboardStep, suction, resultCamera,
        moduleEffectReset: this.createModuleEffectResetStep('stage3-module-effect-reset'),
        finalScore: this.scoreboard.createFinalScoreStep(score.totalScore, this.config.presentation.scoreHoldSeconds),
        finish: callbackStep('stage3-final-score', () => {
          this.state.setPhase({ kind: 'final-score', stage: 'stage3' });
          this.finalScore.show(this.score.snapshot());
        }),
      }), () => undefined, () => this.handlePresentationFailure());
      return;
    }
    const nextStage = nextCampaignStage(this.stage);
    if (nextStage === null) throw new Error(`No stage follows ${this.stage}.`);
    this.state.setPhase({ kind: 'clear-presentation', stage: this.stage, nextStage });
    this.presentation.finishCurrentThenBuildAndPlay(() => {
      // Placement reads happen only after any ordinary module motion has
      // reached its terminal world transform.
      const moduleEffectReset = this.createModuleEffectResetStep(`${this.stage}-module-effect-reset`);
      const revealType = config.revealModuleAfterClear;
      const revealedModule = revealType === null ? null : this.module(revealType);
      if (revealedModule?.location.kind === 'not-introduced') revealedModule.initializeForAdmission(this.config);
      const reveal = revealedModule === null ? [] : revealModule(revealedModule, {
        scene: this.options.scene, player: this.player, config: this.config.moduleReveal,
        floorModuleHalfExtentMeters: this.config.interaction.floorModuleHalfExtentMeters,
        bounds: this.map.bounds,
        blocks: this.blocks, modules: this.modules, fixedRoots: [this.wheatSource.root, this.submissionDock.root],
        fixedBounds: [this.wheatSource.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 }), this.submissionDock.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 })],
        durationSeconds: this.config.presentation.moduleDropSeconds,
        onRevealed: () => this.audio.playCue('module-reveal'),
      });
      const blockTransition = this.stage === 'stage2' ? null : turnAndSwapBlocks(`${this.stage}-block-turn`, this.blocks,
        this.config.presentation.blockTurnSeconds, () => {
          const nextConfig = this.config.stages[nextStage];
          for (const block of this.blocks) block.setVariant(nextConfig.processBlockVariant, nextConfig.enabledSocketCount);
        }, () => {
          for (const block of this.blocks) block.setVariant(config.processBlockVariant, config.enabledSocketCount);
        });
      return createStageClearPlan({
        dockGoalProjection, scoreboard: scoreboardStep, suction, resultCamera, blockTransition, moduleEffectReset, moduleReveal: reveal,
        returnCamera: this.createCurrentPlayerCameraReturnStep(`${this.stage}-camera-return`, this.config.presentation.clearReturnSeconds),
        stageConfiguration: this.createDeferredTimedStageConfigurationStep(nextStage),
        scoreboardEntrance: this.scoreboard.createActiveEntranceStep(nextStage,
          this.config.stages[nextStage].timeScoring.timeLimitSeconds, 0, this.config.presentation.timedStageEntranceSeconds),
        finish: callbackStep(`${nextStage}-stage-admission`, () => this.admitConfiguredStage(nextStage, true, true)),
      });
    }, () => undefined, () => this.handlePresentationFailure());
  }

  private enterGameOver(stage: TimedCampaignStage): void {
    if (this.state.phase.kind !== 'playing') return;
    // Ordinary module motion yields its exact terminal pose before campaign
    // failure owns the shared presentation player.
    if (this.presentation.active && !this.presentation.finishImmediately()) {
      this.retirePlayingInteractionTransaction(); this.state.setPhase({ kind: 'game-over-presentation', stage }); this.handlePresentationFailure(); return;
    }
    this.retirePlayingInteractionTransaction(); this.scoreboard.hide();
    this.state.setPhase({ kind: 'game-over-presentation', stage });
    this.state.publish({ type: 'stage-failed', stage });
    const overview = this.readOverviewCameraPose(false);
    this.presentation.finishCurrentAndPlay([
      moveCamera(`${stage}-game-over-camera`, this.options.camera, overview.position, overview.lookAt, this.config.presentation.wideEnterSeconds, overview.far),
      this.scoreboard.createGameOverStep(this.config.presentation.scoreHoldSeconds + 0.72),
    ], () => {
      this.state.setPhase({ kind: 'game-over', stage });
      this.gameOver.show();
    }, () => this.handlePresentationFailure());
  }
  private takeAttemptMaterialsForPresentation(): readonly THREE.Object3D[] {
    const roots = this.materials.takeAttemptMaterialRoots();
    this.pendingWheat = null; this.pendingOutputs.length = 0;
    this.player.heldMaterialIds.length = 0;
    for (const block of this.blocks) block.clearAttemptMaterials();
    return roots;
  }
  private requestRetry(source: 'pointer' | 'keyboard-r' = 'pointer'): void {
    if (this.state.phase.kind !== 'game-over') return;
    const stage = this.state.phase.stage;
    const projectionSnapshot = this.captureRetryBaselineProjectionSnapshot();
    const retryTarget = this.selectRetryPlayerTarget();
    const resetSnapshot = this.captureRetryResetSnapshot();
    let dockResetReceipt: ReturnType<SubmissionDock['prepareResetProjection']> | null = null;
    let scoreboardActiveReceipt: ReturnType<CampaignScoreboard['prepareActiveProjection']> | null = null;
    let resetMutationStarted = false;
    this.gameOver.markPending(); this.state.setPhase({ kind: 'retry-presentation', stage }); this.state.publish({ type: 'retry-requested', source });
    const materialRoots = this.takeAttemptMaterialsForPresentation();
    this.retryCount += 1;
    const plan = createRetryPlan({
      suction: suctionMaterialRoots(`retry-${this.retryCount}-suction`, this.options.scene, materialRoots, this.wheatSource.readSuctionPosition(new THREE.Vector3()),
        this.config.presentation.retrySeconds * 0.35),
      baselineProjection: callbackStep(`retry-${this.retryCount}-baseline-projection`, () => {
        this.endBlockManipulation();
        this.player.reset(retryTarget.position, retryTarget.facing);
        this.rememberSafePlayerPose();
        this.cameraCenterX = THREE.MathUtils.clamp(this.player.position.x, this.config.camera.centerXMin, this.config.camera.centerXMax);
      }, () => this.restoreRetryBaselineProjectionSnapshot(projectionSnapshot)),
      resetProjection: callbackStep(`retry-${this.retryCount}-reset-projection`, () => {
        scoreboardActiveReceipt = this.scoreboard.prepareActiveProjection(stage, this.config.stages[stage].timeScoring.timeLimitSeconds, 0);
        dockResetReceipt = this.submissionDock.prepareResetProjection();
      }, () => {
        try { this.submissionDock.cancelPreparedReset(dockResetReceipt); }
        finally { this.scoreboard.cancelPreparedActiveProjection(scoreboardActiveReceipt); dockResetReceipt = null; scoreboardActiveReceipt = null; }
      }),
      moduleEffectReset: this.createModuleEffectResetStep(`retry-${this.retryCount}-module-effect-reset`),
      commitReset: callbackStep(`retry-${this.retryCount}-commit`, () => {
        if (!this.submissionDock.isCurrentResetReceipt(dockResetReceipt) ||
          !this.scoreboard.isCurrentActiveProjectionReceipt(scoreboardActiveReceipt)) throw new Error('Retry reset projections are missing or stale.');
        resetMutationStarted = true;
        this.submissionDock.commitPreparedReset(dockResetReceipt); this.state.submittedBreadCount = 0; this.score.restore(this.baseline.score);
        this.state.setRemainingSeconds(this.config.stages[stage].timeScoring.timeLimitSeconds); this.wheatSource.beginAttempt();
        dockResetReceipt = null;
      }, () => { if (resetMutationStarted) this.restoreRetryResetSnapshot(resetSnapshot); }),
      returnCamera: this.createCurrentPlayerCameraReturnStep(`retry-${this.retryCount}-camera-return`, this.config.presentation.retryReturnSeconds),
      scoreboardEntrance: this.scoreboard.createActiveEntranceStep(stage,
        this.config.stages[stage].timeScoring.timeLimitSeconds, 0, this.config.presentation.timedStageEntranceSeconds,
        () => scoreboardActiveReceipt),
      admit: callbackStep(`retry-${this.retryCount}-admission`, () => {
        scoreboardActiveReceipt = null; this.state.setPhase({ kind: 'playing', stage });
      }),
    });
    this.presentation.finishCurrentAndPlay(plan, () => undefined, () => this.handleRetryPresentationFailure(stage));
  }

  private createModuleEffectResetStep(id: string): PresentationStep | null {
    if (!this.modules.some((module) => module.canResetIntroducedEffect)) return null;
    let transitions: ModuleEffectResetTransition[] = [];
    return Object.freeze({
      id,
      durationSeconds: this.config.presentation.moduleEffectResetSeconds,
      start: () => {
        transitions = [];
        for (const module of this.modules) {
          const transition = module.beginEffectResetTransition(this.config);
          if (transition !== null) transitions.push(transition);
        }
        if (transitions.length === 0) throw new Error('Module effect reset admission became stale.');
      },
      update: (progress) => { for (const transition of transitions) transition.update(progress); },
      finish: () => { for (const transition of transitions) transition.finish(); },
      cancel: () => {
        let firstError: unknown = null;
        for (let index = transitions.length - 1; index >= 0; index -= 1) {
          try { transitions[index]!.cancel(); } catch (error) { firstError ??= error; }
        }
        transitions = [];
        if (firstError !== null) throw firstError;
      },
    });
  }

  private configureStage(stage: CampaignStage, initial: boolean, captureBaseline = true, deferTimedAdmission = false): void {
    const previousStage = this.stage;
    this.stage = stage;
    const config = this.config.stages[stage];
    this.submissionDock.configureForStage(config.targetBreadCount); this.state.submittedBreadCount = 0;
    this.state.setRemainingSeconds(config.timeScoring.timeLimitSeconds);
    this.wheatSource.beginAttempt();
    for (const block of this.blocks) block.setVariant(config.processBlockVariant, config.enabledSocketCount);
    if (stage === 'stage0') {
      this.wheatSource.hideForStage0Reveal();
      this.blocks[0].hideForStage0Reveal(); this.blocks[1].hideForStage0Reveal(); this.submissionDock.hideForStage0Reveal();
      this.tutorial.reset();
    } else {
      this.wheatSource.showImmediately();
      for (const block of this.blocks) block.showImmediately();
      this.submissionDock.showImmediately(); this.tutorial.complete();
    }
    this.validateStageBaseline();
    this.rememberSafePlayerPose();
    if (deferTimedAdmission && stage !== 'stage0') { this.scoreboard.hide(); return; }
    this.scoreboard.showActive(stage, this.state.remainingSeconds, this.submissionDock.submittedBreadCount * config.scorePerBread);
    this.admitConfiguredStage(stage, initial || previousStage !== stage, !initial && captureBaseline);
  }
  private admitConfiguredStage(stage: CampaignStage, stageChanged: boolean, captureBaseline: boolean): void {
    if (this.stage !== stage || (stage !== 'stage0' &&
      this.state.remainingSeconds !== this.config.stages[stage].timeScoring.timeLimitSeconds)) {
      throw new Error(`${stage}: timed stage admission is stale.`);
    }
    this.state.setPhase({ kind: 'playing', stage }); this.configureTip(stage, stageChanged);
    if (captureBaseline) this.baseline = this.captureBaseline();
  }
  private createDeferredTimedStageConfigurationStep(nextStage: CampaignStage): PresentationStep {
    if (nextStage === 'stage0') throw new Error('Stage0 does not use deferred timed admission.');
    const previousStage = this.stage; const previousConfig = this.config.stages[previousStage];
    let started = false; let previousRemainingSeconds: number | null = null; let previousSubmitted = 0;
    let previousWheatTimer = 0; let previousWheatIssuance = 0;
    return callbackStep(`${nextStage}-stage-configuration`, () => {
      previousRemainingSeconds = this.state.remainingSeconds; previousSubmitted = this.submissionDock.submittedBreadCount;
      previousWheatTimer = this.wheatSource.readTimerSeconds(); previousWheatIssuance = this.wheatSource.readSuccessfulIssuanceCount();
      started = true; this.configureStage(nextStage, false, true, true);
    }, () => {
      if (!started) return;
      this.stage = previousStage; this.submissionDock.configureForStage(previousConfig.targetBreadCount);
      this.submissionDock.restoreSubmittedBreadCount(previousSubmitted); this.state.submittedBreadCount = previousSubmitted;
      this.state.setRemainingSeconds(previousRemainingSeconds); this.wheatSource.restoreTimerSeconds(previousWheatTimer);
      this.wheatSource.restoreSuccessfulIssuanceCount(previousWheatIssuance);
      for (const block of this.blocks) block.setVariant(previousConfig.processBlockVariant, previousConfig.enabledSocketCount);
      this.wheatSource.showImmediately(); for (const block of this.blocks) block.showImmediately(); this.submissionDock.showImmediately();
      this.tutorial.complete();
      this.scoreboard.hide(); started = false;
    });
  }
  private configureTip(stage: CampaignStage, stageChanged: boolean): void {
    if (stage === 'stage0') {
      if (stageChanged) this.tipPanel.clear();
      return;
    }
    const tips: Readonly<Record<Exclude<CampaignStage, 'stage0'>, Readonly<{ id: CampaignTipId; body: string }>>> = {
      stage1: { id: 'stage1', body: '빨리! 단어를 블록에 넣어 빠르게 만들 수 있습니다.' },
      stage2: { id: 'stage2', body: '두 배! 단어를 블록에 넣어 생산량을 두 배로 늘릴 수 있습니다.' },
      stage3: { id: 'stage3', body: '또! 단어를 넣어 같이 블록에 들어간 단어의 효과를 중첩시킬 수 있습니다.' },
    };
    const tip = tips[stage];
    this.tipPanel.publish(tip.id, tip.body);
  }
  private revealStage0Block(block: ProductionBlock): void {
    const step = block.createStage0RevealStep(this.config.presentation.stage0BlockRevealDropSeconds,
      this.config.presentation.stage0BlockRevealHeightMeters);
    if (step === null) return;
    if (!this.presentation.play([step], () => undefined, () => block.showImmediately())) block.showImmediately();
  }
  private revealStage0WheatSource(): void {
    const step = this.wheatSource.createStage0RevealStep(this.config.presentation.stage0PipeRevealSeconds,
      this.config.presentation.stage0PipeRevealStartScale);
    if (step === null) return;
    if (!this.presentation.play([step], () => undefined, () => this.wheatSource.showImmediately())) {
      this.wheatSource.showImmediately();
    }
  }
  private revealStage0SubmissionDock(): void {
    const step = this.submissionDock.createStage0RevealStep(this.config.presentation.stage0DockRevealSeconds,
      this.config.presentation.stage0DockRevealStartScale, this.config.presentation.stage0GoalBoardRiseMeters);
    if (step === null) return;
    if (!this.presentation.play([step], () => undefined, () => this.submissionDock.showImmediately())) {
      this.submissionDock.showImmediately();
    }
  }

  private captureBaseline(): StageAttemptBaseline {
    return Object.freeze({
      stage: this.stage,
      playerPosition: Object.freeze({ x: CAMPAIGN_PLAYER_SPAWN.position.x, z: CAMPAIGN_PLAYER_SPAWN.position.z }),
      playerFacing: CAMPAIGN_PLAYER_SPAWN.facing,
      score: this.score.snapshot(),
    });
  }
  private beginBlockManipulation(candidate: BlockManipulationCandidate): void {
    if (!this.isBlockManipulationCandidateCurrent(candidate)) return;
    const block = candidate.block;
    this.activeBlock = block; this.activeBlockContact = candidate.side;
    this.activeBlockPlayerOffsetX = candidate.playerX - candidate.blockX;
    this.activeBlockPlayerLaneZ = candidate.playerZ;
    this.carriedBlockStart = block.root.position.clone(); this.player.heldBlockId = block.id;
    blockNextPlayer.set(candidate.playerX, candidate.playerZ);
    blockFacingDirection.set(candidate.facingX, candidate.facingZ);
    this.player.beginBlockContact(blockNextPlayer, blockFacingDirection);
    this.activeBlockLastValidPlayerPosition.copy(this.player.position);
    this.activeBlockLastValidPlayerFacing.copy(this.player.facing);
    this.hasActiveBlockLastValidPlayerPose = true;
    this.rememberSafePlayerPose();
  }

  private selectBlockManipulationTarget(): BlockManipulationCandidate | null {
    if (this.player.heldMaterialIds.length > 0 || this.player.heldModule !== null || this.activeBlock !== null) return null;
    let selected: BlockManipulationCandidate | null = null;
    const contactDistance = this.config.movement.blockHalfExtentMeters + this.config.movement.playerRadiusMeters;
    for (const block of this.blocks) {
      if (!block.interactionAvailable || (this.stage === 'stage0' && !this.tutorial.allowsBlockCapture(block.id))) continue;
      for (const side of ['front', 'left', 'right'] as const) {
        const playerX = side === 'front'
          ? THREE.MathUtils.clamp(this.player.position.x, block.root.position.x - this.config.movement.blockHalfExtentMeters,
            block.root.position.x + this.config.movement.blockHalfExtentMeters)
          : block.root.position.x + (side === 'left' ? -contactDistance : contactDistance);
        const playerZ = side === 'front'
          ? block.root.position.z + contactDistance
          : THREE.MathUtils.clamp(this.player.position.y, block.root.position.z - this.config.movement.blockHalfExtentMeters,
            block.root.position.z + this.config.movement.blockHalfExtentMeters);
        blockCandidatePosition.set(playerX - this.player.position.x, playerZ - this.player.position.y);
        const distance = blockCandidatePosition.length();
        if (distance > BLOCK_CONTACT_ALLOWANCE_METERS + 1e-8) continue;
        const facingAngle = distance <= 1e-8 ? 0 : Math.acos(THREE.MathUtils.clamp(
          blockCandidatePosition.multiplyScalar(1 / distance).dot(this.player.facing), -1, 1));
        blockCandidatePosition.set(playerX, playerZ);
        if (!this.isPlayerPoseCollisionSafe(blockCandidatePosition)) continue;
        blockFacingDirection.set(block.root.position.x - playerX, block.root.position.z - playerZ).normalize();
        const candidate: BlockManipulationCandidate = Object.freeze({
          block, side, playerX, playerZ, facingX: blockFacingDirection.x, facingZ: blockFacingDirection.y,
          blockX: block.root.position.x, blockZ: block.root.position.z, distance, facingAngle,
        });
        if (selected === null || candidate.distance < selected.distance - 1e-8 ||
          (Math.abs(candidate.distance - selected.distance) <= 1e-8 && (candidate.facingAngle < selected.facingAngle - 1e-8 ||
            (Math.abs(candidate.facingAngle - selected.facingAngle) <= 1e-8 &&
              (candidate.block.id.localeCompare(selected.block.id) < 0 ||
                (candidate.block === selected.block && this.blockContactOrder(candidate.side) < this.blockContactOrder(selected.side))))))) selected = candidate;
      }
    }
    return selected;
  }

  private isBlockManipulationCandidateCurrent(candidate: BlockManipulationCandidate): boolean {
    if (this.activeBlock !== null || this.player.heldMaterialIds.length > 0 || this.player.heldModule !== null || !candidate.block.interactionAvailable) return false;
    if (this.stage === 'stage0' && !this.tutorial.allowsBlockCapture(candidate.block.id)) return false;
    if (Math.abs(candidate.block.root.position.x - candidate.blockX) > 1e-8 || Math.abs(candidate.block.root.position.z - candidate.blockZ) > 1e-8) return false;
    if (Math.hypot(candidate.playerX - this.player.position.x, candidate.playerZ - this.player.position.y) > BLOCK_CONTACT_ALLOWANCE_METERS + 1e-8) return false;
    blockCandidatePosition.set(candidate.playerX, candidate.playerZ);
    return this.isPlayerPoseCollisionSafe(blockCandidatePosition);
  }
  private blockContactOrder(contact: BlockManipulationCandidate['side']): number { return contact === 'front' ? 0 : contact === 'left' ? 1 : 2; }

  private resolveSelectedMaterial(): CampaignMaterial | null {
    const held = this.heldMaterials();
    const material = this.findNearestMaterialCandidate(held[0]?.type);
    const other = this.interaction.selected;
    if (material === null) return null;
    if (other === null || this.compareMaterialWithInteraction(material, other) <= 0) return material.material;
    return null;
  }
  private compareMaterialWithInteraction(material: MaterialInteractionCandidate, target: CampaignInteractionTarget): number {
    const epsilon = this.config.interaction.interactionDistanceTieEpsilonMeters;
    if (Math.abs(material.distance - target.distance) > epsilon) return material.distance - target.distance;
    const stableId = target.kind === 'socket' ? target.socket.block.id : target.module.id;
    const socketIndex = target.kind === 'socket' ? target.socket.index : target.kind === 'module' ? target.socket?.index ?? 0 : 0;
    return material.facingAngle - target.facingAngle || material.material.id.localeCompare(stableId) || -socketIndex;
  }

  private advanceBlockManipulation(inputX: number, deltaSeconds: number, tapX = 0): void {
    const block = this.activeBlock; if (block === null) return;
    let deltaX = tapX !== 0 ? tapX : Math.sign(inputX) * this.config.movement.blockMetersPerSecond * deltaSeconds;
    this.wheatSource.readCollisionBounds(this.collisionObstacles[0]!);
    this.submissionDock.readCollisionBounds(this.collisionObstacles[1]!);
    (this.blocks[0] === block ? this.blocks[1]! : this.blocks[0]!).readCollisionBounds(this.collisionObstacles[2]!);
    const worldModuleCount = this.readWorldModuleCollisionObstacles();
    deltaX = this.resolveCombinedBlockPlayerDelta(block, deltaX, this.collisionObstacles, 3,
      this.worldModuleCollisionObstacles, worldModuleCount);
    const terminalBlockX = block.root.position.x + deltaX; blockNextPlayer.set(terminalBlockX + this.activeBlockPlayerOffsetX, this.activeBlockPlayerLaneZ);
    const state = this.activeBlockContact === 'front' ? 'blockMoveFront' :
      (this.activeBlockContact === 'left') === (deltaX > 0) ? 'blockPush' : 'blockPull';
    blockFacingDirection.set(terminalBlockX - blockNextPlayer.x, block.root.position.z - blockNextPlayer.y).normalize();
    block.root.position.x = terminalBlockX;
    this.player.applyBlockMovement(blockNextPlayer, deltaX === 0 ? 'holding' : state, blockFacingDirection);
    if (this.isPlayerPoseCollisionSafe(this.player.position)) {
      this.activeBlockLastValidPlayerPosition.copy(this.player.position); this.activeBlockLastValidPlayerFacing.copy(this.player.facing);
      this.hasActiveBlockLastValidPlayerPose = true; this.rememberSafePlayerPose();
    }
  }

  private readWorldModuleCollisionObstacles(): number {
    const half = this.config.interaction.floorModuleHalfExtentMeters;
    let count = 0;
    for (const module of this.modules) {
      if (module.location.kind !== 'world') continue;
      module.root.getWorldPosition(moduleCollisionWorldPosition);
      const target = this.worldModuleCollisionObstacles[count++]!;
      target.minX = moduleCollisionWorldPosition.x - half; target.maxX = moduleCollisionWorldPosition.x + half;
      target.minZ = moduleCollisionWorldPosition.z - half; target.maxZ = moduleCollisionWorldPosition.z + half;
    }
    return count;
  }

  private resolveCombinedBlockPlayerDelta(block: ProductionBlock, requestedDeltaX: number,
    obstacles: readonly CampaignCollisionBounds[], obstacleCount: number,
    blockOnlyObstacles: readonly CampaignCollisionBounds[], blockOnlyObstacleCount: number): number {
    const half = this.config.movement.blockHalfExtentMeters; const radius = this.config.movement.playerRadiusMeters;
    let deltaX = resolveEscapeAwareBoundsDelta(block.root.position.x, requestedDeltaX,
      this.map.bounds.minX + half, this.map.bounds.maxX - half);
    deltaX = resolveEscapeAwareBoundsDelta(this.player.position.x, deltaX,
      this.map.bounds.minX + radius, this.map.bounds.maxX - radius);
    for (let index = 0; index < obstacleCount; index += 1) {
      const obstacle = obstacles[index]!;
      if (block.root.position.z + half > obstacle.minZ + CAMPAIGN_COLLISION_EPSILON_METERS &&
        block.root.position.z - half < obstacle.maxZ - CAMPAIGN_COLLISION_EPSILON_METERS) {
        deltaX = resolveEscapeAwareAxisDelta(block.root.position.x, deltaX, obstacle.minX - half, obstacle.maxX + half);
      }
      if (this.player.position.y > obstacle.minZ - radius + CAMPAIGN_COLLISION_EPSILON_METERS &&
        this.player.position.y < obstacle.maxZ + radius - CAMPAIGN_COLLISION_EPSILON_METERS) {
        deltaX = resolveEscapeAwareAxisDelta(this.player.position.x, deltaX, obstacle.minX - radius, obstacle.maxX + radius);
      }
    }
    for (let index = 0; index < blockOnlyObstacleCount; index += 1) {
      const obstacle = blockOnlyObstacles[index]!;
      if (block.root.position.z + half > obstacle.minZ + CAMPAIGN_COLLISION_EPSILON_METERS &&
        block.root.position.z - half < obstacle.maxZ - CAMPAIGN_COLLISION_EPSILON_METERS) {
        deltaX = resolveEscapeAwareAxisDelta(block.root.position.x, deltaX, obstacle.minX - half, obstacle.maxX + half);
      }
    }
    return Math.abs(deltaX) <= 1e-8 ? 0 : deltaX;
  }

  private endBlockManipulation(observeTutorialRelease = false): void {
    const block = this.activeBlock; if (block === null) return;
    if (observeTutorialRelease && this.stage === 'stage0' && this.carriedBlockStart !== null && block.root.position.distanceTo(this.carriedBlockStart) > 1e-6) this.tutorial.observe({ kind: 'block-moved', blockId: block.id });
    if (!this.isPlayerPoseCollisionSafe(this.player.position) && this.hasActiveBlockLastValidPlayerPose) {
      this.player.restorePose(this.activeBlockLastValidPlayerPosition, this.activeBlockLastValidPlayerFacing);
    }
    this.activeBlock = null; this.player.heldBlockId = null; this.carriedBlockStart = null;
    this.activeBlockPlayerLaneZ = 0; this.activeBlockPlayerOffsetX = 0; this.activeBlockContact = 'front';
    this.hasActiveBlockLastValidPlayerPose = false;
    this.player.stop();
  }
  private validateStageBaseline(): void {
    const radius = this.config.movement.playerRadiusMeters;
    if (this.player.position.x < this.map.bounds.minX + radius || this.player.position.x > this.map.bounds.maxX - radius ||
      this.player.position.y < this.map.bounds.minZ + radius || this.player.position.y > this.map.bounds.maxZ - radius) throw new Error(`${this.stage}: invalid player baseline.`);
    const half = this.config.movement.blockHalfExtentMeters;
    for (const block of this.blocks) {
      if (block.root.position.x - half < this.map.bounds.minX || block.root.position.x + half > this.map.bounds.maxX ||
        block.root.position.z - half < this.map.bounds.minZ || block.root.position.z + half > this.map.bounds.maxZ) throw new Error(`${this.stage}: invalid block baseline.`);
    }
    if (Math.abs(this.blocks[0]!.root.position.x - this.blocks[1]!.root.position.x) < half * 2 &&
      Math.abs(this.blocks[0]!.root.position.z - this.blocks[1]!.root.position.z) < half * 2) throw new Error(`${this.stage}: overlapping block baseline.`);
    this.readCollisionObstacles();
    for (const obstacle of this.collisionObstacles) if (this.player.position.x > obstacle.minX - radius && this.player.position.x < obstacle.maxX + radius &&
      this.player.position.y > obstacle.minZ - radius && this.player.position.y < obstacle.maxZ + radius) throw new Error(`${this.stage}: obstructed player baseline.`);
  }
  private module(type: ModuleType): Module { return this.modules.find((module) => module.type === type)!; }
  private renderRuntimeState(): void {
    if (this.state.phase.kind === 'playing') this.scoreboard.showActive(this.stage, this.state.remainingSeconds,
      this.submissionDock.submittedBreadCount * this.config.stages[this.stage].scorePerBread);
    const data = this.options.canvas.dataset;
    data.campaignPhase = this.state.phase.kind;
    data.campaignStage = this.stage;
    data.playerX = this.player.position.x.toFixed(3);
    data.playerZ = this.player.position.y.toFixed(3);
    data.heldMaterials = this.player.heldMaterialIds.join(',');
    data.heldModule = this.player.heldModule?.id ?? '';
    data.heldBlock = this.player.heldBlockId ?? '';
    data.materials = String(this.materials.size);
    data.submitted = String(this.submissionDock.submittedBreadCount);
    data.retryCount = String(this.retryCount);
    data.inputCount = String(this.inputCount);
  }
  private updateCamera(): void {
    if (this.state.phase.kind !== 'playing') return;
    const target = this.readFollowCameraCenterX(this.player.position.x);
    const factor = this.lastDeltaSeconds <= 0 ? 0 : 1 - Math.exp(-this.lastDeltaSeconds / this.config.camera.smoothingSeconds);
    this.cameraCenterX = THREE.MathUtils.lerp(this.cameraCenterX, target, factor);
    this.options.camera.position.set(this.cameraCenterX + this.config.camera.offsetX, this.config.camera.offsetY, this.config.camera.offsetZ);
    this.options.camera.lookAt(this.cameraCenterX, this.config.camera.lookAtY, 0);
  }
  private readFollowCameraCenterX(playerX: number): number {
    const dead = this.config.camera.deadZoneHalfWidth;
    let target = this.cameraCenterX;
    if (playerX < target - dead) target = playerX + dead;
    else if (playerX > target + dead) target = playerX - dead;
    return THREE.MathUtils.clamp(target, this.config.camera.centerXMin, this.config.camera.centerXMax);
  }
  private restartDocument(): void {
    if (this.state.phase.kind !== 'final-score') return;
    this.state.setPhase({ kind: 'restarting' }); this.state.publish({ type: 'restart-requested', source: 'pointer' });
    this.input.clear(); this.heldMaterialPickupCooldownSeconds = 0; this.options.window.location.reload();
  }
  private retirePlayingInteractionTransaction(): void {
    this.endBlockManipulation();
    this.input.clear();
    this.heldMaterialPickupCooldownSeconds = 0;
    this.selectedAction = null;
    this.interaction.clearTarget();
    this.interactionKeycap.hide();
  }
  private handlePresentationFailure(): void {
    this.input.clear(); this.heldMaterialPickupCooldownSeconds = 0; this.interactionKeycap.hide(); this.scoreboard.hide();
    this.options.canvas.dataset.presentationFailure = this.presentation.lastFailure?.stepId ?? 'presentation-owner';
  }
  private handleRetryPresentationFailure(stage: TimedCampaignStage): void {
    this.handlePresentationFailure(); this.state.setPhase({ kind: 'game-over', stage }); this.gameOver.show();
  }
  private captureRetryBaselineProjectionSnapshot(): RetryBaselineProjectionSnapshot {
    return Object.freeze({
      playerPosition: Object.freeze({ x: this.player.position.x, z: this.player.position.y }),
      playerFacing: Object.freeze({ x: this.player.facing.x, z: this.player.facing.y }),
      cameraCenterX: this.cameraCenterX,
      block: this.activeBlock,
      contact: this.activeBlockContact,
      playerLaneZ: this.activeBlockPlayerLaneZ,
      playerOffsetX: this.activeBlockPlayerOffsetX,
      lastValidPlayerPosition: Object.freeze({ x: this.activeBlockLastValidPlayerPosition.x, z: this.activeBlockLastValidPlayerPosition.y }),
      lastValidPlayerFacing: Object.freeze({ x: this.activeBlockLastValidPlayerFacing.x, z: this.activeBlockLastValidPlayerFacing.y }),
      hasLastValidPlayerPose: this.hasActiveBlockLastValidPlayerPose,
      carriedBlockStart: this.carriedBlockStart?.clone() ?? null,
    });
  }
  private restoreRetryBaselineProjectionSnapshot(snapshot: RetryBaselineProjectionSnapshot): void {
    this.player.reset(snapshot.playerPosition, snapshot.playerFacing); this.cameraCenterX = snapshot.cameraCenterX;
    this.activeBlock = snapshot.block; this.activeBlockContact = snapshot.contact; this.activeBlockPlayerLaneZ = snapshot.playerLaneZ;
    this.activeBlockPlayerOffsetX = snapshot.playerOffsetX;
    this.activeBlockLastValidPlayerPosition.set(snapshot.lastValidPlayerPosition.x, snapshot.lastValidPlayerPosition.z);
    this.activeBlockLastValidPlayerFacing.set(snapshot.lastValidPlayerFacing.x, snapshot.lastValidPlayerFacing.z);
    this.hasActiveBlockLastValidPlayerPose = snapshot.hasLastValidPlayerPose;
    this.carriedBlockStart = snapshot.carriedBlockStart?.clone() ?? null; this.player.heldBlockId = snapshot.block?.id ?? null;
  }
  private createCurrentPlayerCameraReturnStep(id: string, durationSeconds: number): PresentationStep {
    let owned: PresentationStep | null = null;
    let terminalCenterX = this.cameraCenterX;
    const terminalPosition = new THREE.Vector3();
    const terminalLookAt = new THREE.Vector3();
    return Object.freeze({
      id, durationSeconds,
      start: () => {
        terminalCenterX = this.readFollowCameraCenterX(this.player.position.x);
        terminalPosition.set(terminalCenterX + this.config.camera.offsetX, this.config.camera.offsetY, this.config.camera.offsetZ);
        terminalLookAt.set(terminalCenterX, this.config.camera.lookAtY, 0);
        owned = moveCamera(id, this.options.camera,
          terminalPosition, terminalLookAt, durationSeconds, this.config.camera.far);
        owned.start?.();
      },
      update: (progress) => owned?.update?.(progress),
      finish: () => {
        owned?.finish?.();
        this.cameraCenterX = terminalCenterX;
        this.options.camera.position.copy(terminalPosition);
        this.options.camera.lookAt(terminalLookAt);
        this.options.camera.far = this.config.camera.far;
        this.options.camera.updateProjectionMatrix();
      },
      cancel: () => owned?.cancel?.(),
    });
  }
  private captureRetryResetSnapshot(): RetryResetSnapshot {
    return Object.freeze({
      modules: Object.freeze(this.modules.map((module) => Object.freeze({ module, fuelSeconds: module.fuelSeconds,
        recoverySeconds: module.recoverySeconds, chargeSeconds: module.chargeSeconds, activeSeconds: module.activeSeconds,
        presentation: module.capturePresentationSnapshot() }))),
      submittedBreadCount: this.submissionDock.submittedBreadCount,
      stateSubmittedBreadCount: this.state.submittedBreadCount,
      score: this.score.snapshot(), remainingSeconds: this.state.remainingSeconds,
      wheatTimerSeconds: this.wheatSource.readTimerSeconds(),
      wheatSuccessfulIssuanceCount: this.wheatSource.readSuccessfulIssuanceCount(),
    });
  }
  private restoreRetryResetSnapshot(snapshot: RetryResetSnapshot): void {
    if (snapshot.modules.some((saved) => !saved.module.canRestorePresentationSnapshot(saved.presentation))) {
      throw new Error('Retry Module presentation snapshots are stale or foreign.');
    }
    for (const saved of snapshot.modules) {
      saved.module.fuelSeconds = saved.fuelSeconds; saved.module.recoverySeconds = saved.recoverySeconds;
      saved.module.chargeSeconds = saved.chargeSeconds; saved.module.activeSeconds = saved.activeSeconds;
    }
    let presentationRestoreError: unknown = null;
    for (const saved of snapshot.modules) {
      try {
        if (!saved.module.restorePresentationSnapshot(saved.presentation)) throw new Error('Retry Module presentation restore rejected.');
      } catch (error) { presentationRestoreError ??= error; }
    }
    if (presentationRestoreError !== null) throw presentationRestoreError;
    try { this.submissionDock.restoreSubmittedBreadCount(snapshot.submittedBreadCount); }
    catch { this.submissionDock.submittedBreadCount = snapshot.submittedBreadCount; }
    this.state.submittedBreadCount = snapshot.stateSubmittedBreadCount; this.score.restore(snapshot.score);
    this.state.setRemainingSeconds(snapshot.remainingSeconds); this.wheatSource.restoreTimerSeconds(snapshot.wheatTimerSeconds);
    this.wheatSource.restoreSuccessfulIssuanceCount(snapshot.wheatSuccessfulIssuanceCount);
    this.scoreboard.hide();
  }
}
