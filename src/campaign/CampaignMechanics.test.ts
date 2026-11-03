import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAMPAIGN_CONFIG, nextCampaignStage } from './CampaignConfig';
import { advanceModuleEffects, readProductionModifiers } from './CampaignMechanics';
import { Module } from './objects/Module';
import { Player } from './objects/Player';
import { ProductionBlock } from './objects/ProductionBlock';
import { testBlockVisual, testModuleVisual, testPlayerVisual } from './test/CampaignTestVisuals';

function attach(block: ProductionBlock, module: Module, player: Player, socket: 0 | 1): void {
  const scene = block.root.parent!;
  module.revealAt(scene, new THREE.Vector3());
  expect(module.pickUp(player)).toBe(true);
  expect(block.sockets[socket].attach(module, player)).toBe(true);
}

describe('production-consumed campaign mechanics', () => {
  it('walks the only stage sequence and terminates after Stage 3', () => {
    expect(nextCampaignStage('stage0')).toBe('stage1');
    expect(nextCampaignStage('stage1')).toBe('stage2');
    expect(nextCampaignStage('stage2')).toBe('stage3');
    expect(nextCampaignStage('stage3')).toBeNull();
  });

  it('applies Fast once and Again+Fast twice from the same config', () => {
    const scene = new THREE.Scene(); const player = new Player(testPlayerVisual());
    const block = new ProductionBlock('mill', 'mill', new THREE.Vector3(), testBlockVisual); block.setVariant('double-socket', 2);
    const fast = new Module('fast', 'fast', testModuleVisual()); const again = new Module('again', 'again', testModuleVisual());
    scene.add(player.root, block.root, fast.root, again.root);
    attach(block, fast, player, 0); fast.fuelSeconds = 8;
    expect(readProductionModifiers(block, CAMPAIGN_CONFIG).processingSpeedMultiplier).toBeCloseTo(1.8);
    attach(block, again, player, 1);
    expect(readProductionModifiers(block, CAMPAIGN_CONFIG).processingSpeedMultiplier).toBeCloseTo(3.24);
  });

  it('uses Double output two and only active same-block Again+Double output four', () => {
    const scene = new THREE.Scene(); const player = new Player(testPlayerVisual());
    const block = new ProductionBlock('heater', 'heater', new THREE.Vector3(), testBlockVisual); block.setVariant('double-socket', 2);
    const double = new Module('double', 'double', testModuleVisual()); const again = new Module('again', 'again', testModuleVisual());
    scene.add(player.root, block.root, double.root, again.root);
    attach(block, double, player, 0);
    expect(readProductionModifiers(block, CAMPAIGN_CONFIG).outputCount).toBe(1);
    double.activeSeconds = CAMPAIGN_CONFIG.modules.double.activeSeconds;
    expect(readProductionModifiers(block, CAMPAIGN_CONFIG).outputCount).toBe(2);
    attach(block, again, player, 1);
    expect(readProductionModifiers(block, CAMPAIGN_CONFIG).outputCount).toBe(4);
    double.activeSeconds = 0;
    expect(readProductionModifiers(block, CAMPAIGN_CONFIG).outputCount).toBe(1);
  });

  it('advances the configured Double charge/active clock and Fast fuel/recovery', () => {
    const scene = new THREE.Scene(); const player = new Player(testPlayerVisual());
    const block = new ProductionBlock('mill', 'mill', new THREE.Vector3(), testBlockVisual); block.setVariant('double-socket', 2);
    const fast = new Module('fast', 'fast', testModuleVisual()); const double = new Module('double', 'double', testModuleVisual());
    scene.add(player.root, block.root, fast.root, double.root);
    attach(block, fast, player, 0); attach(block, double, player, 1);
    block.storedMaterialIds.push('wheat-1');
    const compareFastSplit = (fuel: number, recovery: number, expectedActiveSeconds: number): void => {
      fast.fuelSeconds = fuel; fast.recoverySeconds = recovery; const directActive = advanceModuleEffects([fast], 0.1, CAMPAIGN_CONFIG);
      const direct = [fast.fuelSeconds, fast.recoverySeconds, readProductionModifiers(block, CAMPAIGN_CONFIG).processingSpeedMultiplier];
      fast.fuelSeconds = fuel; fast.recoverySeconds = recovery;
      const splitActive = advanceModuleEffects([fast], 0.05, CAMPAIGN_CONFIG) + advanceModuleEffects([fast], 0.05, CAMPAIGN_CONFIG);
      expect(directActive).toBeCloseTo(expectedActiveSeconds, 10); expect(splitActive).toBeCloseTo(directActive, 10);
      expect(fast.fuelSeconds).toBeCloseTo(direct[0]!, 10); expect(fast.recoverySeconds).toBeCloseTo(direct[1]!, 10);
      expect(readProductionModifiers(block, CAMPAIGN_CONFIG).processingSpeedMultiplier).toBe(direct[2]);
    };
    compareFastSplit(0.05, 0, 0.05); expect(fast.recoverySeconds).toBeCloseTo(5.95, 10); expect(readProductionModifiers(block, CAMPAIGN_CONFIG).processingSpeedMultiplier).toBe(1);
    const nearFullRecoverySeconds = 0.025; compareFastSplit(8 - (8 / 6) * nearFullRecoverySeconds, nearFullRecoverySeconds, 0.075);
    expect(fast.recoverySeconds).toBe(0); expect(fast.fuelSeconds).toBeCloseTo(7.925, 10); expect(readProductionModifiers(block, CAMPAIGN_CONFIG).processingSpeedMultiplier).toBeCloseTo(1.8);
    fast.fuelSeconds = 0.1; fast.recoverySeconds = 0;
    advanceModuleEffects([fast, double], 0.1, CAMPAIGN_CONFIG);
    expect(fast.fuelSeconds).toBe(0); expect(fast.recoverySeconds).toBe(6);
    expect(readProductionModifiers(block, CAMPAIGN_CONFIG).processingSpeedMultiplier).toBe(1);
    advanceModuleEffects([fast, double], 1, CAMPAIGN_CONFIG);
    expect(fast.fuelSeconds).toBeCloseTo(8 / 6, 10); expect(fast.recoverySeconds).toBe(5);
    block.storedMaterialIds.length = 0;
    advanceModuleEffects([fast, double], 2, CAMPAIGN_CONFIG);
    expect(fast.fuelSeconds).toBe(4); expect(fast.recoverySeconds).toBe(3);
    advanceModuleEffects([fast, double], 3, CAMPAIGN_CONFIG);
    expect(fast.fuelSeconds).toBe(8); expect(double.activeSeconds).toBe(0);
    advanceModuleEffects([fast, double], 4, CAMPAIGN_CONFIG);
    expect(double.activeSeconds).toBeCloseTo(3.4, 10);
    expect(block.sockets[1].detach(player)).toBe(double);
    advanceModuleEffects([fast, double], 1, CAMPAIGN_CONFIG);
    expect(double.activeSeconds).toBeCloseTo(2.4, 10); expect(readProductionModifiers(block, CAMPAIGN_CONFIG).outputCount).toBe(1);
    advanceModuleEffects([fast, double], 3, CAMPAIGN_CONFIG); expect(double.activeSeconds).toBe(0); expect(double.chargeSeconds).toBeCloseTo(0.6, 10);
    expect(double.dropTo(scene, new THREE.Vector3(3, 0.5, 2), player)).toBe(true);
    advanceModuleEffects([fast, double], 8.4, CAMPAIGN_CONFIG);
    expect(double.activeSeconds).toBe(4.5); expect(readProductionModifiers(block, CAMPAIGN_CONFIG).outputCount).toBe(1);
    expect(double.pickUp(player)).toBe(true); expect(block.sockets[1].attach(double, player)).toBe(true);
    expect(double.activeSeconds).toBe(4.5); expect(readProductionModifiers(block, CAMPAIGN_CONFIG).outputCount).toBe(2);
  });

  it('preserves Double phase remainder and split equivalence in world, held, and socket states', () => {
    const scene = new THREE.Scene(); const player = new Player(testPlayerVisual());
    const block = new ProductionBlock('heater', 'heater', new THREE.Vector3(), testBlockVisual); block.setVariant('double-socket', 2);
    const double = new Module('double', 'double', testModuleVisual()); scene.add(player.root, block.root, double.root); double.revealAt(scene, new THREE.Vector3());
    const compareSplit = (charge: number, active: number): void => {
      double.chargeSeconds = charge; double.activeSeconds = active; advanceModuleEffects([double], 0.1, CAMPAIGN_CONFIG);
      const direct = [double.chargeSeconds, double.activeSeconds];
      double.chargeSeconds = charge; double.activeSeconds = active; advanceModuleEffects([double], 0.05, CAMPAIGN_CONFIG); advanceModuleEffects([double], 0.05, CAMPAIGN_CONFIG);
      expect(double.chargeSeconds).toBeCloseTo(direct[0]!, 10); expect(double.activeSeconds).toBeCloseTo(direct[1]!, 10);
    };
    compareSplit(8.95, 0); expect(double.activeSeconds).toBeCloseTo(4.45, 10); expect(readProductionModifiers(block, CAMPAIGN_CONFIG).outputCount).toBe(1);
    expect(double.pickUp(player)).toBe(true); compareSplit(0, 0.05); expect(double.chargeSeconds).toBeCloseTo(0.05, 10); expect(double.activeSeconds).toBe(0);
    expect(block.sockets[0].attach(double, player)).toBe(true); compareSplit(8.95, 0); expect(double.activeSeconds).toBeCloseTo(4.45, 10);
    expect(readProductionModifiers(block, CAMPAIGN_CONFIG).outputCount).toBe(2);

    const activeStart = CAMPAIGN_CONFIG.modules.double.activeSeconds - 0.465;
    double.chargeSeconds = 0; double.activeSeconds = activeStart;
    advanceModuleEffects([double], 0.1, CAMPAIGN_CONFIG); double.updatePresentation(CAMPAIGN_CONFIG);
    const directShake = double.doubleActiveShakeAngleRadians; const directActive = double.doubleActiveFeedbackActive;
    double.chargeSeconds = 0; double.activeSeconds = activeStart;
    advanceModuleEffects([double], 0.05, CAMPAIGN_CONFIG); double.updatePresentation(CAMPAIGN_CONFIG);
    advanceModuleEffects([double], 0.05, CAMPAIGN_CONFIG); double.updatePresentation(CAMPAIGN_CONFIG);
    expect(double.doubleActiveFeedbackActive).toBe(directActive); expect(double.doubleActiveShakeAngleRadians).toBeCloseTo(directShake, 10);
    advanceModuleEffects([double], 1350, CAMPAIGN_CONFIG); double.updatePresentation(CAMPAIGN_CONFIG);
    expect(Number.isFinite(double.doubleActiveShakeAngleRadians)).toBe(true);
    expect(Math.abs(double.doubleActiveShakeAngleRadians)).toBeLessThanOrEqual(THREE.MathUtils.degToRad(5));
  });

  it('uses exact Double phase segments for split-invariant fade-in and fade-out', () => {
    const makeDouble = (id: string): Module => {
      const scene = new THREE.Scene(); const module = new Module(id, 'double', testModuleVisual());
      scene.add(module.root); module.revealAt(scene, new THREE.Vector3()); return module;
    };
    const read = (module: Module): readonly number[] => {
      module.updatePresentation(CAMPAIGN_CONFIG);
      const body = module.root.getObjectByName('sharedCubeGeometry') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      const light = module.root.getObjectByName(`campaign-module-${module.id}-active-light`) as THREE.PointLight;
      return [module.chargeSeconds, module.activeSeconds, module.doubleActiveFeedbackFadeFactor, body.material.emissiveIntensity, light.intensity];
    };
    const directIn = makeDouble('fade-in-direct'); const splitIn = makeDouble('fade-in-split');
    directIn.chargeSeconds = CAMPAIGN_CONFIG.modules.double.chargeSeconds - 0.1;
    splitIn.chargeSeconds = CAMPAIGN_CONFIG.modules.double.chargeSeconds - 0.1;
    advanceModuleEffects([directIn], 0.3, CAMPAIGN_CONFIG);
    advanceModuleEffects([splitIn], 0.1, CAMPAIGN_CONFIG); advanceModuleEffects([splitIn], 0.1, CAMPAIGN_CONFIG); advanceModuleEffects([splitIn], 0.1, CAMPAIGN_CONFIG);
    const directInState = read(directIn); const splitInState = read(splitIn);
    directInState.forEach((value, index) => expect(splitInState[index]).toBeCloseTo(value, 10));
    expect(directIn.doubleActiveFeedbackFadeFactor).toBe(1);

    const directOut = makeDouble('fade-out-direct'); const splitOut = makeDouble('fade-out-split');
    for (const module of [directOut, splitOut]) {
      module.activeSeconds = 0.1;
      module.advanceDoubleActiveFeedbackEnvelope(true, CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.fadeInSeconds, CAMPAIGN_CONFIG);
    }
    advanceModuleEffects([directOut], 0.3, CAMPAIGN_CONFIG);
    advanceModuleEffects([splitOut], 0.1, CAMPAIGN_CONFIG); advanceModuleEffects([splitOut], 0.1, CAMPAIGN_CONFIG); advanceModuleEffects([splitOut], 0.1, CAMPAIGN_CONFIG);
    const directOutState = read(directOut); const splitOutState = read(splitOut);
    directOutState.forEach((value, index) => expect(splitOutState[index]).toBeCloseTo(value, 10));
    expect(directOut.doubleActiveFeedbackFadeFactor).toBeCloseTo(0, 12);
    expect((directOut.root.getObjectByName('campaign-module-fade-out-direct-active-light') as THREE.PointLight).visible).toBe(false);
  });
});
