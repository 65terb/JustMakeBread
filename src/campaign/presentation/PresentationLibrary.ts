import * as THREE from 'three';
import type { CampaignModuleRevealConfig } from '../CampaignConfig';
import type { Module } from '../objects/Module';
import type { Player } from '../objects/Player';
import type { ProductionBlock } from '../objects/ProductionBlock';
import type { PresentationStep } from './PresentationPlayer';
import type { CampaignWorldBounds } from '../objects/CampaignMap';
import type { CampaignCollisionBounds } from '../objects/CampaignMap';
import { CAMPAIGN_CONFIG } from '../CampaignConfig';

export function moveCamera(
  id: string,
  camera: THREE.PerspectiveCamera,
  targetPosition: THREE.Vector3,
  targetLookAt: THREE.Vector3,
  durationSeconds: number,
  targetFar?: number,
): PresentationStep {
  const startPosition = new THREE.Vector3();
  const startLookAt = new THREE.Vector3();
  const currentDirection = new THREE.Vector3();
  const look = new THREE.Vector3();
  let started = false;
  let startFar = camera.far;
  return Object.freeze({
    id, durationSeconds,
    start: () => {
      started = true;
      startFar = camera.far;
      if (targetFar !== undefined && targetFar > camera.far) { camera.far = targetFar; camera.updateProjectionMatrix(); }
      startPosition.copy(camera.position);
      camera.getWorldDirection(currentDirection);
      startLookAt.copy(startPosition).add(currentDirection.multiplyScalar(8));
    },
    update: (progress) => {
      const eased = progress * progress * (3 - 2 * progress);
      camera.position.lerpVectors(startPosition, targetPosition, eased);
      look.lerpVectors(startLookAt, targetLookAt, eased); camera.lookAt(look);
    },
    finish: () => { camera.position.copy(targetPosition); camera.lookAt(targetLookAt); if (targetFar !== undefined && camera.far !== targetFar) { camera.far = targetFar; camera.updateProjectionMatrix(); } },
    cancel: () => { if (started) { camera.position.copy(startPosition); camera.lookAt(startLookAt); if (camera.far !== startFar) { camera.far = startFar; camera.updateProjectionMatrix(); } } },
  });
}

export function suctionMaterialRoots(
  id: string,
  scene: THREE.Scene,
  roots: readonly THREE.Object3D[],
  target: THREE.Vector3,
  durationSeconds: number,
  onFinish?: () => void,
): PresentationStep {
  const starts = roots.map((root) => root.getWorldPosition(new THREE.Vector3()));
  const scales = roots.map((root) => root.scale.clone());
  return Object.freeze({
    id, durationSeconds,
    start: () => { for (const root of roots) { scene.attach(root); root.visible = true; } },
    update: (progress) => {
      const eased = progress * progress;
      for (let index = 0; index < roots.length; index += 1) {
        roots[index]!.position.lerpVectors(starts[index]!, target, eased);
        roots[index]!.scale.copy(scales[index]!).multiplyScalar(1 - eased);
      }
    },
    finish: () => { for (const root of roots) root.removeFromParent(); onFinish?.(); },
    cancel: () => { for (const root of roots) root.removeFromParent(); },
  });
}

export function turnAndSwapBlocks(
  id: string,
  blocks: readonly ProductionBlock[],
  durationSeconds: number,
  swap: () => void,
  rollback?: () => void,
  swapProgress = CAMPAIGN_CONFIG.presentation.blockVisualSwapSeconds / CAMPAIGN_CONFIG.presentation.blockTurnSeconds,
): PresentationStep {
  const rotations = blocks.map((block) => block.root.rotation.y);
  let swapped = false;
  let capacityFramesStarted = false;
  const ensureCapacityFrames = (): void => {
    if (capacityFramesStarted) return;
    capacityFramesStarted = true;
    for (const block of blocks) block.beginCapacityPresentationFrame();
  };
  const ensureSwap = (): void => { if (!swapped) { swapped = true; swap(); } };
  return Object.freeze({
    id, durationSeconds,
    start: ensureCapacityFrames,
    update: (progress) => {
      ensureCapacityFrames();
      if (progress >= swapProgress) ensureSwap();
      const acceleration = CAMPAIGN_CONFIG.presentation.blockTurnAccelerationSeconds / CAMPAIGN_CONFIG.presentation.blockTurnSeconds;
      const cruise = CAMPAIGN_CONFIG.presentation.blockTurnCruiseSeconds / CAMPAIGN_CONFIG.presentation.blockTurnSeconds;
      const deceleration = CAMPAIGN_CONFIG.presentation.blockTurnDecelerationSeconds / CAMPAIGN_CONFIG.presentation.blockTurnSeconds;
      const velocity = 1 / (cruise + (acceleration + deceleration) * 0.5);
      let eased: number;
      if (progress < acceleration) eased = 0.5 * velocity * progress * progress / acceleration;
      else if (progress < acceleration + cruise) eased = 0.5 * velocity * acceleration + velocity * (progress - acceleration);
      else { const phase = progress - acceleration - cruise; eased = 0.5 * velocity * acceleration + velocity * cruise + velocity * phase - 0.5 * velocity * phase * phase / deceleration; }
      for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index]!;
        block.root.rotation.y = rotations[index]! + Math.PI * 2 * eased;
        block.updateCapacityPresentationFrame();
      }
    },
    finish: () => { ensureCapacityFrames(); ensureSwap(); for (let index = 0; index < blocks.length; index += 1) { const block = blocks[index]!; block.root.rotation.y = rotations[index]!; block.endCapacityPresentationFrame(); } },
    cancel: () => { ensureCapacityFrames(); if (swapped) rollback?.(); for (let index = 0; index < blocks.length; index += 1) { const block = blocks[index]!; block.root.rotation.y = rotations[index]!; block.endCapacityPresentationFrame(); } },
  });
}

