export type CampaignStage = 'stage0' | 'stage1' | 'stage2' | 'stage3';
export type ModuleType = 'fast' | 'double' | 'again';

export type StageTimeScoring = Readonly<{
  timeLimitSeconds: null;
  scorePerRemainingSecond: 0;
}> | Readonly<{
  timeLimitSeconds: number;
  scorePerRemainingSecond: number;
}>;

export interface CampaignStageConfig {
  readonly stage: CampaignStage;
  readonly targetBreadCount: number;
  readonly timeScoring: StageTimeScoring;
  readonly wheatSpawnIntervalSeconds: number;
  readonly maxActiveWheatCount: number;
  readonly wheatSpawnBudgetPerAttempt: number | null;
  readonly millProcessSeconds: number;
  readonly heaterProcessSeconds: number;
  readonly productionCapacity: number;
  readonly scorePerBread: number;
  readonly processBlockVariant: 'socketless' | 'single-socket' | 'double-socket';
  readonly enabledSocketCount: 0 | 1 | 2;
  readonly revealModuleAfterClear: ModuleType | null;
}

export interface CampaignPresentationTiming {
  readonly clearSeconds: number;
  readonly retrySeconds: number;
  readonly moduleDropSeconds: number;
  readonly moduleEffectResetSeconds: number;
  readonly moduleInsertSeconds: number;
  readonly moduleAttachApproachSeconds: number;
  readonly moduleAttachFlipSeconds: number;
  readonly moduleAttachInsertSeconds: number;
  readonly moduleAttachContactSeconds: number;
  readonly againAttachApproachSeconds: number;
  readonly againAttachInsertSeconds: number;
  readonly againAttachSettleSeconds: number;
  readonly wideEnterSeconds: number;
  readonly clearReturnSeconds: number;
  readonly retryReturnSeconds: number;
  readonly scoreCountSeconds: number;
  readonly scoreHoldSeconds: number;
  readonly timedStageEntranceSeconds: number;
  readonly blockTurnSeconds: number;
  readonly blockTurnAccelerationSeconds: number;
  readonly blockTurnCruiseSeconds: number;
  readonly blockTurnDecelerationSeconds: number;
  readonly blockVisualSwapSeconds: number;
  readonly stage0BlockRevealDropSeconds: number;
  readonly stage0BlockRevealHeightMeters: number;
  readonly stage0DockRevealSeconds: number;
  readonly stage0DockRevealStartScale: number;
  readonly stage0GoalBoardRiseMeters: number;
  readonly stage0PipeRevealSeconds: number;
  readonly stage0PipeRevealStartScale: number;
  readonly doubleActiveFeedback: Readonly<{
    glowEmissiveIntensity: number;
    fadeInSeconds: number;
    fadeOutSeconds: number;
    pointLightIntensity: number;
    pointLightDistanceMeters: number;
    shakeIntervalSeconds: number;
    shakeDurationSeconds: number;
    shakeAngleDegrees: number;
  }>;
}

export interface CampaignInteractionConfig {
  readonly interactionRadiusMeters: number;
  readonly interactionDistanceTieEpsilonMeters: number;
  readonly moduleSurfaceRadiusMeters: number;
  readonly floorModuleHalfExtentMeters: number;
  readonly heldMaterialCapacity: number;
  readonly heldMaterialPickupIntervalSeconds: number;
  readonly automaticIntakeRadiusMeters: number;
}

export interface CampaignModuleRevealConfig {
  readonly forwardDistanceMeters: number;
  readonly sideOffsetMeters: number;
  readonly minimumSeparationMeters: number;
}

