import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CampaignInteraction } from '../CampaignInteraction';
import { CAMPAIGN_CONFIG } from '../CampaignConfig';
import { Module } from './Module';
import { Player } from './Player';
import { ProductionBlock } from './ProductionBlock';
import { testBlockVisual, testModuleVisual, testPlayerVisual } from '../test/CampaignTestVisuals';

describe('stable campaign sockets and modules', () => {
  it('eases introduced Fast and Double effects to their authored retry terminals and restores an exact cancellation snapshot', () => {
    const scene = new THREE.Scene();
    const fast = new Module('reset-fast', 'fast', testModuleVisual());
    const double = new Module('reset-double', 'double', testModuleVisual());
    const again = new Module('reset-again', 'again', testModuleVisual());
    scene.add(fast.root, double.root, again.root);
    fast.revealAt(scene, new THREE.Vector3(-1, 0.5, 0)); double.revealAt(scene, new THREE.Vector3(0, 0.5, 0));
    again.revealAt(scene, new THREE.Vector3(1, 0.5, 0));
    fast.fuelSeconds = 2; fast.recoverySeconds = 4; fast.updatePresentation(CAMPAIGN_CONFIG);
    double.chargeSeconds = 1.75; double.activeSeconds = 2.25;
    double.advanceDoubleActiveFeedbackEnvelope(true, CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.fadeInSeconds, CAMPAIGN_CONFIG);
    double.updatePresentation(CAMPAIGN_CONFIG);
    const fastRoot = fast.root; const doubleRoot = double.root; const againColor = again.readBodyColor(new THREE.Color()).clone();
    const doubleFeedback = double.root.getObjectByName('campaign-module-reset-double-active-feedback')!;
    const doubleLight = double.root.getObjectByName('campaign-module-reset-double-active-light') as THREE.PointLight;
    const fastGauge = fast.root.getObjectByName('campaign-module-fast-gauge-fill')!;
    const doubleGauge = double.root.getObjectByName('campaign-module-double-gauge-fill')!;
    const saved = { fuel: fast.fuelSeconds, recovery: fast.recoverySeconds, charge: double.chargeSeconds,
      active: double.activeSeconds, feedback: double.doubleActiveFeedbackFadeFactor, shake: doubleFeedback.rotation.y,
      light: doubleLight.intensity, fastGauge: fastGauge.scale.x, doubleGauge: doubleGauge.scale.x };
    const fastReset = fast.beginEffectResetTransition(CAMPAIGN_CONFIG)!;
    const doubleReset = double.beginEffectResetTransition(CAMPAIGN_CONFIG)!;
    expect(again.beginEffectResetTransition(CAMPAIGN_CONFIG)).toBeNull();
    fastReset.update(0.5); doubleReset.update(0.5);
    expect(fast.fuelSeconds).toBeGreaterThan(saved.fuel); expect(fast.fuelSeconds).toBeLessThan(CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds);
    expect(fast.recoverySeconds).toBeGreaterThan(0); expect(fast.recoverySeconds).toBeLessThan(saved.recovery);
    expect(double.chargeSeconds).toBeGreaterThan(0); expect(double.chargeSeconds).toBeLessThan(saved.charge);
    expect(double.activeSeconds).toBeGreaterThan(0); expect(double.activeSeconds).toBeLessThan(saved.active);
    expect(double.doubleActiveFeedbackFadeFactor).toBeGreaterThan(0); expect(double.doubleActiveFeedbackFadeFactor).toBeLessThan(saved.feedback);
    expect(fast.root).toBe(fastRoot); expect(double.root).toBe(doubleRoot); expect(again.readBodyColor(new THREE.Color())).toEqual(againColor);
    fastReset.cancel(); doubleReset.cancel();
    expect([fast.fuelSeconds, fast.recoverySeconds]).toEqual([saved.fuel, saved.recovery]);
    expect([double.chargeSeconds, double.activeSeconds]).toEqual([saved.charge, saved.active]);
    expect(double.doubleActiveFeedbackFadeFactor).toBe(saved.feedback); expect(doubleFeedback.rotation.y).toBe(saved.shake);
    expect(doubleLight.intensity).toBe(saved.light); expect(fastGauge.scale.x).toBe(saved.fastGauge); expect(doubleGauge.scale.x).toBe(saved.doubleGauge);

    const finishFast = fast.beginEffectResetTransition(CAMPAIGN_CONFIG)!;
    const finishDouble = double.beginEffectResetTransition(CAMPAIGN_CONFIG)!;
    finishFast.update(0.25); finishFast.update(0.5); finishFast.finish();
    finishDouble.update(0.5); finishDouble.finish();
    expect([fast.fuelSeconds, fast.recoverySeconds]).toEqual([CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds, 0]);
    expect([double.chargeSeconds, double.activeSeconds]).toEqual([0, 0]);
    expect(fastGauge.scale.x).toBe(1); expect(doubleGauge.scale.x).toBe(0);
    expect(double.doubleActiveFeedbackFadeFactor).toBe(0); expect(double.doubleActiveFeedbackActive).toBe(false);
    expect(doubleFeedback.rotation.y).toBe(0); expect(doubleLight.intensity).toBe(0); expect(doubleLight.visible).toBe(false);
    fast.dispose(); double.dispose(); again.dispose();
  });

  it('restores exact opaque presentation snapshots and rejects stale or foreign receipts without mutation', () => {
    const scene = new THREE.Scene(); const player = new Player(testPlayerVisual()); scene.add(player.root);
    const block = new ProductionBlock('snapshot-block', 'mill', new THREE.Vector3(), testBlockVisual);
    scene.add(block.root); block.setVariant('double-socket', 2);
    const double = new Module('snapshot-double', 'double', testModuleVisual());
    const again = new Module('snapshot-again', 'again', testModuleVisual()); scene.add(double.root, again.root);
    double.revealAt(scene, new THREE.Vector3(-1, 0.5, 0)); again.revealAt(scene, new THREE.Vector3(1, 0.5, 0));
    expect(double.pickUp(player)).toBe(true); expect(block.sockets[0].attach(double, player)).toBe(true);
    expect(again.pickUp(player)).toBe(true); expect(block.sockets[1].attach(again, player)).toBe(true);
    double.activeSeconds = CAMPAIGN_CONFIG.modules.double.activeSeconds -
      CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.shakeIntervalSeconds -
      CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.shakeDurationSeconds * 0.25;
    double.advanceDoubleActiveFeedbackEnvelope(true, CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.fadeInSeconds, CAMPAIGN_CONFIG);
    double.updatePresentation(CAMPAIGN_CONFIG);
    again.updatePresentation(CAMPAIGN_CONFIG, CAMPAIGN_CONFIG.modules.again.colorTransitionSeconds * 0.5);
    const againBody = again.root.getObjectByName('sharedCubeGeometry') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const doubleBody = double.root.getObjectByName('sharedCubeGeometry') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const feedback = double.root.getObjectByName('campaign-module-snapshot-double-active-feedback')!;
    const light = double.root.getObjectByName('campaign-module-snapshot-double-active-light') as THREE.PointLight;
    const againColor = againBody.material.color.clone(); const doubleColor = doubleBody.material.color.clone();
    const emissive = doubleBody.material.emissive.clone(); const intensity = doubleBody.material.emissiveIntensity;
    const feedbackQuaternion = feedback.quaternion.clone(); const feedbackVisible = feedback.visible;
    const lightIntensity = light.intensity; const lightVisible = light.visible;
    const superseded = double.capturePresentationSnapshot(); const againSnapshot = again.capturePresentationSnapshot();
    const current = double.capturePresentationSnapshot();
    double.resetEffectForRetry(CAMPAIGN_CONFIG); again.resetEffectForRetry(CAMPAIGN_CONFIG);
    const resetColor = doubleBody.material.color.clone(); const resetFeedback = feedback.quaternion.clone();
    expect(double.restorePresentationSnapshot(superseded)).toBe(false);
    expect(doubleBody.material.color).toEqual(resetColor); expect(feedback.quaternion.angleTo(resetFeedback)).toBeLessThan(1e-12);
    expect(again.restorePresentationSnapshot(current)).toBe(false); expect(againBody.material.color).not.toEqual(againColor);
    expect(double.restorePresentationSnapshot(current)).toBe(true);
    expect(doubleBody.material.color).toEqual(doubleColor); expect(doubleBody.material.emissive).toEqual(emissive);
    expect(doubleBody.material.emissiveIntensity).toBe(intensity); expect(feedback.quaternion.angleTo(feedbackQuaternion)).toBeLessThan(1e-12);
    expect(feedback.visible).toBe(feedbackVisible); expect(light.intensity).toBe(lightIntensity); expect(light.visible).toBe(lightVisible);
    expect(double.restorePresentationSnapshot(current)).toBe(false);
    expect(again.restorePresentationSnapshot(againSnapshot)).toBe(true); expect(againBody.material.color).toEqual(againColor);
    double.dispose(); again.dispose();
  });

  it('projects Double active glow and bounded shake through one presentation-only child', () => {
    const scene = new THREE.Scene(); const module = new Module('double', 'double', testModuleVisual());
    scene.add(module.root); module.revealAt(scene, new THREE.Vector3(1, 0.5, 2));
    const body = module.root.getObjectByName('sharedCubeGeometry') as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
    const feedback = module.root.getObjectByName('campaign-module-double-active-feedback')!;
    const light = module.root.getObjectByName('campaign-module-double-active-light') as THREE.PointLight;
    const rootPosition = module.root.position.clone(); const rootQuaternion = module.root.quaternion.clone();
    const baseEmissive = body.material.emissive.clone(); const baseIntensity = body.material.emissiveIntensity;
    module.activeSeconds = CAMPAIGN_CONFIG.modules.double.activeSeconds;
    module.advanceDoubleActiveFeedbackEnvelope(true, CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.fadeInSeconds, CAMPAIGN_CONFIG);
    module.updatePresentation(CAMPAIGN_CONFIG);
    expect(module.doubleActiveFeedbackActive).toBe(true); expect(module.doubleActiveShakeAngleRadians).toBe(0);
    expect(body.material.emissive.getHexString()).toBe(new THREE.Color(CAMPAIGN_CONFIG.modules.double.bodyColor).getHexString());
    expect(body.material.emissiveIntensity).toBe(CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.glowEmissiveIntensity);
    expect(module.doubleActiveFeedbackFadeFactor).toBe(1); expect(light.intensity).toBe(1); expect(light.distance).toBe(2);
    expect(light.visible).toBe(true); expect(light.castShadow).toBe(false); expect(light.parent).toBe(feedback);
    module.activeSeconds -= CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.shakeIntervalSeconds +
      CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.shakeDurationSeconds * 0.25;
    module.updatePresentation(CAMPAIGN_CONFIG);
    expect(module.doubleActiveShakeAngleRadians).toBeCloseTo(THREE.MathUtils.degToRad(5), 10);
    expect(feedback.rotation.y).toBeCloseTo(module.doubleActiveShakeAngleRadians, 10);
    expect(body.parent).toBe(feedback); expect(module.root.position).toEqual(rootPosition); expect(module.root.quaternion.angleTo(rootQuaternion)).toBeLessThan(1e-12);
    module.activeSeconds = CAMPAIGN_CONFIG.modules.double.activeSeconds - 0.25; module.updatePresentation(CAMPAIGN_CONFIG);
    expect(module.doubleActiveShakeAngleRadians).toBe(0);
    module.activeSeconds = CAMPAIGN_CONFIG.modules.double.activeSeconds - 1 -
      CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.shakeDurationSeconds * 0.25;
    module.updatePresentation(CAMPAIGN_CONFIG); expect(module.doubleActiveShakeAngleRadians).toBeCloseTo(THREE.MathUtils.degToRad(5), 10);
    module.activeSeconds = 0; module.chargeSeconds = 0.1;
    module.advanceDoubleActiveFeedbackEnvelope(false, CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.fadeOutSeconds * 0.5, CAMPAIGN_CONFIG);
    module.updatePresentation(CAMPAIGN_CONFIG);
    expect(module.doubleActiveFeedbackActive).toBe(false); expect(feedback.rotation.y).toBe(0); expect(module.doubleActiveFeedbackFadeFactor).toBeCloseTo(0.5, 10);
    expect(body.material.emissiveIntensity).toBeCloseTo(baseIntensity + (CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.glowEmissiveIntensity - baseIntensity) * 0.5, 10);
    expect(light.intensity).toBeCloseTo(0.5, 10); expect(light.visible).toBe(true);
    module.advanceDoubleActiveFeedbackEnvelope(false, CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.fadeOutSeconds * 0.5, CAMPAIGN_CONFIG);
    module.updatePresentation(CAMPAIGN_CONFIG);
    expect(module.doubleActiveFeedbackFadeFactor).toBe(0); expect(light.intensity).toBe(0); expect(light.visible).toBe(false);
    expect(body.material.emissive).toEqual(baseEmissive); expect(body.material.emissiveIntensity).toBe(baseIntensity);
    module.activeSeconds = 1; module.location = Object.freeze({ kind: 'not-introduced' }); module.updatePresentation(CAMPAIGN_CONFIG);
    expect(module.doubleActiveFeedbackActive).toBe(false);
    module.dispose(); expect(module.root.parent).toBeNull(); expect(feedback.rotation.y).toBe(0);
    expect(light.intensity).toBe(0); expect(light.visible).toBe(false);
  });

  it('uses one root and one location while attach, block movement, and detach stay coherent', () => {
    const scene = new THREE.Scene();
    const player = new Player(testPlayerVisual());
    const block = new ProductionBlock('mill', 'mill', new THREE.Vector3(0, 0, 0), testBlockVisual);
    const module = new Module('fast', 'fast', testModuleVisual());
    scene.add(player.root, block.root, module.root);
    block.setVariant('single-socket', 1);
    module.revealAt(scene, new THREE.Vector3(0, 0, 1));
    expect(module.pickUp(player)).toBe(true);
    expect(block.sockets[0].attach(module, player)).toBe(true);
    expect(module.location).toEqual({ kind: 'socket', block, socket: 0 });
    expect(module.root.parent).toBe(block.sockets[0].anchor);

    const before = block.sockets[0].readWorldPosition(new THREE.Vector3()).clone();
    block.moveBy(new THREE.Vector3(3, 0, 2));
    const after = block.sockets[0].readWorldPosition(new THREE.Vector3());
    expect(after.x - before.x).toBeCloseTo(3);
    expect(after.z - before.z).toBeCloseTo(2);
    expect(block.sockets[0].detach(player)).toBe(module);
    expect(module.location.kind).toBe('held');
    expect(module.root.parent).toBe(player.heldAnchor);
  });

  it('selects the actual current socket after a block moves and keeps held state when all sockets are full', () => {
    const scene = new THREE.Scene();
    const player = new Player(testPlayerVisual());
    player.reset({ x: 3, z: 2 }, { x: 0, z: -1 });
    const near = new ProductionBlock('a', 'mill', new THREE.Vector3(8, 0, 8), testBlockVisual);
    const far = new ProductionBlock('b', 'heater', new THREE.Vector3(-8, 0, -8), testBlockVisual);
    near.setVariant('double-socket', 2); far.setVariant('double-socket', 2);
    near.moveBy(new THREE.Vector3(-5, 0, -6));
    const held = new Module('again', 'again', testModuleVisual());
    scene.add(player.root, near.root, far.root, held.root);
    held.revealAt(scene, new THREE.Vector3(3, 0, 3)); held.pickUp(player);
    const interaction = new CampaignInteraction(player, [near, far], [held], CAMPAIGN_CONFIG.interaction);
    const target = interaction.updateTarget();
    expect(target?.kind).toBe('socket');
    expect(target?.kind === 'socket' && target.socket.block).toBe(near);

    const occupant0 = new Module('fast', 'fast', testModuleVisual());
    const occupant1 = new Module('double', 'double', testModuleVisual());
    scene.add(occupant0.root, occupant1.root);
    player.heldModule = null;
    for (const [socket, occupant] of [[near.sockets[0], occupant0], [near.sockets[1], occupant1]] as const) {
      occupant.revealAt(scene, new THREE.Vector3()); occupant.pickUp(player); socket.attach(occupant, player);
    }
    player.heldModule = held; player.heldAnchor.attach(held.root); held.location = Object.freeze({ kind: 'held' });
    expect(interaction.updateTarget()).toBeNull();
    expect(interaction.interact()).toBe(false);
    expect(player.heldModule).toBe(held);
    expect(held.root.visible).toBe(true);
  });
});