export function callbackStep(id: string, callback: () => void, cancel?: () => void): PresentationStep {
  return Object.freeze({ id, durationSeconds: 0, start: callback, cancel });
}

export function revealModule(
  module: Module,
  context: Readonly<{
    scene: THREE.Scene;
    player: Player;
    blocks?: readonly ProductionBlock[];
    modules?: readonly Module[];
    fixedRoots?: readonly THREE.Object3D[];
    fixedBounds?: readonly CampaignCollisionBounds[];
    config: CampaignModuleRevealConfig;
    floorModuleHalfExtentMeters: number;
    bounds: CampaignWorldBounds;
    durationSeconds: number;
    onRevealed?: () => void;
  }>,
): readonly PresentationStep[] {
  const forward = new THREE.Vector3(context.player.facing.x, 0, context.player.facing.y);
  const side = new THREE.Vector3(-forward.z, 0, forward.x);
  const playerPosition = new THREE.Vector3(context.player.position.x, 0, context.player.position.y);
  const base = playerPosition.clone().addScaledVector(forward, context.config.forwardDistanceMeters);
  const candidates: THREE.Vector3[] = [];
  const bounds = context.bounds;
  const halfExtent = context.floorModuleHalfExtentMeters;
  const addCandidate = (forwardDistance: number, sideDistance: number): void => {
    const candidate = playerPosition.clone().addScaledVector(forward, forwardDistance).addScaledVector(side, sideDistance);
    candidate.x = THREE.MathUtils.clamp(candidate.x, bounds.minX + halfExtent, bounds.maxX - halfExtent);
    candidate.z = THREE.MathUtils.clamp(candidate.z, bounds.minZ + halfExtent, bounds.maxZ - halfExtent);
    if (!candidates.some((existing) => existing.distanceToSquared(candidate) < 1e-8)) candidates.push(candidate);
  };
  addCandidate(context.config.forwardDistanceMeters, 0);
  addCandidate(context.config.forwardDistanceMeters, context.config.sideOffsetMeters);
  addCandidate(context.config.forwardDistanceMeters, -context.config.sideOffsetMeters);
  const occupied = [
    ...(context.modules ?? []).filter((other) => other !== module && other.location.kind !== 'not-introduced')
      .map((other) => other.root.getWorldPosition(new THREE.Vector3())),
    ...(context.fixedRoots ?? []).map((root) => root.getWorldPosition(new THREE.Vector3())),
  ];
  const separation = (candidate: THREE.Vector3): number => Math.min(
    candidate.distanceTo(playerPosition),
    ...occupied.map((position) => candidate.distanceTo(position)),
  );
  const blockBounds = (context.blocks ?? []).map((block) => block.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 }));
  const clearsFixedBounds = (candidate: THREE.Vector3): boolean => [...blockBounds, ...(context.fixedBounds ?? [])].every((fixed) =>
    candidate.x <= fixed.minX - halfExtent || candidate.x >= fixed.maxX + halfExtent || candidate.z <= fixed.minZ - halfExtent || candidate.z >= fixed.maxZ + halfExtent);
  const minimum = context.config.minimumSeparationMeters;
  let landing = candidates.find((candidate) => separation(candidate) >= minimum && clearsFixedBounds(candidate));
  if (landing === undefined) {
    // The bounded campaign graph has player, two blocks, two prior modules,
    // pipe and dock. Grid
    // points are farther than 2×minimum apart, so each occupied root can
    // invalidate at most one point and the supported graph always has a safe
    // terminal. Sorting retains nearest-to-authored-base deterministic choice.
    const spacing = minimum * 2 + 0.05;
    const guaranteed: THREE.Vector3[] = [];
    for (let z = bounds.minZ + halfExtent; z <= bounds.maxZ - halfExtent + 1e-8; z += spacing) {
      for (let x = bounds.minX + halfExtent; x <= bounds.maxX - halfExtent + 1e-8; x += spacing) guaranteed.push(new THREE.Vector3(x, 0, z));
    }
    guaranteed.sort((left, right) => left.distanceToSquared(base) - right.distanceToSquared(base) || left.z - right.z || left.x - right.x);
    landing = guaranteed.find((candidate) => separation(candidate) >= minimum && clearsFixedBounds(candidate));
  }
  if (landing === undefined) throw new Error('Supported campaign graph has no non-overlapping module reveal terminal.');
  landing.y = 0.34;
  const start = landing.clone().setY(5);
  return [Object.freeze({
    id: `reveal-${module.id}`,
    durationSeconds: context.durationSeconds,
    start: () => { module.presentationLocked = true; module.revealAt(context.scene, start); },
    update: (progress: number) => {
      const eased = 1 - Math.pow(1 - progress, 3);
      module.root.position.lerpVectors(start, landing, eased);
    },
    finish: () => { module.root.position.copy(landing); module.location = Object.freeze({ kind: 'world' }); module.presentationLocked = false; context.onRevealed?.(); },
    cancel: () => { module.presentationLocked = false; module.location = Object.freeze({ kind: 'not-introduced' }); module.root.visible = false; },
  })];
}