export interface CampaignConfig {
  readonly stages: Readonly<Record<CampaignStage, CampaignStageConfig>>;
  readonly modules: Readonly<{
    fast: Readonly<{ processingSpeedMultiplier: number; maxFuelSeconds: number; recoverySeconds: number; fullFuelColor: string; emptyFuelColor: string }>;
    double: Readonly<{ chargeSeconds: number; activeSeconds: number; outputMultiplier: number; bodyColor: string }>;
    again: Readonly<{ fastReapplicationCount: number; doubleOutputMultiplier: number; baseColor: string; colorTransitionSeconds: number }>;
  }>;
  readonly interaction: CampaignInteractionConfig;
  readonly presentation: CampaignPresentationTiming;
  readonly moduleReveal: CampaignModuleRevealConfig;
  readonly movement: Readonly<{
    playerRadiusMeters: number; walkMetersPerSecond: number; runMetersPerSecond: number;
    blockMetersPerSecond: number; tapMaximumMilliseconds: number; tapMinimumDistanceMeters: number;
    blockHalfExtentMeters: number; blockCarryDistanceMeters: number;
    ordinaryCycleDistanceMeters: number; blockCycleDistanceMeters: number;
  }>;
  readonly materialPresentation: Readonly<{
    wheatRuntimeScale: number; flourRuntimeScale: number; breadRuntimeScale: number;
    wheatSpawnSeconds: number; wheatOutletHeight: number; wheatMouthForwardOffset: number; wheatInitialBurstDistance: number;
    outputSourceHoldSeconds: number; outputDepartureSeconds: number; outputFlightSeconds: number;
    outputContactSeconds: number; outputSettleSeconds: number; outputSeconds: number;
    heldTransferSeconds: number;
    footprintRadiusMeters: Readonly<Record<'wheat' | 'flour' | 'bread', number>>;
  }>;
  readonly camera: Readonly<{
    fovDegrees: number; near: number; far: number; lookAtY: number; horizontalYawDegrees: number;
    offsetX: number; offsetY: number; offsetZ: number; deadZoneHalfWidth: number; smoothingSeconds: number;
    centerXMin: number; centerXMax: number;
  }>;
}

const stage = (
  id: CampaignStage,
  targetBreadCount: number,
  timeLimitSeconds: number | null,
  processBlockVariant: CampaignStageConfig['processBlockVariant'],
  enabledSocketCount: 0 | 1 | 2,
  revealModuleAfterClear: ModuleType | null,
  wheatSpawnBudgetPerAttempt: number | null = null,
): CampaignStageConfig => Object.freeze({
  stage: id,
  targetBreadCount,
  timeScoring: timeLimitSeconds === null
    ? Object.freeze({ timeLimitSeconds: null, scorePerRemainingSecond: 0 as const })
    : Object.freeze({ timeLimitSeconds, scorePerRemainingSecond: 10 }),
  wheatSpawnIntervalSeconds: 1.5,
  maxActiveWheatCount: 30,
  wheatSpawnBudgetPerAttempt,
  millProcessSeconds: 2.4,
  heaterProcessSeconds: 1.65,
  productionCapacity: 5,
  scorePerBread: 100,
  processBlockVariant,
  enabledSocketCount,
  revealModuleAfterClear,
});

