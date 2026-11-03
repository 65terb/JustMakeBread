import { describe, expect, it } from 'vitest';
import { CAMPAIGN_CONFIG } from './CampaignConfig';
import { CampaignScore } from './CampaignScore';
import { CampaignInput } from './CampaignInput';
import { installCampaignKeyboardOwner } from './CampaignKeyboard';
import { PresentationPlayer } from './presentation/PresentationPlayer';
import * as THREE from 'three';
import { Player } from './objects/Player';
import { CAMPAIGN_COLLISION_EPSILON_METERS, resolveEscapeAwareAxisDelta, resolveEscapeAwareBoundsDelta } from './objects/CampaignMap';

describe('campaign core owners', () => {
  it('commits each stage score exactly once and restores a retry baseline', () => {
    const score = new CampaignScore();
    expect(score.commit('stage0', CAMPAIGN_CONFIG.stages.stage0, 1, null)).toBe(100);
    const first = score.commit('stage1', CAMPAIGN_CONFIG.stages.stage1, 10, 7.9);
    const snapshot = score.snapshot();
    expect(first).toBe(1070);
    expect(score.commit('stage1', CAMPAIGN_CONFIG.stages.stage1, 99, 35)).toBe(first);
    score.commit('stage2', CAMPAIGN_CONFIG.stages.stage2, 1, 1);
    score.restore(snapshot);
    expect(score.snapshot()).toEqual(snapshot);
  });

  it('accepts one non-repeat R edge while keeping Enter, Space and E distinct', () => {
    const input = new CampaignInput();
    expect(input.keyDown('KeyR', false)).toBe(true);
    expect(input.consumeActions().retryPressed).toBe(true);
    expect(input.consumeActions().retryPressed).toBe(false);
    expect(input.keyDown('KeyR', true)).toBe(true);
    expect(input.consumeActions().retryPressed).toBe(false);
    expect(input.keyDown('Enter', false)).toBe(false);
  });

  it('tracks both Shift keys and emits only a timed non-repeat tap displacement', () => {
    const input = new CampaignInput(); const tap = { x: 0, y: 0 };
    input.keyDown('ShiftLeft', false); input.keyDown('ShiftRight', false); input.keyUp('ShiftLeft');
    expect(input.isRunning).toBe(true);
    input.keyDown('ArrowRight', false, 1000); input.keyDown('ArrowRight', true, 1010); input.keyUp('ArrowRight', 1119, 120, 0.18);
    expect(input.consumeTap(tap)).toBe(true); expect(tap).toEqual({ x: 0.18, y: 0 }); expect(input.consumeTapRunning()).toBe(true);
    input.keyUp('ShiftRight'); expect(input.isRunning).toBe(false);
    input.keyDown('ArrowUp', false, 2000); input.keyUp('ArrowUp', 2120, 120, 0.18); expect(input.consumeTap(tap)).toBe(false);
    input.keyDown('ShiftLeft', false); input.keyDown('ArrowUp', false, 3000); input.clear(); expect(input.isRunning).toBe(false);
    input.keyDown('ShiftLeft', true); input.keyDown('ArrowUp', true, 3010); const movement = { x: 0, y: 0 }; input.readMovement(movement);
    expect(input.isRunning).toBe(false); expect(movement).toEqual({ x: 0, y: 0 });
    const repeatOnly = new CampaignInput(); repeatOnly.keyDown('ArrowRight', true, 4000); repeatOnly.readMovement(movement);
    expect(movement).toEqual({ x: 0, y: 0 }); repeatOnly.keyUp('ArrowRight', 4010); expect(repeatOnly.consumeTap(tap)).toBe(false);
  });

  it('admits only arrow movement and keeps held E plus edge-only Q in one input owner', () => {
    const input = new CampaignInput(); const movement = { x: 0, y: 0 }; const tap = { x: 0, y: 0 };
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      expect(input.keyDown(code, false, 1000)).toBe(false);
      expect(input.keyUp(code, 1050, 120, 0.18)).toBe(false);
    }
    input.readMovement(movement); expect(movement).toEqual({ x: 0, y: 0 }); expect(input.consumeTap(tap)).toBe(false);
    expect(input.keyDown('KeyE', false)).toBe(true);
    expect(input.consumeActions()).toMatchObject({ interactPressed: true, interactHeld: true, dropPressed: false });
    expect(input.consumeActions()).toMatchObject({ interactPressed: false, interactHeld: true, dropPressed: false });
    expect(input.keyDown('KeyQ', true)).toBe(true); expect(input.consumeActions().dropPressed).toBe(false);
    expect(input.keyDown('KeyQ', false)).toBe(true); expect(input.consumeActions().dropPressed).toBe(true);
    expect(input.consumeActions().dropPressed).toBe(false);
    input.keyUp('KeyE'); expect(input.consumeActions().interactHeld).toBe(false);
    input.keyDown('KeyE', false); input.clear(); expect(input.consumeActions()).toMatchObject({ interactHeld: false, dropPressed: false });
  });

  it('forwards DOM keyboard timestamps and pointer unlock through one installed owner', () => {
    const listeners = new Map<string, EventListener>(); const calls: string[] = [];
    const windowOwner = {
      addEventListener: (type: string, listener: EventListener) => { listeners.set(type, listener); },
      removeEventListener: (type: string, listener: EventListener) => { if (listeners.get(type) === listener) listeners.delete(type); },
    };
    const ignoredTarget = {} as EventTarget;
    const remove = installCampaignKeyboardOwner({ window: windowOwner, isIgnoredTarget: (target) => target === ignoredTarget, receiver: {
      unlockAudio: () => calls.push('unlock'),
      cancelGameplayInput: () => calls.push('cancel'),
      keyDown: (code, repeat, timeStamp) => { calls.push(`down:${code}:${repeat}:${timeStamp}`); return true; },
      keyUp: (code, timeStamp) => { calls.push(`up:${code}:${timeStamp}`); return true; },
    } });
    listeners.get('keydown')?.({ code: 'ArrowRight', repeat: false, timeStamp: 1000, target: null, preventDefault: () => calls.push('prevent-down') } as unknown as Event);
    listeners.get('keyup')?.({ code: 'ArrowRight', repeat: false, timeStamp: 1119, target: null, preventDefault: () => calls.push('prevent-up') } as unknown as Event);
    listeners.get('pointerdown')?.({ button: 0, target: null } as unknown as Event);
    listeners.get('pointerdown')?.({ button: 2, target: null } as unknown as Event);
    listeners.get('pointerdown')?.({ button: 0, target: ignoredTarget } as unknown as Event);
    listeners.get('keyup')?.({ code: 'ArrowUp', timeStamp: 1200, target: ignoredTarget, preventDefault: () => calls.push('ignored-prevent') } as unknown as Event);
    listeners.get('contextmenu')?.(new Event('contextmenu')); listeners.get('pointercancel')?.(new Event('pointercancel'));
    expect(calls).toEqual(['unlock', 'down:ArrowRight:false:1000', 'prevent-down', 'up:ArrowRight:1119', 'prevent-up',
      'unlock', 'unlock', 'cancel', 'unlock', 'cancel', 'up:ArrowUp:1200', 'cancel', 'cancel']);
    remove(); expect(listeners.size).toBe(0);
  });

  it('drives ordinary and block clips from their named actual-distance cycles', () => {
    const clips = ['Idle_A', 'Walking_A', 'BlockPush_A'].map((name) => new THREE.AnimationClip(name, 1, []));
    const player = new Player(new THREE.Group(), clips);
    player.moveTo(player.position.clone().add(new THREE.Vector2(1, 0))); player.update(0);
    const walking = (player as unknown as { activeAction: THREE.AnimationAction }).activeAction;
    expect(walking.time).toBeCloseTo(0.5, 8);
    player.applyBlockMovement(player.position.clone().add(new THREE.Vector2(0.8, 0)), 'blockPush', new THREE.Vector2(1, 0)); player.update(0);
    const pushing = (player as unknown as { activeAction: THREE.AnimationAction }).activeAction;
    expect(pushing.time).toBeCloseTo(0.5, 8);
    const before = player.blockTravelDistance; player.applyBlockMovement(player.position.clone(), 'blockPush', new THREE.Vector2(1, 0)); player.update(0);
    expect(player.blockTravelDistance).toBe(before);
  });

  it('allows escape but rejects deeper entry at collision boundaries and tiny existing penetration', () => {
    const epsilon = CAMPAIGN_COLLISION_EPSILON_METERS;
    for (const start of [1 - epsilon * 0.5, 1, 1 + epsilon * 0.5]) {
      expect(resolveEscapeAwareAxisDelta(start, -0.18, 1, 2)).toBe(-0.18);
      expect(resolveEscapeAwareAxisDelta(start, 0.18, 1, 2)).toBe(0);
    }
    for (const start of [2 - epsilon * 0.5, 2, 2 + epsilon * 0.5]) {
      expect(resolveEscapeAwareAxisDelta(start, 0.18, 1, 2)).toBe(0.18);
      expect(resolveEscapeAwareAxisDelta(start, -0.18, 1, 2)).toBe(0);
    }
    expect(resolveEscapeAwareAxisDelta(0.8, 0.3, 1, 2)).toBeCloseTo(0.2, 8);
    expect(resolveEscapeAwareAxisDelta(2.2, -0.3, 1, 2)).toBeCloseTo(-0.2, 8);
    expect(resolveEscapeAwareBoundsDelta(1 - epsilon * 0.5, 0.18, 1, 2)).toBe(0.18);
    expect(resolveEscapeAwareBoundsDelta(1 - epsilon * 0.5, -0.18, 1, 2)).toBe(0);
    expect(resolveEscapeAwareBoundsDelta(2 + epsilon * 0.5, -0.18, 1, 2)).toBe(-0.18);
    expect(resolveEscapeAwareBoundsDelta(2 + epsilon * 0.5, 0.18, 1, 2)).toBe(0);
  });

  it('does not advance presentations while paused and completes each step once', () => {
    const player = new PresentationPlayer();
    const events: string[] = [];
    player.play([{ id: 'a', durationSeconds: 1, start: () => events.push('start'), finish: () => events.push('finish') }],
      () => events.push('complete'));
    player.setPaused(true); player.update(3);
    expect(events).toEqual(['start']);
    player.setPaused(false); player.update(1);
    expect(events).toEqual(['start', 'finish', 'complete']);
  });

  it('drains ordered zero-duration terminal steps in the timed step terminal update', () => {
    const player = new PresentationPlayer(); const events: string[] = [];
    player.play([
      { id: 'timed', durationSeconds: 0.2, start: () => events.push('timed-start'), finish: () => events.push('timed-finish') },
      { id: 'zero-a', durationSeconds: 0, start: () => events.push('a-start'), update: (progress) => events.push(`a-update-${progress}`), finish: () => events.push('a-finish') },
      { id: 'zero-b', durationSeconds: 0, start: () => events.push('b-start'), finish: () => events.push('b-finish') },
    ], () => events.push('complete'));
    player.update(0.2);
    expect(events).toEqual(['timed-start', 'timed-finish', 'a-start', 'a-update-1', 'a-finish', 'b-start', 'b-finish', 'complete']);
    expect(player.active).toBe(false);
  });

  it('cancels the whole required transaction on a fault and admits one clean retry', () => {
    const player = new PresentationPlayer(); const events: string[] = [];
    player.play([
      { id: 'scoreboard', durationSeconds: 0.1, cancel: () => events.push('cancel-scoreboard') },
      { id: 'suction', durationSeconds: 1, update: () => { throw new Error('required suction fault'); }, cancel: () => events.push('cancel-suction') },
      { id: 'stage-commit', durationSeconds: 0, start: () => events.push('commit'), cancel: () => events.push('cancel-commit') },
    ], () => events.push('complete'));
    player.update(0.1); player.update(0.1);
    expect(player.active).toBe(false); expect(player.lastFailure?.stepId).toBe('suction');
    expect(events).toEqual(['cancel-commit', 'cancel-suction', 'cancel-scoreboard']);
    expect(player.play([{ id: 'clean', durationSeconds: 0, start: () => events.push('clean') }], () => events.push('clean-complete'))).toBe(true);
    expect(player.finishImmediately()).toBe(true);
    expect(events).toContain('clean-complete'); expect(events).not.toContain('complete'); expect(events).not.toContain('commit');
  });

  it('contains a throwing transaction completion inside the same reverse-cancel boundary', () => {
    const player = new PresentationPlayer(); const events: string[] = [];
    expect(() => player.play([{ id: 'terminal', durationSeconds: 0, cancel: () => events.push('cancel') }],
      () => { throw new Error('completion fault'); }, (failure) => events.push(failure.stepId))).not.toThrow();
    player.update(0.01);
    expect(player.active).toBe(false); expect(player.lastFailure?.stepId).toBe('presentation-completion');
    expect(events).toEqual(['cancel', 'presentation-completion']);
  });
});
