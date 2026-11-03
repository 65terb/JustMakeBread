import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAMPAIGN_RESTART_ACTION, CAMPAIGN_RETRY_ACTION } from './CampaignActions';
import { CAMPAIGN_CONFIG, validateCampaignConfig } from './CampaignConfig';
import { CampaignFrameClock } from './CampaignFrameClock';
import { CampaignInput } from './CampaignInput';
import { CampaignInteraction } from './CampaignInteraction';
import { installCampaignLifecycleOwner, synchronizeCampaignLifecyclePause } from './CampaignLifecycle';
import { createStage0TutorialSteps, Stage0TutorialController, type TutorialSurface } from './Stage0TutorialController';
import { Module } from './objects/Module';
import { Player } from './objects/Player';
import { ProductionBlock } from './objects/ProductionBlock';
import { moveCamera, suctionMaterialRoots, turnAndSwapBlocks } from './presentation/PresentationLibrary';
import { PresentationPlayer } from './presentation/PresentationPlayer';
import { createStageClearPlan } from './presentation/StagePresentationPlans';
import { testBlockVisual, testModuleVisual, testPlayerVisual } from './test/CampaignTestVisuals';

function surface(): TutorialSurface {
  return { hidden: false, textContent: '', dataset: {}, setAttribute: () => undefined, replaceChildren: () => undefined };
}