export const CAMPAIGN_CONFIG: CampaignConfig = Object.freeze({
  stages: Object.freeze({
    stage0: stage('stage0', 1, null, 'socketless', 0, 'fast', 1),
    stage1: stage('stage1', 5, 50, 'single-socket', 1, 'double'),
    stage2: stage('stage2', 10, 60, 'double-socket', 2, 'again'),
    stage3: stage('stage3', 40, 90, 'double-socket', 2, null),
  }),
  modules: Object.freeze({
    fast: Object.freeze({ processingSpeedMultiplier: 1.8, maxFuelSeconds: 8, recoverySeconds: 6, fullFuelColor: '#e0a43a', emptyFuelColor: '#c9473a' }),
    double: Object.freeze({ chargeSeconds: 9, activeSeconds: 4.5, outputMultiplier: 2, bodyColor: '#39d9e8' }),
    again: Object.freeze({ fastReapplicationCount: 1, doubleOutputMultiplier: 2, baseColor: '#8f969d', colorTransitionSeconds: 0.24 }),
  }),
  interaction: Object.freeze({
    interactionRadiusMeters: 1.75,
    interactionDistanceTieEpsilonMeters: 0.05,
    moduleSurfaceRadiusMeters: 0.34,
    floorModuleHalfExtentMeters: 0.34,
    heldMaterialCapacity: 5,
    heldMaterialPickupIntervalSeconds: 0.18,
    automaticIntakeRadiusMeters: 2.25,
  }),
  presentation: Object.freeze({
    clearSeconds: 3.8,
    retrySeconds: 1.4,
    moduleDropSeconds: 0.88,
    moduleEffectResetSeconds: 0.45,
    moduleInsertSeconds: 0.84,
    moduleAttachApproachSeconds: 0.34,
    moduleAttachFlipSeconds: 0.18,
    moduleAttachInsertSeconds: 0.18,
    moduleAttachContactSeconds: 0.14,
    againAttachApproachSeconds: 0.28,
    againAttachInsertSeconds: 0.20,
    againAttachSettleSeconds: 0.12,
    wideEnterSeconds: 0.56,
    clearReturnSeconds: 0.62,
    retryReturnSeconds: 0.68,
    scoreCountSeconds: 1.26,
    scoreHoldSeconds: 0.62,
    timedStageEntranceSeconds: 0.28,
    blockTurnSeconds: 0.88,
    blockTurnAccelerationSeconds: 0.14,
    blockTurnCruiseSeconds: 0.20,
    blockTurnDecelerationSeconds: 0.54,
    blockVisualSwapSeconds: 0.34,
    stage0BlockRevealDropSeconds: 0.70,
    stage0BlockRevealHeightMeters: 5,
    stage0DockRevealSeconds: 0.50,
    stage0DockRevealStartScale: 0.62,
    stage0GoalBoardRiseMeters: 0.65,
    stage0PipeRevealSeconds: 0.42,
    stage0PipeRevealStartScale: 0.92,
    doubleActiveFeedback: Object.freeze({
      glowEmissiveIntensity: 0.85,
      fadeInSeconds: 0.2,
      fadeOutSeconds: 0.2,
      pointLightIntensity: 1,
      pointLightDistanceMeters: 2,
      shakeIntervalSeconds: 0.5,
      shakeDurationSeconds: 0.14,
      shakeAngleDegrees: 5,
    }),
  }),
  moduleReveal: Object.freeze({
    forwardDistanceMeters: 2.1,
    sideOffsetMeters: 0.85,
    minimumSeparationMeters: 1.15,
  }),
  movement: Object.freeze({
    playerRadiusMeters: 0.38, walkMetersPerSecond: 3.4, runMetersPerSecond: 5.1, blockMetersPerSecond: 3.4,
    tapMaximumMilliseconds: 120, tapMinimumDistanceMeters: 0.18,
    blockHalfExtentMeters: 1.1, blockCarryDistanceMeters: 2,
    ordinaryCycleDistanceMeters: 2, blockCycleDistanceMeters: 1.6,
  }),
  materialPresentation: Object.freeze({
    wheatRuntimeScale: 0.72, flourRuntimeScale: 1.69728, breadRuntimeScale: 2.2848,
    wheatSpawnSeconds: 0.55, wheatOutletHeight: 1.12, wheatMouthForwardOffset: 0.06, wheatInitialBurstDistance: 0.04,
    outputSourceHoldSeconds: 0.04, outputDepartureSeconds: 0.08, outputFlightSeconds: 0.16,
    outputContactSeconds: 0.06, outputSettleSeconds: 0.08,
    outputSeconds: 0.42,
    heldTransferSeconds: 0.18,
    footprintRadiusMeters: Object.freeze({ wheat: 0.17496328353881835, flour: 0.161007431285376, bread: 0.2513279986381531 }),
  }),
  camera: Object.freeze({
    fovDegrees: 21, near: 0.1, far: 100, lookAtY: 0.8, horizontalYawDegrees: 10,
    offsetX: 3.9987, offsetY: 10.6389, offsetZ: 22.6755,
    deadZoneHalfWidth: 2.2, smoothingSeconds: 0.12, centerXMin: -8.85, centerXMax: 8.85,
  }),
});

export const CAMPAIGN_STAGE_ORDER: readonly CampaignStage[] = Object.freeze([
  'stage0', 'stage1', 'stage2', 'stage3',
]);

export function nextCampaignStage(stage: CampaignStage): CampaignStage | null {
  const next = CAMPAIGN_STAGE_ORDER[CAMPAIGN_STAGE_ORDER.indexOf(stage) + 1];
  return next ?? null;
}

