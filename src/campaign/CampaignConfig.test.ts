import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAMPAIGN_CONFIG } from './CampaignConfig';
import type { CampaignGameOptions } from './CampaignGame';

describe('CAMPAIGN_CONFIG', () => {
  it('does not expose a custom runtime config injection contract', () => {
    const options = {} as CampaignGameOptions;
    // @ts-expect-error Production supports only the immutable CAMPAIGN_CONFIG authority.
    expect(options.config).toBeUndefined();
  });
  it('supplies the confirmed goals, timers, and wheat cadence from one object', () => {
    expect(Object.values(CAMPAIGN_CONFIG.stages).map((stage) => stage.wheatSpawnIntervalSeconds)).toEqual([1.5, 1.5, 1.5, 1.5]);
    expect(Object.values(CAMPAIGN_CONFIG.stages).map((stage) => stage.wheatSpawnBudgetPerAttempt)).toEqual([1, null, null, null]);
    expect(CAMPAIGN_CONFIG.stages.stage1.targetBreadCount).toBe(5);
    expect(CAMPAIGN_CONFIG.stages.stage1.timeScoring.timeLimitSeconds).toBe(50);
    expect(CAMPAIGN_CONFIG.stages.stage2.targetBreadCount).toBe(10);
    expect(CAMPAIGN_CONFIG.stages.stage2.timeScoring.timeLimitSeconds).toBe(60);
    expect(CAMPAIGN_CONFIG.stages.stage3.targetBreadCount).toBe(40);
    expect(CAMPAIGN_CONFIG.stages.stage3.timeScoring.timeLimitSeconds).toBe(90);
  });

  it('progresses from zero to one to two stable sockets', () => {
    expect(CAMPAIGN_CONFIG.stages.stage0.enabledSocketCount).toBe(0);
    expect(CAMPAIGN_CONFIG.stages.stage1.enabledSocketCount).toBe(1);
    expect(CAMPAIGN_CONFIG.stages.stage2.enabledSocketCount).toBe(2);
    expect(CAMPAIGN_CONFIG.stages.stage3.enabledSocketCount).toBe(2);
  });

  it('reveals Fast, Double, and Again after the preceding clear', () => {
    expect([
      CAMPAIGN_CONFIG.stages.stage0.revealModuleAfterClear,
      CAMPAIGN_CONFIG.stages.stage1.revealModuleAfterClear,
      CAMPAIGN_CONFIG.stages.stage2.revealModuleAfterClear,
    ]).toEqual(['fast', 'double', 'again']);
  });

  it('retains the canonical production, stack, and module values', () => {
    expect(CAMPAIGN_CONFIG.stages.stage1.productionCapacity).toBe(5);
    expect(CAMPAIGN_CONFIG.stages.stage1.maxActiveWheatCount).toBe(30);
    expect(CAMPAIGN_CONFIG.interaction.heldMaterialCapacity).toBe(5);
    expect(CAMPAIGN_CONFIG.interaction.heldMaterialPickupIntervalSeconds).toBe(0.18);
    expect(CAMPAIGN_CONFIG.interaction).toMatchObject({ moduleSurfaceRadiusMeters: 0.34, floorModuleHalfExtentMeters: 0.34 });
    expect(CAMPAIGN_CONFIG.modules.fast).toEqual({
      processingSpeedMultiplier: 1.8,
      maxFuelSeconds: 8,
      recoverySeconds: 6,
      fullFuelColor: '#e0a43a',
      emptyFuelColor: '#c9473a',
    });
    expect(CAMPAIGN_CONFIG.modules.double).toEqual({ chargeSeconds: 9, activeSeconds: 4.5, outputMultiplier: 2, bodyColor: '#39d9e8' });
    expect(CAMPAIGN_CONFIG.modules.again).toEqual({ fastReapplicationCount: 1, doubleOutputMultiplier: 2, baseColor: '#8f969d', colorTransitionSeconds: 0.24 });
  });

  it('owns the v5.1 camera, material, rail, and authored transition timings in one config', () => {
    expect(CAMPAIGN_CONFIG.camera).toMatchObject({ fovDegrees: 21, offsetX: 3.9987, offsetY: 10.6389, offsetZ: 22.6755, deadZoneHalfWidth: 2.2, smoothingSeconds: 0.12, centerXMin: -8.85, centerXMax: 8.85 });
    expect(new THREE.Vector3(CAMPAIGN_CONFIG.camera.offsetX, CAMPAIGN_CONFIG.camera.offsetY, CAMPAIGN_CONFIG.camera.offsetZ).length())
      .toBeCloseTo(new THREE.Vector3(4.443, 11.821, 25.195).length() * 0.9, 10);
    expect(CAMPAIGN_CONFIG.movement).toMatchObject({
      playerRadiusMeters: 0.38, walkMetersPerSecond: 3.4, runMetersPerSecond: 5.1, blockMetersPerSecond: 3.4,
      tapMaximumMilliseconds: 120, tapMinimumDistanceMeters: 0.18, blockHalfExtentMeters: 1.1,
      ordinaryCycleDistanceMeters: 2, blockCycleDistanceMeters: 1.6,
    });
    expect(CAMPAIGN_CONFIG.materialPresentation).toMatchObject({ wheatRuntimeScale: 0.72, flourRuntimeScale: 1.69728, breadRuntimeScale: 2.2848, wheatSpawnSeconds: 0.55, wheatOutletHeight: 1.12, wheatMouthForwardOffset: 0.06, wheatInitialBurstDistance: 0.04, outputSourceHoldSeconds: 0.04, outputDepartureSeconds: 0.08, outputFlightSeconds: 0.16, outputContactSeconds: 0.06, outputSettleSeconds: 0.08, outputSeconds: 0.42, footprintRadiusMeters: { wheat: 0.17496328353881835, flour: 0.161007431285376, bread: 0.2513279986381531 } });
    expect(CAMPAIGN_CONFIG.presentation).toMatchObject({ moduleDropSeconds: 0.88, moduleEffectResetSeconds: 0.45,
      moduleInsertSeconds: 0.84, moduleAttachApproachSeconds: 0.34, moduleAttachFlipSeconds: 0.18, moduleAttachInsertSeconds: 0.18, moduleAttachContactSeconds: 0.14, againAttachApproachSeconds: 0.28, againAttachInsertSeconds: 0.2, againAttachSettleSeconds: 0.12, wideEnterSeconds: 0.56, clearReturnSeconds: 0.62, retryReturnSeconds: 0.68, scoreCountSeconds: 1.26, scoreHoldSeconds: 0.62, timedStageEntranceSeconds: 0.28, blockTurnSeconds: 0.88, blockTurnAccelerationSeconds: 0.14, blockTurnCruiseSeconds: 0.2, blockTurnDecelerationSeconds: 0.54, blockVisualSwapSeconds: 0.34,
      stage0BlockRevealDropSeconds: 0.70, stage0BlockRevealHeightMeters: 5,
      stage0DockRevealSeconds: 0.50, stage0DockRevealStartScale: 0.62, stage0GoalBoardRiseMeters: 0.65,
      stage0PipeRevealSeconds: 0.42, stage0PipeRevealStartScale: 0.92,
      doubleActiveFeedback: { glowEmissiveIntensity: 0.85, fadeInSeconds: 0.2, fadeOutSeconds: 0.2,
        pointLightIntensity: 1, pointLightDistanceMeters: 2, shakeIntervalSeconds: 0.5, shakeDurationSeconds: 0.14, shakeAngleDegrees: 5 } });
  });
});
