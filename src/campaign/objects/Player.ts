import * as THREE from 'three';
import type { Module } from './Module';
import { CAMPAIGN_MAP_ANCHORS, CAMPAIGN_MAP_BOUNDS, CAMPAIGN_PLAYER_COLLISION_RADIUS, type CampaignMap } from './CampaignMap';
import { CAMPAIGN_CONFIG } from '../CampaignConfig';

export type PlayerAnimationState = 'idle' | 'walking' | 'running' | 'holding' | 'carryWalking' | 'blockPush' | 'blockPull' | 'blockMoveFront';
const CLIP_NAME: Readonly<Record<PlayerAnimationState, string>> = Object.freeze({ idle: 'Idle_A', walking: 'Walking_A', running: 'Running_A', holding: 'Holding_A', carryWalking: 'CarryWalking_A', blockPush: 'BlockPush_A', blockPull: 'BlockPull_A', blockMoveFront: 'BlockMoveFront_A' });

export class Player {
  readonly root = new THREE.Group(); readonly heldAnchor = new THREE.Group();
  readonly position = new THREE.Vector2(CAMPAIGN_MAP_ANCHORS.player.x, CAMPAIGN_MAP_ANCHORS.player.z); readonly facing = new THREE.Vector2(0, -1);
  readonly heldMaterialIds: string[] = []; heldModule: Module | null = null; heldBlockId: string | null = null; moving = false;
  animationState: PlayerAnimationState = 'idle'; traveledDistance = 0; blockTravelDistance = 0;
  private readonly mixer: THREE.AnimationMixer | null; private readonly actions = new Map<PlayerAnimationState, THREE.AnimationAction>(); private activeAction: THREE.AnimationAction | null = null;

  constructor(visual: THREE.Object3D, animations: readonly THREE.AnimationClip[] = [], private readonly map?: CampaignMap) {
    this.root.name = 'campaign-player'; this.heldAnchor.name = 'campaign-player-held-anchor'; this.heldAnchor.position.set(0.005, 0.844, -0.548); this.root.add(this.heldAnchor);
    visual.traverse((node) => { node.castShadow = true; }); this.root.add(visual); this.mixer = animations.length > 0 ? new THREE.AnimationMixer(visual) : null;
    if (this.mixer !== null) for (const state of Object.keys(CLIP_NAME) as PlayerAnimationState[]) { const clip = animations.find((candidate) => candidate.name === CLIP_NAME[state]); if (clip !== undefined) this.actions.set(state, this.mixer.clipAction(clip)); }
    this.activate('idle'); this.syncRoot();
  }

  update(deltaSeconds: number): void {
    if (this.mixer === null) return; this.activate(this.animationState); this.mixer.update(deltaSeconds);
    const action = this.activeAction; if (action === null) return; const clip = action.getClip();
    if (['walking', 'running', 'carryWalking'].includes(this.animationState)) action.time = ((this.traveledDistance / CAMPAIGN_CONFIG.movement.ordinaryCycleDistanceMeters) % 1) * clip.duration;
    else if (['blockPush', 'blockPull', 'blockMoveFront'].includes(this.animationState)) action.time = ((this.blockTravelDistance / CAMPAIGN_CONFIG.movement.blockCycleDistanceMeters) % 1) * clip.duration;
    else if (this.animationState === 'holding') action.time = 0;
    this.mixer.update(0);
  }

  move(direction: THREE.Vector2, distance: number, running = false): void {
    if (direction.lengthSq() <= 0 || distance <= 0) { this.stop(); return; } direction.normalize(); const target = this.position.clone().addScaledVector(direction, distance);
    if (this.map !== undefined) this.map.clampPlayer(target); else { target.x = THREE.MathUtils.clamp(target.x, CAMPAIGN_MAP_BOUNDS.minX + CAMPAIGN_PLAYER_COLLISION_RADIUS, CAMPAIGN_MAP_BOUNDS.maxX - CAMPAIGN_PLAYER_COLLISION_RADIUS); target.y = THREE.MathUtils.clamp(target.y, CAMPAIGN_MAP_BOUNDS.minZ + CAMPAIGN_PLAYER_COLLISION_RADIUS, CAMPAIGN_MAP_BOUNDS.maxZ - CAMPAIGN_PLAYER_COLLISION_RADIUS); }
    this.moveTo(target, running);
  }

  moveTo(target: THREE.Vector2, running = false): void {
    const deltaX = target.x - this.position.x; const deltaZ = target.y - this.position.y; const distance = Math.hypot(deltaX, deltaZ);
    if (distance <= 1e-8) { this.stop(); return; } this.position.copy(target); this.facing.set(deltaX / distance, deltaZ / distance); this.moving = true; this.traveledDistance += distance;
    this.animationState = this.isCarrying ? 'carryWalking' : running ? 'running' : 'walking'; this.syncRoot();
  }

  applyBlockMovement(target: THREE.Vector2, state: Extract<PlayerAnimationState, 'holding' | 'blockPush' | 'blockPull' | 'blockMoveFront'>,
    facing: Readonly<{ x: number; y: number }>): void {
    const distance = target.distanceTo(this.position); if (distance > 0) { this.position.copy(target); this.blockTravelDistance += distance; this.moving = true; }
    this.facing.set(facing.x, facing.y).normalize(); this.animationState = distance > 0 ? state : 'holding'; this.syncRoot();
  }
  beginBlockContact(target: THREE.Vector2, facing: Readonly<{ x: number; y: number }>): void {
    this.position.copy(target); this.facing.set(facing.x, facing.y).normalize(); this.moving = false; this.animationState = 'holding'; this.syncRoot();
  }

  restorePose(position: Readonly<{ x: number; y: number }>, facing: Readonly<{ x: number; y: number }>): void {
    this.position.set(position.x, position.y); this.facing.set(facing.x, facing.y).normalize(); this.moving = false; this.animationState = 'idle'; this.syncRoot();
  }

  stop(): void { this.moving = false; this.animationState = this.isCarrying ? 'holding' : 'idle'; }
  reset(position: Readonly<{ x: number; z: number }>, facing: Readonly<{ x: number; z: number }>): void { this.position.set(position.x, position.z); this.facing.set(facing.x, facing.z).normalize(); this.moving = false; this.animationState = 'idle'; this.traveledDistance = 0; this.blockTravelDistance = 0; this.syncRoot(); }
  private get isCarrying(): boolean { return this.heldMaterialIds.length > 0 || this.heldModule !== null || this.heldBlockId !== null; }
  private activate(state: PlayerAnimationState): void { const next = this.actions.get(state) ?? this.actions.get('idle') ?? null; if (next === null || next === this.activeAction) return; this.activeAction?.fadeOut(0.12); next.reset().fadeIn(0.12).play(); this.activeAction = next; }
  private syncRoot(): void { this.root.position.set(this.position.x, 0, this.position.y); this.root.rotation.y = Math.atan2(-this.facing.x, -this.facing.y); }
}