export function validateCampaignConfig(config: CampaignConfig): void {
  for (const stageId of CAMPAIGN_STAGE_ORDER) {
    const value = config.stages[stageId];
    const positives = [value.targetBreadCount, value.wheatSpawnIntervalSeconds, value.maxActiveWheatCount,
      value.millProcessSeconds, value.heaterProcessSeconds, value.productionCapacity, value.scorePerBread];
    if (value.stage !== stageId || positives.some((number) => !Number.isFinite(number) || number <= 0)) throw new Error(`Invalid campaign config: ${stageId}`);
    if (value.wheatSpawnBudgetPerAttempt !== null && (!Number.isInteger(value.wheatSpawnBudgetPerAttempt) || value.wheatSpawnBudgetPerAttempt <= 0)) {
      throw new Error(`Invalid campaign wheat spawn budget: ${stageId}`);
    }
    if (value.timeScoring.timeLimitSeconds !== null && (!Number.isFinite(value.timeScoring.timeLimitSeconds) || value.timeScoring.timeLimitSeconds <= 0)) {
      throw new Error(`Invalid campaign timer: ${stageId}`);
    }
  }
  const positives = [config.modules.fast.processingSpeedMultiplier, config.modules.fast.maxFuelSeconds,
    config.modules.fast.recoverySeconds, config.modules.double.chargeSeconds, config.modules.double.activeSeconds,
    config.modules.double.outputMultiplier, config.modules.again.doubleOutputMultiplier, config.modules.again.colorTransitionSeconds,
    config.interaction.interactionRadiusMeters, config.interaction.moduleSurfaceRadiusMeters,
    config.interaction.floorModuleHalfExtentMeters, config.interaction.heldMaterialCapacity,
    config.interaction.heldMaterialPickupIntervalSeconds,
    config.interaction.automaticIntakeRadiusMeters, config.presentation.clearSeconds,
    config.presentation.retrySeconds, config.presentation.moduleDropSeconds, config.presentation.moduleEffectResetSeconds,
    config.presentation.moduleInsertSeconds,
    config.presentation.moduleAttachApproachSeconds, config.presentation.moduleAttachFlipSeconds,
    config.presentation.moduleAttachInsertSeconds, config.presentation.moduleAttachContactSeconds,
    config.presentation.againAttachApproachSeconds, config.presentation.againAttachInsertSeconds,
    config.presentation.againAttachSettleSeconds,
    config.presentation.wideEnterSeconds, config.presentation.clearReturnSeconds, config.presentation.retryReturnSeconds,
    config.presentation.scoreCountSeconds, config.presentation.scoreHoldSeconds, config.presentation.timedStageEntranceSeconds,
    config.presentation.blockTurnSeconds,
    config.presentation.blockTurnAccelerationSeconds, config.presentation.blockTurnCruiseSeconds,
    config.presentation.blockTurnDecelerationSeconds, config.presentation.blockVisualSwapSeconds,
    config.presentation.doubleActiveFeedback.glowEmissiveIntensity,
    config.presentation.stage0BlockRevealDropSeconds, config.presentation.stage0BlockRevealHeightMeters,
    config.presentation.stage0DockRevealSeconds, config.presentation.stage0DockRevealStartScale,
    config.presentation.stage0GoalBoardRiseMeters,
    config.presentation.stage0PipeRevealSeconds, config.presentation.stage0PipeRevealStartScale,
    config.presentation.doubleActiveFeedback.fadeInSeconds, config.presentation.doubleActiveFeedback.fadeOutSeconds,
    config.presentation.doubleActiveFeedback.pointLightIntensity, config.presentation.doubleActiveFeedback.pointLightDistanceMeters,
    config.presentation.doubleActiveFeedback.shakeIntervalSeconds,
    config.presentation.doubleActiveFeedback.shakeDurationSeconds,
    config.presentation.doubleActiveFeedback.shakeAngleDegrees,
    config.moduleReveal.forwardDistanceMeters, config.moduleReveal.sideOffsetMeters,
    config.moduleReveal.minimumSeparationMeters, config.movement.playerRadiusMeters, config.movement.walkMetersPerSecond,
    config.movement.runMetersPerSecond, config.movement.blockMetersPerSecond, config.movement.tapMaximumMilliseconds,
    config.movement.tapMinimumDistanceMeters, config.movement.blockHalfExtentMeters, config.movement.blockCarryDistanceMeters,
    config.movement.ordinaryCycleDistanceMeters, config.movement.blockCycleDistanceMeters, config.materialPresentation.wheatRuntimeScale,
    config.materialPresentation.flourRuntimeScale, config.materialPresentation.breadRuntimeScale,
    config.materialPresentation.wheatSpawnSeconds, config.materialPresentation.wheatOutletHeight,
    config.materialPresentation.wheatMouthForwardOffset, config.materialPresentation.wheatInitialBurstDistance,
    config.materialPresentation.outputSourceHoldSeconds, config.materialPresentation.outputDepartureSeconds,
    config.materialPresentation.outputFlightSeconds, config.materialPresentation.outputContactSeconds,
    config.materialPresentation.outputSettleSeconds, config.materialPresentation.outputSeconds,
    config.materialPresentation.heldTransferSeconds,
    ...Object.values(config.materialPresentation.footprintRadiusMeters), config.camera.fovDegrees, config.camera.near, config.camera.far,
    config.camera.offsetY, config.camera.offsetZ, config.camera.deadZoneHalfWidth, config.camera.smoothingSeconds];
  if (positives.some((number) => !Number.isFinite(number) || number <= 0) ||
    !Number.isFinite(config.interaction.interactionDistanceTieEpsilonMeters) || config.interaction.interactionDistanceTieEpsilonMeters < 0 ||
    config.presentation.stage0DockRevealStartScale >= 1 || config.presentation.stage0PipeRevealStartScale >= 1) {
    throw new Error('Invalid shared campaign config.');
  }
  for (const color of [config.modules.fast.fullFuelColor, config.modules.fast.emptyFuelColor,
    config.modules.double.bodyColor, config.modules.again.baseColor]) if (!/^#[0-9a-f]{6}$/iu.test(color)) throw new Error('Invalid campaign module color.');
  if (Math.abs(config.presentation.blockTurnAccelerationSeconds + config.presentation.blockTurnCruiseSeconds +
    config.presentation.blockTurnDecelerationSeconds - config.presentation.blockTurnSeconds) > 1e-8 ||
    config.presentation.blockVisualSwapSeconds >= config.presentation.blockTurnSeconds ||
    config.presentation.doubleActiveFeedback.shakeDurationSeconds >= config.presentation.doubleActiveFeedback.shakeIntervalSeconds) {
    throw new Error('Invalid block turn or module feedback timing config.');
  }
  if (Math.abs(config.presentation.moduleAttachApproachSeconds + config.presentation.moduleAttachFlipSeconds +
    config.presentation.moduleAttachInsertSeconds + config.presentation.moduleAttachContactSeconds - config.presentation.moduleInsertSeconds) > 1e-8 ||
    Math.abs(config.presentation.againAttachApproachSeconds + config.presentation.againAttachInsertSeconds +
      config.presentation.againAttachSettleSeconds - 0.6) > 1e-8 ||
    Math.abs(config.materialPresentation.outputSourceHoldSeconds + config.materialPresentation.outputDepartureSeconds +
      config.materialPresentation.outputFlightSeconds + config.materialPresentation.outputContactSeconds +
      config.materialPresentation.outputSettleSeconds - config.materialPresentation.outputSeconds) > 1e-8) throw new Error('Invalid authored presentation phase timing.');
  const authoredYaw = Math.atan2(config.camera.offsetX, config.camera.offsetZ) * 180 / Math.PI;
  if (![config.camera.lookAtY, config.camera.horizontalYawDegrees, config.camera.offsetX,
    config.camera.centerXMin, config.camera.centerXMax].every(Number.isFinite) ||
    Math.abs(authoredYaw - config.camera.horizontalYawDegrees) > 0.02 || config.camera.near >= config.camera.far ||
    config.camera.centerXMin >= config.camera.centerXMax) throw new Error('Invalid campaign camera contract.');
}