describe('production-connected campaign contracts', () => {
  it('drives the ten authored Stage0 cards through exact dropped-material and production observations', () => {
    const effects: string[] = [];
    const controller = new Stage0TutorialController(surface(), createStage0TutorialSteps({
      revealPipe: () => effects.push('pipe'), revealMill: () => effects.push('mill'),
      revealHeater: () => effects.push('heater'), revealDock: () => effects.push('dock'),
    }));
    expect(controller.steps.filter((step) => step.cardVisible).map((step) => step.text)).toEqual([
      '방향키로 움직여 보세요.',
      'Shift를 누른 상태로 움직여 달릴 수 있습니다.',
      '밀 파이프에선 밀이 나옵니다. E로 집어 보세요. E를 누르고 있으면 한 번에 5개까지 차례로 들 수 있습니다.',
      'Q를 눌러 바닥에 놓을 수 있습니다.',
      '블록 근처에서 밀을 들고 Q를 눌러 재료를 넣으세요.',
      '시간이 지나면 밀가루가 나옵니다.',
      '밀가루를 굽기 블록에 넣으세요.',
      'Space를 눌러 블록 위치를 옮길 수 있습니다.',
      '빵을 제출대에 넣으세요!',
      '빵을 제출대에 넣으세요!',
    ]);
    expect(controller.currentStepId).toBe('move');
    expect(controller.allowsBlockCapture('mill')).toBe(false); expect(controller.allowsBlockCapture('heater')).toBe(false);
    controller.observe({ kind: 'moved', running: false }); controller.observe({ kind: 'moved', running: true });
    controller.observe({ kind: 'material-picked', materialType: 'wheat', materialId: 'w1' });
    controller.observe({ kind: 'material-dropped', materialType: 'wheat', materialIds: ['w1'] });
    expect(controller.allowsAutomaticIntake('w1')).toBe(false);
    controller.observe({ kind: 'material-dropped', materialType: 'wheat', materialIds: ['other'] });
    expect(controller.allowsAutomaticIntake('other')).toBe(false);
    controller.observe({ kind: 'material-dropped', materialType: 'wheat', materialIds: ['w1'] });
    expect(controller.allowsAutomaticIntake('w1')).toBe(true);
    controller.observe({ kind: 'material-intake', materialType: 'wheat', materialId: 'w1', blockId: 'mill' });
    controller.observe({ kind: 'material-output', materialType: 'flour', materialIds: ['f1'] });
    controller.observe({ kind: 'material-dropped', materialType: 'flour', materialIds: ['f1'] });
    expect(controller.allowsAutomaticIntake('f1')).toBe(true);
    controller.observe({ kind: 'material-intake', materialType: 'flour', materialId: 'f1', blockId: 'heater' });
    expect(controller.currentStepId).toBe('move-heater'); expect(controller.allowsBlockCapture('mill')).toBe(false); expect(controller.allowsBlockCapture('heater')).toBe(true);
    controller.observe({ kind: 'block-moved', blockId: 'mill' }); expect(controller.heaterProcessingUnlocked).toBe(false);
    controller.observe({ kind: 'block-moved', blockId: 'heater' }); expect(controller.heaterProcessingUnlocked).toBe(true);
    expect(controller.allowsBlockCapture('mill')).toBe(true); expect(controller.allowsBlockCapture('heater')).toBe(true);
    controller.observe({ kind: 'material-output', materialType: 'bread', materialIds: ['b1'] });
    controller.observe({ kind: 'material-dropped', materialType: 'bread', materialIds: ['b1'] });
    controller.observe({ kind: 'bread-submitted', materialId: 'b1' });
    expect(controller.currentStepId).toBe('stage1-handoff');
    expect(effects).toEqual(['pipe', 'mill', 'heater', 'dock']);
  });

  it('uses code-based retry input and distinct action identities', () => {
    const input = new CampaignInput();
    expect(input.keyDown('KeyR', false)).toBe(true); expect(input.consumeActions().retryPressed).toBe(true);
    expect(input.keyDown('KeyR', true)).toBe(true); expect(input.consumeActions().retryPressed).toBe(false);
    expect(CAMPAIGN_RETRY_ACTION).toEqual({ id: 'campaign-retry', label: '다시 시도' });
    expect(CAMPAIGN_RESTART_ACTION).toEqual({ id: 'campaign-result-restart', label: '다시하기' });
  });

  it('resumes with catch-up zero through the frame clock consumed by main', () => {
    const clock = new CampaignFrameClock(1_000);
    expect(clock.sample(1_016)).toBeCloseTo(0.016);
    clock.pauseTransition(1_020, true);
    clock.pauseTransition(61_020, false);
    expect(clock.sample(61_036)).toBe(0);
    expect(clock.sample(61_052)).toBeCloseTo(0.016);
  });

  it('synchronizes a hidden or unfocused document when running listeners are installed', () => {
    const states: boolean[] = [];
    expect(synchronizeCampaignLifecyclePause({ hidden: true, hasFocus: () => true }, (paused) => states.push(paused))).toBe(true);
    expect(synchronizeCampaignLifecyclePause({ hidden: false, hasFocus: () => false }, (paused) => states.push(paused))).toBe(true);
    expect(synchronizeCampaignLifecyclePause({ hidden: false, hasFocus: () => true }, (paused) => states.push(paused))).toBe(false);
    expect(states).toEqual([true, true, false]);
  });

  it('installs the main-used lifecycle listeners before reading and applying current hidden state', () => {
    const order: string[] = []; const listeners = new Map<string, EventListener>();
    const source = (name: string) => ({
      addEventListener: (type: string, listener: EventListener) => { order.push(`${name}:add:${type}`); listeners.set(`${name}:${type}`, listener); },
      removeEventListener: (type: string) => { order.push(`${name}:remove:${type}`); },
    });
    const documentSource = Object.assign(source('document'), { hidden: true, hasFocus: () => true });
    const remove = installCampaignLifecycleOwner({ document: documentSource, window: source('window'), setPaused: (paused) => order.push(`pause:${paused}`) });
    expect(order).toEqual(['document:add:visibilitychange', 'window:add:blur', 'window:add:focus', 'pause:true']);
    documentSource.hidden = false; listeners.get('window:focus')!(new Event('focus'));
    expect(order.at(-1)).toBe('pause:false');
    remove(); expect(order.slice(-3)).toEqual(['document:remove:visibilitychange', 'window:remove:blur', 'window:remove:focus']);
  });

  it('keeps a held module when a nearby compatible block has no free socket', () => {
    const scene = new THREE.Scene(); const player = new Player(testPlayerVisual()); scene.add(player.root);
    const block = new ProductionBlock('mill', 'mill', new THREE.Vector3(), testBlockVisual); block.setVariant('single-socket', 1); scene.add(block.root);
    const occupying = new Module('occupying', 'fast', testModuleVisual()); const held = new Module('held', 'double', testModuleVisual());
    scene.add(occupying.root, held.root); occupying.revealAt(scene, new THREE.Vector3()); held.revealAt(scene, new THREE.Vector3());
    expect(occupying.pickUp(player)).toBe(true); expect(block.sockets[0].attach(occupying, player)).toBe(true);
    expect(held.pickUp(player)).toBe(true); player.position.set(0, 0); player.root.position.set(0, 0, 0);
    const presentation = new PresentationPlayer();
    const interaction = new CampaignInteraction(player, [block], [occupying, held], CAMPAIGN_CONFIG.interaction, {
      scene, player, presentation, durationSeconds: 0.2, timing: CAMPAIGN_CONFIG.presentation,
    });
    expect(interaction.interact()).toBe(false);
    expect(player.heldModule).toBe(held); expect(held.location.kind).toBe('held'); expect(presentation.active).toBe(false);
  });

  it('rejects an invalid config before game construction', () => {
    expect(() => validateCampaignConfig(CAMPAIGN_CONFIG)).not.toThrow();
    const invalid = { ...CAMPAIGN_CONFIG, stages: { ...CAMPAIGN_CONFIG.stages, stage1: { ...CAMPAIGN_CONFIG.stages.stage1, targetBreadCount: 0 } } };
    expect(() => validateCampaignConfig(invalid)).toThrow(/stage1/);
    const invalidTransfer = { ...CAMPAIGN_CONFIG, materialPresentation: { ...CAMPAIGN_CONFIG.materialPresentation, heldTransferSeconds: 0 } };
    expect(() => validateCampaignConfig(invalidTransfer)).toThrow(/shared campaign config/);
    const invalidFloorModule = { ...CAMPAIGN_CONFIG, interaction: { ...CAMPAIGN_CONFIG.interaction, floorModuleHalfExtentMeters: 0 } };
    expect(() => validateCampaignConfig(invalidFloorModule)).toThrow(/shared campaign config/);
    const invalidDockDuration = { ...CAMPAIGN_CONFIG, presentation: { ...CAMPAIGN_CONFIG.presentation, stage0DockRevealSeconds: 0 } };
    expect(() => validateCampaignConfig(invalidDockDuration)).toThrow(/shared campaign config/);
    const invalidDockScale = { ...CAMPAIGN_CONFIG, presentation: { ...CAMPAIGN_CONFIG.presentation, stage0DockRevealStartScale: 1 } };
    expect(() => validateCampaignConfig(invalidDockScale)).toThrow(/shared campaign config/);
    const invalidPipeDuration = { ...CAMPAIGN_CONFIG, presentation: { ...CAMPAIGN_CONFIG.presentation, stage0PipeRevealSeconds: 0 } };
    expect(() => validateCampaignConfig(invalidPipeDuration)).toThrow(/shared campaign config/);
    const invalidPipeScale = { ...CAMPAIGN_CONFIG, presentation: { ...CAMPAIGN_CONFIG.presentation, stage0PipeRevealStartScale: 1 } };
    expect(() => validateCampaignConfig(invalidPipeScale)).toThrow(/shared campaign config/);
    const invalidTimedEntrance = { ...CAMPAIGN_CONFIG, presentation: { ...CAMPAIGN_CONFIG.presentation, timedStageEntranceSeconds: 0 } };
    expect(() => validateCampaignConfig(invalidTimedEntrance)).toThrow(/shared campaign config/);
  });

  it('runs visible suction, camera, block-turn/swap, and terminal callbacks through one player', () => {
    const scene = new THREE.Scene(); const root = new THREE.Group(); root.position.set(4, 0, 0); scene.add(root);
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 3, 8); camera.lookAt(0, 0, 0);
    const block = new ProductionBlock('mill', 'mill', new THREE.Vector3(), testBlockVisual); scene.add(block.root);
    const order: string[] = [];
    const scoreboard = { id: 'scoreboard', durationSeconds: 0.1, start: () => order.push('scoreboard') } as const;
    const suction = suctionMaterialRoots('suction', scene, [root], new THREE.Vector3(), 1, () => order.push('suction-finish'));
    const resultCamera = moveCamera('result-camera', camera, new THREE.Vector3(0, 7, 10), new THREE.Vector3(), 1);
    const turn = turnAndSwapBlocks('turn', [block], 1, () => order.push('swap'));
    const returnCamera = moveCamera('return-camera', camera, new THREE.Vector3(7, 9, 9), new THREE.Vector3(), 1);
    const dockGoalProjection = { id: 'dock-goal', durationSeconds: 0, start: () => order.push('dock-goal') } as const;
    const stageConfiguration = { id: 'stage-configuration', durationSeconds: 0, start: () => order.push('stage-configuration') } as const;
    const scoreboardEntrance = { id: 'scoreboard-entrance', durationSeconds: 0.28, start: () => order.push('scoreboard-entrance') } as const;
    const finish = { id: 'finish', durationSeconds: 0, start: () => order.push('finish') } as const;
    const plan = createStageClearPlan({ dockGoalProjection, scoreboard, suction, resultCamera, blockTransition: turn,
      moduleEffectReset: null, moduleReveal: [], returnCamera, stageConfiguration, scoreboardEntrance, finish });
    const player = new PresentationPlayer(); player.play(plan, () => order.push('complete'));
    player.update(0.1); player.update(1); player.update(0.1); player.update(0.5);
    expect(root.position.x).toBeGreaterThan(0); expect(root.position.x).toBeLessThan(4);
    player.finishImmediately();
    expect(root.parent).toBeNull(); expect(order).toEqual(['dock-goal', 'scoreboard', 'suction-finish', 'swap',
      'stage-configuration', 'scoreboard-entrance', 'finish', 'complete']);
    expect(camera.position.toArray()).toEqual([7, 9, 9]);
  });

  it('finishes an ordinary motion before acquiring the same player for a campaign transaction', () => {
    const order: string[] = []; const player = new PresentationPlayer();
    player.play([{ id: 'ordinary-module-motion', durationSeconds: 1, finish: () => order.push('ordinary-terminal') }],
      () => order.push('ordinary-complete'));
    player.finishCurrentAndPlay([
      { id: 'camera-out', durationSeconds: 0, start: () => order.push('camera-out') },
      { id: 'suction', durationSeconds: 0, start: () => order.push('suction') },
      { id: 'commit', durationSeconds: 0, start: () => order.push('commit') },
      { id: 'camera-return', durationSeconds: 0, start: () => order.push('camera-return') },
    ], () => order.push('campaign-complete'));
    player.finishImmediately();
    expect(order).toEqual(['ordinary-terminal', 'ordinary-complete', 'camera-out', 'suction', 'commit', 'camera-return', 'campaign-complete']);
  });

  it('builds transform-dependent campaign steps only after ordinary terminal pose', () => {
    const order: string[] = []; const player = new PresentationPlayer(); let pose = 'intermediate';
    player.play([{ id: 'ordinary', durationSeconds: 1, finish: () => { pose = 'terminal'; order.push('ordinary-terminal'); } }], () => undefined);
    player.finishCurrentThenBuildAndPlay(() => {
      order.push(`build:${pose}`); return [{ id: 'campaign', durationSeconds: 0 }];
    }, () => order.push('complete'));
    player.finishImmediately(); expect(order).toEqual(['ordinary-terminal', 'build:terminal', 'complete']);
  });
});
