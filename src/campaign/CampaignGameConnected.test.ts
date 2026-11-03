import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMPAIGN_CONFIG } from './CampaignConfig';
import { HELD_STACK_CONTACT_OVERLAP_METERS, HELD_STACK_LATERAL_OVERLAP_METERS } from './HeldMaterialLayout';
import { CampaignGame } from './CampaignGame';
import { CampaignBoot } from './CampaignBoot';
import { installCampaignKeyboardOwner } from './CampaignKeyboard';
import { CAMPAIGN_COLLISION_EPSILON_METERS, CAMPAIGN_MAP_ANCHORS, CAMPAIGN_MAP_BOUNDS, CAMPAIGN_WALL_PRESENTATION } from './objects/CampaignMap';
import { CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE_ID } from './presentation/PhysicalScoreboardTemplate';
import { testBlockVisual, testModuleVisual, testPlayerVisual } from './test/CampaignTestVisuals';
import { CAMPAIGN_ASSET_CONTRACTS, CAMPAIGN_PREPARED_HELD_LATERAL_WIDTH_METERS, CAMPAIGN_PREPARED_MATERIAL_HEIGHT_METERS, createCampaignBrowserAssetTransport, prepareCampaignAssetRoot, validateCampaignAssetBytes, validateParsedAsset, type CampaignAssetId } from './CampaignAssets';
import { readProductionModifiers } from './CampaignMechanics';
import { campaignScoreboardFont } from './presentation/CampaignScoreboardTypography';
import { MATERIAL_FLOOR_DROP_DURATION_SECONDS } from './presentation/MaterialTransferMotion';
import { turnAndSwapBlocks } from './presentation/PresentationLibrary';
import type { CampaignMaterial } from './objects/MaterialWorld';

class FakeElement {
  className = ''; hidden = false; textContent: string | null = ''; innerHTML = '';
  readonly dataset: Record<string, string> = {}; readonly style: Record<string, string> = {};
  disabled = false; checked = false; value = '0.35'; width = 0; height = 0;
  readonly drawnTexts: string[] = [];
  readonly drawnFonts: string[] = [];
  readonly attributes: Record<string, string> = {};
  replaced: unknown[] = [];
  private readonly children = new Map<string, FakeElement>();
  private readonly listeners = new Map<string, Array<() => void>>();
  readonly appended: unknown[] = [];
  removed = false; src = '';
  querySelector<T>(_selector: string): T { let child = this.children.get(_selector); if (child === undefined) { child = new FakeElement(); this.children.set(_selector, child); } return child as T; }
  append(...nodes: unknown[]): void { this.appended.push(...nodes); } remove(): void { this.removed = true; } replaceChildren(...nodes: unknown[]): void { this.replaced = nodes; }
  setAttribute(name: string, value: string): void { this.attributes[name] = value; } addEventListener(type: string, listener: () => void): void { const list = this.listeners.get(type) ?? []; list.push(listener); this.listeners.set(type, list); }
  removeEventListener(type: string, listener: () => void): void { const list = this.listeners.get(type) ?? []; this.listeners.set(type, list.filter((candidate) => candidate !== listener)); }
  listenerCount(type: string): number { return this.listeners.get(type)?.length ?? 0; }
  dispatch(type: string): void { for (const listener of this.listeners.get(type) ?? []) listener(); }
  focus(): void {} getContext(): CanvasRenderingContext2D { const context = {
    fillStyle: '', textAlign: 'center', textBaseline: 'middle', font: '',
    lineJoin: 'round', lineWidth: 0, strokeStyle: '',
    fillRect: () => undefined, clearRect: () => undefined, fillText: (text: string) => { this.drawnTexts.push(text); this.drawnFonts.push(context.font); }, strokeText: () => undefined,
    measureText: (text: string) => { const size = Number(context.font.match(/(\d+)px/)?.[1] ?? 16); return { width: text.length * size * 0.82, actualBoundingBoxAscent: size * 0.78, actualBoundingBoxDescent: size * 0.22 } as TextMetrics; },
    roundRect: () => ({}) as CanvasRenderingContext2D, fill: () => undefined,
    save: () => undefined, restore: () => undefined, translate: () => undefined,
    beginPath: () => undefined, moveTo: () => undefined, quadraticCurveTo: () => undefined,
    closePath: () => undefined, stroke: () => undefined,
    createLinearGradient: () => ({ addColorStop: () => undefined }),
  }; return context as unknown as CanvasRenderingContext2D; }
}

class FakeAudio {
  preload = ''; volume = 0; currentTime = 0;
  cloneNode(): FakeAudio { return new FakeAudio(); } play(): Promise<void> { return Promise.resolve(); }
  pause(): void {}
}

const fakeDocument = { createElement: () => new FakeElement() } as unknown as Document;
const fakeWindow = { location: { reload: () => undefined } } as unknown as Window;
function testKeycapTexture(label: 'W' | 'A' | 'S' | 'D' | 'E' | 'Q' | 'ARROWUP' | 'ARROWLEFT' | 'ARROWDOWN' | 'ARROWRIGHT' | 'SPACE' | 'SHIFT'): THREE.Texture {
  const texture = new THREE.Texture();
  const region = label.startsWith('ARROW') ? `arrow-${label.slice(5).toLowerCase()}` : label.toLowerCase();
  texture.userData.approvedAtlasRegion = label === 'SPACE' ? 'wide-space-normal' : label === 'SHIFT' ? 'wide-shift-normal' : `standard-${region}-normal`;
  return texture;
}
const fakeAssets = {
  clonePrepared(id: string): THREE.Object3D {
    if (id === 'player') return testPlayerVisual();
    if (id === 'fast' || id === 'double' || id === 'again') return testModuleVisual();
    if (id === 'stage0-block') return testBlockVisual('socketless');
    if (id === 'stage1-block') return testBlockVisual('single-socket');
    if (id === 'stage2-block') return testBlockVisual('double-socket');
    const root = new THREE.Group();
    if (id === 'wheat-source') {
      const wall = new THREE.Group(); wall.name = 'wallAttachment'; wall.position.set(-0.4284332895, 0.4246366155, 0);
      const spawn = new THREE.Group(); spawn.name = 'wheatSpawn'; spawn.position.set(0.1515436128, 0.4246366155, 0);
      const exit = new THREE.Group(); exit.name = 'wheatExit'; exit.position.set(0.5533130586, 0.4246366155, 0); root.add(wall, spawn, exit);
    }
    if (id === 'submission-dock') for (const name of ['interactionProxyReference', 'breadContact', 'suctionTarget', 'goalBoardMount', 'outwardNormal']) { const anchor = new THREE.Group(); anchor.name = name; if (name === 'interactionProxyReference') anchor.position.z = -0.465; if (name === 'goalBoardMount') anchor.position.y = 0.69; if (name === 'outwardNormal') anchor.rotation.x = Math.PI / 2; root.add(anchor); }
    return root;
  },
  createKeycapTexture: testKeycapTexture, createEKeycapTexture: () => testKeycapTexture('E'),
  clips: () => [],
} as unknown as import('./CampaignAssets').CampaignAssets;

async function actualAuthoredObjectAssets(): Promise<import('./CampaignAssets').CampaignAssets> {
  const loader = new GLTFLoader(); const sources = new Map<CampaignAssetId, THREE.Object3D>(); const clips = new Map<CampaignAssetId, readonly THREE.AnimationClip[]>();
  for (const id of ['player', 'stage0-block', 'stage1-block', 'stage2-block', 'fast', 'wheat', 'flour', 'bread', 'submission-dock'] as const) {
    const definition = CAMPAIGN_ASSET_CONTRACTS[id]; const data = await readFile(path.join(process.cwd(), 'public', ...definition.url.split('/').filter(Boolean)));
    const buffer = new Uint8Array(data).slice().buffer; await validateCampaignAssetBytes(id, buffer);
    const gltf = await loader.parseAsync(buffer, ''); validateParsedAsset(id, gltf); sources.set(id, gltf.scene); clips.set(id, gltf.animations);
  }
  return {
    load: async () => undefined,
    clonePrepared(id: CampaignAssetId): THREE.Object3D {
      if (id === 'player') return prepareCampaignAssetRoot(id, sources.get('player')!);
      if (id === 'fast' || id === 'double' || id === 'again') return prepareCampaignAssetRoot(id, sources.get('fast')!);
      if (id === 'stage0-block' || id === 'stage1-block' || id === 'stage2-block') return prepareCampaignAssetRoot(id, sources.get(id)!);
      if (id === 'wheat' || id === 'flour' || id === 'bread') return prepareCampaignAssetRoot(id, sources.get(id)!);
      if (id === 'submission-dock') return prepareCampaignAssetRoot(id, sources.get(id)!);
      return fakeAssets.clonePrepared(id);
    }, createKeycapTexture: testKeycapTexture, createEKeycapTexture: () => testKeycapTexture('E'), clips: (id: CampaignAssetId) => clips.get(id) ?? [],
  } as unknown as import('./CampaignAssets').CampaignAssets;
}

async function actualPreparedMaterial(id: 'wheat' | 'flour' | 'bread'): Promise<THREE.Object3D> {
  const definition = CAMPAIGN_ASSET_CONTRACTS[id];
  const data = await readFile(path.join(process.cwd(), 'public', ...definition.url.split('/').filter(Boolean)));
  const buffer = new Uint8Array(data).slice().buffer; await validateCampaignAssetBytes(id, buffer);
  const gltf = await new GLTFLoader().parseAsync(buffer, ''); validateParsedAsset(id, gltf);
  return prepareCampaignAssetRoot(id, gltf.scene);
}

function tap(game: CampaignGame, code: string, deltaSeconds = 0.016): void {
  expect(game.keyDown(code, false), `${code} should be accepted while ${JSON.stringify(game.state.phase)}`).toBe(true);
  game.update(deltaSeconds); game.keyUp(code);
}

function moveTo(game: CampaignGame, x: number, z: number): void {
  if (Math.abs(x - game.player.position.x) > 1e-5 && (game.player.position.y <= -0.95 || z <= -0.95)) {
    const safeZ = 0;
    const safeDelta = safeZ - game.player.position.y;
    if (Math.abs(safeDelta) > 1e-5) { const code = safeDelta > 0 ? 'ArrowDown' : 'ArrowUp'; game.keyDown(code, false); game.update(Math.abs(safeDelta) / CAMPAIGN_CONFIG.movement.walkMetersPerSecond); game.keyUp(code); }
  }
  const dx = x - game.player.position.x;
  if (Math.abs(dx) > 1e-5) { const code = dx > 0 ? 'ArrowRight' : 'ArrowLeft'; game.keyDown(code, false); game.update(Math.abs(dx) / CAMPAIGN_CONFIG.movement.walkMetersPerSecond); game.keyUp(code); }
  const dz = z - game.player.position.y;
  if (Math.abs(dz) > 1e-5) { const code = dz > 0 ? 'ArrowDown' : 'ArrowUp'; game.keyDown(code, false); game.update(Math.abs(dz) / CAMPAIGN_CONFIG.movement.walkMetersPerSecond); game.keyUp(code); }
}

function moveToBlockSide(game: CampaignGame, block: CampaignGame['blocks'][number], side: 'left' | 'right' = 'left'): void {
  const contactDistance = CAMPAIGN_CONFIG.movement.blockHalfExtentMeters + CAMPAIGN_CONFIG.movement.playerRadiusMeters;
  moveTo(game, block.root.position.x + (side === 'left' ? -contactDistance : contactDistance), block.root.position.z);
  game.update(0.016);
}

function moveToBlockFront(game: CampaignGame, block: CampaignGame['blocks'][number], offsetX = 0): void {
  const contactDistance = CAMPAIGN_CONFIG.movement.blockHalfExtentMeters + CAMPAIGN_CONFIG.movement.playerRadiusMeters;
  moveTo(game, block.root.position.x + offsetX, block.root.position.z + contactDistance);
  game.update(0.016);
}

function expectVisibleSpaceKeycap(game: CampaignGame, block: CampaignGame['blocks'][number]): void {
  expect(game.interactionKeycap.label).toBe('SPACE'); expect(game.interactionKeycap.root.visible).toBe(true);
  expect(game.interactionKeycap.root.children).toHaveLength(1);
  const face = game.interactionKeycap.root.getObjectByName('campaign-approved-atlas-keycap-plane');
  expect(face).toBeInstanceOf(THREE.Mesh); const mesh = face as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  expect(mesh.visible).toBe(true); expect(mesh.material.visible).toBe(true); expect(mesh.material.transparent).toBe(true);
  expect(mesh.material.map?.userData.approvedAtlasRegion).toBe('wide-space-normal');
  expect(game.interactionKeycap.root.userData.approvedAtlasRegion).toBe('wide-space-normal');
  const blockBounds = new THREE.Box3().setFromObject(block.root); const promptWorld = game.interactionKeycap.root.getWorldPosition(new THREE.Vector3());
  expect(promptWorld.x).toBeCloseTo(block.root.position.x, 8); expect(promptWorld.z).toBeCloseTo(block.root.position.z, 8);
  expect(promptWorld.y).toBeGreaterThan(blockBounds.max.y);
  const camera = (game as unknown as { options: { camera: THREE.PerspectiveCamera } }).options.camera;
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); const projected = promptWorld.clone().project(camera);
  expect(Math.abs(projected.x)).toBeLessThanOrEqual(1); expect(Math.abs(projected.y)).toBeLessThanOrEqual(1); expect(projected.z).toBeGreaterThanOrEqual(-1); expect(projected.z).toBeLessThanOrEqual(1);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  expect(frustum.intersectsObject(mesh)).toBe(true);
}

function expectPlayingInteractionRetired(game: CampaignGame): void {
  expect((game as unknown as { selectedAction: unknown }).selectedAction).toBeNull();
  expect((game as unknown as { interaction: { selected: unknown } }).interaction.selected).toBeNull();
  expect(game.interactionKeycap.label).toBeNull();
  expect(game.interactionKeycap.root.visible).toBe(false);
}

function moveToSocketInteraction(game: CampaignGame, block: CampaignGame['blocks'][number], socket: CampaignGame['blocks'][number]['sockets'][number]): void {
  const seat = socket.readWorldPosition(new THREE.Vector3());
  const contactDistance = CAMPAIGN_CONFIG.movement.blockHalfExtentMeters + CAMPAIGN_CONFIG.movement.playerRadiusMeters;
  moveTo(game, seat.x, block.root.position.z + contactDistance + 0.5);
}

function completeStage0ToTimedEntrance(game: CampaignGame): void {
  tap(game, 'ArrowUp', 0.05);
  game.keyDown('ShiftLeft', false); game.keyDown('ArrowUp', false); game.update(0.05); game.keyUp('ArrowUp'); game.keyUp('ShiftLeft');
  game.update(1.45); game.update(0.55);
  const wheat = game.materials.all().find((material) => material.type === 'wheat' && material.location === 'world')!;
  moveTo(game, wheat.root.position.x, wheat.root.position.z); tap(game, 'KeyE'); tap(game, 'KeyQ'); game.update(0.016); tap(game, 'KeyE');
  game.update(CAMPAIGN_CONFIG.presentation.stage0BlockRevealDropSeconds);
  tap(game, 'KeyE');
  moveTo(game, -5.5, -2.5); tap(game, 'KeyQ'); game.update(0.016); game.update(2.4);
  game.update(CAMPAIGN_CONFIG.presentation.stage0BlockRevealDropSeconds); game.update(0.42);
  const flour = game.materials.all().find((material) => material.type === 'flour' && material.location === 'output')!;
  flour.root.getWorldPosition(new THREE.Vector3()); moveTo(game, flour.root.position.x, flour.root.position.z); tap(game, 'KeyE');
  moveTo(game, 2.2, -2.5); tap(game, 'KeyQ'); game.update(0.016);
  expect(game.tutorial.currentStepId).toBe('move-heater'); expect(game.blocks[1]!.processingSeconds).toBe(0);
  moveToBlockSide(game, game.blocks[1]!, 'left');
  game.keyDown('Space', false); game.update(0.016); game.keyDown('ArrowRight', false); game.update(0.06); game.keyUp('ArrowRight'); tap(game, 'Space');
  game.update(1.65); game.update(0.42);
  expect(game.materials.all().map((material) => `${material.type}:${material.location}`)).toContain('bread:output');
  const bread = game.materials.all().find((material) => material.type === 'bread' && material.location === 'output')!;
  moveTo(game, bread.root.position.x, bread.root.position.z); tap(game, 'KeyE');
  moveTo(game, 9.9, -3.135); tap(game, 'KeyQ'); game.update(0.016);
  expect(game.state.phase.kind).toBe('clear-presentation');
}

function reachStage1(game: CampaignGame): void {
  completeStage0ToTimedEntrance(game);
  for (let index = 0; index < 100 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
  expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage1' });
  expect(game.wheatSource.readStage0RevealDiagnostics()).toMatchObject({ state: 'revealed', revealed: true,
    visualVisible: true, visualScale: 1 });
}

function completeCurrentStage(game: CampaignGame, breadCount: number): void {
  for (let index = 0; index < breadCount; index += 1) game.materials.create('bread', game.submissionDock.root.position.clone());
  game.update(0.016);
  expect(game.state.phase.kind).toBe('clear-presentation');
  for (let index = 0; index < 120 && game.state.phase.kind === 'clear-presentation'; index += 1) game.update(0.1);
}

function repeatRetry(game: CampaignGame, stage: 'stage1' | 'stage2' | 'stage3', repetitions: number): void {
  for (let attempt = 0; attempt < repetitions; attempt += 1) {
    const retainedRoots = game.modules.map((module) => module.root);
    game.materials.create('wheat', game.player.root.position.clone());
    game.update(100);
    expect(game.state.phase).toEqual({ kind: 'game-over-presentation', stage });
    for (let index = 0; index < 40 && game.state.phase.kind !== 'game-over'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'game-over', stage });
    expect(game.keyDown('Enter', false)).toBe(true); expect(game.state.phase.kind).toBe('game-over');
    expect(game.keyDown('Space', false)).toBe(true); expect(game.state.phase.kind).toBe('game-over');
    expect(game.keyDown('KeyE', false)).toBe(true); expect(game.state.phase.kind).toBe('game-over');
    expect(game.keyDown('KeyR', false)).toBe(true); expect(game.state.phase.kind).toBe('retry-presentation');
    expect(game.keyDown('KeyR', true)).toBe(true); expect(game.state.phase.kind).toBe('retry-presentation');
    for (let index = 0; index < 30 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'playing', stage });
    expect(game.state.remainingSeconds).toBeGreaterThanOrEqual(stage === 'stage3' ? 59.8 : 29.8);
    expect(retainedRoots.every((root) => root.parent !== null)).toBe(true);
    expect(game.materials.all()).toHaveLength(0);
  }
}

function attachWorldModule(game: CampaignGame, module: CampaignGame['modules'][number], block: CampaignGame['blocks'][number]): void {
  const rootIdentity = module.root;
  const labelFaces = module.type === 'again' ? ['front', 'rear', 'left', 'right', 'top'] : ['front', 'left', 'right', 'top'];
  const labels = labelFaces.map((face) => module.root.getObjectByName(`campaign-module-${module.type}-label-${face}`) as THREE.Mesh);
  const labelTexture = (labels[0]!.material as THREE.MeshBasicMaterial).map;
  const camera = (game as unknown as { options: { camera: THREE.Camera } }).options.camera;
  const expectReadableSurface = (): void => {
    const towardCamera = camera.getWorldPosition(new THREE.Vector3()).sub(module.root.getWorldPosition(new THREE.Vector3())).normalize();
    const surfaceNormals = labels.map((label) => new THREE.Vector3(0, 0, 1).applyQuaternion(label.getWorldQuaternion(new THREE.Quaternion())).normalize());
    if (module.type !== 'again') {
      const gauge = module.root.getObjectByName(`campaign-module-${module.type}-rear-gauge`)!;
      surfaceNormals.push(new THREE.Vector3(0, 0, 1).applyQuaternion(gauge.getWorldQuaternion(new THREE.Quaternion())).normalize());
    }
    expect(Math.max(...surfaceNormals.map((normal) => normal.dot(towardCamera)))).toBeGreaterThan(0.05);
    expect(module.root).toBe(rootIdentity);
    expect(labels.every((label) => (label.material as THREE.MeshBasicMaterial).map === labelTexture)).toBe(true);
  };
  const modulePosition = module.root.getWorldPosition(new THREE.Vector3());
  const competitors = [
    ...game.modules.filter((candidate) => candidate !== module && candidate.location.kind !== 'not-introduced').map((candidate) => candidate.root.getWorldPosition(new THREE.Vector3())),
    ...game.materials.all().filter((material) => material.location === 'world' || material.location === 'output').map((material) => material.root.getWorldPosition(new THREE.Vector3())),
  ];
  const approaches = Array.from({ length: 16 }, (_, index) => modulePosition.clone().add(new THREE.Vector3(
    Math.cos(index * Math.PI / 8) * 1.25, 0, Math.sin(index * Math.PI / 8) * 1.25,
  )));
  approaches.sort((left, right) => Math.min(...competitors.map((position) => right.distanceTo(position)), Number.POSITIVE_INFINITY) -
    Math.min(...competitors.map((position) => left.distanceTo(position)), Number.POSITIVE_INFINITY));
  moveTo(game, approaches[0]!.x, approaches[0]!.z); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds + 0.01);
  expect(game.player.heldModule).toBe(module);
  const socket = block.sockets.find((candidate) => candidate.enabled && candidate.module === null)!;
  const socketPosition = socket.readWorldPosition(new THREE.Vector3()); moveTo(game, socketPosition.x, socketPosition.z);
  game.update(0.016); expect(game.interactionKeycap.label).toBe('E'); expect(game.interactionKeycap.root.visible).toBe(true);
  tap(game, 'KeyE');
  const insertionDuration = module.type === 'again'
    ? CAMPAIGN_CONFIG.presentation.againAttachApproachSeconds + CAMPAIGN_CONFIG.presentation.againAttachInsertSeconds + CAMPAIGN_CONFIG.presentation.againAttachSettleSeconds
    : CAMPAIGN_CONFIG.presentation.moduleInsertSeconds;
  for (const _sample of [0.25, 0.5, 0.75]) { game.update(insertionDuration * 0.25); expectReadableSurface(); }
  expect(socket.module).toBe(module); expect(module.location.kind).toBe('socket');
  if (module.type === 'again') {
    game.update(0.35);
    const front = module.root.getObjectByName('campaign-module-again-label-front')!;
    const frontNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(front.getWorldQuaternion(new THREE.Quaternion())).normalize();
    expect(frontNormal.dot(socket.readOutwardDirection(new THREE.Vector3()))).toBeLessThan(-0.999);
  }
}

function detachAndDrop(game: CampaignGame, module: CampaignGame['modules'][number], dropIndex: number): void {
  game.presentation.finishImmediately();
  expect(module.location.kind).toBe('socket'); if (module.location.kind !== 'socket') return;
  const block = module.location.block; const socket = block.sockets[module.location.socket];
  moveToSocketInteraction(game, block, socket); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds); expect(game.player.heldModule).toBe(module);
  moveTo(game, -4 + dropIndex * 1.4, 3); game.update(0.016);
  expect(game.interactionKeycap.label).toBeNull(); expect(game.interactionKeycap.root.visible).toBe(false);
  const selected = heldModuleDropTarget(game); expect(selected?.kind).toBe('floor-drop');
  const landing = selected?.landing.clone() ?? new THREE.Vector3();
  tap(game, 'KeyQ'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds); expect(module.location.kind).toBe('world');
  expect(module.root.getWorldPosition(new THREE.Vector3()).distanceTo(landing)).toBeLessThan(1e-6);
}

function relocateWorldModule(game: CampaignGame, module: CampaignGame['modules'][number], dropIndex: number): void {
  expect(module.location.kind).toBe('world'); const original = module.root.getWorldPosition(new THREE.Vector3());
  moveTo(game, original.x, original.z); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds); expect(game.player.heldModule).toBe(module);
  moveTo(game, -3.5 + dropIndex * 2.4, 2.9); game.update(0.016); const target = heldModuleDropTarget(game); expect(target?.kind).toBe('floor-drop');
  const landing = target?.landing.clone() ?? new THREE.Vector3(); tap(game, 'KeyQ'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds);
  expect(module.location.kind).toBe('world'); expect(module.root.getWorldPosition(new THREE.Vector3()).distanceTo(landing)).toBeLessThan(1e-6);
  expect(module.root.getWorldPosition(new THREE.Vector3()).distanceTo(original)).toBeGreaterThan(0.25);
  moveTo(game, landing.x, landing.z); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds); expect(game.player.heldModule).toBe(module);
  moveTo(game, -2.8 + dropIndex * 2.4, 1.7); game.update(0.016); expect(heldModuleDropTarget(game)?.kind).toBe('floor-drop');
  const setupTarget = heldModuleDropTarget(game); expect(setupTarget?.kind).toBe('floor-drop');
  expect(module.dropTo((game as unknown as { options: { scene: THREE.Scene } }).options.scene,
    setupTarget?.landing ?? new THREE.Vector3(), game.player)).toBe(true);
  expect(module.location.kind).toBe('world');
}

function moduleBodyColor(module: CampaignGame['modules'][number]): THREE.Color {
  return module.readBodyColor(new THREE.Color());
}
function colorDistance(left: THREE.Color, right: THREE.Color): number { return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b); }
function heldModuleDropTarget(game: CampaignGame): import('./CampaignInteraction').FloorDropCandidate | null {
  return (game as unknown as { interaction: { readHeldModuleDropTarget(): import('./CampaignInteraction').FloorDropCandidate | null } })
    .interaction.readHeldModuleDropTarget();
}

describe('CampaignGame connected transition priority', () => {
  beforeEach(() => {
    Object.assign(globalThis, { document: fakeDocument, Audio: FakeAudio, localStorage: { getItem: () => null, setItem: () => undefined } });
    vi.stubGlobal('self', globalThis); vi.stubGlobal('createImageBitmap', async () => ({ width: 1, height: 1, close: () => undefined }));
  });
  afterEach(() => { vi.unstubAllGlobals(); delete (globalThis as { document?: unknown }).document; delete (globalThis as { Audio?: unknown }).Audio; delete (globalThis as { localStorage?: unknown }).localStorage; });

  it('applies the latest Boot viewport before running publication and the first real game render', async () => {
    const assets = await actualAuthoredObjectAssets();
    for (const [width, height] of [[1280, 720], [1920, 1080], [1366, 768]] as const) {
      const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(21, 1, 0.1, 100); const mount = new FakeElement();
      let renderCount = 0; let runningCount = 0; let runningObservedAspect = 0; let runningObservedLoadingRemoved = false;
      const renderer = { capabilities: { getMaxAnisotropy: () => 8 }, setPixelRatio: () => undefined, setSize: () => undefined, dispose: () => undefined,
        render: () => { renderCount += 1; expect(runningCount).toBe(1); expect(camera.aspect).toBeCloseTo(width / height, 8); expect(camera.position.length()).toBeGreaterThan(1); } } as unknown as THREE.WebGLRenderer;
      const boot = new CampaignBoot({ document: fakeDocument, window: fakeWindow, mount: mount as unknown as HTMLElement,
        tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
        renderer, scene, camera, assets, onRunning: () => { runningCount += 1; runningObservedAspect = camera.aspect; runningObservedLoadingRemoved = (mount.appended[0] as FakeElement).removed; } });
      expect((mount.appended[0] as FakeElement).innerHTML).toContain('campaign-loading__thumbnail');
      const loadingCss = await readFile(path.join(process.cwd(), 'src', 'style.css'), 'utf8');
      expect(loadingCss).toMatch(/\.campaign-loading__thumbnail\s*\{[^}]*object-fit:\s*contain/s); expect(loadingCss).not.toMatch(/background-size:\s*cover/);
      boot.render(); expect(renderCount).toBe(0);
      boot.resize(width, height, 1.5); expect(renderCount).toBe(0);
      expect(await boot.load()).toBe(true); expect(boot.phase).toBe('running'); expect(runningObservedAspect).toBeCloseTo(width / height, 8);
      expect(runningObservedLoadingRemoved).toBe(true); expect(renderCount).toBe(1);
      const runningGame = (boot as unknown as { game: CampaignGame }).game;
      const label = runningGame.blocks[0]!.root.getObjectByName('campaign-block-function-surface') as THREE.Mesh;
      expect(((label.material as THREE.MeshBasicMaterial).map as THREE.Texture).anisotropy).toBe(8);
      for (const module of runningGame.modules) {
        const faces = module.type === 'again' ? ['front', 'rear', 'left', 'right', 'top'] : ['front', 'left', 'right', 'top'];
        const surfaces = faces.map((face) => module.root.getObjectByName(`campaign-module-${module.type}-label-${face}`) as THREE.Mesh);
        const frontTexture = (surfaces[0]!.material as THREE.MeshBasicMaterial).map!;
        expect(surfaces.every((surface) => (surface.material as THREE.MeshBasicMaterial).map === frontTexture)).toBe(true);
        expect(frontTexture.anisotropy).toBe(8);
        expect(frontTexture.magFilter).toBe(THREE.LinearFilter); expect(frontTexture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
        expect(frontTexture.generateMipmaps).toBe(true);
      }
      boot.dispose();
    }
  });

  it('loads the exact Galmuri11 Bold face through the browser readiness owner before the first dock draw', async () => {
    const authored = await actualAuthoredObjectAssets(); const order: string[] = []; let loaded = false;
    class ObservedElement extends FakeElement {
      override getContext(): CanvasRenderingContext2D {
        const context = super.getContext(); const fillText = context.fillText.bind(context);
        context.fillText = (text, x, y, maxWidth) => {
          if (/^\d+ \/ \d+$/.test(text)) { order.push(`dock:${context.font}`); expect(loaded).toBe(true); }
          fillText(text, x, y, maxWidth);
        };
        return context;
      }
    }
    const fontDocument = {
      createElement: () => new ObservedElement(),
      fonts: {
        load: async (font: string, sample: string) => { order.push(`load:${font}:${sample}`); loaded = true; return [{} as FontFace]; },
        ready: Promise.resolve(),
        check: (font: string) => { order.push(`check:${font}`); return loaded; },
      },
    } as unknown as Document;
    Object.assign(globalThis, { document: fontDocument });
    const browserReady = createCampaignBrowserAssetTransport().ready;
    const assets = {
      load: async (_progress: (label: string) => void, signal?: AbortSignal) => browserReady(signal),
      clonePrepared: (id: CampaignAssetId) => authored.clonePrepared(id), clips: (id: CampaignAssetId) => authored.clips(id),
      createKeycapTexture: (label: 'W' | 'A' | 'S' | 'D' | 'E' | 'SPACE' | 'SHIFT') => authored.createKeycapTexture(label),
      createEKeycapTexture: () => authored.createEKeycapTexture(),
    } as unknown as import('./CampaignAssets').CampaignAssets;
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(); const mount = new ObservedElement();
    const renderer = { capabilities: { getMaxAnisotropy: () => 1 }, setPixelRatio: () => undefined, setSize: () => undefined,
      dispose: () => undefined, render: () => undefined } as unknown as THREE.WebGLRenderer;
    const boot = new CampaignBoot({ document: fontDocument, window: fakeWindow, mount: mount as unknown as HTMLElement,
      tutorialSurface: new ObservedElement() as unknown as HTMLElement, canvas: new ObservedElement() as unknown as HTMLCanvasElement,
      renderer, scene, camera, assets });
    boot.resize(1280, 720, 1); await expect(boot.load()).resolves.toBe(true);
    const dockDraw = order.findIndex((entry) => entry.startsWith('dock:'));
    expect(order[0]).toBe('load:900 16px Galmuri11:0 / 30'); expect(dockDraw).toBeGreaterThan(order.findIndex((entry) => entry === 'check:900 16px Galmuri11'));
    expect(order[dockDraw]).toBe(`dock:${campaignScoreboardFont(176)}`); boot.dispose();
  });

  it('carries public Boot timestamps into collision-resolved short-tap movement', async () => {
    const assets = await actualAuthoredObjectAssets();
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(21, 1, 0.1, 100); const mount = new FakeElement();
    const renderer = { capabilities: { getMaxAnisotropy: () => 8 }, setPixelRatio: () => undefined, setSize: () => undefined,
      dispose: () => undefined, render: () => undefined } as unknown as THREE.WebGLRenderer;
    const boot = new CampaignBoot({ document: fakeDocument, window: fakeWindow, mount: mount as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      renderer, scene, camera, assets });
    boot.resize(1280, 720, 1); expect(await boot.load()).toBe(true);
    const game = (boot as unknown as { game: CampaignGame }).game;

    const listeners = new Map<string, EventListener>();
    const eventWindow = {
      addEventListener: (type: string, listener: EventListener) => { listeners.set(type, listener); },
      removeEventListener: (type: string, listener: EventListener) => { if (listeners.get(type) === listener) listeners.delete(type); },
    };
    const ignoredTarget = {} as EventTarget;
    const removeKeyboardOwner = installCampaignKeyboardOwner({ window: eventWindow, receiver: boot, isIgnoredTarget: (target) => target === ignoredTarget });
    let prevented = 0;
    const dispatchKey = (type: 'keydown' | 'keyup', code: string, timeStamp: number, repeat = false, target: EventTarget | null = null): void => {
      const preventDefault = () => { prevented += 1; };
      listeners.get(type)?.({ code, timeStamp, repeat, preventDefault, target } as unknown as Event);
    };

    const legacyStart = game.player.position.clone();
    dispatchKey('keydown', 'KeyD', 900); dispatchKey('keyup', 'KeyD', 950); boot.update(0.016);
    expect(game.player.position).toEqual(legacyStart); expect(prevented).toBe(0);

    const tapStart = game.player.position.x;
    dispatchKey('keydown', 'ArrowRight', 1000); dispatchKey('keyup', 'ArrowRight', 1119); boot.update(0.016);
    expect(game.player.position.x - tapStart).toBeCloseTo(CAMPAIGN_CONFIG.movement.tapMinimumDistanceMeters, 8);
    expect(game.player.root.position.x).toBeCloseTo(game.player.position.x, 8);

    const primaryStart = game.player.position.x; dispatchKey('keydown', 'ArrowRight', 1200);
    listeners.get('pointerdown')?.({ button: 0, target: null } as unknown as Event); boot.update(0.1);
    expect(game.player.position.x).toBeGreaterThan(primaryStart); dispatchKey('keyup', 'ArrowRight', 1290);

    const settingsStart = game.player.position.x; dispatchKey('keydown', 'ArrowRight', 1291);
    listeners.get('pointerdown')?.({ button: 0, target: ignoredTarget } as unknown as Event); boot.update(0.1);
    expect(game.player.position.x).toBeCloseTo(settingsStart, 8); dispatchKey('keyup', 'ArrowRight', 1299, false, ignoredTarget);

    const cancelledStart = game.player.position.x; dispatchKey('keydown', 'ArrowRight', 1300); listeners.get('contextmenu')?.(new Event('contextmenu')); boot.update(0.1);
    expect(game.player.position.x).toBeCloseTo(cancelledStart, 8);
    dispatchKey('keydown', 'ArrowLeft', 1400); boot.update(0.1); dispatchKey('keyup', 'ArrowLeft', 1520, false, ignoredTarget);
    const freshA = game.player.position.x; expect(freshA).toBeLessThan(cancelledStart); boot.update(0.1); expect(game.player.position.x).toBe(freshA);
    dispatchKey('keydown', 'ShiftLeft', 1600); dispatchKey('keydown', 'ArrowUp', 1601); const chordStart = game.player.position.y; boot.update(0.1);
    expect(game.player.position.y).toBeLessThan(chordStart); dispatchKey('keyup', 'ArrowUp', 1700); dispatchKey('keyup', 'ShiftLeft', 1700);

    const exactBoundaryStart = game.player.position.x;
    boot.keyDown('ArrowRight', false, 2000); boot.keyUp('ArrowRight', 2120); boot.update(0.016);
    expect(game.player.position.x).toBeCloseTo(exactBoundaryStart, 8);

    const repeatStart = game.player.position.x;
    boot.keyDown('ArrowRight', true, 3000); boot.keyUp('ArrowRight', 3050); boot.update(0.016);
    expect(game.player.position.x).toBeCloseTo(repeatStart, 8);

    const pausedStart = game.player.position.x;
    boot.keyDown('ArrowRight', false, 4000); boot.setPaused(true); boot.setPaused(false); boot.keyUp('ArrowRight', 4050); boot.update(0.016);
    expect(game.player.position.x).toBeCloseTo(pausedStart, 8);

    boot.keyDown('ArrowRight', false); boot.update(20); boot.keyUp('ArrowRight'); const blockedStart = game.player.position.x;
    boot.keyDown('ArrowRight', false, 5000); boot.keyUp('ArrowRight', 5050); boot.update(0.016);
    expect(game.player.position.x).toBeCloseTo(blockedStart, 8); expect(game.player.root.position.x).toBeCloseTo(blockedStart, 8);
    const mainSource = await readFile(path.join(process.cwd(), 'src', 'main.ts'), 'utf8');
    expect(mainSource).toContain("import { installCampaignKeyboardOwner } from './campaign/CampaignKeyboard';");
    expect(mainSource).toMatch(/removeKeyboardOwner\s*=\s*installCampaignKeyboardOwner\(\{\s*window,\s*receiver:\s*boot/);
    expect(mainSource).toContain("target.closest('.campaign-top-right-controls')");
    removeKeyboardOwner(); expect(listeners.size).toBe(0); boot.dispose();
  });

  it('fits every required overview bound inside the real projection at 16:9, 4:3, and 21:9', async () => {
    const assets = await actualAuthoredObjectAssets();
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets });
    for (const [width, height] of [[1920, 1080], [1024, 768], [2560, 1080], [720, 1280]] as const) {
      game.resize(width, height); const pose = game.readOverviewCameraPose(true); const camera = (game as unknown as { options: { camera: THREE.PerspectiveCamera } }).options.camera;
      camera.position.copy(pose.position); camera.lookAt(pose.lookAt); camera.far = pose.far; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      for (let mask = 0; mask < 8; mask += 1) {
        const projected = new THREE.Vector3(mask & 1 ? pose.bounds.max.x : pose.bounds.min.x, mask & 2 ? pose.bounds.max.y : pose.bounds.min.y,
          mask & 4 ? pose.bounds.max.z : pose.bounds.min.z).project(camera);
        expect(Math.abs(projected.x)).toBeLessThanOrEqual(1); expect(Math.abs(projected.y)).toBeLessThanOrEqual(1); expect(projected.z).toBeLessThanOrEqual(1);
      }
    }
    game.dispose();
  });

  it('builds square non-overlapping north wall corners without changing production bounds, anchors, or movement', async () => {
    const assets = await actualAuthoredObjectAssets(); const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera();
    const renderer = { capabilities: { getMaxAnisotropy: () => 8 }, setPixelRatio: () => undefined, setSize: () => undefined,
      dispose: () => undefined, render: () => undefined } as unknown as THREE.WebGLRenderer;
    const boot = new CampaignBoot({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      renderer, scene, camera, assets });
    boot.resize(1280, 720, 1); expect(await boot.load()).toBe(true);
    const game = (boot as unknown as { game: CampaignGame }).game; const thickness = 0.34;
    expect(game.map.bounds).toBe(CAMPAIGN_MAP_BOUNDS); expect(game.map.anchors).toBeDefined();
    expect(CAMPAIGN_WALL_PRESENTATION).toMatchObject({ thickness, height: 2.2 });
    const wallMeshes = game.map.root.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh && child.name.startsWith('campaign-wall-'));
    expect(wallMeshes.map((wall) => wall.name).sort()).toEqual(['campaign-wall-east', 'campaign-wall-north', 'campaign-wall-west']);
    const byName = (name: string): THREE.Mesh => wallMeshes.find((wall) => wall.name === name)!;
    const north = new THREE.Box3().setFromObject(byName('campaign-wall-north'));
    const west = new THREE.Box3().setFromObject(byName('campaign-wall-west'));
    const east = new THREE.Box3().setFromObject(byName('campaign-wall-east'));
    const expectBoxXZ = (actual: THREE.Box3, expected: Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>,
      expectedHeight = 2.2): void => {
      expect(actual.min.x).toBeCloseTo(expected.minX, 5); expect(actual.max.x).toBeCloseTo(expected.maxX, 5);
      expect(actual.min.z).toBeCloseTo(expected.minZ, 5); expect(actual.max.z).toBeCloseTo(expected.maxZ, 5);
      expect(actual.min.y).toBeCloseTo(0, 5); expect(actual.max.y).toBeCloseTo(expectedHeight, 5);
    };
    expectBoxXZ(north, { minX: CAMPAIGN_MAP_BOUNDS.minX - thickness, maxX: CAMPAIGN_MAP_BOUNDS.maxX + thickness,
      minZ: CAMPAIGN_MAP_BOUNDS.minZ - thickness, maxZ: CAMPAIGN_MAP_BOUNDS.minZ });
    expectBoxXZ(west, { minX: CAMPAIGN_MAP_BOUNDS.minX - thickness, maxX: CAMPAIGN_MAP_BOUNDS.minX,
      minZ: CAMPAIGN_MAP_BOUNDS.minZ, maxZ: CAMPAIGN_MAP_BOUNDS.maxZ + thickness / 2 });
    expectBoxXZ(east, { minX: CAMPAIGN_MAP_BOUNDS.maxX, maxX: CAMPAIGN_MAP_BOUNDS.maxX + thickness,
      minZ: CAMPAIGN_MAP_BOUNDS.minZ, maxZ: CAMPAIGN_MAP_BOUNDS.maxZ + thickness / 2 });
    for (const side of [west, east]) {
      expect(side.min.z).toBeCloseTo(north.max.z, 5);
      expect(Math.min(north.max.z, side.max.z) - Math.max(north.min.z, side.min.z)).toBeCloseTo(0, 5);
    }
    expect(north.min.x).toBeLessThanOrEqual(west.min.x + 1e-5); expect(north.max.x).toBeGreaterThanOrEqual(east.max.x - 1e-5);
    expect(north.min.z).toBeCloseTo(CAMPAIGN_MAP_BOUNDS.minZ - thickness, 5);
    expect(north.max.z).toBeCloseTo(CAMPAIGN_MAP_BOUNDS.minZ, 5);
    for (const wall of wallMeshes) {
      const material = wall.material as THREE.MeshStandardMaterial;
      expect(material.color.getHexString()).toBe('f7f8f8'); expect(material.roughness).toBe(0.86);
      expect(material.metalness).toBe(0.02); expect(wall.castShadow).toBe(true); expect(wall.receiveShadow).toBe(true);
      expect(wall.parent).toBe(game.map.root);
    }
    const floor = game.map.root.getObjectByName('campaign-map-floor')!;
    const floorBounds = new THREE.Box3().setFromObject(floor);
    expectBoxXZ(floorBounds, { minX: CAMPAIGN_MAP_BOUNDS.minX - thickness / 2, maxX: CAMPAIGN_MAP_BOUNDS.maxX + thickness / 2,
      minZ: CAMPAIGN_MAP_BOUNDS.minZ - thickness / 2, maxZ: CAMPAIGN_MAP_BOUNDS.maxZ + thickness / 2 }, 0);
    expect(game.wheatSource.readWallAttachmentPosition(new THREE.Vector3()).x).toBeCloseTo(CAMPAIGN_MAP_BOUNDS.minX, 10);
    expect(game.submissionDock.root.position.toArray()).toEqual([9.9, 0.9, -3.6]);
    expect(CAMPAIGN_MAP_ANCHORS.player).toEqual({ x: -10, z: 1.05 });
    expect(camera.position.toArray()).toEqual([CAMPAIGN_MAP_ANCHORS.player.x + CAMPAIGN_CONFIG.camera.deadZoneHalfWidth + CAMPAIGN_CONFIG.camera.offsetX,
      CAMPAIGN_CONFIG.camera.offsetY, CAMPAIGN_CONFIG.camera.offsetZ]);
    moveTo(game, -10, 3); game.keyDown('ArrowLeft', false); game.update(10); game.keyUp('ArrowLeft');
    expect(game.player.position.x).toBeCloseTo(CAMPAIGN_MAP_BOUNDS.minX + CAMPAIGN_CONFIG.movement.playerRadiusMeters, 8);
    expect(game.player.root.position.x).toBeCloseTo(game.player.position.x, 12);
    const westTerminal = game.player.position.x; game.keyDown('ArrowLeft', false); game.update(0.1); game.keyUp('ArrowLeft');
    expect(game.player.position.x).toBeCloseTo(westTerminal, 12);
    game.keyDown('ArrowRight', false); game.update(0.1); game.keyUp('ArrowRight'); expect(game.player.position.x).toBeGreaterThan(westTerminal);
    game.keyDown('ArrowRight', false); game.update(10); game.keyUp('ArrowRight');
    expect(game.player.position.x).toBeCloseTo(CAMPAIGN_MAP_BOUNDS.maxX - CAMPAIGN_CONFIG.movement.playerRadiusMeters, 8);
    expect(game.player.root.position.x).toBeCloseTo(game.player.position.x, 12); boot.dispose();
  });

  it('restores the shipped Stage0 pipe scale reveal from the public run step without moving source authority', async () => {
    const assets = await actualAuthoredObjectAssets();
    const createBoot = (): Readonly<{ boot: CampaignBoot; game: CampaignGame }> => {
      const renderer = { capabilities: { getMaxAnisotropy: () => 8 }, setPixelRatio: () => undefined, setSize: () => undefined,
        dispose: () => undefined, render: () => undefined } as unknown as THREE.WebGLRenderer;
      const boot = new CampaignBoot({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
        tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
        renderer, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets });
      boot.resize(1280, 720, 1);
      return Object.freeze({ boot, game: null as unknown as CampaignGame });
    };
    const directOwner = createBoot(); const sampledOwner = createBoot();
    expect(await directOwner.boot.load()).toBe(true); expect(await sampledOwner.boot.load()).toBe(true);
    const direct = (directOwner.boot as unknown as { game: CampaignGame }).game;
    const sampled = (sampledOwner.boot as unknown as { game: CampaignGame }).game;
    const source = sampled.wheatSource; const rootIdentity = source.root; const visualIdentity = source.readVisualPresentationRoot();
    const rootPosition = source.root.position.clone(); const rootQuaternion = source.root.quaternion.clone(); const rootScale = source.root.scale.clone();
    const wallAttachment = source.readWallAttachmentPosition(new THREE.Vector3()).clone();
    const spawnPosition = source.readSpawnPosition(new THREE.Vector3()).clone(); const exitPosition = source.readSuctionPosition(new THREE.Vector3()).clone();
    const collisionBounds = source.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
    expect(source.readStage0RevealDiagnostics()).toMatchObject({ state: 'hidden', revealed: false, visualVisible: false, visualScale: 1 });
    expect(source.root.visible).toBe(true); expect(visualIdentity.children).toHaveLength(1);
    for (const anchorName of ['wallAttachment', 'wheatSpawn', 'wheatExit']) {
      expect(source.root.getObjectsByProperty('name', anchorName)).toHaveLength(1);
      expect(source.root.getObjectByName(anchorName)?.parent).toBe(source.root);
    }
    const triggerPublicReveal = (game: CampaignGame): void => {
      tap(game, 'ArrowUp', 0.05);
      game.keyDown('ShiftLeft', false); game.keyDown('ArrowUp', false); game.update(0.05); game.keyUp('ArrowUp'); game.keyUp('ShiftLeft');
    };
    triggerPublicReveal(direct); triggerPublicReveal(sampled);
    expect(source.readStage0RevealDiagnostics()).toMatchObject({ state: 'revealing', revealed: true,
      visualVisible: true, visualScale: CAMPAIGN_CONFIG.presentation.stage0PipeRevealStartScale });
    expect(source.readTimerSeconds()).toBeCloseTo(0.05, 10);
    const assertAuthorityUnchanged = (): void => {
      expect(source.root).toBe(rootIdentity); expect(source.readVisualPresentationRoot()).toBe(visualIdentity);
      expect(source.root.position).toEqual(rootPosition); expect(source.root.quaternion.angleTo(rootQuaternion)).toBeLessThan(1e-12);
      expect(source.root.scale).toEqual(rootScale); expect(source.readWallAttachmentPosition(new THREE.Vector3())).toEqual(wallAttachment);
      expect(source.readSpawnPosition(new THREE.Vector3())).toEqual(spawnPosition); expect(source.readSuctionPosition(new THREE.Vector3())).toEqual(exitPosition);
      expect(source.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 })).toEqual(collisionBounds);
    };
    assertAuthorityUnchanged(); direct.update(CAMPAIGN_CONFIG.presentation.stage0PipeRevealSeconds);
    for (const progress of [0.25, 0.5, 0.75, 1]) {
      sampled.update(CAMPAIGN_CONFIG.presentation.stage0PipeRevealSeconds * 0.25);
      const eased = 1 - Math.pow(1 - progress, 3);
      expect(source.readStage0RevealDiagnostics().visualScale).toBeCloseTo(
        CAMPAIGN_CONFIG.presentation.stage0PipeRevealStartScale + (1 - CAMPAIGN_CONFIG.presentation.stage0PipeRevealStartScale) * eased, 10);
      expect(source.readTimerSeconds()).toBeCloseTo(0.05 + CAMPAIGN_CONFIG.presentation.stage0PipeRevealSeconds * progress, 10);
      assertAuthorityUnchanged();
      if (progress === 0.25) {
        sampled.setPaused(true); const paused = source.readStage0RevealDiagnostics(); const pausedTimer = source.readTimerSeconds();
        sampled.update(0.3); expect(source.readStage0RevealDiagnostics()).toEqual(paused); expect(source.readTimerSeconds()).toBe(pausedTimer);
        sampled.setPaused(false);
      }
    }
    expect(source.readStage0RevealDiagnostics()).toMatchObject({ state: 'revealed', revealed: true, visualVisible: true, visualScale: 1 });
    expect(direct.wheatSource.readStage0RevealDiagnostics()).toEqual(source.readStage0RevealDiagnostics());
    expect(direct.wheatSource.readTimerSeconds()).toBeCloseTo(source.readTimerSeconds(), 10);
    for (const game of [direct, sampled]) game.update(1.04);
    expect(direct.wheatSource.readSuccessfulIssuanceCount()).toBe(1); expect(source.readSuccessfulIssuanceCount()).toBe(1);
    expect(direct.wheatSource.readTimerSeconds()).toBeCloseTo(source.readTimerSeconds(), 10);
    sampled.update(CAMPAIGN_CONFIG.materialPresentation.wheatSpawnSeconds);
    const wheat = sampled.materials.all().find((material) => material.type === 'wheat')!;
    expect(wheat.location).toBe('world'); sampled.materials.retire(wheat.id, 'processing'); sampled.update(3);
    expect(source.readSuccessfulIssuanceCount()).toBe(1);
    source.hideForStage0Reveal(); const cancelStep = source.createStage0RevealStep(CAMPAIGN_CONFIG.presentation.stage0PipeRevealSeconds,
      CAMPAIGN_CONFIG.presentation.stage0PipeRevealStartScale)!;
    expect(sampled.presentation.play([cancelStep], () => undefined)).toBe(true); sampled.update(0.1); sampled.presentation.cancel();
    expect(source.readStage0RevealDiagnostics()).toMatchObject({ state: 'revealed', revealed: true, visualVisible: true, visualScale: 1 });
    assertAuthorityUnchanged(); directOwner.boot.dispose(); sampledOwner.boot.dispose();
    expect(direct.wheatSource.root.parent).toBeNull(); expect(source.root.parent).toBeNull();
  });

  it('restores the named v4.1 map, physical surfaces, and Stage0 UI contract through CampaignGame', () => {
    const scene = new THREE.Scene(); const mount = new FakeElement(); const canvas = new FakeElement(); const camera = new THREE.PerspectiveCamera();
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: mount as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: canvas as unknown as HTMLCanvasElement, scene, camera, assets: fakeAssets });
    expect(game.map.bounds).toEqual({ minX: -12.35, maxX: 12.35, minZ: -3.6, maxZ: 3.6 });
    expect(game.player.position.toArray()).toEqual([-10, 1.05]); expect(game.player.root.position.toArray()).toEqual([-10, 0, 1.05]);
    expect(game.blocks[0]!.root.position.toArray()).toEqual([-5.5, 0, -2.5]); expect(game.blocks[1]!.root.position.toArray()).toEqual([2.2, 0, -2.5]);
    expect(game.wheatSource.root.position.x).toBe(-11.5); expect(game.wheatSource.root.position.y).toBeCloseTo(1.12 - 0.4246366155, 8); expect(game.wheatSource.root.position.z).toBe(0.8); expect(game.submissionDock.root.position.toArray()).toEqual([9.9, 0.9, -3.6]);
    expect(game.wheatSource.readWallAttachmentPosition(new THREE.Vector3()).x).toBeCloseTo(CAMPAIGN_MAP_BOUNDS.minX, 8);
    expect(game.submissionDock.submittedBreadCount).toBe(0); expect(game.submissionDock.targetBreadCount).toBe(1);
    expect(scene.getObjectByName('campaign-compact-goal-board')).toBeUndefined();
    expect(scene.getObjectByName('i9-dock-goal-scoreboard')).not.toBeUndefined(); expect(scene.getObjectByName('campaign-scoreboard')).not.toBeUndefined();
    expect(game.submissionDock.goalScoreboard.contract).toMatchObject({ templateId: CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE_ID,
      role: 'dock-goal', uniformScale: 0.75 });
    expect(game.submissionDock.goalScoreboard.root.children.map((child) => child.name)).toEqual(['frame', 'panel']);
    expect(game.submissionDock.root.visible).toBe(true);
    expect(game.submissionDock.readStage0RevealDiagnostics()).toMatchObject({ state: 'hidden', interactionAvailable: false,
      visualVisible: false, visualScale: 1, goalBoardVisible: false });
    const dockGoalBounds = new THREE.Box3().setFromObject(game.submissionDock.goalScoreboard.root);
    const auxiliaryBounds = new THREE.Box3().setFromObject(game.scoreboard.auxiliary.root);
    expect(dockGoalBounds.min.x).toBeGreaterThanOrEqual(CAMPAIGN_MAP_BOUNDS.minX);
    expect(dockGoalBounds.max.x).toBeLessThanOrEqual(CAMPAIGN_MAP_BOUNDS.maxX);
    expect(dockGoalBounds.min.z).toBeGreaterThanOrEqual(CAMPAIGN_MAP_BOUNDS.minZ - 0.2);
    expect(dockGoalBounds.intersectsBox(auxiliaryBounds)).toBe(false);
    expect(scene.getObjectByName('i9-stage0-tutorial-scoreboard')).toBeUndefined(); expect(game.scoreboard.central.root.visible).toBe(false);
    game.scoreboard.showActive('stage1', 30, 900);
    const activeTexts = ((game.scoreboard as unknown as { centralCanvas: FakeElement }).centralCanvas).drawnTexts;
    expect(activeTexts.at(-1)).toBe('00:30'); expect(activeTexts.at(-1)).not.toContain('900');
    expect(game.scoreboard.root.children).toEqual([game.scoreboard.central.root, game.scoreboard.auxiliary.root]);
    for (const board of [game.scoreboard.central, game.scoreboard.auxiliary]) {
      expect(board.root.userData.i9TemplateId).toBe(CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE_ID);
      expect(board.root.children.map((child) => child.name)).toEqual(['frame', 'panel']);
      expect(board.panel.userData.i9ContentOwner).toBe('panel.material.map');
    }
    expect(scene.getObjectByName('campaign-map-floor')).not.toBeUndefined(); expect(scene.children.flatMap((root) => root.getObjectsByProperty('name', 'campaign-wall-north'))).toHaveLength(1);
    expect(game.map.root.children.filter((root) => root.name.startsWith('campaign-wall-')).map((root) => root.name).sort()).toEqual(['campaign-wall-east', 'campaign-wall-north', 'campaign-wall-west']);
    expect(mount.appended.some((node) => (node as FakeElement).className === 'campaign-hud')).toBe(false);
    for (const block of game.blocks) {
      const label = block.root.getObjectByName('campaign-block-function-surface')!;
      const progress = block.root.getObjectByName('campaign-block-progress')!;
      const capacity = block.root.getObjectByName('campaign-block-capacity')!;
      expect(label.parent).toBe(block.readPresentationRoot()); expect(label.position.x).toBeCloseTo(0, 6); expect(label.position.y).toBeCloseTo(1.727, 3); expect(label.rotation.x).toBeCloseTo(-Math.PI / 2, 6);
      expect(label.userData.typography).toMatchObject({ family: 'Galmuri11', weight: 900 });
      expect(label.userData.glyphPixelHeight).toBeGreaterThan(456); expect(label.userData.surfaceWidth).toBeLessThanOrEqual(1.9);
      expect(label.userData.surfaceHeight).toBeLessThanOrEqual(1.9);
      expect(progress.parent).toBe(block.readPresentationRoot()); expect(progress.position.x).toBeCloseTo(0, 6); expect(progress.position.y).toBeCloseTo(1.385, 3); expect(progress.position.z).toBeCloseTo(0.957, 3);
      expect(capacity.parent).toBe(block.readPresentationRoot()); expect(capacity.position.x).toBeCloseTo(0, 6); expect(capacity.position.y).toBeCloseTo(2.42, 2);
      const capacityNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(capacity.quaternion).normalize();
      expect(capacityNormal.dot(new THREE.Vector3(CAMPAIGN_CONFIG.camera.offsetX, CAMPAIGN_CONFIG.camera.offsetY, CAMPAIGN_CONFIG.camera.offsetZ).normalize())).toBeGreaterThan(0.999);
      expect(block.root.getObjectsByProperty('type', 'Mesh').filter((mesh) => mesh.name.startsWith('campaign-block-capacity-cell-'))).toHaveLength(5);
      block.updatePresentation(0, 2, 5, 2);
      expect(block.readCapacityCellColor(0, new THREE.Color()).getHexString()).toBe('d9a441');
      expect(block.readCapacityCellColor(2, new THREE.Color()).getHexString()).toBe('e2c987');
      expect(block.readCapacityCellColor(4, new THREE.Color()).getHexString()).toBe('7e8a86');
      block.updatePresentation(0, block.storedMaterialIds.length, 5);
    }
    for (const module of game.modules) {
      const faces = module.type === 'again' ? ['front', 'rear', 'left', 'right', 'top'] : ['front', 'left', 'right', 'top'];
      const front = module.root.getObjectByName(`campaign-module-${module.type}-label-front`)!;
      const top = module.root.getObjectByName(`campaign-module-${module.type}-label-top`)!;
      expect(front.parent?.name).toBe('sharedCubeGeometry'); expect(top.parent?.name).toBe('sharedCubeGeometry');
      expect(front.userData.typography).toMatchObject({ family: 'Galmuri11', weight: 900 }); expect(top.userData.typography).toEqual(front.userData.typography);
      expect(front.userData.canvasResolution).toBe('2048x1024'); expect(front.userData.glyphPixelHeight).toBeGreaterThan(300);
      expect((front as THREE.Mesh).geometry).not.toBe((top as THREE.Mesh).geometry);
      expect(faces.every((face) => module.root.getObjectByName(`campaign-module-${module.type}-label-${face}`)?.parent?.name === 'sharedCubeGeometry')).toBe(true);
      expect(module.root.getObjectByName(`campaign-module-${module.type}-label-rear`) === undefined).toBe(module.type !== 'again');
    }
    const sprites: THREE.Sprite[] = []; scene.traverse((node) => { if (node instanceof THREE.Sprite) sprites.push(node); }); expect(sprites).toHaveLength(0);
    expect(scene.getObjectByName('campaign-world-keycap')).not.toBeUndefined(); expect(camera.fov).toBe(21);
    game.player.move(new THREE.Vector2(1, 0), 0.5); expect(game.player.root.position.x).toBe(game.player.position.x); expect(game.player.root.position.z).toBe(game.player.position.y);
    expect(game.modules.every((module) => module.location.kind === 'not-introduced')).toBe(true); game.dispose();
  });

  it('runs the corrected Stage0 floor-drop, exact auto-intake, heater gate, and keycap sequence through public inputs', async () => {
    const tutorialSurface = new FakeElement(); const mount = new FakeElement(); const game = new CampaignGame({ document: fakeDocument, window: fakeWindow,
      mount: mount as unknown as HTMLElement, tutorialSurface: tutorialSurface as unknown as HTMLElement,
      canvas: new FakeElement() as unknown as HTMLCanvasElement, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    const keycaps = (): FakeElement[] => tutorialSurface.replaced.filter((node) => (node as FakeElement).className.startsWith('campaign-keycap')) as FakeElement[];
    const renderedText = (): string => tutorialSurface.replaced.map((node) => (node as FakeElement).textContent ?? '').join('');
    const tipRoot = game.tipPanel.root as unknown as FakeElement;
    const tipPanelElement = tipRoot.querySelector<FakeElement>('.campaign-tip__panel');
    const tipClose = tipRoot.querySelector<FakeElement>('.campaign-tip__close');
    const audioRoot = game.audioSettings.root as unknown as FakeElement;
    const audioToggle = audioRoot.querySelector<FakeElement>('.audio-settings__trigger');
    const audioBackdrop = audioRoot.querySelector<FakeElement>('.audio-settings__backdrop');
    const audioClose = audioRoot.querySelector<FakeElement>('.audio-settings__close');
    const audioControls = audioRoot.querySelector<FakeElement>('.audio-settings__controls');
    const audioVolumeLabel = audioRoot.querySelector<FakeElement>('.audio-settings__volume');
    const audioRange = audioRoot.querySelector<FakeElement>('input[type="range"]');
    const audioMute = audioRoot.querySelector<FakeElement>('.audio-settings__mute');
    const audioMuteMark = audioRoot.querySelector<FakeElement>('.audio-settings__mute-mark');
    const visiblePopoverCount = (): number => Number(game.tipPanel.open) + Number(game.audioSettings.open);
    expect(game.topRightControls.root.className).toBe('campaign-top-right-controls');
    expect((game.topRightControls.root as unknown as FakeElement).attributes.role).toBe('toolbar');
    expect(mount.appended.filter((node) => (node as FakeElement).className === 'campaign-top-right-controls')).toEqual([game.topRightControls.root]);
    expect((game.topRightControls.root as unknown as FakeElement).appended).toEqual([game.tipPanel.root, game.audioSettings.root]);
    expect(tipRoot.innerHTML).not.toContain('campaign-tip__toggle'); expect(tipRoot.innerHTML.match(/<button/g)).toHaveLength(1);
    expect(tipRoot.innerHTML.match(/campaign-tip__panel/g)).toHaveLength(1);
    expect(tipRoot.innerHTML).toContain('<section id="campaign-tip-panel" class="campaign-tip__panel" role="dialog" aria-labelledby="campaign-tip-title" hidden><span id="campaign-tip-title" class="campaign-tip__title">Tip.</span><p class="campaign-tip__body"></p><button class="campaign-tip__close"');
    expect(tipRoot.innerHTML.indexOf('campaign-tip__title')).toBeLessThan(tipRoot.innerHTML.indexOf('campaign-tip__body'));
    expect(tipRoot.innerHTML.indexOf('campaign-tip__body')).toBeLessThan(tipRoot.innerHTML.indexOf('campaign-tip__close'));
    expect(tipRoot.innerHTML).not.toContain('</section><span'); expect(tipRoot.innerHTML).not.toContain('<h2'); expect(tipRoot.innerHTML).not.toContain('campaign-tip__toggle');
    expect(tipRoot.innerHTML).toContain('role="dialog" aria-labelledby="campaign-tip-title"');
    expect(audioRoot.innerHTML).toContain('class="audio-settings__trigger"'); expect(audioRoot.innerHTML).toContain('aria-label="설정"');
    expect(audioRoot.innerHTML).toContain('<svg class="audio-settings__gear"'); expect(audioRoot.innerHTML).toContain('aria-hidden="true" focusable="false"');
    expect(audioRoot.innerHTML).not.toContain('⚙'); expect(audioRoot.innerHTML).not.toContain('>설정</button>'); expect(audioRoot.innerHTML).not.toContain('>소리</button>');
    expect(audioRoot.innerHTML).toContain('class="audio-settings__backdrop" hidden'); expect(audioRoot.innerHTML).toContain('role="dialog" aria-modal="true"');
    expect(audioRoot.innerHTML).toContain('<h2 id="campaign-settings-title">설정</h2>');
    expect(audioRoot.innerHTML).toContain('<label class="audio-settings__volume" for="campaign-settings-volume">볼륨</label>');
    expect(audioRoot.innerHTML).toContain('id="campaign-settings-volume" class="audio-settings__range" type="range"');
    expect(audioRoot.innerHTML.indexOf('audio-settings__volume')).toBeLessThan(audioRoot.innerHTML.indexOf('audio-settings__range'));
    expect(audioRoot.innerHTML.indexOf('audio-settings__range')).toBeLessThan(audioRoot.innerHTML.indexOf('audio-settings__mute"'));
    expect(audioRoot.innerHTML).toContain('class="audio-settings__mute" type="button" aria-label="음소거" aria-pressed="false"');
    expect(audioRoot.innerHTML).toContain('<svg class="audio-settings__speaker"'); expect(audioRoot.innerHTML).toContain('aria-hidden="true" focusable="false"');
    expect(audioRoot.innerHTML).toContain('class="audio-settings__mute-mark" d="M9 6 19 18M19 6 9 18"');
    expect(audioRoot.innerHTML).not.toContain('type="checkbox"'); expect(audioRoot.innerHTML).not.toContain('> 음소거</label>');
    expect(game.tipPanel.currentTipId).toBeNull(); expect(game.tipPanel.currentBody).toBe(''); expect(game.tipPanel.open).toBe(false);
    expect(tipPanelElement.hidden).toBe(true); expect(tipClose.listenerCount('click')).toBe(1);
    expect(game.audioSettings.open).toBe(false); expect(audioBackdrop.hidden).toBe(true); expect(game.topRightControls.openPopover).toBeNull(); expect(visiblePopoverCount()).toBe(0);
    expect(audioToggle.listenerCount('click')).toBe(1); expect(audioClose.listenerCount('click')).toBe(1); expect(audioRange.listenerCount('input')).toBe(1); expect(audioMute.listenerCount('click')).toBe(1);
    expect(audioControls.attributes['data-muted']).toBe('false'); expect(audioMute.attributes['aria-pressed']).toBe('false');
    expect(audioMuteMark.style.display).toBe('none'); expect(audioVolumeLabel).toBeDefined();
    expect(keycaps().map((node) => node.attributes['aria-label'])).toEqual(['ARROWUP', 'ARROWLEFT', 'ARROWDOWN', 'ARROWRIGHT']);
    expect(renderedText()).toBe('로 움직여 보세요.'); expect(renderedText()).not.toMatch(/WASD|Shift|E|Space/);

    tap(game, 'ArrowUp', 0.05); expect(game.tutorial.currentStepId).toBe('run');
    expect(keycaps().map((node) => node.attributes['aria-label'])).toEqual(['SHIFT']); expect(renderedText()).not.toContain('Shift');
    game.keyDown('ShiftLeft', false); game.update(0.05); expect(game.tutorial.currentStepId).toBe('run');
    game.keyDown('ArrowUp', false); game.update(0.05); game.keyUp('ArrowUp'); game.keyUp('ShiftLeft'); expect(game.tutorial.currentStepId).toBe('pick-wheat');
    expect(keycaps().map((node) => node.attributes['aria-label'])).toEqual(['E', 'E']); expect(renderedText()).not.toMatch(/\bE\b/);
    expect(tutorialSurface.replaced.map((node) => (node as FakeElement).className)).toEqual([
      '', 'campaign-keycap campaign-keycap--e', '', 'campaign-tutorial-line-break', 'campaign-keycap campaign-keycap--e', '',
    ]);
    game.update(1.4); game.update(0.55); const wheat = game.materials.all().find((material) => material.type === 'wheat' && material.location === 'world')!;
    expect(game.wheatSource.readSuccessfulIssuanceCount()).toBe(1);
    moveTo(game, wheat.root.position.x, wheat.root.position.z); tap(game, 'KeyE'); expect(game.player.heldMaterialIds).toContain(wheat.id);
    const mill = game.blocks[0]!; const millPresentation = mill.readPresentationRoot();
    const camera = (game as unknown as { options: { camera: THREE.PerspectiveCamera } }).options.camera;
    const cameraY = camera.position.y; const cameraZ = camera.position.z;
    tap(game, 'KeyQ'); expect(wheat.location).toBe('world'); expect(mill.storedMaterialIds).not.toContain(wheat.id);
    expect(mill.root.visible).toBe(true); expect(millPresentation.visible).toBe(true); expect(millPresentation.position.y).toBeCloseTo(5, 10);
    expect(mill.interactionAvailable).toBe(false); expect(game.interactionKeycap.root.visible).toBe(false);
    const millRootPosition = mill.root.position.clone(); const millMouth = mill.readOutputMouthPosition(new THREE.Vector3()).clone();
    for (const progress of [0.25, 0.5, 0.75]) {
      game.update(CAMPAIGN_CONFIG.presentation.stage0BlockRevealDropSeconds * 0.25);
      expect(millPresentation.position.y).toBeCloseTo(CAMPAIGN_CONFIG.presentation.stage0BlockRevealHeightMeters * (1 - progress * progress), 10);
      expect(mill.root.position).toEqual(millRootPosition); expect(mill.readOutputMouthPosition(new THREE.Vector3())).toEqual(millMouth);
      expect(camera.position.y).toBe(cameraY); expect(camera.position.z).toBe(cameraZ);
    }
    game.update(CAMPAIGN_CONFIG.presentation.stage0BlockRevealDropSeconds * 0.25);
    expect(millPresentation.position.y).toBe(0); expect(mill.interactionAvailable).toBe(true);
    expect(game.tutorial.currentStepId).toBe('intake-wheat');
    expect(tutorialSurface.attributes['aria-label']).toBe('블록 근처에서 밀을 들고 Q를 눌러 재료를 넣으세요.');
    expect(keycaps().map((node) => node.attributes['aria-label'])).toEqual(['Q']);
    expect(renderedText()).toBe('블록 근처에서 밀을 들고 를 눌러 재료를 넣으세요.'); expect(renderedText()).not.toMatch(/\bQ\b/);
    game.update(0.016); expect(wheat.location).toBe('world');
    tap(game, 'KeyE'); expect(game.player.heldMaterialIds).toContain(wheat.id);
    moveToBlockSide(game, game.blocks[0]!, 'left');
    expect(game.interactionKeycap.label).toBeNull(); expect(game.interactionKeycap.root.visible).toBe(false);
    tap(game, 'KeyQ');
    expect(wheat.location).toBe('world'); expect(game.blocks[0]!.storedMaterialIds).not.toContain(wheat.id);
    game.update(0.016); expect(wheat.location).toBe('stored'); expect(game.blocks[0]!.storedMaterialIds).toContain(wheat.id);
    expect(game.tutorial.currentStepId).toBe('mill-processing'); expect(game.blocks[0]!.processingSeconds).toBeGreaterThan(0);

    game.update(2.4); expect(game.tutorial.currentStepId).toBe('intake-flour'); expect(keycaps()).toHaveLength(0);
    expect(game.tipPanel.currentTipId).toBe('stage0-absorption');
    expect(game.tipPanel.currentBody).toBe('모든 재료는 블록과 가까이 있으면 흡수됩니다.'); expect(game.tipPanel.open).toBe(true);
    expect(tipPanelElement.hidden).toBe(false);
    expect(game.audioSettings.open).toBe(false); expect(game.topRightControls.openPopover).toBe('tip'); expect(visiblePopoverCount()).toBe(1);
    tipClose.dispatch('click'); expect(game.tipPanel.open).toBe(false); expect(tipPanelElement.hidden).toBe(true); expect(game.audioSettings.open).toBe(false);
    expect(game.tipPanel.currentTipId).toBe('stage0-absorption'); expect(game.tipPanel.currentBody).toBe('모든 재료는 블록과 가까이 있으면 흡수됩니다.'); expect(visiblePopoverCount()).toBe(0);
    const settingsPauseSimulation = (game as unknown as { simulationSeconds: number }).simulationSeconds;
    const settingsPausePlayer = game.player.position.clone(); game.keyDown('ArrowRight', false);
    audioToggle.dispatch('click'); expect(game.audioSettings.open).toBe(true); expect(audioBackdrop.hidden).toBe(false); expect(game.tipPanel.open).toBe(false); expect(tipPanelElement.hidden).toBe(true);
    expect(game.topRightControls.openPopover).toBe('audio'); expect(visiblePopoverCount()).toBe(1);
    audioRange.value = '0.6'; audioRange.dispatch('input'); audioMute.dispatch('click');
    expect(game.audio.settings()).toEqual({ volume: 0.6, muted: true });
    expect(audioControls.attributes['data-muted']).toBe('true'); expect(audioMute.attributes['aria-pressed']).toBe('true'); expect(audioMuteMark.style.display).toBe('');
    audioMute.dispatch('click'); expect(game.audio.settings()).toEqual({ volume: 0.6, muted: false });
    expect(audioControls.attributes['data-muted']).toBe('false'); expect(audioMute.attributes['aria-pressed']).toBe('false'); expect(audioMuteMark.style.display).toBe('none');
    audioMute.dispatch('click'); expect(game.audio.settings()).toEqual({ volume: 0.6, muted: true });
    expect(game.tipPanel.currentTipId).toBe('stage0-absorption'); expect(game.tipPanel.currentBody).toBe('모든 재료는 블록과 가까이 있으면 흡수됩니다.');
    game.update(1); expect((game as unknown as { simulationSeconds: number }).simulationSeconds).toBe(settingsPauseSimulation);
    expect(game.player.position).toEqual(settingsPausePlayer); expect(game.player.root.position.x).toBeCloseTo(settingsPausePlayer.x, 8);
    audioToggle.dispatch('click'); expect(game.audioSettings.open).toBe(false); expect(audioBackdrop.hidden).toBe(true); expect(game.tipPanel.open).toBe(false);
    expect(game.topRightControls.openPopover).toBeNull(); expect(visiblePopoverCount()).toBe(0);
    const resumedRevealSeconds = 0.1;
    game.update(resumedRevealSeconds); expect((game as unknown as { simulationSeconds: number }).simulationSeconds).toBeCloseTo(settingsPauseSimulation + resumedRevealSeconds, 8);
    expect(game.player.position).toEqual(settingsPausePlayer);
    audioToggle.dispatch('click'); expect(game.audioSettings.open).toBe(true); expect(game.tipPanel.open).toBe(false); expect(visiblePopoverCount()).toBe(1);
    audioClose.dispatch('click'); expect(game.audioSettings.open).toBe(false); expect(audioBackdrop.hidden).toBe(true); expect(visiblePopoverCount()).toBe(0);
    const heater = game.blocks[1]!; const heaterPresentation = heater.readPresentationRoot();
    expect(heaterPresentation.position.y).toBeCloseTo(CAMPAIGN_CONFIG.presentation.stage0BlockRevealHeightMeters * (1 - Math.pow(resumedRevealSeconds / CAMPAIGN_CONFIG.presentation.stage0BlockRevealDropSeconds, 2)), 10);
    expect(heater.interactionAvailable).toBe(false); expect(camera.position.y).toBe(cameraY); expect(camera.position.z).toBe(cameraZ);
    const remainingHeaterRevealSeconds = CAMPAIGN_CONFIG.presentation.stage0BlockRevealDropSeconds - resumedRevealSeconds;
    game.update(remainingHeaterRevealSeconds * 0.5);
    const heaterMidProgress = (resumedRevealSeconds + remainingHeaterRevealSeconds * 0.5) / CAMPAIGN_CONFIG.presentation.stage0BlockRevealDropSeconds;
    expect(heaterPresentation.position.y).toBeCloseTo(CAMPAIGN_CONFIG.presentation.stage0BlockRevealHeightMeters * (1 - heaterMidProgress * heaterMidProgress), 10);
    game.setPaused(true); const pausedDropY = heaterPresentation.position.y; game.update(1); expect(heaterPresentation.position.y).toBe(pausedDropY); game.setPaused(false);
    game.update(remainingHeaterRevealSeconds * 0.5);
    expect(heaterPresentation.position.y).toBe(0); expect(heater.interactionAvailable).toBe(true); game.update(0.42);
    expect(game.wheatSource.readSuccessfulIssuanceCount()).toBe(1); expect(game.materials.all().filter((material) => material.type === 'wheat')).toHaveLength(0);
    const flour = game.materials.all().find((material) => material.type === 'flour' && material.location === 'output')!;
    moveTo(game, flour.root.position.x, flour.root.position.z); tap(game, 'KeyE'); moveTo(game, game.blocks[1]!.root.position.x, game.blocks[1]!.root.position.z); game.update(0.016);
    expect(game.interactionKeycap.label).toBeNull(); expect(game.interactionKeycap.root.visible).toBe(false); tap(game, 'KeyQ');
    expect(flour.location).toBe('world'); expect(game.blocks[1]!.storedMaterialIds).not.toContain(flour.id);
    game.update(0.016); expect(flour.location).toBe('stored'); expect(game.blocks[1]!.storedMaterialIds).toContain(flour.id);
    expect(game.tutorial.currentStepId).toBe('move-heater'); expect(game.blocks[1]!.processingSeconds).toBe(0); expect(game.tutorial.heaterProcessingUnlocked).toBe(false);
    expect(game.blocks[1]!.readCapacityCellColor(0, new THREE.Color()).getHexString()).toBe('d9a441');
    const heaterProgress = game.blocks[1]!.root.getObjectByName('campaign-block-progress')!.children[1]!;
    moveToBlockSide(game, game.blocks[1]!, 'left');
    expect(heaterProgress.scale.x).toBe(0); expectVisibleSpaceKeycap(game, game.blocks[1]!);
    moveToBlockSide(game, game.blocks[0]!, 'left');
    expect(game.interactionKeycap.label).toBeNull(); expect(game.interactionKeycap.root.visible).toBe(false);
    moveTo(game, game.blocks[1]!.root.position.x + 5, game.blocks[1]!.root.position.z + 4); game.update(0.016);
    expect(game.interactionKeycap.label).toBeNull(); expect(game.interactionKeycap.root.visible).toBe(false);
    moveToBlockSide(game, game.blocks[1]!, 'left');
    expectVisibleSpaceKeycap(game, game.blocks[1]!);
    const heaterStart = game.blocks[1]!.root.position.x; game.keyDown('Space', false); game.update(0.05); game.keyUp('Space');
    expect(game.tutorial.currentStepId).toBe('move-heater'); expect(game.blocks[1]!.processingSeconds).toBe(0);
    expect(game.keyDown('Space', true)).toBe(true); game.update(0.05); expect(game.tutorial.heaterProcessingUnlocked).toBe(false);
    game.keyDown('ArrowRight', false); game.update(0.08); game.keyUp('ArrowRight'); expect(game.blocks[1]!.root.position.x).toBeGreaterThan(heaterStart);
    expect(game.tutorial.currentStepId).toBe('move-heater'); expect(game.blocks[1]!.processingSeconds).toBe(0);
    game.setPaused(true); expect(game.tutorial.heaterProcessingUnlocked).toBe(false); expect(game.player.heldBlockId).toBeNull(); game.setPaused(false);
    tap(game, 'Space'); game.keyDown('ArrowLeft', false); game.update(0.04);
    const movedHeaterX = game.blocks[1]!.root.position.x; const releaseStart = game.player.position.clone(); game.keyDown('Space', false); game.update(0.04); game.keyUp('Space');
    expect(game.player.heldBlockId).toBeNull(); expect(game.blocks[1]!.root.position.x).toBeCloseTo(movedHeaterX, 8);
    expect((game as unknown as { activeBlock: unknown; carriedBlockStart: unknown; activeBlockPlayerLaneZ: number; activeBlockPlayerOffsetX: number }).activeBlock).toBeNull();
    expect((game as unknown as { carriedBlockStart: unknown }).carriedBlockStart).toBeNull();
    expect((game as unknown as { activeBlockPlayerLaneZ: number }).activeBlockPlayerLaneZ).toBe(0);
    expect((game as unknown as { activeBlockPlayerOffsetX: number }).activeBlockPlayerOffsetX).toBe(0);
    expect(game.player.position.x).toBeLessThan(releaseStart.x); expect(game.player.root.position.x).toBeCloseTo(game.player.position.x, 8); game.keyUp('ArrowLeft');
    const postRelease = game.player.position.clone(); game.keyDown('ArrowDown', false, 1000); game.keyUp('ArrowDown', 1119); game.update(0.016);
    expect(game.player.position.y - postRelease.y).toBeCloseTo(CAMPAIGN_CONFIG.movement.tapMinimumDistanceMeters, 8);
    expect(game.player.root.position.z).toBeCloseTo(game.player.position.y, 8);
    expect(game.tutorial.heaterProcessingUnlocked).toBe(true); expect(game.tutorial.currentStepId).toBe('heater-processing');
    expect(tutorialSurface.attributes['aria-label']).toBe('빵을 제출대에 넣으세요!'); expect(renderedText()).toBe('빵을 제출대에 넣으세요!');
    expect(game.blocks[1]!.processingSeconds).toBeGreaterThan(0);
    moveToBlockSide(game, game.blocks[0]!, 'left');
    expectVisibleSpaceKeycap(game, game.blocks[0]!);
    moveTo(game, game.blocks[1]!.root.position.x + 4, game.blocks[1]!.root.position.z + 4);
    game.update(1.65); expect(game.tutorial.currentStepId).toBe('submit-bread'); game.update(0.42);
    const bread = game.materials.all().find((material) => material.type === 'bread' && material.location === 'output')!;
    moveTo(game, bread.root.position.x, bread.root.position.z); tap(game, 'KeyE'); moveTo(game, 9.9, -3.135); tap(game, 'KeyQ');
    expect(bread.location).toBe('world'); game.update(0.016); expect(game.state.phase.kind).toBe('clear-presentation');
    expect(game.tutorial.currentStepId).toBe('stage1-handoff');
    for (let index = 0; index < 120 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage1' }); game.update(3.1);
    expect(game.wheatSource.readSuccessfulIssuanceCount()).toBeGreaterThanOrEqual(2);
    expect(game.tipPanel.currentTipId).toBe('stage1'); expect(game.tipPanel.currentBody).toBe('빨리! 단어를 블록에 넣어 빠르게 만들 수 있습니다.'); expect(game.tipPanel.open).toBe(true);
    expect(tipPanelElement.hidden).toBe(false); expect(game.audioSettings.open).toBe(false); expect(game.audio.settings()).toEqual({ volume: 0.6, muted: true }); expect(visiblePopoverCount()).toBe(1);
    expect(game.tipPanel.currentBody).not.toContain('모든 재료'); tipClose.dispatch('click'); expect(game.tipPanel.open).toBe(false);
    game.state.setRemainingSeconds(0.01); game.update(0.02); for (let index = 0; index < 40 && game.state.phase.kind !== 'game-over'; index += 1) game.update(0.1);
    expect(game.state.phase.kind).toBe('game-over'); game.keyDown('KeyR', false); game.keyUp('KeyR'); game.presentation.finishImmediately();
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage1' }); expect(game.tipPanel.currentTipId).toBe('stage1'); expect(game.tipPanel.open).toBe(false);
    const lifecyclePauseSimulation = (game as unknown as { simulationSeconds: number }).simulationSeconds;
    const lifecyclePauseRemaining = game.state.remainingSeconds;
    audioToggle.dispatch('click'); expect(game.audioSettings.open).toBe(true); expect(game.tipPanel.open).toBe(false); expect(visiblePopoverCount()).toBe(1);
    game.setPaused(true); audioClose.dispatch('click'); expect(game.audioSettings.open).toBe(false);
    game.update(1); expect((game as unknown as { simulationSeconds: number }).simulationSeconds).toBe(lifecyclePauseSimulation); expect(game.state.remainingSeconds).toBe(lifecyclePauseRemaining);
    game.setPaused(false); game.update(0.1); expect((game as unknown as { simulationSeconds: number }).simulationSeconds).toBeCloseTo(lifecyclePauseSimulation + 0.1, 8);
    audioToggle.dispatch('click'); expect(game.audioSettings.open).toBe(true);
    game.tipPanel.publish('stage2', '두 배! 단어를 블록에 넣어 생산량을 두 배로 늘릴 수 있습니다.');
    expect(game.audioSettings.open).toBe(false); expect(game.tipPanel.open).toBe(true); expect(game.topRightControls.openPopover).toBe('tip');
    game.tipPanel.clear(); game.tipPanel.publish('stage1', '빨리! 단어를 블록에 넣어 빠르게 만들 수 있습니다.'); tipClose.dispatch('click');
    completeCurrentStage(game, CAMPAIGN_CONFIG.stages.stage1.targetBreadCount);
    expect(game.tipPanel.currentTipId).toBe('stage2'); expect(game.tipPanel.currentBody).toBe('두 배! 단어를 블록에 넣어 생산량을 두 배로 늘릴 수 있습니다.'); expect(game.tipPanel.open).toBe(true);
    expect(game.audioSettings.open).toBe(false); expect(visiblePopoverCount()).toBe(1); expect(game.audio.settings()).toEqual({ volume: 0.6, muted: true });
    const double = game.modules.find((module) => module.type === 'double')!;
    const doubleChargeBeforeSettings = double.chargeSeconds; const stage2RemainingBeforeSettings = game.state.remainingSeconds!;
    audioToggle.dispatch('click'); expect(game.audioSettings.open).toBe(true); expect(game.tipPanel.open).toBe(false);
    game.update(1); expect(double.chargeSeconds).toBe(doubleChargeBeforeSettings); expect(game.state.remainingSeconds).toBe(stage2RemainingBeforeSettings);
    audioClose.dispatch('click'); game.update(0.1); expect(double.chargeSeconds).toBeCloseTo(doubleChargeBeforeSettings + 0.1, 8);
    expect(game.state.remainingSeconds).toBeCloseTo(stage2RemainingBeforeSettings - 0.1, 8);
    tipClose.dispatch('click');
    (game as unknown as { configureStage(stage: 'stage2', initial: boolean, captureBaseline: boolean): void }).configureStage('stage2', false, false);
    expect(game.tipPanel.currentTipId).toBe('stage2'); expect(game.tipPanel.open).toBe(false);
    expect(tipClose.listenerCount('click')).toBe(1);
    completeCurrentStage(game, CAMPAIGN_CONFIG.stages.stage2.targetBreadCount);
    expect(game.tipPanel.currentTipId).toBe('stage3'); expect(game.tipPanel.currentBody).toBe('또! 단어를 넣어 같이 블록에 들어간 단어의 효과를 중첩시킬 수 있습니다.'); expect(game.tipPanel.open).toBe(true);
    const css = await readFile(path.join(process.cwd(), 'src', 'style.css'), 'utf8');
    expect(css).toMatch(/campaign-keycap[^}]*keycaps-atlas-1x\.png/s); expect(css).not.toMatch(/campaign-keycap[^}]*background-color:\s*white/s);
    expect(css).toMatch(/\.campaign-keycap--q\s*\{[^}]*background-position:\s*-384px 0/);
    expect(css).toMatch(/\.campaign-keycap--arrowup\s*\{[^}]*background-position:\s*-416px 0/);
    expect(css).toMatch(/\.campaign-keycap--arrowleft\s*\{[^}]*background-position:\s*-448px 0/);
    expect(css).toMatch(/\.campaign-keycap--arrowdown\s*\{[^}]*background-position:\s*-480px 0/);
    expect(css).toMatch(/\.campaign-keycap--arrowright\s*\{[^}]*background-position:\s*-512px 0/);
    const tutorialRule = css.match(/\.tutorial-panel\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(tutorialRule).toMatch(/bottom:\s*48px/); expect(tutorialRule).not.toMatch(/bottom:\s*(?:24|40)px/);
    expect(tutorialRule).toMatch(/width:\s*min\(560px,\s*calc\(100vw\s*-\s*32px\)\)/);
    expect(tutorialRule).toMatch(/background:\s*#ffffff/); expect(tutorialRule).not.toMatch(/rgba\(248,239,215/); expect(tutorialRule).toMatch(/color:\s*#18252f/);
    expect(css).toMatch(/\.campaign-top-right-controls\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*gap:\s*8px/s);
    expect(css).toMatch(/\.audio-settings__trigger\s*\{[^}]*width:\s*38px[^}]*height:\s*38px[^}]*border:\s*2px solid #263746[^}]*background:\s*#ffffff[^}]*box-shadow:/s);
    expect(css).toMatch(/\.audio-settings__gear\s*\{[^}]*width:\s*22px[^}]*height:\s*22px[^}]*fill:\s*currentColor/s);
    expect(css).toMatch(/\.audio-settings__trigger:hover\s*\{[^}]*transform:\s*translateY\(-1px\)/s);
    expect(css).toMatch(/\.audio-settings__trigger:active\s*\{[^}]*transform:\s*translateY\(3px\)/s);
    expect(css).toMatch(/\.audio-settings__trigger:focus-visible\s*\{[^}]*outline:/s);
    expect(css).toMatch(/\.audio-settings__mute\s*\{[^}]*width:\s*42px[^}]*height:\s*38px[^}]*border:\s*2px solid #263746[^}]*background:\s*#ffffff[^}]*box-shadow:/s);
    expect(css).toMatch(/\.audio-settings__controls\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*auto minmax\(0,1fr\) auto[^}]*column-gap:\s*10px/s);
    expect(css).toMatch(/\.audio-settings__range\s*\{[^}]*width:\s*100%[^}]*accent-color:\s*#3ba873/s);
    expect(css).toMatch(/\.audio-settings__controls\[data-muted="true"\] \.audio-settings__volume\s*\{[^}]*color:\s*#7c878f[^}]*opacity:\s*\.55/s);
    expect(css).toMatch(/\.audio-settings__controls\[data-muted="true"\] \.audio-settings__range\s*\{[^}]*accent-color:\s*#8b969d[^}]*filter:\s*grayscale\(1\) saturate\(0\)[^}]*opacity:\s*\.72/s);
    expect(css).toMatch(/\.audio-settings__speaker\s*\{[^}]*width:\s*28px[^}]*height:\s*24px[^}]*overflow:\s*visible/s);
    expect(css).toMatch(/\.audio-settings__mute\[aria-pressed="true"\]\s+\.audio-settings__speaker-shape\s*\{[^}]*opacity:\s*\.38/s);
    expect(css).toMatch(/\.audio-settings__mute-mark\s*\{[^}]*stroke:\s*#ef5b43[^}]*stroke-width:\s*3/s);
    expect(css).toMatch(/\.audio-settings__mute:hover\s*\{[^}]*transform:\s*translateY\(-1px\)/s);
    expect(css).toMatch(/\.audio-settings__mute:active\s*\{[^}]*transform:\s*translateY\(3px\)/s);
    expect(css).toMatch(/\.audio-settings__mute:focus-visible\s*\{[^}]*outline:/s);
    expect(css).not.toContain('.campaign-tip__toggle');
    expect(css).toMatch(/\.campaign-tip__title\s*\{[^}]*flex:\s*0 0 auto[^}]*color:\s*#ef5b43[^}]*font-family:\s*Galmuri11,\s*system-ui,\s*sans-serif[^}]*font-size:\s*20px[^}]*font-weight:\s*900[^}]*font-synthesis:\s*none/s);
    expect(css).not.toContain('.campaign-tip__title[hidden]');
    expect(css).toMatch(/\.campaign-tip__panel\s*\{[^}]*position:\s*static[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*width:\s*max-content[^}]*max-width:\s*min\(960px,\s*calc\(100vw\s*-\s*144px\)\)[^}]*background:\s*#ffffff/s);
    expect(css).toMatch(/\.campaign-tip__body\s*\{[^}]*color:\s*#18252f[^}]*word-break:\s*keep-all[^}]*overflow-wrap:\s*normal/s);
    expect(css).toMatch(/\.campaign-tip__close\s*\{[^}]*width:\s*28px[^}]*height:\s*28px[^}]*color:\s*#ffffff[^}]*background:\s*#ef5b43[^}]*font-size:\s*18px[^}]*box-shadow:/s);
    expect(css).not.toMatch(/\.campaign-tip__close\s*\{[^}]*width:\s*34px|\.campaign-tip__close\s*\{[^}]*font-size:\s*24px/s);
    expect(css).toMatch(/\.campaign-tip__close:hover\s*\{[^}]*background:\s*#d94735[^}]*transform:\s*translateY\(1px\)/s);
    expect(css).toMatch(/\.campaign-tip__close:active\s*\{[^}]*transform:\s*translateY\(2px\)/s);
    expect(css).toMatch(/\.campaign-tip__close:focus-visible\s*\{[^}]*outline:/s);
    const toolbarRoot = game.topRightControls.root as unknown as FakeElement;
    game.dispose(); expect(toolbarRoot.removed).toBe(true); expect(tipRoot.removed).toBe(true); expect(audioRoot.removed).toBe(true);
    expect(tipClose.listenerCount('click')).toBe(0);
    expect(audioToggle.listenerCount('click')).toBe(0); expect(audioClose.listenerCount('click')).toBe(0); expect(audioRange.listenerCount('input')).toBe(0); expect(audioMute.listenerCount('click')).toBe(0);
  });

  it('projects persisted mute through the public CampaignGame settings owner without a parallel checkbox state', () => {
    const writes: string[] = [];
    Object.assign(globalThis, { localStorage: {
      getItem: () => JSON.stringify({ volume: 0.45, muted: true }),
      setItem: (_key: string, value: string) => { writes.push(value); },
    } });
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    const audioRoot = game.audioSettings.root as unknown as FakeElement;
    const controls = audioRoot.querySelector<FakeElement>('.audio-settings__controls');
    const range = audioRoot.querySelector<FakeElement>('input[type="range"]');
    const mute = audioRoot.querySelector<FakeElement>('.audio-settings__mute'); const mark = audioRoot.querySelector<FakeElement>('.audio-settings__mute-mark');
    const trigger = audioRoot.querySelector<FakeElement>('.audio-settings__trigger');
    expect(game.audio.settings()).toEqual({ volume: 0.45, muted: true }); expect(audioRoot.innerHTML).toContain('value="0.45"');
    expect(controls.attributes['data-muted']).toBe('true'); expect(mute.attributes['aria-pressed']).toBe('true');
    expect(mark.style.display).toBe(''); expect(audioRoot.innerHTML).not.toContain('type="checkbox"');
    trigger.dispatch('click'); expect(game.audioSettings.open).toBe(true);
    range.value = '0.7'; range.dispatch('input');
    expect(game.audio.settings()).toEqual({ volume: 0.7, muted: true }); expect(controls.attributes['data-muted']).toBe('true');
    mute.dispatch('click');
    expect(game.audio.settings()).toEqual({ volume: 0.7, muted: false }); expect(controls.attributes['data-muted']).toBe('false');
    expect(mute.attributes['aria-pressed']).toBe('false'); expect(mark.style.display).toBe('none');
    trigger.dispatch('click'); trigger.dispatch('click'); expect(game.audioSettings.open).toBe(true);
    expect(game.audio.settings()).toEqual({ volume: 0.7, muted: false }); expect(controls.attributes['data-muted']).toBe('false');
    expect(mute.attributes['aria-pressed']).toBe('false');
    expect(writes).toEqual([JSON.stringify({ volume: 0.7, muted: true }), JSON.stringify({ volume: 0.7, muted: false })]);
    game.dispose(); expect(mute.listenerCount('click')).toBe(0);
  });

  it('drops both shipped Stage0 block presentations from one public tutorial admission without moving gameplay anchors or camera height', async () => {
    const assets = await actualAuthoredObjectAssets(); const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera();
    const renderer = { capabilities: { getMaxAnisotropy: () => 8 }, setPixelRatio: () => undefined, setSize: () => undefined,
      dispose: () => undefined, render: () => undefined } as unknown as THREE.WebGLRenderer;
    const boot = new CampaignBoot({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      renderer, scene, camera, assets });
    boot.resize(1280, 720, 1); expect(await boot.load()).toBe(true);
    const game = (boot as unknown as { game: CampaignGame }).game; const [mill, heater] = game.blocks;
    expect(mill!.root.visible).toBe(false); expect(heater!.root.visible).toBe(false);
    tap(game, 'ArrowUp', 0.05); game.keyDown('ShiftLeft', false); game.keyDown('ArrowUp', false); game.update(0.05); game.keyUp('ArrowUp'); game.keyUp('ShiftLeft');
    game.update(1.45); game.update(0.55); const wheat = game.materials.all().find((material) => material.type === 'wheat' && material.location === 'world')!;
    moveTo(game, wheat.root.position.x, wheat.root.position.z); tap(game, 'KeyE');
    const millRootPosition = mill!.root.position.clone(); const millRootQuaternion = mill!.root.quaternion.clone();
    const millMouth = mill!.readOutputMouthPosition(new THREE.Vector3()).clone(); const millExit = mill!.readTokenExitPosition(new THREE.Vector3()).clone();
    tap(game, 'KeyQ'); const millPresentation = mill!.readPresentationRoot();
    expect(millPresentation.position.y).toBeCloseTo(5, 10); expect(mill!.interactionAvailable).toBe(false); expect(game.interactionKeycap.root.visible).toBe(false);
    for (const name of ['campaign-block-function-surface', 'campaign-block-progress', 'campaign-block-capacity'])
      expect(millPresentation.getObjectByName(name)).not.toBeUndefined();
    const cameraY = camera.position.y; const cameraZ = camera.position.z;
    const playingSimulationBeforeDrop = (game as unknown as { simulationSeconds: number }).simulationSeconds;
    for (const progress of [0.25, 0.5, 0.75, 1]) {
      game.update(CAMPAIGN_CONFIG.presentation.stage0BlockRevealDropSeconds * 0.25);
      expect(millPresentation.position.y).toBeCloseTo(5 * (1 - progress * progress), 10);
      expect(mill!.root.position).toEqual(millRootPosition); expect(mill!.root.quaternion.angleTo(millRootQuaternion)).toBeLessThan(1e-12);
      expect(mill!.readOutputMouthPosition(new THREE.Vector3())).toEqual(millMouth); expect(mill!.readTokenExitPosition(new THREE.Vector3())).toEqual(millExit);
      expect(camera.position.y).toBe(cameraY); expect(camera.position.z).toBe(cameraZ);
    }
    expect((game as unknown as { simulationSeconds: number }).simulationSeconds - playingSimulationBeforeDrop)
      .toBeCloseTo(CAMPAIGN_CONFIG.presentation.stage0BlockRevealDropSeconds, 8);
    expect(mill!.interactionAvailable).toBe(true); expect(mill!.createStage0RevealStep(0.88, 5)).toBeNull();
    game.update(0.016); tap(game, 'KeyE'); moveToBlockSide(game, mill!, 'left'); tap(game, 'KeyQ'); game.update(0.016);
    expect(wheat.location).toBe('stored'); game.update(2.4);
    const heaterPresentation = heater!.readPresentationRoot(); expect(heaterPresentation.position.y).toBeCloseTo(5, 10);
    for (const progress of [0.25, 0.5, 0.75, 1]) {
      game.update(CAMPAIGN_CONFIG.presentation.stage0BlockRevealDropSeconds * 0.25);
      expect(heaterPresentation.position.y).toBeCloseTo(5 * (1 - progress * progress), 10);
      expect(camera.position.y).toBe(cameraY); expect(camera.position.z).toBe(cameraZ);
    }
    expect(heater!.interactionAvailable).toBe(true); const roots = [mill!.root, heater!.root]; boot.dispose();
    expect(roots.every((root) => root.parent === null)).toBe(true);
  });

  it('reveals the shipped Stage0 submission dock through one owned scale and goal-board rise before admitting bread', async () => {
    const assets = await actualAuthoredObjectAssets(); const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera();
    const renderer = { capabilities: { getMaxAnisotropy: () => 8 }, setPixelRatio: () => undefined, setSize: () => undefined,
      dispose: () => undefined, render: () => undefined } as unknown as THREE.WebGLRenderer;
    const boot = new CampaignBoot({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      renderer, scene, camera, assets });
    boot.resize(1280, 720, 1); expect(await boot.load()).toBe(true);
    const game = (boot as unknown as { game: CampaignGame }).game; const dock = game.submissionDock;
    const rootIdentity = dock.root; const visualIdentity = dock.readVisualPresentationRoot(); const boardIdentity = dock.goalScoreboard.root;
    const rootPosition = dock.root.position.clone(); const rootQuaternion = dock.root.quaternion.clone(); const rootScale = dock.root.scale.clone();
    const gameplayPosition = dock.readGameplayPosition(new THREE.Vector3()).clone();
    const suctionPosition = dock.readSuctionPosition(new THREE.Vector3()).clone();
    const collisionBounds = dock.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
    const boardTerminalPosition = boardIdentity.position.clone(); const boardTerminalQuaternion = boardIdentity.quaternion.clone();
    const boardTerminalScale = boardIdentity.scale.clone();
    expect(dock.goalScoreboard.contract).toMatchObject({ templateId: CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE_ID,
      instanceId: 'i9-dock-goal-scoreboard', role: 'dock-goal', uniformScale: 0.75 });
    expect(boardIdentity.userData).toMatchObject({ breadPictogramSource: 'i9-compact-goal-bread-pictogram-v001',
      typography: { family: 'Galmuri11', weight: 900 } });
    expect(dock.readStage0RevealDiagnostics()).toMatchObject({ state: 'hidden', interactionAvailable: false,
      visualVisible: false, visualScale: 1, goalBoardVisible: false });

    tap(game, 'ArrowUp', 0.05); game.keyDown('ShiftLeft', false); game.keyDown('ArrowUp', false); game.update(0.05); game.keyUp('ArrowUp'); game.keyUp('ShiftLeft');
    game.update(1.45); game.update(0.55); const wheat = game.materials.all().find((material) => material.type === 'wheat' && material.location === 'world')!;
    moveTo(game, wheat.root.position.x, wheat.root.position.z); tap(game, 'KeyE'); tap(game, 'KeyQ');
    game.update(CAMPAIGN_CONFIG.presentation.stage0BlockRevealDropSeconds); game.update(0.016); tap(game, 'KeyE');
    moveTo(game, -5.5, -2.5); tap(game, 'KeyQ'); game.update(0.016); game.update(2.4);
    game.update(CAMPAIGN_CONFIG.presentation.stage0BlockRevealDropSeconds); game.update(CAMPAIGN_CONFIG.materialPresentation.outputSeconds);
    const flour = game.materials.all().find((material) => material.type === 'flour' && material.location === 'output')!;
    moveTo(game, flour.root.position.x, flour.root.position.z); tap(game, 'KeyE'); moveTo(game, 2.2, -2.5); tap(game, 'KeyQ'); game.update(0.016);
    moveToBlockSide(game, game.blocks[1]!, 'left'); tap(game, 'Space'); game.keyDown('ArrowRight', false); game.update(0.06); game.keyUp('ArrowRight'); tap(game, 'Space');
    expect(game.tutorial.heaterProcessingUnlocked).toBe(true);
    game.update(CAMPAIGN_CONFIG.stages.stage0.heaterProcessSeconds);

    expect(dock.root).toBe(rootIdentity); expect(dock.readVisualPresentationRoot()).toBe(visualIdentity);
    expect(dock.goalScoreboard.root).toBe(boardIdentity);
    expect(dock.readStage0RevealDiagnostics()).toMatchObject({ state: 'revealing', interactionAvailable: false,
      visualVisible: true, visualScale: CAMPAIGN_CONFIG.presentation.stage0DockRevealStartScale, goalBoardVisible: true,
      goalBoardLocalY: boardTerminalPosition.y - CAMPAIGN_CONFIG.presentation.stage0GoalBoardRiseMeters });
    const bread = game.materials.all().find((material) => material.type === 'bread')!;
    const elapsedSamples = [0.25, 0.5, 0.75];
    for (const progress of elapsedSamples) {
      game.update(CAMPAIGN_CONFIG.presentation.stage0DockRevealSeconds * 0.25);
      const eased = 1 - Math.pow(1 - progress, 3); const diagnostics = dock.readStage0RevealDiagnostics();
      expect(diagnostics).toMatchObject({ state: 'revealing', interactionAvailable: false, visualVisible: true, goalBoardVisible: true });
      expect(diagnostics.visualScale).toBeCloseTo(CAMPAIGN_CONFIG.presentation.stage0DockRevealStartScale +
        (1 - CAMPAIGN_CONFIG.presentation.stage0DockRevealStartScale) * eased, 10);
      expect(diagnostics.goalBoardLocalY).toBeCloseTo(boardTerminalPosition.y -
        CAMPAIGN_CONFIG.presentation.stage0GoalBoardRiseMeters * (1 - eased), 10);
      expect(dock.submittedBreadCount).toBe(0); expect(bread.location).not.toBe('submitted');
      expect(dock.root.position).toEqual(rootPosition); expect(dock.root.quaternion.angleTo(rootQuaternion)).toBeLessThan(1e-12);
      expect(dock.root.scale).toEqual(rootScale); expect(dock.readGameplayPosition(new THREE.Vector3())).toEqual(gameplayPosition);
      expect(dock.readSuctionPosition(new THREE.Vector3())).toEqual(suctionPosition);
      expect(dock.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 })).toEqual(collisionBounds);
    }
    game.setPaused(true); const paused = dock.readStage0RevealDiagnostics(); game.update(0.2);
    expect(dock.readStage0RevealDiagnostics()).toEqual(paused); game.setPaused(false);
    game.update(CAMPAIGN_CONFIG.presentation.stage0DockRevealSeconds * 0.25);
    expect(dock.readStage0RevealDiagnostics()).toMatchObject({ state: 'revealed', interactionAvailable: true,
      visualVisible: true, visualScale: 1, goalBoardVisible: true, goalBoardLocalY: boardTerminalPosition.y });
    expect(boardIdentity.position).toEqual(boardTerminalPosition); expect(boardIdentity.quaternion.angleTo(boardTerminalQuaternion)).toBeLessThan(1e-12);
    expect(boardIdentity.scale).toEqual(boardTerminalScale); expect(dock.root).toBe(rootIdentity);
    expect(dock.submittedBreadCount).toBe(0); expect(bread.location).toBe('output');
    moveTo(game, bread.root.position.x, bread.root.position.z); tap(game, 'KeyE');
    const delivery = dock.readGameplayPosition(new THREE.Vector3()); moveTo(game, delivery.x, delivery.z); tap(game, 'KeyQ');
    expect(bread.location).toBe('world'); expect(dock.submittedBreadCount).toBe(0);
    expect((game as unknown as { selectedAction: { label: string } | null }).selectedAction?.label).toBe('E');
    expect(game.interactionKeycap.label).toBe('E'); expect(game.interactionKeycap.root.visible).toBe(true);
    game.update(0.016);
    expect(dock.submittedBreadCount).toBe(1); expect(bread.location).toBe('submitted'); expect(game.state.phase.kind).toBe('clear-presentation');
    expectPlayingInteractionRetired(game);
    game.update(0.17); expectPlayingInteractionRetired(game);
    for (let index = 0; index < 120 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage1' });
    expect(dock.readStage0RevealDiagnostics()).toMatchObject({ state: 'revealed', interactionAvailable: true,
      visualVisible: true, visualScale: 1, goalBoardVisible: true, goalBoardLocalY: boardTerminalPosition.y });
    boot.dispose(); expect(dock.root.parent).toBeNull(); expect(visualIdentity.parent).toBe(dock.root);
    expect(boardIdentity.parent).toBe(dock.root);
  });

  it('retires the exact final-bread interaction on every timed CLEAR edge and admits only a fresh next-stage prompt', async () => {
    const assets = await actualAuthoredObjectAssets(); const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera();
    const renderer = { capabilities: { getMaxAnisotropy: () => 8 }, setPixelRatio: () => undefined, setSize: () => undefined,
      dispose: () => undefined, render: () => undefined } as unknown as THREE.WebGLRenderer;
    const boot = new CampaignBoot({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      renderer, scene, camera, assets });
    boot.resize(1280, 720, 1); expect(await boot.load()).toBe(true);
    const game = (boot as unknown as { game: CampaignGame }).game; reachStage1(game);
    const timedStages = ['stage1', 'stage2', 'stage3'] as const;
    for (const stage of timedStages) {
      expect(game.state.phase).toEqual({ kind: 'playing', stage });
      const target = CAMPAIGN_CONFIG.stages[stage].targetBreadCount;
      const delivery = game.submissionDock.readGameplayPosition(new THREE.Vector3());
      for (let index = 0; index < target - 1; index += 1) game.materials.create('bread', delivery);
      game.update(0.016); expect(game.submissionDock.submittedBreadCount).toBe(target - 1);
      moveTo(game, 0, 2);
      const finalBread = game.materials.create('bread', game.player.root.position.clone());
      game.update(0); expect(game.interactionKeycap.label).toBe('E'); tap(game, 'KeyE');
      expect(finalBread.location).toBe('held'); moveTo(game, delivery.x, delivery.z); tap(game, 'KeyQ');
      expect(finalBread.location).toBe('world'); expect(game.interactionKeycap.label).toBe('E');
      expect((game as unknown as { selectedAction: { root: THREE.Object3D } | null }).selectedAction?.root).toBe(finalBread.root);
      game.update(0.016);
      expect(game.submissionDock.submittedBreadCount).toBe(target); expect(finalBread.location).toBe('submitted');
      expect(game.state.phase.kind).toBe('clear-presentation'); expectPlayingInteractionRetired(game);
      game.update(0.19); expectPlayingInteractionRetired(game);
      for (let index = 0; index < 160 && game.state.phase.kind === 'clear-presentation'; index += 1) game.update(0.1);
      if (stage === 'stage3') {
        expect(game.state.phase.kind).toBe('final-score'); expectPlayingInteractionRetired(game);
      } else {
        const nextStage = stage === 'stage1' ? 'stage2' : 'stage3';
        expect(game.state.phase).toEqual({ kind: 'playing', stage: nextStage });
        const fresh = game.materials.create('wheat', game.player.root.position.clone()); game.update(0);
        expect((game as unknown as { selectedAction: { root: THREE.Object3D } | null }).selectedAction?.root).toBe(fresh.root);
        expect(game.interactionKeycap.label).toBe('E'); tap(game, 'KeyE'); tap(game, 'KeyQ');
      }
    }
    boot.dispose();
  });

  it('retires a visible E interaction at timeout and republishes only a fresh prompt after public retry', async () => {
    const assets = await actualAuthoredObjectAssets(); const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera();
    const renderer = { capabilities: { getMaxAnisotropy: () => 8 }, setPixelRatio: () => undefined, setSize: () => undefined,
      dispose: () => undefined, render: () => undefined } as unknown as THREE.WebGLRenderer;
    const boot = new CampaignBoot({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      renderer, scene, camera, assets });
    boot.resize(1280, 720, 1); expect(await boot.load()).toBe(true);
    const game = (boot as unknown as { game: CampaignGame }).game; reachStage1(game);
    const prompted = game.modules.find((module) => module.type === 'fast')!; const promptedWorld = prompted.root.getWorldPosition(new THREE.Vector3());
    moveTo(game, promptedWorld.x, promptedWorld.z); game.update(0);
    expect((game as unknown as { selectedAction: { root: THREE.Object3D } | null }).selectedAction?.root).toBe(prompted.root);
    expect((game as unknown as { interaction: { selected: unknown } }).interaction.selected).not.toBeNull();
    expect(game.interactionKeycap.label).toBe('E'); expect(game.interactionKeycap.root.visible).toBe(true);
    game.state.setRemainingSeconds(0.01); game.update(0.02);
    expect(game.state.phase).toEqual({ kind: 'game-over-presentation', stage: 'stage1' }); expectPlayingInteractionRetired(game);
    for (let index = 0; index < 80 && game.state.phase.kind !== 'game-over'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage1' }); expect(game.keyDown('KeyR', false)).toBe(true); game.keyUp('KeyR');
    for (let index = 0; index < 120 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage1' }); expectPlayingInteractionRetired(game);
    const freshWorld = prompted.root.getWorldPosition(new THREE.Vector3()); moveTo(game, freshWorld.x, freshWorld.z); game.update(0);
    expect((game as unknown as { selectedAction: { root: THREE.Object3D } | null }).selectedAction?.root).toBe(prompted.root);
    expect((game as unknown as { interaction: { selected: unknown } }).interaction.selected).not.toBeNull();
    expect(game.interactionKeycap.label).toBe('E'); expect(game.interactionKeycap.root.visible).toBe(true); boot.dispose();
  });

  it('publishes CLEAR and retry terminal playing state without consuming presentation-frame delta as gameplay', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game);
    for (let index = 0; index < 5; index += 1) game.materials.create('bread', game.submissionDock.readGameplayPosition(new THREE.Vector3()));
    game.update(0.016); expect(game.state.phase.kind).toBe('clear-presentation');
    const presentation = game.presentation as unknown as { current: import('./presentation/PresentationPlayer').PresentationStep | null };
    for (let index = 0; index < 200 && !presentation.current?.id.includes('camera-return'); index += 1) game.update(0.1);
    expect(presentation.current?.id).toContain('camera-return');
    const clearTerminalDelta = 0.9; game.update(clearTerminalDelta);
    expect(game.state.phase).toEqual({ kind: 'clear-presentation', stage: 'stage1', nextStage: 'stage2' });
    expect(presentation.current?.id).toBe('stage2-physical-scoreboard-entrance');
    expect(game.state.remainingSeconds).toBe(60); expect(game.wheatSource.readTimerSeconds()).toBe(0);
    const double = game.modules.find((module) => module.type === 'double')!; expect(double.chargeSeconds).toBe(0);
    game.update(CAMPAIGN_CONFIG.presentation.timedStageEntranceSeconds);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage2' });
    expect(game.state.remainingSeconds).toBe(60); expect(game.wheatSource.readTimerSeconds()).toBe(0); expect(double.chargeSeconds).toBe(0);
    game.update(0.25); expect(game.state.remainingSeconds).toBeCloseTo(59.75, 8);
    expect(game.wheatSource.readTimerSeconds()).toBeCloseTo(0.25, 8); expect(double.chargeSeconds).toBeCloseTo(0.25, 8);

    game.update(60); for (let index = 0; index < 80 && game.state.phase.kind !== 'game-over'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage2' }); expect(game.keyDown('KeyR', false)).toBe(true);
    for (let index = 0; index < 100 && !presentation.current?.id.includes('camera-return'); index += 1) game.update(0.1);
    expect(presentation.current?.id).toContain('camera-return');
    const retryTerminalDelta = 0.85; game.update(retryTerminalDelta);
    expect(presentation.current?.id).toContain('module-effect-reset');
    game.update(CAMPAIGN_CONFIG.presentation.moduleEffectResetSeconds);
    expect(game.state.phase).toEqual({ kind: 'retry-presentation', stage: 'stage2' });
    expect(presentation.current?.id).toBe('stage2-physical-scoreboard-entrance');
    game.update(CAMPAIGN_CONFIG.presentation.timedStageEntranceSeconds);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage2' });
    expect(game.state.remainingSeconds).toBe(60); expect(game.wheatSource.readTimerSeconds()).toBe(0);
    expect(double.chargeSeconds).toBe(0);
    game.update(0.25); expect(game.state.remainingSeconds).toBeCloseTo(59.75, 8);
    expect(game.wheatSource.readTimerSeconds()).toBeCloseTo(0.25, 8); expect(double.chargeSeconds).toBeCloseTo(0.25, 8);
    game.dispose();
  });

  it('admits every timed stage and retry only after the shipped central timer completes its owned rise', async () => {
    const assets = await actualAuthoredObjectAssets(); const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera();
    const renderer = { capabilities: { getMaxAnisotropy: () => 8 }, setPixelRatio: () => undefined,
      setSize: () => undefined, dispose: () => undefined, render: () => undefined } as unknown as THREE.WebGLRenderer;
    const boot = new CampaignBoot({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      renderer, scene, camera, assets });
    boot.resize(1280, 720, 1); expect(await boot.load()).toBe(true);
    const game = (boot as unknown as { game: CampaignGame }).game;
    const presentation = game.presentation as unknown as { current: import('./presentation/PresentationPlayer').PresentationStep | null };
    const centralRoot = game.scoreboard.central.root;
    const advanceToEntrance = (stage: 'stage1' | 'stage2' | 'stage3'): void => {
      for (let index = 0; index < 240 && presentation.current?.id !== `${stage}-physical-scoreboard-entrance`; index += 1) game.update(0.1);
      expect(presentation.current?.id).toBe(`${stage}-physical-scoreboard-entrance`);
    };
    const assertEntranceStart = (stage: 'stage1' | 'stage2' | 'stage3', text: string, seconds: number): void => {
      const diagnostic = game.scoreboard.readActiveProjectionDiagnostics();
      expect(game.state.phase.kind).not.toBe('playing'); expect(game.state.remainingSeconds).toBe(seconds);
      expect(diagnostic).toMatchObject({ state: 'entering', centralVisible: true, auxiliaryVisible: false,
        centralY: diagnostic.hiddenY, signature: `active:${stage}:${seconds}`, text });
      expect(game.scoreboard.central.root).toBe(centralRoot);
    };
    const sampleSplitEntrance = (stage: 'stage1' | 'stage2' | 'stage3', seconds: number): void => {
      const startSimulation = (game as unknown as { simulationSeconds: number }).simulationSeconds;
      const startWheat = game.wheatSource.readTimerSeconds(); const playerPosition = game.player.position.clone();
      expect(game.keyDown('ArrowRight', false)).toBe(true);
      let previousY = game.scoreboard.readActiveProjectionDiagnostics().centralY;
      for (const progress of [0.25, 0.5, 0.75, 1]) {
        game.update(CAMPAIGN_CONFIG.presentation.timedStageEntranceSeconds * 0.25);
        const diagnostic = game.scoreboard.readActiveProjectionDiagnostics(); const eased = progress * progress * (3 - 2 * progress);
        expect(diagnostic.centralY).toBeCloseTo(diagnostic.hiddenY + (diagnostic.raisedY - diagnostic.hiddenY) * eased, 10);
        expect(diagnostic.centralY).toBeGreaterThanOrEqual(previousY); previousY = diagnostic.centralY;
        expect(game.state.remainingSeconds).toBe(seconds); expect(game.wheatSource.readTimerSeconds()).toBe(startWheat);
        expect((game as unknown as { simulationSeconds: number }).simulationSeconds).toBe(startSimulation);
        expect(game.player.position).toEqual(playerPosition);
        if (progress === 0.25) {
          game.setPaused(true); const paused = game.scoreboard.readActiveProjectionDiagnostics(); game.update(0.6);
          expect(game.scoreboard.readActiveProjectionDiagnostics()).toEqual(paused); expect(game.state.remainingSeconds).toBe(seconds);
          game.setPaused(false);
        }
      }
      game.keyUp('ArrowRight'); expect(game.state.phase).toEqual({ kind: 'playing', stage });
      expect(game.scoreboard.readActiveProjectionDiagnostics()).toMatchObject({ state: 'active', centralVisible: true,
        auxiliaryVisible: false, text: `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}` });
      expect((game as unknown as { simulationSeconds: number }).simulationSeconds).toBe(startSimulation);
      game.update(0.1); expect(game.state.remainingSeconds).toBeCloseTo(seconds - 0.1, 10);
      expect(game.wheatSource.readTimerSeconds()).toBeCloseTo(startWheat + 0.1, 10);
    };

    completeStage0ToTimedEntrance(game); advanceToEntrance('stage1'); assertEntranceStart('stage1', '00:50', 50);
    sampleSplitEntrance('stage1', 50);

    for (let index = 0; index < CAMPAIGN_CONFIG.stages.stage1.targetBreadCount; index += 1) {
      game.materials.create('bread', game.submissionDock.readGameplayPosition(new THREE.Vector3()));
    }
    game.update(0.016); advanceToEntrance('stage2'); assertEntranceStart('stage2', '01:00', 60);
    const stage2StartSimulation = (game as unknown as { simulationSeconds: number }).simulationSeconds;
    game.update(CAMPAIGN_CONFIG.presentation.timedStageEntranceSeconds);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage2' }); expect(game.state.remainingSeconds).toBe(60);
    expect((game as unknown as { simulationSeconds: number }).simulationSeconds).toBe(stage2StartSimulation);

    for (let index = 0; index < CAMPAIGN_CONFIG.stages.stage2.targetBreadCount; index += 1) {
      game.materials.create('bread', game.submissionDock.readGameplayPosition(new THREE.Vector3()));
    }
    game.update(0.016); advanceToEntrance('stage3'); assertEntranceStart('stage3', '01:30', 90);
    const stage3StartSimulation = (game as unknown as { simulationSeconds: number }).simulationSeconds;
    game.update(CAMPAIGN_CONFIG.presentation.timedStageEntranceSeconds * 0.5);
    expect(game.state.phase.kind).toBe('clear-presentation'); expect(game.state.remainingSeconds).toBe(90);
    game.update(CAMPAIGN_CONFIG.presentation.timedStageEntranceSeconds * 0.5);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage3' }); expect(game.state.remainingSeconds).toBe(90);
    expect((game as unknown as { simulationSeconds: number }).simulationSeconds).toBe(stage3StartSimulation);

    game.update(90); for (let index = 0; index < 80 && game.state.phase.kind !== 'game-over'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage3' }); expect(game.keyDown('KeyR', false)).toBe(true);
    advanceToEntrance('stage3'); assertEntranceStart('stage3', '01:30', 90);
    const retrySimulation = (game as unknown as { simulationSeconds: number }).simulationSeconds;
    const retryRootPosition = centralRoot.position.clone(); game.update(CAMPAIGN_CONFIG.presentation.timedStageEntranceSeconds);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage3' }); expect(game.state.remainingSeconds).toBe(90);
    expect((game as unknown as { simulationSeconds: number }).simulationSeconds).toBe(retrySimulation);
    expect(centralRoot).toBe(game.scoreboard.central.root); expect(centralRoot.position.y).toBeGreaterThan(retryRootPosition.y);
    game.update(0.1); expect(game.state.remainingSeconds).toBeCloseTo(89.9, 10);
    boot.dispose(); expect(centralRoot.parent).not.toBe(scene);
  });

  it('terminalizes a cancelled Stage0 block drop on the same owned presentation root', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    tap(game, 'ArrowUp', 0.05); game.keyDown('ShiftLeft', false); game.keyDown('ArrowUp', false); game.update(0.05); game.keyUp('ArrowUp'); game.keyUp('ShiftLeft');
    game.update(1.45); game.update(0.55); const wheat = game.materials.all().find((material) => material.type === 'wheat' && material.location === 'world')!;
    moveTo(game, wheat.root.position.x, wheat.root.position.z); tap(game, 'KeyE'); tap(game, 'KeyQ');
    const mill = game.blocks[0]!; const presentationRoot = mill.readPresentationRoot(); game.update(0.22);
    expect(presentationRoot.position.y).toBeGreaterThan(0); expect(game.presentation.active).toBe(true);
    game.presentation.cancel(); expect(game.presentation.active).toBe(false); expect(presentationRoot.position.toArray()).toEqual([0, 0, 0]);
    expect(presentationRoot.quaternion.toArray()).toEqual([0, 0, 0, 1]); expect(presentationRoot.scale.toArray()).toEqual([1, 1, 1]);
    expect(mill.root.visible).toBe(true); expect(mill.interactionAvailable).toBe(true);
    const dockStep = game.submissionDock.createStage0RevealStep(CAMPAIGN_CONFIG.presentation.stage0DockRevealSeconds,
      CAMPAIGN_CONFIG.presentation.stage0DockRevealStartScale, CAMPAIGN_CONFIG.presentation.stage0GoalBoardRiseMeters)!;
    expect(game.presentation.play([dockStep], () => undefined)).toBe(true); game.update(0.2);
    expect(game.submissionDock.readStage0RevealDiagnostics()).toMatchObject({ state: 'revealing', interactionAvailable: false });
    game.presentation.cancel();
    expect(game.submissionDock.readStage0RevealDiagnostics()).toMatchObject({ state: 'revealed', interactionAvailable: true,
      visualVisible: true, visualScale: 1, goalBoardVisible: true }); game.dispose();
  });

  it('keeps bread intake closed until the owned dock reveal terminal and opens it after cancellation', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); const dock = game.submissionDock; dock.hideForStage0Reveal();
    const step = dock.createStage0RevealStep(CAMPAIGN_CONFIG.presentation.stage0DockRevealSeconds,
      CAMPAIGN_CONFIG.presentation.stage0DockRevealStartScale, CAMPAIGN_CONFIG.presentation.stage0GoalBoardRiseMeters)!;
    expect(game.presentation.play([step], () => undefined)).toBe(true);
    const bread = game.materials.create('bread', dock.readGameplayPosition(new THREE.Vector3())); game.update(0.2);
    expect(dock.interactionAvailable).toBe(false); expect(dock.submittedBreadCount).toBe(0); expect(bread.location).toBe('world');
    game.presentation.cancel(); expect(dock.interactionAvailable).toBe(true); game.update(0.016);
    expect(dock.submittedBreadCount).toBe(1); expect(bread.location).toBe('submitted'); game.dispose();
  });

  it('enforces v5.1 swept collisions, camera projection, exact prompt ownership, and held stacks through CampaignGame', () => {
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(); const canvas = new FakeElement();
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: canvas as unknown as HTMLCanvasElement, scene, camera, assets: fakeAssets });
    game.keyDown('ArrowLeft', false); game.update(4); game.keyUp('ArrowLeft');
    const pipeBounds = game.wheatSource.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
    expect(game.player.position.x).toBeCloseTo(pipeBounds.maxX + CAMPAIGN_CONFIG.movement.playerRadiusMeters, 5);
    game.keyDown('ArrowRight', false); game.update(10); game.keyUp('ArrowRight');
    expect(game.player.position.x).toBeCloseTo(CAMPAIGN_MAP_BOUNDS.maxX - CAMPAIGN_CONFIG.movement.playerRadiusMeters, 5);
    expect(camera.fov).toBe(21); expect(camera.position.x).toBeCloseTo(CAMPAIGN_CONFIG.camera.centerXMax + CAMPAIGN_CONFIG.camera.offsetX, 3);
    game.resize(1600, 900); expect(camera.aspect).toBeCloseTo(16 / 9, 6);
    moveTo(game, -5.5, 0); game.keyDown('ArrowUp', false); game.update(10); game.keyUp('ArrowUp');
    expect(game.player.position.y).toBeCloseTo(game.blocks[0]!.root.position.z + CAMPAIGN_CONFIG.movement.blockHalfExtentMeters + CAMPAIGN_CONFIG.movement.playerRadiusMeters, 5);
    expect(game.player.root.position.z).toBe(game.player.position.y);
    moveTo(game, 9.9, 0); game.keyDown('ArrowUp', false); game.update(10); game.keyUp('ArrowUp');
    expect(game.player.position.y).toBeCloseTo(-3.135 + 0.315 + CAMPAIGN_CONFIG.movement.playerRadiusMeters, 5);

    const materialRoots = Array.from({ length: 5 }, (_, index) => game.materials.create('wheat', new THREE.Vector3(game.player.position.x - index * 0.03, 0, game.player.position.y)).root);
    for (let index = 0; index < 5; index += 1) { game.update(0.016); expect(game.interactionKeycap.label).toBe('E'); tap(game, 'KeyE'); }
    expect(game.player.heldMaterialIds).toHaveLength(5); expect(game.player.animationState).toBe('holding');
    expect(materialRoots.every((root) => root.parent === game.player.root)).toBe(true);
    expect(materialRoots.map((root) => Number(root.position.y.toFixed(3)))).toEqual([0.844, 0.844, 0.844, 0.933, 0.933]);
    game.keyDown('ArrowLeft', false); game.update(0.1); game.keyUp('ArrowLeft'); expect(game.player.animationState).toBe('carryWalking');
    game.setPaused(true); expect(game.interactionKeycap.root.visible).toBe(false); game.setPaused(false); game.dispose();
  });

  it('uses held E cadence for one same-type stack and Q for one whole-stack floor drop', () => {
    const createGame = (): CampaignGame => new CampaignGame({ document: fakeDocument, window: fakeWindow,
      mount: new FakeElement() as unknown as HTMLElement, tutorialSurface: new FakeElement() as unknown as HTMLElement,
      canvas: new FakeElement() as unknown as HTMLCanvasElement, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    const seed = (game: CampaignGame): CampaignMaterial[] => {
      const at = new THREE.Vector3(game.player.position.x, 0, game.player.position.y);
      return Array.from({ length: 5 }, (_, index) => game.materials.create('wheat', at.clone().add(new THREE.Vector3(index * 0.01, 0, 0))));
    };
    const direct = createGame(); const directMaterials = seed(direct);
    direct.keyDown('KeyE', false); direct.update(0); expect(direct.player.heldMaterialIds).toHaveLength(1);
    direct.update(CAMPAIGN_CONFIG.interaction.heldMaterialPickupIntervalSeconds - 0.001);
    expect(direct.player.heldMaterialIds).toHaveLength(1);
    const otherType = direct.materials.create('flour', new THREE.Vector3(direct.player.position.x, 0, direct.player.position.y));
    direct.update(0.001); expect(direct.player.heldMaterialIds).toHaveLength(2);
    direct.update(CAMPAIGN_CONFIG.interaction.heldMaterialPickupIntervalSeconds * 3);
    expect(direct.player.heldMaterialIds).toHaveLength(5);
    direct.update(2); expect(direct.player.heldMaterialIds).toHaveLength(5);
    direct.keyUp('KeyE'); direct.keyDown('KeyE', false); direct.update(0.1); direct.keyUp('KeyE');
    expect(direct.player.heldMaterialIds).toHaveLength(5);
    expect(directMaterials.every((material) => material.location === 'held')).toBe(true);
    expect(otherType.location).toBe('world');
    direct.keyDown('KeyQ', true); direct.update(0.1); direct.keyUp('KeyQ');
    expect(direct.player.heldMaterialIds).toHaveLength(5);
    tap(direct, 'KeyQ'); expect(direct.player.heldMaterialIds).toHaveLength(0);
    expect(directMaterials.every((material) => material.location === 'world')).toBe(true);

    const split = createGame(); seed(split); split.keyDown('KeyE', false); split.update(0);
    for (let index = 0; index < 8; index += 1) split.update(CAMPAIGN_CONFIG.interaction.heldMaterialPickupIntervalSeconds / 2);
    expect(split.player.heldMaterialIds).toHaveLength(5);
    split.keyUp('KeyE');

    const ready = createGame(); const at = new THREE.Vector3(ready.player.position.x, 0, ready.player.position.y);
    const first = ready.materials.create('flour', at); ready.keyDown('KeyE', false); ready.update(0); ready.update(1);
    expect(first.location).toBe('held'); const second = ready.materials.create('flour', at); ready.update(0);
    expect(second.location).toBe('held'); ready.keyUp('KeyE');
    const third = ready.materials.create('flour', at); ready.update(1); expect(third.location).toBe('world');

    const late = createGame(); late.keyDown('KeyE', false); late.update(0); late.update(0.5);
    expect(late.player.heldMaterialIds).toHaveLength(0);
    const lateFirst = late.materials.create('wheat', new THREE.Vector3(late.player.position.x, 0, late.player.position.y));
    late.update(0); expect(late.player.heldMaterialIds).toEqual([lateFirst.id]);
    const lateSecond = late.materials.create('wheat', new THREE.Vector3(late.player.position.x, 0, late.player.position.y));
    late.update(CAMPAIGN_CONFIG.interaction.heldMaterialPickupIntervalSeconds - 0.001); expect(lateSecond.location).toBe('world');
    late.update(0.001); expect(lateSecond.location).toBe('held'); late.keyUp('KeyE');
    const afterRelease = late.materials.create('wheat', new THREE.Vector3(late.player.position.x, 0, late.player.position.y));
    late.update(1); expect(afterRelease.location).toBe('world');
    direct.dispose(); split.dispose(); ready.dispose(); late.dispose();
  });

  it('rejects a retained module Q landing made unsafe by same-frame movement and drops only on a fresh target', async () => {
    const assets = await actualAuthoredObjectAssets(); const scene = new THREE.Scene();
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene, camera: new THREE.PerspectiveCamera(), assets });
    reachStage1(game); game.state.setRemainingSeconds(300);
    const stages = [
      { type: 'fast' as const, next: () => completeCurrentStage(game, CAMPAIGN_CONFIG.stages.stage1.targetBreadCount) },
      { type: 'double' as const, next: () => completeCurrentStage(game, CAMPAIGN_CONFIG.stages.stage2.targetBreadCount) },
      { type: 'again' as const, next: () => undefined },
    ];
    for (let index = 0; index < stages.length; index += 1) {
      const entry = stages[index]!; const module = game.modules.find((candidate) => candidate.type === entry.type)!;
      expect(module.location.kind).toBe('world'); const moduleRoot = module.root;
      game.materials.removeAttemptMaterials();
      const world = module.root.getWorldPosition(new THREE.Vector3());
      for (const [x, z] of [[8, 4], [-8, 4], [8, 0], [-8, 0], [0, 4]] as const) {
        moveTo(game, x, z); game.update(0);
        if (game.interactionKeycap.label !== 'E') break;
      }
      expect(game.interactionKeycap.label).not.toBe('E');
      game.keyDown('KeyE', false); game.update(0); moveTo(game, world.x, world.z); game.update(0);
      expect(game.player.heldModule).toBeNull(); expect(module.location.kind).toBe('world');
      game.keyUp('KeyE'); tap(game, 'KeyE');
      game.presentation.finishImmediately(); expect(game.player.heldModule).toBe(module); expect(module.root).toBe(moduleRoot);
      moveTo(game, -4 + index * 3.4, 3.8); game.update(0);
      expect(game.interactionKeycap.label).toBeNull(); expect(game.interactionKeycap.root.visible).toBe(false);
      const retained = heldModuleDropTarget(game); expect(retained?.kind).toBe('floor-drop'); expect(Object.isFrozen(retained?.landing)).toBe(true);
      const oldLanding = retained!.landing.clone(); const beforeLocal = module.root.position.clone();
      const deltaX = oldLanding.x - game.player.position.x; const deltaZ = oldLanding.z - game.player.position.y;
      const toward = Math.abs(deltaX) >= Math.abs(deltaZ) ? (deltaX >= 0 ? 'ArrowRight' : 'ArrowLeft') : (deltaZ >= 0 ? 'ArrowDown' : 'ArrowUp');
      let moduleDropCalls = 0; const audio = (game as unknown as { audio: { playCue(cue: string): void } }).audio;
      const playCue = audio.playCue.bind(audio); audio.playCue = (cue) => { if (cue === 'module-drop') moduleDropCalls += 1; playCue(cue); };
      game.keyDown(toward, false); game.keyDown('KeyQ', false); game.update(0.06); game.keyUp(toward); game.keyUp('KeyQ');
      expect(Math.hypot(game.player.position.x - oldLanding.x, game.player.position.y - oldLanding.z))
        .toBeLessThan(CAMPAIGN_CONFIG.moduleReveal.minimumSeparationMeters);
      expect(game.player.heldModule).toBe(module); expect(module.location.kind).toBe('held'); expect(module.root).toBe(moduleRoot);
      expect(module.root.parent).toBe(game.player.heldAnchor); expect(module.root.position).toEqual(beforeLocal);
      expect(game.presentation.active).toBe(false); expect(moduleDropCalls).toBe(0);
      game.update(0); expect(game.interactionKeycap.label).toBeNull(); expect(game.interactionKeycap.root.visible).toBe(false);
      const fresh = heldModuleDropTarget(game); expect(fresh?.kind).toBe('floor-drop');
      const freshLanding = fresh!.landing.clone(); tap(game, 'KeyQ'); expect(moduleDropCalls).toBe(1);
      game.presentation.finishImmediately(); expect(module.location.kind).toBe('world'); expect(module.root).toBe(moduleRoot);
      expect(module.root.getWorldPosition(new THREE.Vector3()).distanceTo(freshLanding)).toBeLessThan(1e-6);
      audio.playCue = playCue; entry.next();
      if (index < stages.length - 1) expect(game.state.phase.kind).toBe('playing');
    }
    game.dispose();
  });

  it('moves the one Stage0-budgeted wheat root from the real pipe anchors for 0.55 seconds', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    tap(game, 'ArrowUp', 0.05); game.keyDown('ShiftLeft', false); game.keyDown('ArrowUp', false); game.update(0.05); game.keyUp('ArrowUp'); game.keyUp('ShiftLeft');
    game.update(1.44); expect(game.materials.all()).toHaveLength(0); game.update(0.02);
    const wheat = game.materials.all()[0]!; expect(wheat.location).toBe('reserved'); const start = wheat.root.position.clone(); expect(start.y).toBeCloseTo(CAMPAIGN_CONFIG.materialPresentation.wheatOutletHeight, 6); expect(wheat.root.scale.x).toBeGreaterThanOrEqual(0.84);
    game.update(0.27); expect(wheat.root.position.distanceTo(start)).toBeGreaterThan(0); expect(wheat.location).toBe('reserved');
    game.update(0.27); expect(wheat.location).toBe('world');
    game.update(4.5); const terminals = game.materials.all().filter((material) => material.location === 'world').map((material) => material.root.position.clone());
    expect(terminals).toHaveLength(1); expect(game.wheatSource.readSuccessfulIssuanceCount()).toBe(1); game.dispose();
  });

  it('holds and moves the same flour root through the authored block output anchors for exactly 0.42 seconds', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    tap(game, 'ArrowUp', 0.05); game.keyDown('ShiftLeft', false); game.keyDown('ArrowUp', false); game.update(0.05); game.keyUp('ArrowUp'); game.keyUp('ShiftLeft');
    game.update(1.45); game.update(0.55); const wheat = game.materials.all().find((material) => material.type === 'wheat' && material.location === 'world')!;
    moveTo(game, wheat.root.position.x, wheat.root.position.z); tap(game, 'KeyE'); tap(game, 'KeyQ'); game.update(0.016); tap(game, 'KeyE');
    game.update(CAMPAIGN_CONFIG.presentation.stage0BlockRevealDropSeconds);
    tap(game, 'KeyE');
    moveTo(game, -5.5, -2.5); tap(game, 'KeyQ'); game.update(0.016); game.update(2.4);
    const flour = game.materials.all().find((material) => material.type === 'flour')!; expect(flour.location).toBe('reserved');
    const mouth = game.blocks[0]!.readOutputMouthPosition(new THREE.Vector3()); const exit = game.blocks[0]!.readTokenExitPosition(new THREE.Vector3());
    expect(flour.root.position.distanceTo(mouth)).toBeLessThan(1e-6); expect(exit.distanceTo(mouth)).toBeGreaterThan(0); const identity = flour.id;
    game.update(0.03); expect(flour.root.position.distanceTo(mouth)).toBeLessThan(1e-6); game.update(0.1); expect(flour.root.position.distanceTo(mouth)).toBeGreaterThan(0);
    game.update(0.29); expect(flour.location).toBe('output'); expect(game.materials.get(identity)).toBe(flour); game.dispose();
  });

  it('finishes same-frame module motion before GAME OVER and runs the whole exact-once retry plan', () => {
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(); const canvas = new FakeElement();
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: canvas as unknown as HTMLCanvasElement, scene, camera, assets: fakeAssets });
    reachStage1(game);
    const failureTypeRoots = [game.materials.create('flour', new THREE.Vector3(8, 0, 3)).root, game.materials.create('bread', new THREE.Vector3(-1, 0, 3)).root];
    const fast = game.modules.find((module) => module.type === 'fast')!; const landing = fast.root.getWorldPosition(new THREE.Vector3());
    moveTo(game, landing.x, landing.z);
    game.update(Math.max(0, (game.state.remainingSeconds ?? 0) - 0.05));
    tap(game, 'KeyE', 0.1);
    expect(game.state.phase).toEqual({ kind: 'game-over-presentation', stage: 'stage1' });
    expect(game.presentation.active).toBe(true); expect(game.player.heldModule).toBe(fast);
    const roots = game.materials.all().map((material) => material.root); expect(roots.length).toBeGreaterThan(0); expect(failureTypeRoots.every((root) => roots.includes(root))).toBe(true);
    expect(game.keyDown('KeyR', false)).toBe(true); expect(game.state.phase.kind).toBe('game-over-presentation');
    for (let index = 0; index < 40 && game.state.phase.kind !== 'game-over'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage1' }); expect(game.presentation.active).toBe(false);
    expect(game.keyDown('KeyR', false)).toBe(true);
    expect(game.state.phase).toEqual({ kind: 'retry-presentation', stage: 'stage1' }); expect(game.presentation.active).toBe(true);
    expect(game.keyDown('KeyR', true)).toBe(true);
    game.update(0.2);
    expect(roots.some((root) => root.parent !== null && root.scale.x < 1)).toBe(true);
    game.update(0.35);
    for (let index = 0; index < 30 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage1' });
    expect(game.player.heldModule).toBe(fast); expect(game.state.remainingSeconds).toBeGreaterThanOrEqual(29.8);
    expect(roots.every((root) => root.parent === null)).toBe(true); expect(canvas.dataset.retryCount).toBe('1');
    game.dispose();
  });

  it('captures side contact, locks full block-facing, and reverses push/pull from accepted X motion', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); const block = game.blocks[0]!; moveToBlockSide(game, block, 'left'); tap(game, 'Space');
    expect(game.player.heldBlockId).toBe(block.id); expect(game.player.facing.x).toBeCloseTo(1, 8); expect(game.player.facing.y).toBeCloseTo(0, 8);
    const pushBlockX = block.root.position.x; const pushPlayerX = game.player.position.x;
    game.keyDown('ArrowRight', false); game.update(0.04); game.keyUp('ArrowRight'); expect(game.player.animationState).toBe('blockPush');
    expect(block.root.position.x - pushBlockX).toBeCloseTo(game.player.position.x - pushPlayerX, 8); expect(game.player.facing.x).toBeCloseTo(1, 8); expect(game.player.facing.y).toBeCloseTo(0, 8);
    const pullBlockX = block.root.position.x; const pullPlayerX = game.player.position.x;
    game.keyDown('ArrowLeft', false); game.update(0.04); game.keyUp('ArrowLeft'); expect(game.player.animationState).toBe('blockPull');
    expect(block.root.position.x - pullBlockX).toBeCloseTo(game.player.position.x - pullPlayerX, 8); expect(game.player.facing.x).toBeCloseTo(1, 8); expect(game.player.facing.y).toBeCloseTo(0, 8);
    const phase = game.player.blockTravelDistance; game.update(0.04); expect(game.player.animationState).toBe('holding'); expect(game.player.blockTravelDistance).toBe(phase);
    tap(game, 'Space'); expect(game.player.heldBlockId).toBeNull(); game.dispose();
  });

  it('uses visible collision-safe front, left, and right candidates and one shared player-block sweep on both production blocks', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); game.state.setRemainingSeconds(300);
    for (const block of game.blocks) {
      moveToBlockFront(game, block, 0.24); expectVisibleSpaceKeycap(game, block); tap(game, 'Space');
      expect(game.player.heldBlockId).toBe(block.id); expect(game.player.animationState).toBe('holding');
      const frontFacing = new THREE.Vector2(block.root.position.x - game.player.position.x, block.root.position.z - game.player.position.y).normalize();
      expect(game.player.facing.distanceTo(frontFacing)).toBeLessThan(1e-8);
      const frontPlayerX = game.player.position.x; const frontBlockX = block.root.position.x;
      game.keyDown('ArrowRight', false); game.update(0.02); game.keyUp('ArrowRight');
      expect(game.player.position.x - frontPlayerX).toBeCloseTo(block.root.position.x - frontBlockX, 8); expect(game.player.animationState).toBe('blockMoveFront');
      expect(game.player.facing.distanceTo(new THREE.Vector2(block.root.position.x - game.player.position.x, block.root.position.z - game.player.position.y).normalize())).toBeLessThan(1e-8);
      expectVisibleSpaceKeycap(game, block);
      tap(game, 'Space'); expect(game.player.heldBlockId).toBeNull();
      for (const side of ['left', 'right'] as const) {
      moveToBlockSide(game, block, side); expect(game.interactionKeycap.label).toBe('SPACE'); tap(game, 'Space');
      expect(game.player.heldBlockId).toBe(block.id); expect(game.player.facing.x).toBeCloseTo(side === 'left' ? 1 : -1, 8); expect(game.player.facing.y).toBeCloseTo(0, 8);
      for (const code of ['ArrowRight', 'ArrowLeft'] as const) {
        const playerX = game.player.position.x; const blockX = block.root.position.x;
        game.keyDown(code, false); game.update(0.02); game.keyUp(code);
        expect(game.player.position.x - playerX).toBeCloseTo(block.root.position.x - blockX, 8);
        expect(game.player.facing.x).toBeCloseTo(side === 'left' ? 1 : -1, 8); expect(game.player.facing.y).toBeCloseTo(0, 8);
        expect(game.player.animationState).toBe((side === 'left') === (code === 'ArrowRight') ? 'blockPush' : 'blockPull');
      }
      tap(game, 'Space'); expect(game.player.heldBlockId).toBeNull();
      const ordinaryStart = game.player.position.x; const away = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
      game.keyDown(away, false); game.update(0.02); game.keyUp(away); expect(game.player.position.x).not.toBeCloseTo(ordinaryStart, 8);
      }
    }
    const constrained = game.blocks[0]!; moveToBlockSide(game, constrained, 'right'); tap(game, 'Space');
    const playerBefore = game.player.position.x; const blockBefore = constrained.root.position.x;
    game.keyDown('ArrowRight', false); game.update(10); game.keyUp('ArrowRight');
    expect(game.player.position.x - playerBefore).toBeCloseTo(constrained.root.position.x - blockBefore, 8);
    const other = game.blocks[1]!.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
    expect(game.player.position.x).toBeLessThanOrEqual(other.minX - CAMPAIGN_CONFIG.movement.playerRadiusMeters + 1e-6);
    expect(constrained.root.position.x + CAMPAIGN_CONFIG.movement.blockHalfExtentMeters).toBeLessThanOrEqual(other.minX + 1e-6);
    tap(game, 'Space'); moveToBlockFront(game, constrained); tap(game, 'Space');
    game.keyDown('ArrowRight', false); game.update(10); game.keyUp('ArrowRight');
    const blockedPlayer = game.player.position.clone(); const blockedBlockX = constrained.root.position.x; const blockedTravel = game.player.blockTravelDistance;
    game.keyDown('ArrowRight', false); game.update(0.02); game.keyUp('ArrowRight');
    expect(game.player.position).toEqual(blockedPlayer); expect(constrained.root.position.x).toBe(blockedBlockX);
    expect(game.player.animationState).toBe('holding'); expect(game.player.blockTravelDistance).toBe(blockedTravel);
    expect(game.player.facing.distanceTo(new THREE.Vector2(constrained.root.position.x - game.player.position.x,
      constrained.root.position.z - game.player.position.y).normalize())).toBeLessThan(1e-8);
    tap(game, 'Space'); game.dispose();
  });

  it('stops the combined pair at actual wall and dock bounds and exposes only the outer side in a closed block gap', () => {
    const createGame = (): CampaignGame => new CampaignGame({ document: fakeDocument, window: fakeWindow,
      mount: new FakeElement() as unknown as HTMLElement, tutorialSurface: new FakeElement() as unknown as HTMLElement,
      canvas: new FakeElement() as unknown as HTMLCanvasElement, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    const wallGame = createGame(); reachStage1(wallGame); wallGame.state.setRemainingSeconds(300);
    const mill = wallGame.blocks[0]!; moveToBlockSide(wallGame, mill, 'left'); tap(wallGame, 'Space');
    wallGame.keyDown('ArrowLeft', false); wallGame.update(10); wallGame.keyUp('ArrowLeft');
    expect(mill.root.position.x - CAMPAIGN_CONFIG.movement.blockHalfExtentMeters).toBeGreaterThanOrEqual(wallGame.map.bounds.minX - 1e-6);
    expect(wallGame.player.position.x).toBeGreaterThanOrEqual(wallGame.map.bounds.minX + CAMPAIGN_CONFIG.movement.playerRadiusMeters - 1e-6);
    expect(wallGame.player.position.x - (mill.root.position.x - (CAMPAIGN_CONFIG.movement.blockHalfExtentMeters + CAMPAIGN_CONFIG.movement.playerRadiusMeters))).toBeCloseTo(0, 8);
    tap(wallGame, 'Space'); wallGame.dispose();

    const dockGame = createGame(); reachStage1(dockGame); dockGame.state.setRemainingSeconds(300);
    const heater = dockGame.blocks[1]!; moveToBlockSide(dockGame, heater, 'right'); tap(dockGame, 'Space');
    dockGame.keyDown('ArrowRight', false); dockGame.update(10); dockGame.keyUp('ArrowRight');
    const dockBounds = dockGame.submissionDock.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
    expect(heater.root.position.x + CAMPAIGN_CONFIG.movement.blockHalfExtentMeters).toBeLessThanOrEqual(dockBounds.minX + 1e-6);
    expect(dockGame.player.position.x - (heater.root.position.x + (CAMPAIGN_CONFIG.movement.blockHalfExtentMeters + CAMPAIGN_CONFIG.movement.playerRadiusMeters))).toBeCloseTo(0, 8);
    tap(dockGame, 'Space'); dockGame.dispose();

    const gapGame = createGame(); reachStage1(gapGame); gapGame.state.setRemainingSeconds(300);
    const gapHeater = gapGame.blocks[1]!; const gapMill = gapGame.blocks[0]!;
    moveToBlockSide(gapGame, gapHeater, 'right'); tap(gapGame, 'Space');
    gapGame.keyDown('ArrowLeft', false); gapGame.update(10); gapGame.keyUp('ArrowLeft'); tap(gapGame, 'Space');
    expect(gapHeater.root.position.x - CAMPAIGN_CONFIG.movement.blockHalfExtentMeters).toBeGreaterThanOrEqual(
      gapMill.root.position.x + CAMPAIGN_CONFIG.movement.blockHalfExtentMeters - 1e-6);
    moveToBlockSide(gapGame, gapHeater, 'left');
    const innerSelected = (gapGame as unknown as { selectBlockManipulationTarget(): { side: string; block: CampaignGame['blocks'][number] } | null }).selectBlockManipulationTarget();
    expect(innerSelected?.side).not.toBe('left');
    if (gapGame.interactionKeycap.label === 'SPACE') expect(innerSelected?.side).toBe('front');
    moveToBlockSide(gapGame, gapHeater, 'right'); expect(gapGame.interactionKeycap.label).toBe('SPACE');
    gapGame.dispose();
  });

  it('releases the block and applies the same-frame W/S escape after inner-gap and front contact limits', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); game.state.setRemainingSeconds(300);
    const cases = [
      { block: game.blocks[0]!, side: 'right' as const, inward: 'ArrowRight', escape: 'ArrowUp', sign: -1 },
      { block: game.blocks[1]!, side: 'left' as const, inward: 'ArrowLeft', escape: 'ArrowDown', sign: 1 },
    ];
    for (const entry of cases) {
      moveToBlockSide(game, entry.block, entry.side); tap(game, 'Space');
      game.keyDown(entry.inward, false); game.update(10); game.keyUp(entry.inward);
      const blockX = entry.block.root.position.x; const blockZ = entry.block.root.position.z; const playerZ = game.player.position.y;
      game.keyDown(entry.inward, false); game.keyDown(entry.escape, false); game.update(0.02); game.keyUp(entry.inward); game.keyUp(entry.escape);
      expect(entry.block.root.position.x).toBe(blockX); expect(entry.block.root.position.z).toBe(blockZ);
      expect(Math.sign(game.player.position.y - playerZ)).toBe(entry.sign); expect(game.player.heldBlockId).toBeNull();
      expect(game.player.root.position.x).toBeCloseTo(game.player.position.x, 8); expect(game.player.root.position.z).toBeCloseTo(game.player.position.y, 8);
      const internals = game as unknown as { activeBlock: CampaignGame['blocks'][number] | null; carriedBlockStart: THREE.Vector3 | null;
        activeBlockPlayerLaneZ: number; activeBlockPlayerOffsetX: number };
      expect(internals.activeBlock).toBeNull(); expect(internals.carriedBlockStart).toBeNull();
      expect(internals.activeBlockPlayerLaneZ).toBe(0); expect(internals.activeBlockPlayerOffsetX).toBe(0);
      const ordinaryZ = game.player.position.y; game.keyDown(entry.escape, false); game.update(0.02); game.keyUp(entry.escape);
      expect(Math.sign(game.player.position.y - ordinaryZ)).toBe(entry.sign);
    }

    const front = game.blocks[0]!; moveToBlockFront(game, front); tap(game, 'Space');
    game.keyDown('ArrowRight', false); game.update(10); game.keyUp('ArrowRight');
    const frontBlockX = front.root.position.x; const frontPlayerZ = game.player.position.y;
    game.keyDown('ArrowDown', false); game.update(0.02); game.keyUp('ArrowDown');
    expect(front.root.position.x).toBe(frontBlockX); expect(game.player.position.y).toBeGreaterThan(frontPlayerZ); expect(game.player.heldBlockId).toBeNull();

    game.dispose();

    const repeatGame = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(repeatGame); repeatGame.state.setRemainingSeconds(300); const repeatBlock = repeatGame.blocks[0]!;
    for (let index = 0; index < 10; index += 1) {
      moveToBlockFront(repeatGame, repeatBlock); tap(repeatGame, 'Space'); expect(repeatGame.player.heldBlockId).toBe(repeatBlock.id);
      const before = repeatBlock.root.position.x; const code = index % 2 === 0 ? 'ArrowDown' : 'ArrowUp';
      repeatGame.keyDown(code, false, 1000 + index * 200); repeatGame.keyUp(code, 1119 + index * 200); repeatGame.update(0.016);
      expect(repeatBlock.root.position.x).toBe(before); expect(repeatGame.player.heldBlockId).toBeNull();
    }
    repeatGame.dispose();
  });

  it('allows public movement away from an actual block boundary and rejects deeper penetration across epsilon drift', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); game.state.setRemainingSeconds(300); const block = game.blocks[0]!;
    const bounds = block.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
    const boundaryZ = bounds.maxZ + CAMPAIGN_CONFIG.movement.playerRadiusMeters;
    for (const drift of [-CAMPAIGN_COLLISION_EPSILON_METERS * 0.5, 0, CAMPAIGN_COLLISION_EPSILON_METERS * 0.5]) {
      game.player.restorePose(new THREE.Vector2(block.root.position.x, boundaryZ + drift), new THREE.Vector2(0, -1));
      const outward = game.player.position.y; game.keyDown('ArrowDown', false); game.update(0.02); game.keyUp('ArrowDown');
      expect(game.player.position.y).toBeGreaterThan(outward);
      game.player.restorePose(new THREE.Vector2(block.root.position.x, boundaryZ + drift), new THREE.Vector2(0, -1));
      const inward = game.player.position.y; game.keyDown('ArrowUp', false); game.update(0.02); game.keyUp('ArrowUp');
      expect(game.player.position.y).toBeCloseTo(inward, 8);
    }
    game.dispose();
  });

  it('clamps shipped production blocks against public-dropped world Fast, Double, and Again without making them player obstacles', async () => {
    const assets = await actualAuthoredObjectAssets();
    const cases = [
      { type: 'fast' as const, advance: 0 },
      { type: 'double' as const, advance: 1 },
      { type: 'again' as const, advance: 2 },
    ];
    for (const entry of cases) {
      const boot = new CampaignBoot({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
        tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
        renderer: { capabilities: { getMaxAnisotropy: () => 8 }, setPixelRatio: () => undefined, setSize: () => undefined,
          dispose: () => undefined, render: () => undefined } as unknown as THREE.WebGLRenderer,
        scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets });
      boot.resize(1280, 720, 1); expect(await boot.load()).toBe(true);
      const game = (boot as unknown as { game: CampaignGame }).game;
      reachStage1(game);
      if (entry.advance >= 1) completeCurrentStage(game, CAMPAIGN_CONFIG.stages.stage1.targetBreadCount);
      if (entry.advance >= 2) completeCurrentStage(game, CAMPAIGN_CONFIG.stages.stage2.targetBreadCount);
      game.state.setRemainingSeconds(300);
      const module = game.modules.find((candidate) => candidate.type === entry.type)!;
      const block = game.blocks[0]!;
      expect(module.location.kind).toBe('world');
      const initialModuleWorld = module.root.getWorldPosition(new THREE.Vector3());
      moveTo(game, initialModuleWorld.x, initialModuleWorld.z); tap(game, 'KeyE'); game.presentation.finishImmediately();
      expect(game.player.heldModule).toBe(module);

      const desiredLandingX = block.root.position.x + 3;
      const facingStep = CAMPAIGN_CONFIG.movement.walkMetersPerSecond * 0.001;
      moveTo(game, desiredLandingX - 1.25 - facingStep, block.root.position.z);
      game.keyDown('ArrowRight', false); game.update(0.001); game.keyUp('ArrowRight');
      const dropTarget = heldModuleDropTarget(game); expect(dropTarget?.kind).toBe('floor-drop');
      expect(dropTarget?.landing.x).toBeCloseTo(desiredLandingX, 6);
      expect(dropTarget?.landing.z).toBeCloseTo(block.root.position.z, 6);
      tap(game, 'KeyQ'); game.presentation.finishImmediately();
      expect(module.location.kind).toBe('world');
      const moduleWorld = module.root.getWorldPosition(new THREE.Vector3());
      const moduleQuaternion = module.root.getWorldQuaternion(new THREE.Quaternion());
      const moduleParent = module.root.parent;
      const moduleHalf = CAMPAIGN_CONFIG.interaction.floorModuleHalfExtentMeters;
      const blockHalf = CAMPAIGN_CONFIG.movement.blockHalfExtentMeters;
      const expectedBoundaryX = moduleWorld.x - moduleHalf - blockHalf;

      moveToBlockSide(game, block, 'left'); expectVisibleSpaceKeycap(game, block); tap(game, 'Space');
      const sideBlockStart = block.root.position.x; const sidePlayerStart = game.player.position.x;
      game.keyDown('ArrowRight', false); game.update(2); game.keyUp('ArrowRight');
      expect(block.root.position.x).toBeCloseTo(expectedBoundaryX, 8);
      expect(block.root.position.x - sideBlockStart).toBeCloseTo(game.player.position.x - sidePlayerStart, 8);
      expect(block.root.position.x + blockHalf).toBeLessThanOrEqual(moduleWorld.x - moduleHalf + CAMPAIGN_COLLISION_EPSILON_METERS);
      expect(module.root.getWorldPosition(new THREE.Vector3())).toEqual(moduleWorld);
      expect(module.root.getWorldQuaternion(new THREE.Quaternion()).angleTo(moduleQuaternion)).toBeLessThan(1e-12);
      expect(module.root.parent).toBe(moduleParent); expect(module.location.kind).toBe('world');
      const blockedBlockX = block.root.position.x; const blockedPlayerX = game.player.position.x;
      const blockedTravel = game.player.blockTravelDistance;
      game.keyDown('ArrowRight', false); game.update(0.1); game.keyUp('ArrowRight');
      expect(block.root.position.x).toBe(blockedBlockX); expect(game.player.position.x).toBe(blockedPlayerX);
      expect(game.player.animationState).toBe('holding'); expect(game.player.blockTravelDistance).toBe(blockedTravel);
      game.keyDown('ArrowLeft', false); game.update(0.1); game.keyUp('ArrowLeft');
      expect(block.root.position.x).toBeLessThan(blockedBlockX);
      expect(block.root.position.x - blockedBlockX).toBeCloseTo(game.player.position.x - blockedPlayerX, 8);
      tap(game, 'Space'); expect(game.player.heldBlockId).toBeNull();

      moveToBlockFront(game, block); expectVisibleSpaceKeycap(game, block); tap(game, 'Space');
      const frontBlockStart = block.root.position.x; const frontPlayerStart = game.player.position.x;
      game.keyDown('ArrowRight', false); game.update(1); game.keyUp('ArrowRight');
      expect(block.root.position.x).toBeCloseTo(expectedBoundaryX, 8);
      expect(block.root.position.x - frontBlockStart).toBeCloseTo(game.player.position.x - frontPlayerStart, 8);
      expect(game.player.animationState).toBe('blockMoveFront');
      tap(game, 'Space');

      const passStartX = block.root.position.x;
      moveTo(game, passStartX, block.root.position.z + blockHalf + CAMPAIGN_CONFIG.movement.playerRadiusMeters + 0.02);
      game.keyDown('ArrowRight', false); game.update((moduleWorld.x + moduleHalf + 0.5 - game.player.position.x) /
        CAMPAIGN_CONFIG.movement.walkMetersPerSecond); game.keyUp('ArrowRight');
      expect(game.player.position.x).toBeGreaterThan(moduleWorld.x + moduleHalf);
      expect(module.root.getWorldPosition(new THREE.Vector3())).toEqual(moduleWorld);

      moveTo(game, moduleWorld.x + 1, moduleWorld.z + 1);
      game.keyDown('ArrowLeft', false); game.update(0.001); game.keyUp('ArrowLeft');
      expect(game.interactionKeycap.label).toBe('E');
      tap(game, 'KeyE'); game.presentation.finishImmediately();
      expect(game.player.heldModule).toBe(module);
      moveToBlockFront(game, block); game.update(0.016);
      expect(game.interactionKeycap.label).not.toBe('SPACE'); expect(game.player.heldBlockId).toBeNull();
      const movedBlockBounds = block.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
      const freshLanding = heldModuleDropTarget(game)?.landing;
      expect(freshLanding).toBeDefined();
      expect(freshLanding!.x <= movedBlockBounds.minX - moduleHalf || freshLanding!.x >= movedBlockBounds.maxX + moduleHalf ||
        freshLanding!.z <= movedBlockBounds.minZ - moduleHalf || freshLanding!.z >= movedBlockBounds.maxZ + moduleHalf).toBe(true);

      if (entry.type === 'fast') {
        const socket = block.sockets.find((candidate) => candidate.enabled && candidate.module === null)!;
        moveToSocketInteraction(game, block, socket); tap(game, 'KeyE'); game.presentation.finishImmediately();
        expect(socket.module).toBe(module); expect(module.location.kind).toBe('socket');
        moveToBlockFront(game, block); tap(game, 'Space');
        const socketModuleBefore = module.root.getWorldPosition(new THREE.Vector3()); const socketBlockBefore = block.root.position.x;
        game.keyDown('ArrowLeft', false); game.update(0.1); game.keyUp('ArrowLeft');
        expect(module.root.getWorldPosition(new THREE.Vector3()).x - socketModuleBefore.x)
          .toBeCloseTo(block.root.position.x - socketBlockBefore, 8);
        tap(game, 'Space');
      } else if (entry.type === 'double') {
        const otherBlock = game.blocks[1]!; const socket = otherBlock.sockets.find((candidate) => candidate.enabled && candidate.module === null)!;
        moveToSocketInteraction(game, otherBlock, socket); tap(game, 'KeyE'); game.presentation.finishImmediately();
        expect(socket.module).toBe(module); expect(module.location.kind).toBe('socket');
        moveToBlockSide(game, block, 'left'); tap(game, 'Space');
        game.keyDown('ArrowRight', false); game.update(10); game.keyUp('ArrowRight');
        const otherBounds = otherBlock.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
        expect(block.root.position.x + blockHalf).toBeCloseTo(otherBounds.minX, 8);
        tap(game, 'Space');
      }
      boot.dispose();
    }
  });

  it('finishes an ordinary module motion and still starts the complete clear transaction', () => {
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(); const canvas = new FakeElement();
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: canvas as unknown as HTMLCanvasElement, scene, camera, assets: fakeAssets });
    reachStage1(game);
    const fast = game.modules.find((module) => module.type === 'fast')!; const landing = fast.root.getWorldPosition(new THREE.Vector3());
    moveTo(game, landing.x, landing.z); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds + 0.01);
    expect(game.player.heldModule).toBe(fast);
    moveTo(game, 0, 4); tap(game, 'KeyQ'); expect(game.presentation.active).toBe(true);
    for (let index = 0; index < 10; index += 1) game.materials.create('bread', game.submissionDock.root.position.clone());
    game.update(0.016);
    expect(game.state.phase).toEqual({ kind: 'clear-presentation', stage: 'stage1', nextStage: 'stage2' });
    expect(game.presentation.active).toBe(true); expect(fast.location.kind).toBe('world');
    expect(game.scoreboard.central.root.visible).toBe(false); expect(game.scoreboard.auxiliary.root.visible).toBe(false);
    const hiddenY = 1.385;
    for (let index = 0; index < 20 && !game.scoreboard.central.root.visible; index += 1) game.update(0.1);
    game.update(0.28);
    expect(game.scoreboard.central.root.visible).toBe(true); expect(game.scoreboard.auxiliary.root.visible).toBe(true);
    expect(game.scoreboard.central.root.position.y).toBeGreaterThan(hiddenY);
    expect(game.scoreboard.central.root.position.y - 1.55 / 2).toBeCloseTo(game.scoreboard.auxiliary.root.position.y - 1.55 * 0.75 / 2, 6);
    for (let index = 0; index < 100 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage2' });
    expect(game.scoreboard.central.root.visible).toBe(true); expect(game.scoreboard.central.root.position.y).toBeGreaterThan(hiddenY);
    const double = game.modules.find((module) => module.type === 'double')!;
    const fastTerminal = fast.root.getWorldPosition(new THREE.Vector3()); const doubleTerminal = double.root.getWorldPosition(new THREE.Vector3());
    expect(fastTerminal.distanceTo(doubleTerminal)).toBeGreaterThanOrEqual(CAMPAIGN_CONFIG.moduleReveal.minimumSeparationMeters);
    expect(fast.root.parent).not.toBeNull(); expect(double.root.parent).not.toBeNull(); expect(double.location.kind).toBe('world');
    game.dispose();
  });

  it('retains wheat, flour, and bread roots through CLEAR ownership and removes every attempt root only at pipe-suction terminal', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game);
    const roots = (['wheat', 'flour', 'bread'] as const).map((type, index) => game.materials.create(type, new THREE.Vector3(-1 + index, 0, 3)).root);
    const held = game.materials.create('wheat', new THREE.Vector3(game.player.position.x, 0, game.player.position.y)); roots.push(held.root);
    game.update(0.016); tap(game, 'KeyE'); expect(game.player.heldMaterialIds).toContain(held.id); expect(held.root.parent).toBe(game.player.root);
    for (let index = 0; index < 10; index += 1) game.materials.create('bread', game.submissionDock.readGameplayPosition(new THREE.Vector3()));
    game.update(0.016); expect(game.state.phase.kind).toBe('clear-presentation'); expect(roots.every((root) => root.parent !== null)).toBe(true);
    game.presentation.finishImmediately(); expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage2' }); expect(roots.every((root) => root.parent === null)).toBe(true);
    expect(game.materials.all()).toHaveLength(0); game.dispose();
  });

  it('walks Stage1 through final, repeats every timed retry, and restarts into a fresh Stage0 graph', () => {
    let reloads = 0; const windowWithReload = { location: { reload: () => { reloads += 1; } } } as unknown as Window;
    const canvas = new FakeElement(); const game = new CampaignGame({ document: fakeDocument, window: windowWithReload,
      mount: new FakeElement() as unknown as HTMLElement, tutorialSurface: new FakeElement() as unknown as HTMLElement,
      canvas: canvas as unknown as HTMLCanvasElement, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game);
    repeatRetry(game, 'stage1', 2);
    completeCurrentStage(game, 5); expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage2' });
    const fast = game.modules.find((module) => module.type === 'fast')!; const double = game.modules.find((module) => module.type === 'double')!;
    expect(fast.root.parent).not.toBeNull(); expect(double.location.kind).toBe('world');
    repeatRetry(game, 'stage2', 2);
    completeCurrentStage(game, 10); expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage3' });
    const again = game.modules.find((module) => module.type === 'again')!; expect(again.location.kind).toBe('world');
    repeatRetry(game, 'stage3', 2);
    completeCurrentStage(game, 40); expect(game.state.phase).toEqual({ kind: 'final-score', stage: 'stage3' });
    expect(game.finalScore.root.hidden).toBe(false);
    expect((game.finalScore.root as unknown as FakeElement).innerHTML).toContain('캠페인 완료');
    expect((game.finalScore.root as unknown as FakeElement).innerHTML).toContain('총 점수');
    expect((game.finalScore.root as unknown as FakeElement).innerHTML).not.toContain('FINAL SCORE');
    expect(game.finalScore.root.className).toContain('campaign-result-overlay');
    const finalRoot = game.finalScore.root as unknown as FakeElement;
    const finalSnapshot = game.score.snapshot();
    expect(finalRoot.querySelector<FakeElement>('.campaign-final-score__total').textContent).toBe(String(finalSnapshot.totalScore));
    const rows = finalRoot.querySelector<FakeElement>('.campaign-final-score__breakdown').innerHTML;
    for (const [index, value] of [finalSnapshot.stage0Score, finalSnapshot.stage1Score, finalSnapshot.stage2Score, finalSnapshot.stage3Score].entries()) {
      expect(rows).toContain(`Stage ${index}`); expect(rows).toContain(`>${value}</output>`);
    }
    for (const code of ['KeyR', 'Enter', 'Space', 'KeyE']) { expect(game.keyDown(code, false)).toBe(true); expect(reloads).toBe(0); }
    const restart = (game.finalScore.root as unknown as FakeElement).querySelector<FakeElement>('button'); restart.dispatch('click'); restart.dispatch('click');
    expect(reloads).toBe(1); expect(game.state.phase).toEqual({ kind: 'restarting' }); game.dispose();

    const second = new CampaignGame({ document: fakeDocument, window: windowWithReload, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    expect(second.state.phase).toEqual({ kind: 'playing', stage: 'stage0' }); expect(second.score.snapshot().totalScore).toBe(0);
    expect(second.modules.every((module) => module.location.kind === 'not-introduced')).toBe(true); second.dispose();
  });

  it('accepts arbitrary three-module order and restores E from the explicit module-only approach after Space movement', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); completeCurrentStage(game, 5); completeCurrentStage(game, 10);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage3' });
    const [fast, double, again] = game.modules;
    again!.root.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.37); attachWorldModule(game, again!, game.blocks[1]!);
    const againInsertionQuaternion = again!.root.quaternion.clone(); game.update(0.6); expect(again!.root.quaternion.angleTo(againInsertionQuaternion)).toBeLessThan(1e-6);
    attachWorldModule(game, fast!, game.blocks[0]!); attachWorldModule(game, double!, game.blocks[1]!);
    expect(game.blocks.flatMap((block) => block.sockets).filter((socket) => socket.module !== null)).toHaveLength(3);
    game.update(1); expect(colorDistance(moduleBodyColor(again!), moduleBodyColor(double!))).toBeLessThan(0.03);
    detachAndDrop(game, double!, 1); game.update(1); expect(colorDistance(moduleBodyColor(again!), new THREE.Color('#8f969d'))).toBeLessThan(0.03);
    detachAndDrop(game, fast!, 0); detachAndDrop(game, again!, 2);
    repeatRetry(game, 'stage3', 1);
    attachWorldModule(game, double!, game.blocks[0]!); attachWorldModule(game, again!, game.blocks[1]!); attachWorldModule(game, fast!, game.blocks[0]!);

    repeatRetry(game, 'stage3', 1);
    const moved = game.blocks[0]!; const before = moved.root.position.clone(); moveToBlockSide(game, moved, 'left');
    const playerBeforeX = game.player.position.x; game.keyDown('Space', false); game.keyDown('ArrowRight', false); game.update(0.08);
    expect(game.player.animationState).toBe('blockPush'); expect(moved.root.position.z).toBe(before.z); expect(game.player.position.x - playerBeforeX).toBeCloseTo(moved.root.position.x - before.x, 6);
    game.keyUp('ArrowRight'); game.keyUp('Space'); tap(game, 'Space');
    expect(moved.root.position.distanceTo(before)).toBeGreaterThan(0);
    const occupiedSocket = moved.sockets.find((socket) => socket.module !== null)!; moveToSocketInteraction(game, moved, occupiedSocket);
    game.update(0.016); expect(game.interactionKeycap.label).toBe('E'); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds + 0.01);
    expect(game.player.heldModule).not.toBeNull();
    expect(game.modules.every((module) => module.root.parent !== null && module.root.visible)).toBe(true);
    game.dispose();
  });

  it('uses a guaranteed bounded terminal when every authored reveal candidate is occupied by actual roots', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); completeCurrentStage(game, 5);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage2' });

    moveTo(game, 0, 0);
    const config = CAMPAIGN_CONFIG.moduleReveal;
    const player = new THREE.Vector3(game.player.position.x, 0, game.player.position.y);
    const forward = new THREE.Vector3(game.player.facing.x, 0, game.player.facing.y);
    const side = new THREE.Vector3(-forward.z, 0, forward.x);
    const authored = [0, config.sideOffsetMeters, -config.sideOffsetMeters].map((offset) => player.clone()
      .addScaledVector(forward, config.forwardDistanceMeters).addScaledVector(side, offset));
    const fastBlocker = game.modules.find((module) => module.type === 'fast')!;
    const doubleBlocker = game.modules.find((module) => module.type === 'double')!;
    fastBlocker.root.position.copy(authored[0]!); doubleBlocker.root.position.copy(authored[1]!); game.blocks[0]!.root.position.copy(authored[2]!);

    completeCurrentStage(game, 10);
    const again = game.modules.find((module) => module.type === 'again')!;
    const terminal = again.root.getWorldPosition(new THREE.Vector3());
    const occupied = [player, ...game.blocks.map((block) => block.root.getWorldPosition(new THREE.Vector3())),
      ...game.modules.filter((module) => module !== again && module.location.kind !== 'not-introduced')
        .map((module) => module.root.getWorldPosition(new THREE.Vector3()))];
    expect(authored.every((candidate) => terminal.distanceTo(candidate) > 1e-6)).toBe(true);
    expect(Math.min(...occupied.map((position) => terminal.distanceTo(position)))).toBeGreaterThanOrEqual(config.minimumSeparationMeters);
    expect(terminal.x).toBeGreaterThanOrEqual(CAMPAIGN_MAP_BOUNDS.minX + 0.34); expect(terminal.x).toBeLessThanOrEqual(CAMPAIGN_MAP_BOUNDS.maxX - 0.34);
    expect(terminal.z).toBeGreaterThanOrEqual(CAMPAIGN_MAP_BOUNDS.minZ + 0.34); expect(terminal.z).toBeLessThanOrEqual(CAMPAIGN_MAP_BOUNDS.maxZ - 0.34);
    expect(again.location.kind).toBe('world'); expect(again.root.parent).not.toBeNull();
    game.dispose();
  });

  it('preserves attached, held, and world Fast across Stage1→2 using shipped authored roots, then keeps Stage2→3 visual/socket identity', async () => {
    const assets = await actualAuthoredObjectAssets();
    for (const state of ['attached', 'held', 'world'] as const) {
      const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
        tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
        scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets, maxTextureAnisotropy: 8 });
      for (const block of game.blocks) {
        const visual = block.readPresentationRoot().children.find((child) => child.name.endsWith('socketless-visual'))!; const bodyMaterials: THREE.MeshStandardMaterial[] = [];
        visual.traverse((node) => { if (node instanceof THREE.Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material instanceof THREE.MeshStandardMaterial) bodyMaterials.push(material); });
        expect(bodyMaterials.length).toBeGreaterThan(0); for (const material of bodyMaterials) {
          expect(material.color.getHexString()).toBe('f3f5f4'); expect(material.roughness).toBeCloseTo(0.84, 8); expect(material.metalness).toBe(0);
        }
        const label = block.root.getObjectByName('campaign-block-function-surface') as THREE.Mesh;
        const progress = block.root.getObjectByName('campaign-block-progress')!; const capacity = block.root.getObjectByName('campaign-block-capacity')!;
        expect(label.parent).toBe(block.readPresentationRoot()); expect(label.rotation.x).toBeCloseTo(-Math.PI / 2, 8); expect(label.position.x).toBeCloseTo(0, 8); expect(label.userData.glyphColor).toBe('#111111'); expect(label.userData.canvasResolution).toBe('2048x768'); expect(label.userData.glyphPixelHeight).toBeGreaterThan(456);
        const labelBounds = label.userData.bodyFaceBounds as { minX: number; maxX: number; minZ: number; maxZ: number };
        expect(label.position.x - label.userData.surfaceWidth / 2).toBeGreaterThan(labelBounds.minX);
        expect(label.position.x + label.userData.surfaceWidth / 2).toBeLessThan(labelBounds.maxX);
        expect(label.position.z - label.userData.surfaceHeight / 2).toBeGreaterThan(labelBounds.minZ);
        expect(label.position.z + label.userData.surfaceHeight / 2).toBeLessThan(labelBounds.maxZ);
        const labelTexture = (label.material as THREE.MeshBasicMaterial).map!; expect(labelTexture.anisotropy).toBe(8);
        expect(progress.position.x).toBeCloseTo(0, 8); expect(progress.position.y).toBeCloseTo(1.386, 3); expect(progress.position.z).toBeCloseTo(0.957, 3);
        expect(capacity.position.x).toBeCloseTo(0, 8); expect(capacity.position.y).toBeCloseTo(2.422, 3);
        const output = block.root.getObjectByName('outputMouth')!.getWorldPosition(new THREE.Vector3()); const labelWorld = label.getWorldPosition(new THREE.Vector3());
        expect(output.x - block.root.position.x).toBeGreaterThan(1.1); expect(labelWorld.x).toBeCloseTo(block.root.position.x, 8);
      }
      const mount = game.submissionDock.root.getObjectByName('goalBoardMount')!;
      const gameplay = game.submissionDock.readGameplayPosition(new THREE.Vector3());
      const mountWorld = mount.getWorldPosition(new THREE.Vector3());
      const outward = gameplay.clone().sub(mountWorld).normalize();
      const boardWorld = game.submissionDock.readGoalBoardWorldPosition(new THREE.Vector3());
      expect(boardWorld.x).toBeGreaterThanOrEqual(CAMPAIGN_MAP_BOUNDS.minX); expect(boardWorld.x).toBeLessThanOrEqual(CAMPAIGN_MAP_BOUNDS.maxX);
      expect(boardWorld.z).toBeGreaterThanOrEqual(CAMPAIGN_MAP_BOUNDS.minZ); expect(boardWorld.z).toBeLessThanOrEqual(CAMPAIGN_MAP_BOUNDS.maxZ);
      expect(game.submissionDock.readGoalBoardWorldDirection(new THREE.Vector3()).dot(outward)).toBeGreaterThan(0);
      for (const module of game.modules) {
        const body = module.root.getObjectByName('sharedCubeGeometry') as THREE.Mesh; const bodyMaterial = (Array.isArray(body.material) ? body.material[0] : body.material) as THREE.MeshStandardMaterial;
        if (body.geometry.boundingBox === null) body.geometry.computeBoundingBox(); const bodyBounds = body.geometry.boundingBox!;
        const expectedFaces = module.type === 'again' ? ['front', 'rear', 'left', 'right', 'top'] : ['front', 'left', 'right', 'top'];
        const surfaces = expectedFaces.map((face) => module.root.getObjectByName(`campaign-module-${module.type}-label-${face}`) as THREE.Mesh);
        expect(surfaces.every((surface) => surface.parent === body)).toBe(true);
        expect(body.children.filter((child) => child.name.startsWith(`campaign-module-${module.type}-label-`)).map((child) => child.userData.face).sort())
          .toEqual([...expectedFaces].sort());
        const front = surfaces[0]!; const top = surfaces.at(-1)!; const frontTexture = (front.material as THREE.MeshBasicMaterial).map!;
        for (const surface of surfaces) {
          surface.geometry.computeBoundingBox(); const plane = surface.geometry.boundingBox!;
          const face = surface.userData.face as string; const widthLimit = face === 'left' || face === 'right'
            ? bodyBounds.max.z - bodyBounds.min.z : bodyBounds.max.x - bodyBounds.min.x;
          const heightLimit = face === 'top' ? bodyBounds.max.z - bodyBounds.min.z : bodyBounds.max.y - bodyBounds.min.y;
          expect(plane.max.x - plane.min.x).toBeCloseTo(surface.userData.surfaceWidth, 6);
          expect(plane.max.y - plane.min.y).toBeCloseTo(surface.userData.surfaceHeight, 6);
          expect(surface.userData.surfaceWidth).toBeLessThan(widthLimit);
          expect(surface.userData.surfaceHeight).toBeLessThan(heightLimit);
          expect(surface.userData.glyphPixelHeight).toBeGreaterThan(300);
          expect((surface.material as THREE.MeshBasicMaterial).map).toBe(frontTexture);
          expect(surface.userData.clearanceMeters).toBe(0.006);
        }
        expect(front.position.z).toBeCloseTo(bodyBounds.max.z + 0.006, 8);
        expect(module.root.getObjectByName(`campaign-module-${module.type}-label-rear`) === undefined).toBe(module.type !== 'again');
        expect(module.root.getObjectByName(`campaign-module-${module.type}-label-bottom`)).toBeUndefined();
        expect(frontTexture).toBe((top.material as THREE.MeshBasicMaterial).map); expect(frontTexture.anisotropy).toBe(8);
        expect(front.userData.labelText).toBe(module.type === 'fast' ? '빨리!' : module.type === 'double' ? '두 배!' : '또!');
        expect(front.userData.outlineMultiplier).toBe(2.5); expect(front.userData.outlinePixelWidth)
          .toBe(Math.max(8, Math.ceil(front.userData.glyphPixelHeight * 0.055)) * 2.5);
        expect(surfaces.every((surface) => surface.userData.labelText === front.userData.labelText)).toBe(true);
        expect(surfaces.every((surface) => surface.userData.outlinePixelWidth === front.userData.outlinePixelWidth)).toBe(true);
        if (module.type === 'fast') expect(front.userData.glyphPixelHeight).toBeGreaterThan(600);
        if (module.type === 'double') expect(front.userData.glyphPixelHeight).toBeGreaterThan(500);
        expect(bodyMaterial.color.getHexString()).toBe(new THREE.Color(module.type === 'fast' ? CAMPAIGN_CONFIG.modules.fast.fullFuelColor : module.type === 'double'
          ? CAMPAIGN_CONFIG.modules.double.bodyColor : CAMPAIGN_CONFIG.modules.again.baseColor).getHexString());
        expect(bodyMaterial.roughness).toBeCloseTo(module.type === 'double' ? 0.36 : 0.82, 8); expect(bodyMaterial.metalness).toBeCloseTo(module.type === 'double' ? 0 : 0.02, 8);
        const labelMaterial = (module.root.getObjectByName(`campaign-module-${module.type}-label-front`) as THREE.Mesh).material as THREE.MeshBasicMaterial;
        expect(labelMaterial).not.toBe(bodyMaterial); expect(labelMaterial.color.getHexString()).toBe('ffffff');
        expect(module.root.getObjectsByProperty('name', `campaign-module-${module.type}-rear-gauge`)).toHaveLength(module.type === 'again' ? 0 : 1);
      }
      if (state === 'attached') {
        game.keyDown('ArrowUp', false); game.update(0.05); expect(game.player.animationState).toBe('walking'); game.keyUp('ArrowUp'); game.update(0.016); expect(game.player.animationState).toBe('idle');
        game.keyDown('ShiftLeft', false); game.keyDown('ArrowUp', false); game.update(0.05); expect(game.player.animationState).toBe('running'); game.keyUp('ArrowUp'); game.keyUp('ShiftLeft');
      }
      reachStage1(game); const fast = game.modules.find((module) => module.type === 'fast')!; const fastRoot = fast.root;
      const fastGauge = fast.root.getObjectByName('campaign-module-fast-rear-gauge')!; const fastBody = fast.root.getObjectByName('sharedCubeGeometry')!;
      expect(fastGauge.visible).toBe(true); expect(fastGauge.parent?.name).toBe('campaign-module-fast-active-feedback'); expect(fastGauge.position.z).toBeLessThan(-0.34);
      const gaugeNormalWorld = new THREE.Vector3(0, 0, 1).applyQuaternion(fastGauge.getWorldQuaternion(new THREE.Quaternion())).normalize();
      expect(fastGauge.getWorldPosition(new THREE.Vector3()).sub(fastBody.getWorldPosition(new THREE.Vector3())).dot(gaugeNormalWorld)).toBeGreaterThan(0.34);
      const fastFill = fast.root.getObjectByName('campaign-module-fast-gauge-fill')!; fast.fuelSeconds = 0; fast.updatePresentation(CAMPAIGN_CONFIG); expect(fastFill.scale.x).toBe(0);
      fast.fuelSeconds = CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds * 0.5; fast.updatePresentation(CAMPAIGN_CONFIG); expect(fastFill.scale.x).toBeCloseTo(0.5, 8);
      fast.fuelSeconds = CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds; fast.updatePresentation(CAMPAIGN_CONFIG); expect(fastFill.scale.x).toBe(1);
      const worldBefore = fast.root.getWorldPosition(new THREE.Vector3());
      if (state === 'attached') attachWorldModule(game, fast, game.blocks[0]!);
      else if (state === 'held') { moveTo(game, worldBefore.x, worldBefore.z); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds + 0.01); expect(game.player.heldModule).toBe(fast); }
      const attachedBlock = state === 'attached' ? fast.location.kind === 'socket' ? fast.location.block : null : null;
      if (state === 'attached') {
        expect(fast.presentationLocked).toBe(true); attachedBlock!.storedMaterialIds.push('attach-lock-probe'); const lockedFuel = fast.fuelSeconds;
        game.update(0.1); expect(fast.fuelSeconds).toBe(lockedFuel); game.update(0.75); expect(fast.presentationLocked).toBe(false); attachedBlock!.storedMaterialIds.pop();
      }
      const fuelBefore = fast.fuelSeconds; completeCurrentStage(game, 5); expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage2' });
      expect(fast.root).toBe(fastRoot);
      if (state === 'attached') {
        expect(attachedBlock).not.toBeNull(); expect(attachedBlock!.sockets[0].module).toBe(fast); expect(fast.location).toEqual({ kind: 'socket', block: attachedBlock, socket: 0 });
        expect(attachedBlock!.sockets[1].module).toBeNull(); expect(fast.fuelSeconds).toBeGreaterThanOrEqual(fuelBefore);
        const rear = fast.root.getObjectByName('campaign-module-fast-rear-gauge')!;
        const rearDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(rear.getWorldQuaternion(new THREE.Quaternion())).normalize();
        expect(rearDirection.dot(attachedBlock!.sockets[0].readOutwardDirection(new THREE.Vector3()))).toBeGreaterThan(0.999);
        const front = fast.root.getObjectByName('frontLabelFace')!; expect(new THREE.Vector3(0, 0, 1).applyQuaternion(front.getWorldQuaternion(new THREE.Quaternion())).normalize().dot(rearDirection)).toBeLessThan(-0.999);
        const double = game.modules.find((module) => module.type === 'double')!; const doubleRearWorld = double.root.getObjectByName('campaign-module-double-rear-gauge')!;
        expect(double.location.kind).toBe('world'); expect(double.root.visible).toBe(true); expect(doubleRearWorld.visible).toBe(true);
        const doubleFill = double.root.getObjectByName('campaign-module-double-gauge-fill')!; double.chargeSeconds = 0; double.activeSeconds = 0; double.updatePresentation(CAMPAIGN_CONFIG); expect(doubleFill.scale.x).toBe(0);
        double.chargeSeconds = CAMPAIGN_CONFIG.modules.double.chargeSeconds * 0.5; double.updatePresentation(CAMPAIGN_CONFIG); expect(doubleFill.scale.x).toBeCloseTo(0.5, 8);
        double.chargeSeconds = CAMPAIGN_CONFIG.modules.double.chargeSeconds; double.updatePresentation(CAMPAIGN_CONFIG); expect(doubleFill.scale.x).toBe(1); double.chargeSeconds = 0; double.updatePresentation(CAMPAIGN_CONFIG);
        attachWorldModule(game, double, attachedBlock!); expect(attachedBlock!.sockets[1].module).toBe(double); expect(double.presentationLocked).toBe(true); expect(doubleRearWorld.visible).toBe(true);
        const doubleRear = double.root.getObjectByName('campaign-module-double-rear-gauge')!;
        expect(doubleRear.visible).toBe(true); expect(doubleRear.parent?.name).toBe('campaign-module-double-active-feedback'); expect(doubleRear.position.z).toBeLessThan(-0.34);
        game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds);
        expect(new THREE.Vector3(0, 0, 1).applyQuaternion(doubleRear.getWorldQuaternion(new THREE.Quaternion())).normalize()
          .dot(attachedBlock!.sockets[1].readOutwardDirection(new THREE.Vector3()))).toBeGreaterThan(0.999);
        moveToSocketInteraction(game, attachedBlock!, attachedBlock!.sockets[1]); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds);
        expect(game.player.heldModule).toBe(double); expect(double.location.kind).toBe('held'); expect(doubleRear.visible).toBe(true);
        tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds); expect(attachedBlock!.sockets[1].module).toBe(double);
        const fastBeforeMove = fast.root.getWorldPosition(new THREE.Vector3()); const doubleBeforeMove = double.root.getWorldPosition(new THREE.Vector3());
        const blockBeforeMove = attachedBlock!.root.position.clone(); moveToBlockSide(game, attachedBlock!, 'left');
        game.keyDown('Space', false); game.keyDown('ArrowRight', false); game.update(0.08); game.keyUp('ArrowRight'); game.keyUp('Space'); tap(game, 'Space');
        const blockDelta = attachedBlock!.root.position.clone().sub(blockBeforeMove); expect(blockDelta.length()).toBeGreaterThan(0);
        expect(fast.root).toBe(fastRoot); expect(fast.root.getWorldPosition(new THREE.Vector3()).sub(fastBeforeMove).distanceTo(blockDelta)).toBeLessThan(1e-6);
        expect(double.root.getWorldPosition(new THREE.Vector3()).sub(doubleBeforeMove).distanceTo(blockDelta)).toBeLessThan(1e-6);
      } else if (state === 'held') { expect(game.player.heldModule).toBe(fast); expect(fast.location.kind).toBe('held'); expect(fastGauge.visible).toBe(true); expect(game.blocks.every((block) => block.sockets.every((socket) => socket.module !== fast))).toBe(true); }
      else { expect(fast.location.kind).toBe('world'); expect(fast.root.getWorldPosition(new THREE.Vector3())).toEqual(worldBefore); expect(game.blocks.every((block) => block.sockets.every((socket) => socket.module !== fast))).toBe(true); }

      const roots = game.blocks.map((block) => block.root); const visuals = game.blocks.map((block) => block.readPresentationRoot().children.find((child) => child.name.endsWith('double-socket-visual'))!);
      const sockets = game.blocks.flatMap((block) => [...block.sockets]); completeCurrentStage(game, 10); expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage3' });
      expect(game.blocks.map((block) => block.root)).toEqual(roots); expect(game.blocks.map((block) => block.readPresentationRoot().children.find((child) => child.name.endsWith('double-socket-visual')))).toEqual(visuals);
      expect(game.blocks.flatMap((block) => [...block.sockets])).toEqual(sockets); expect(visuals.every((visual) => visual.parent !== null)).toBe(true); game.dispose();
    }
  });

  it('prepares tuned flour and bread roots from the config scale and uses their actual horizontal footprint', async () => {
    for (const id of ['wheat', 'flour', 'bread'] as const) {
      const root = await actualPreparedMaterial(id); const visual = root.children[0]!;
      const configuredScale = CAMPAIGN_CONFIG.materialPresentation[`${id}RuntimeScale`];
      const appliedScale = id === 'flour' ? visual.scale.x / 0.1897240659 : visual.scale.x;
      expect(appliedScale).toBeCloseTo(configuredScale, 10);
      const bounds = new THREE.Box3().setFromObject(root);
      const footprint = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.z), Math.abs(bounds.max.z));
      expect(footprint).toBeCloseTo(CAMPAIGN_CONFIG.materialPresentation.footprintRadiusMeters[id], 10);
      if (id === 'wheat') expect(configuredScale).toBe(0.72);
      if (id === 'flour') expect(configuredScale).toBe(1.69728);
      if (id === 'bread') expect(configuredScale).toBe(2.2848);
    }
  });

  it('shows only the central GAME OVER action and removes it before visible retry suction', async () => {
    const canvas = new FakeElement(); const game = new CampaignGame({ document: fakeDocument, window: fakeWindow,
      mount: new FakeElement() as unknown as HTMLElement, tutorialSurface: new FakeElement() as unknown as HTMLElement,
      canvas: canvas as unknown as HTMLCanvasElement, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); const material = game.materials.create('wheat', new THREE.Vector3(-1, 0, 2));
    game.update(100); for (let index = 0; index < 40 && game.state.phase.kind !== 'game-over'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage1' });
    expect(game.gameOver.root.className).toBe('campaign-game-over-action'); expect(game.gameOver.root.hidden).toBe(false);
    const style = await readFile(path.join(process.cwd(), 'src', 'style.css'), 'utf8');
    expect(style).toMatch(/\.campaign-game-over-action\s*\{[^}]*pointer-events:\s*none/s);
    expect(style).not.toMatch(/\.campaign-game-over-action\s*\{[^}]*background:/s);
    expect(style).toMatch(/\.campaign-game-over-action button\s*\{[^}]*color:\s*#ffffff[^}]*background:\s*#ef5b43/s);
    expect(style).toMatch(/\.campaign-loading button,\s*\.campaign-overlay button,\s*\.campaign-game-over-action button\s*\{[^}]*background:\s*#f4cc63/s);
    expect(style).toMatch(/\.campaign-result-panel__action\s*\{[^}]*background:\s*#f2f1ea[^}]*color:\s*#263746/s);
    const button = (game.gameOver.root as unknown as FakeElement).querySelector<FakeElement>('button'); button.dispatch('click');
    expect(game.gameOver.root.hidden).toBe(true); expect(game.state.phase).toEqual({ kind: 'retry-presentation', stage: 'stage1' });
    expect(material.root.parent).not.toBeNull(); game.update(0.1); expect(material.root.parent).not.toBeNull(); expect(material.root.scale.x).toBeLessThan(1);
    game.dispose(); expect(material.root.parent).toBeNull(); expect(game.state.phase.kind).toBe('disposed');
  });

  it('preserves the moved block while returning player and camera to the stage baseline and releasing Space ownership', () => {
    const camera = new THREE.PerspectiveCamera();
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera, assets: fakeAssets });
    reachStage1(game);
    const block = game.blocks[0]!; block.root.visible = true; moveToBlockSide(game, block, 'left');
    game.update(Math.max(0, (game.state.remainingSeconds ?? 0) - 0.05));
    game.keyDown('Space', false); game.keyDown('ArrowRight', false); game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'game-over-presentation', stage: 'stage1' }); expect(game.player.heldBlockId).toBeNull();
    const heldBlock = block.root.position.clone(); const failurePosition = game.player.position.clone(); const failureFacing = game.player.facing.clone();
    for (let index = 0; index < 40 && game.state.phase.kind !== 'game-over'; index += 1) game.update(0.1);
    expect(game.keyDown('KeyR', false)).toBe(true);
    game.update(CAMPAIGN_CONFIG.presentation.retrySeconds * 0.35);
    expect(game.state.phase).toEqual({ kind: 'retry-presentation', stage: 'stage1' });
    expect(game.player.position).toEqual(failurePosition); expect(game.player.root.position.x).toBe(failurePosition.x); expect(game.player.root.position.z).toBe(failurePosition.y);
    game.update(0.001);
    const expectedCamera = new THREE.Vector3(THREE.MathUtils.clamp(failurePosition.x, CAMPAIGN_CONFIG.camera.centerXMin, CAMPAIGN_CONFIG.camera.centerXMax) + CAMPAIGN_CONFIG.camera.offsetX,
      CAMPAIGN_CONFIG.camera.offsetY, CAMPAIGN_CONFIG.camera.offsetZ);
    const cameraDistances: number[] = [];
    for (let sample = 0; sample < 3; sample += 1) {
      game.update(CAMPAIGN_CONFIG.presentation.retryReturnSeconds * 0.25);
      expect(game.player.position).toEqual(failurePosition); expect(game.player.root.position.x).toBe(failurePosition.x); expect(game.player.root.position.z).toBe(failurePosition.y);
      cameraDistances.push(camera.position.distanceTo(expectedCamera));
    }
    expect(cameraDistances[1]!).toBeLessThan(cameraDistances[0]!); expect(cameraDistances[2]!).toBeLessThan(cameraDistances[1]!);
    game.update(CAMPAIGN_CONFIG.presentation.retryReturnSeconds * 0.25);
    expect(game.state.phase).toEqual({ kind: 'retry-presentation', stage: 'stage1' });
    game.update(CAMPAIGN_CONFIG.presentation.moduleEffectResetSeconds);
    expect(game.state.phase).toEqual({ kind: 'retry-presentation', stage: 'stage1' });
    game.update(CAMPAIGN_CONFIG.presentation.timedStageEntranceSeconds);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage1' });
    const terminalCamera = camera.position.clone(); game.update(0.016);
    expect(camera.position.distanceTo(terminalCamera)).toBeLessThan(1e-8);
    expect(game.player.heldBlockId).toBeNull(); expect(block.root.position).toEqual(heldBlock);
    expect(game.player.position).toEqual(failurePosition); expect(game.player.facing).toEqual(failureFacing);
    expect(camera.position.toArray()).toEqual(expectedCamera.toArray());
    game.dispose();
  });

  it('always accepts retry, projects an invalid failure pose to the last safe pose, and retries cleanly after a camera fault', () => {
    const camera = new THREE.PerspectiveCamera(); const game = new CampaignGame({ document: fakeDocument, window: fakeWindow,
      mount: new FakeElement() as unknown as HTMLElement, tutorialSurface: new FakeElement() as unknown as HTMLElement,
      canvas: new FakeElement() as unknown as HTMLCanvasElement, scene: new THREE.Scene(), camera, assets: fakeAssets });
    reachStage1(game); game.state.setRemainingSeconds(300); moveTo(game, 0, 2.2); game.update(0.016);
    const safePosition = game.player.position.clone(); const safeFacing = game.player.facing.clone();
    const blockRoots = game.blocks.map((block) => block.root.position.clone()); const overlapBlock = game.blocks[0]!;
    const failAtInvalidPose = (): { position: THREE.Vector2; facing: THREE.Vector2 } => {
      const invalidPosition = new THREE.Vector2(overlapBlock.root.position.x, overlapBlock.root.position.z);
      const invalidFacing = new THREE.Vector2(0, -1); game.player.restorePose(invalidPosition, invalidFacing);
      game.state.setRemainingSeconds(0.01); game.update(0.02);
      for (let index = 0; index < 50 && game.state.phase.kind !== 'game-over'; index += 1) game.update(0.1);
      expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage1' }); return { position: invalidPosition, facing: invalidFacing };
    };
    failAtInvalidPose(); expect(game.keyDown('KeyR', false)).toBe(true);
    expect(game.state.phase).toEqual({ kind: 'retry-presentation', stage: 'stage1' });
    game.update(CAMPAIGN_CONFIG.presentation.retrySeconds * 0.35); game.update(0.001);
    expect(game.player.position).toEqual(safePosition); expect(game.player.facing).toEqual(safeFacing);
    expect(game.blocks.map((block) => block.root.position)).toEqual(blockRoots);
    for (let index = 0; index < 50 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage1' });

    const invalidSnapshot = failAtInvalidPose(); expect(game.keyDown('KeyR', false)).toBe(true);
    const owner = game.presentation as unknown as { queue: Array<import('./presentation/PresentationPlayer').PresentationStep>; transaction: Array<import('./presentation/PresentationPlayer').PresentationStep> };
    const cameraIndex = owner.queue.findIndex((step) => step.id.includes('camera-return')); const original = owner.queue[cameraIndex]!;
    const faulty = Object.freeze({ ...original, update: () => { throw new Error('invalid-pose retry camera fault'); } });
    owner.queue[cameraIndex] = faulty; const transactionIndex = owner.transaction.indexOf(original); owner.transaction[transactionIndex] = faulty;
    game.update(1); game.update(0.1); game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage1' }); expect(game.gameOver.root.hidden).toBe(false);
    expect(game.player.position).toEqual(invalidSnapshot.position); expect(game.player.facing).toEqual(invalidSnapshot.facing);
    expect(game.blocks.map((block) => block.root.position)).toEqual(blockRoots);
    expect(game.keyDown('KeyR', false)).toBe(true);
    for (let index = 0; index < 50 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage1' }); expect(game.player.position).toEqual(safePosition);
    expect(game.player.facing).toEqual(safeFacing); expect(game.gameOver.root.hidden).toBe(true); game.dispose();
  });

  it('aligns every shipped module to the same authored terminal on both blocks and sockets regardless of held quaternion', async () => {
    const assets = await actualAuthoredObjectAssets();
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets });
    for (const block of game.blocks) block.setVariant('double-socket', 2);
    const terminalBySeat = new Map<string, THREE.Quaternion>();
    for (const module of game.modules) {
      module.revealAt((game as unknown as { options: { scene: THREE.Scene } }).options.scene, new THREE.Vector3(0, 0.5, 0));
      for (const [blockIndex, block] of game.blocks.entries()) for (const socket of block.sockets) for (const angle of [0.37, -0.81]) {
        expect(module.pickUp(game.player)).toBe(true); module.root.quaternion.setFromEuler(new THREE.Euler(0.21, angle, -0.16));
        expect(socket.attach(module, game.player)).toBe(true);
        const front = module.root.getObjectByName(`campaign-module-${module.type}-label-front`)!;
        const frontNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(front.getWorldQuaternion(new THREE.Quaternion())).normalize();
        const socketOutward = socket.readOutwardDirection(new THREE.Vector3());
        expect(frontNormal.dot(socketOutward)).toBeLessThan(-0.999);
        if (module.type === 'again') {
          const rearLabel = module.root.getObjectByName('campaign-module-again-label-rear')!;
          const rearLabelNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(rearLabel.getWorldQuaternion(new THREE.Quaternion())).normalize();
          expect(rearLabelNormal.dot(socketOutward)).toBeGreaterThan(0.999);
        } else {
          const gauge = module.root.getObjectByName(`campaign-module-${module.type}-rear-gauge`)!;
          const gaugeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(gauge.getWorldQuaternion(new THREE.Quaternion())).normalize();
          expect(gaugeNormal.dot(socketOutward)).toBeGreaterThan(0.999);
        }
        const pivot = module.root.getObjectByName('rotationPivot')!.getWorldPosition(new THREE.Vector3());
        expect(pivot.distanceTo(socket.readWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-6);
        const terminal = module.root.getWorldQuaternion(new THREE.Quaternion()); const key = `${blockIndex}:${socket.index}`;
        const prior = terminalBySeat.get(key); if (prior === undefined) terminalBySeat.set(key, terminal.clone()); else expect(terminal.angleTo(prior)).toBeLessThan(1e-6);
        if (module.type === 'again') expect(module.root.getObjectByName('campaign-module-again-rear-gauge')).toBeUndefined();
        expect(socket.detach(game.player)).toBe(module);
        expect(module.dropTo((game as unknown as { options: { scene: THREE.Scene } }).options.scene, new THREE.Vector3(0, 0.5, 0), game.player)).toBe(true);
      }
    }
    game.dispose();
  });

  it('builds a partial Fast reset start through public attach, generated wheat, automatic intake, and real processing', async () => {
    const assets = await actualAuthoredObjectAssets(); const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera();
    const renderer = { capabilities: { getMaxAnisotropy: () => 8 }, setPixelRatio: () => undefined, setSize: () => undefined,
      dispose: () => undefined, render: () => undefined } as unknown as THREE.WebGLRenderer;
    const boot = new CampaignBoot({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      renderer, scene, camera, assets });
    boot.resize(1280, 720, 1); expect(await boot.load()).toBe(true);
    const game = (boot as unknown as { game: CampaignGame }).game;
    reachStage1(game);
    const fast = game.modules.find((module) => module.type === 'fast')!;
    const notIntroducedAgain = game.modules.find((module) => module.type === 'again')!;
    game.state.setRemainingSeconds(300);
    const mill = game.blocks[0]!; const issuanceBeforeFastWork = game.wheatSource.readSuccessfulIssuanceCount();
    attachWorldModule(game, fast, mill);
    for (let index = 0; index < 20 && !game.materials.all().some((material) => material.type === 'wheat' && material.location === 'world'); index += 1) game.update(0.25);
    const processingWheat = game.materials.all().find((material) => material.type === 'wheat' && material.location === 'world')!;
    expect(processingWheat).toBeDefined(); expect(game.wheatSource.readSuccessfulIssuanceCount()).toBeGreaterThan(issuanceBeforeFastWork);
    moveTo(game, processingWheat.root.position.x, processingWheat.root.position.z); tap(game, 'KeyE');
    expect(game.player.heldMaterialIds).toContain(processingWheat.id);
    moveToBlockFront(game, mill); tap(game, 'KeyQ');
    expect(processingWheat.location).toBe('world'); game.update(0.016);
    expect(processingWheat.location).toBe('stored'); expect(mill.storedMaterialIds).toContain(processingWheat.id);
    const processingBeforeFastWork = mill.processingSeconds; const fullFuelBeforeFastWork = fast.fuelSeconds;
    game.update(0.4);
    expect(mill.processingSeconds).toBeGreaterThan(processingBeforeFastWork);
    expect(fast.fuelSeconds).toBeLessThan(fullFuelBeforeFastWork); expect(fast.recoverySeconds).toBe(0);
    const actualFastResetStart = { fuel: fast.fuelSeconds, recovery: fast.recoverySeconds };
    expect(actualFastResetStart).toEqual({ fuel: 7.584, recovery: 0 });
    const fastRoot = fast.root; const fastParent = fast.root.parent; const fastPosition = fast.root.position.clone();
    const fastQuaternion = fast.root.quaternion.clone(); const fastLocation = fast.location;
    for (let index = 0; index < 5; index += 1) game.materials.create('bread', game.submissionDock.readGameplayPosition(new THREE.Vector3()));
    game.update(0.016); expect(game.state.phase.kind).toBe('clear-presentation');
    const stagePresentation = game.presentation as unknown as { current: import('./presentation/PresentationPlayer').PresentationStep | null };
    for (let index = 0; index < 100 && !stagePresentation.current?.id.includes('module-effect-reset'); index += 1) game.update(0.1);
    expect(stagePresentation.current?.id).toContain('module-effect-reset');
    game.update(CAMPAIGN_CONFIG.presentation.moduleEffectResetSeconds * 0.5);
    expect(fast.fuelSeconds).toBeCloseTo(
      actualFastResetStart.fuel + (CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds - actualFastResetStart.fuel) * 0.5,
      10,
    );
    expect(fast.fuelSeconds).toBeLessThan(CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds);
    expect(fast.recoverySeconds).toBe(actualFastResetStart.recovery);
    expect(fast.root).toBe(fastRoot); expect(fast.root.parent).toBe(fastParent); expect(fast.root.position).toEqual(fastPosition);
    expect(fast.root.quaternion.angleTo(fastQuaternion)).toBeLessThan(1e-12); expect(fast.location).toBe(fastLocation);
    expect(notIntroducedAgain.location.kind).toBe('not-introduced'); expect(notIntroducedAgain.root.visible).toBe(false);
    game.setPaused(true); const pausedFuel = fast.fuelSeconds; game.update(1); expect(fast.fuelSeconds).toBe(pausedFuel); game.setPaused(false);
    game.update(CAMPAIGN_CONFIG.presentation.moduleEffectResetSeconds * 0.5);
    expect([fast.fuelSeconds, fast.recoverySeconds]).toEqual([CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds, 0]);
    for (let index = 0; index < 100 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage2' });
    boot.dispose();
  });

  it('projects shipped Double active glow and half-second shake through world, held, socket, and transfer motion', async () => {
    const assets = await actualAuthoredObjectAssets(); const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera();
    const renderer = { capabilities: { getMaxAnisotropy: () => 8 }, setPixelRatio: () => undefined, setSize: () => undefined,
      dispose: () => undefined, render: () => undefined } as unknown as THREE.WebGLRenderer;
    const boot = new CampaignBoot({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      renderer, scene, camera, assets });
    boot.resize(1280, 720, 1); expect(await boot.load()).toBe(true);
    const game = (boot as unknown as { game: CampaignGame }).game;
    reachStage1(game); completeCurrentStage(game, 5); expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage2' });
    game.state.setRemainingSeconds(300); const double = game.modules.find((module) => module.type === 'double')!;
    const root = double.root; const feedback = root.getObjectByName('campaign-module-double-active-feedback')!;
    const light = root.getObjectByName('campaign-module-double-active-light') as THREE.PointLight;
    const body = root.getObjectByName('sharedCubeGeometry') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const gauge = root.getObjectByName('campaign-module-double-rear-gauge')!;
    expect(double.location.kind).toBe('world'); expect(body.parent).toBe(feedback); expect(gauge.parent).toBe(feedback);
    const baseEmissive = body.material.emissive.clone(); const baseIntensity = body.material.emissiveIntensity;
    double.chargeSeconds = 0; double.activeSeconds = 0; game.update(CAMPAIGN_CONFIG.modules.double.chargeSeconds);
    expect(double.activeSeconds).toBeCloseTo(CAMPAIGN_CONFIG.modules.double.activeSeconds, 8);
    expect(double.doubleActiveFeedbackActive).toBe(true); expect(double.doubleActiveFeedbackFadeFactor).toBe(0);
    expect(body.material.emissiveIntensity).toBe(baseIntensity); expect(light.intensity).toBe(0); expect(light.visible).toBe(false);
    game.update(CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.fadeInSeconds);
    expect(double.doubleActiveFeedbackFadeFactor).toBe(1); expect(body.material.emissiveIntensity)
      .toBe(CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.glowEmissiveIntensity);
    expect(light.intensity).toBe(CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.pointLightIntensity);
    expect(light.distance).toBe(CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.pointLightDistanceMeters);
    expect(light.visible).toBe(true); expect(light.castShadow).toBe(false); expect(light.parent).toBe(feedback);
    expect(readProductionModifiers(game.blocks[0]!, CAMPAIGN_CONFIG).outputCount).toBe(1);
    const authoritativePosition = root.position.clone(); const authoritativeQuaternion = root.quaternion.clone();
    game.update(CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.shakeIntervalSeconds - CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.fadeInSeconds +
      CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.shakeDurationSeconds * 0.25);
    expect(double.doubleActiveShakeAngleRadians).toBeCloseTo(THREE.MathUtils.degToRad(5), 8);
    expect(feedback.rotation.y).toBeCloseTo(double.doubleActiveShakeAngleRadians, 8);
    expect(root.position).toEqual(authoritativePosition); expect(root.quaternion.angleTo(authoritativeQuaternion)).toBeLessThan(1e-12);
    expect(body.material.emissiveIntensity).toBe(CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.glowEmissiveIntensity);
    const pausedActive = double.activeSeconds; const pausedShake = double.doubleActiveShakeAngleRadians;
    game.setPaused(true); game.update(1); expect(double.activeSeconds).toBe(pausedActive); expect(double.doubleActiveShakeAngleRadians).toBe(pausedShake);
    game.setPaused(false);

    const activate = (): void => {
      double.activeSeconds = 0; double.chargeSeconds = CAMPAIGN_CONFIG.modules.double.chargeSeconds - 0.05;
      game.update(0.05 + CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.fadeInSeconds);
      expect(double.doubleActiveFeedbackActive).toBe(true); expect(double.doubleActiveFeedbackFadeFactor).toBe(1);
      expect(light.intensity).toBe(CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.pointLightIntensity);
    };
    const modulePosition = root.getWorldPosition(new THREE.Vector3()); moveTo(game, modulePosition.x, modulePosition.z); activate(); tap(game, 'KeyE');
    expect(game.presentation.active).toBe(true); expect(double.doubleActiveFeedbackActive).toBe(true); expect(double.root).toBe(root);
    game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds); expect(game.player.heldModule).toBe(double);
    expect(double.location.kind).toBe('held'); expect(double.doubleActiveFeedbackActive).toBe(true);

    const block = game.blocks[0]!; const socket = block.sockets.find((candidate) => candidate.enabled && candidate.module === null)!;
    moveToSocketInteraction(game, block, socket); activate(); tap(game, 'KeyE');
    expect(game.presentation.active).toBe(true); expect(double.doubleActiveFeedbackActive).toBe(true); game.update(0.2);
    expect(double.root).toBe(root); expect(double.doubleActiveFeedbackActive).toBe(true);
    game.presentation.finishImmediately(); expect(socket.module).toBe(double); expect(double.location.kind).toBe('socket');
    expect(readProductionModifiers(block, CAMPAIGN_CONFIG).outputCount).toBe(2);
    const seat = socket.readWorldPosition(new THREE.Vector3()); const pivot = root.getObjectByName('rotationPivot')!.getWorldPosition(new THREE.Vector3());
    expect(pivot.distanceTo(seat)).toBeLessThan(1e-6);

    moveToSocketInteraction(game, block, socket); activate(); tap(game, 'KeyE');
    expect(game.presentation.active).toBe(true); expect(double.doubleActiveFeedbackActive).toBe(true);
    game.presentation.finishImmediately(); expect(game.player.heldModule).toBe(double);
    moveTo(game, -3, 3); game.update(0.016); activate(); tap(game, 'KeyQ');
    expect(game.presentation.active).toBe(true); expect(double.doubleActiveFeedbackActive).toBe(true);
    game.presentation.finishImmediately(); expect(double.location.kind).toBe('world'); expect(double.root).toBe(root);

    double.activeSeconds = 0.01; double.chargeSeconds = 0; game.update(0.02);
    expect(double.doubleActiveFeedbackActive).toBe(false); expect(feedback.rotation.y).toBe(0);
    expect(double.doubleActiveFeedbackFadeFactor).toBeGreaterThan(0); expect(light.visible).toBe(true);
    game.update(CAMPAIGN_CONFIG.presentation.doubleActiveFeedback.fadeOutSeconds - 0.01);
    expect(double.doubleActiveFeedbackFadeFactor).toBe(0); expect(light.intensity).toBe(0); expect(light.visible).toBe(false);
    expect(body.material.emissive).toEqual(baseEmissive); expect(body.material.emissiveIntensity).toBe(baseIntensity);

    const directStart = CAMPAIGN_CONFIG.modules.double.activeSeconds - 0.465;
    double.activeSeconds = directStart; double.chargeSeconds = 0; game.update(0.1); const directShake = double.doubleActiveShakeAngleRadians;
    double.activeSeconds = directStart; double.chargeSeconds = 0; game.update(0.05); game.update(0.05);
    expect(double.doubleActiveShakeAngleRadians).toBeCloseTo(directShake, 10);
    game.state.setRemainingSeconds(0.01); game.update(0.02); game.presentation.finishImmediately();
    expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage2' }); expect(game.keyDown('KeyR', false)).toBe(true);
    game.presentation.finishImmediately(); expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage2' });
    expect(double.activeSeconds).toBe(0); expect(double.doubleActiveFeedbackActive).toBe(false); expect(feedback.rotation.y).toBe(0);
    boot.dispose(); expect(root.parent).toBeNull(); expect(double.doubleActiveFeedbackActive).toBe(false);
    expect(light.intensity).toBe(0); expect(light.visible).toBe(false);
  });

  it('restores exact shipped Module presentation after a late retry terminal fault and retries cleanly', async () => {
    const assets = await actualAuthoredObjectAssets(); const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera();
    const renderer = { capabilities: { getMaxAnisotropy: () => 8 }, setPixelRatio: () => undefined, setSize: () => undefined,
      dispose: () => undefined, render: () => undefined } as unknown as THREE.WebGLRenderer;
    const boot = new CampaignBoot({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      renderer, scene, camera, assets });
    boot.resize(1280, 720, 1); expect(await boot.load()).toBe(true);
    const game = (boot as unknown as { game: CampaignGame }).game;
    reachStage1(game); completeCurrentStage(game, 5); completeCurrentStage(game, 10);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage3' });
    const double = game.modules.find((module) => module.type === 'double')!;
    const fast = game.modules.find((module) => module.type === 'fast')!;
    const again = game.modules.find((module) => module.type === 'again')!;
    const block = game.blocks[0]!; attachWorldModule(game, double, block); attachWorldModule(game, again, block);
    expect(double.location.kind).toBe('socket'); expect(again.location.kind).toBe('socket');
    const doubleSocket = block.sockets.find((socket) => socket.module === double)!;
    moveToSocketInteraction(game, block, doubleSocket);
    game.state.setRemainingSeconds(300);
    for (let index = 0; index < 1600 &&
      (double.activeSeconds <= 0 || double.doubleActiveFeedbackFadeFactor < 1 || Math.abs(double.doubleActiveShakeAngleRadians) <= 0.01); index += 1) game.update(0.01);
    expect(double.doubleActiveFeedbackActive).toBe(true); expect(double.doubleActiveFeedbackFadeFactor).toBe(1);
    expect(Math.abs(double.doubleActiveShakeAngleRadians)).toBeGreaterThan(0.01);
    tap(game, 'KeyE'); game.presentation.finishImmediately();
    expect(game.player.heldModule).toBe(double); expect(double.location.kind).toBe('held'); expect(double.activeSeconds).toBeGreaterThan(0);
    again.updatePresentation(CAMPAIGN_CONFIG, CAMPAIGN_CONFIG.modules.again.colorTransitionSeconds * 0.5);
    const againBody = again.root.getObjectByName('sharedCubeGeometry') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(colorDistance(againBody.material.color, new THREE.Color(CAMPAIGN_CONFIG.modules.again.baseColor))).toBeGreaterThan(0.03);
    expect(colorDistance(againBody.material.color, new THREE.Color(CAMPAIGN_CONFIG.modules.double.bodyColor))).toBeGreaterThan(0.03);
    const activeSecondsBeforeGameOver = double.activeSeconds;
    game.state.setRemainingSeconds(0.01); game.update(0.02); game.presentation.finishImmediately();
    expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage3' });
    expect(double.activeSeconds).toBeCloseTo(activeSecondsBeforeGameOver - 0.02, 10);
    expect(double.doubleActiveFeedbackActive).toBe(true);
    expect(Math.abs(double.doubleActiveShakeAngleRadians)).toBeGreaterThan(0.01);
    type MaterialState = Readonly<{ material: THREE.Material; color: readonly number[] | null; emissive: readonly number[] | null;
      emissiveIntensity: number | null; opacity: number; visible: boolean }>;
    const readMaterialStates = (module: CampaignGame['modules'][number]): readonly MaterialState[] => {
      const result: MaterialState[] = [];
      module.root.getObjectByName(`campaign-module-${module.id}-active-feedback`)!.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          const candidate = material as THREE.Material & { color?: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number };
          result.push(Object.freeze({ material, color: candidate.color?.toArray() ?? null, emissive: candidate.emissive?.toArray() ?? null,
            emissiveIntensity: candidate.emissiveIntensity ?? null, opacity: material.opacity, visible: material.visible }));
        }
      });
      return result;
    };
    const feedback = double.root.getObjectByName(`campaign-module-${double.id}-active-feedback`)!;
    const light = double.root.getObjectByName(`campaign-module-${double.id}-active-light`) as THREE.PointLight;
    const gaugeFill = double.root.getObjectByName('campaign-module-double-gauge-fill')!;
    const savedScalars = new Map(game.modules.map((module) => [module, [module.fuelSeconds, module.recoverySeconds,
      module.chargeSeconds, module.activeSeconds] as const]));
    const savedAgainColor = again.readBodyColor(new THREE.Color()).toArray();
    const savedMaterials = new Map(game.modules.map((module) => [module, readMaterialStates(module)]));
    const savedFeedback = { position: feedback.position.toArray(), quaternion: feedback.quaternion.toArray(), scale: feedback.scale.toArray(),
      visible: feedback.visible, active: double.doubleActiveFeedbackActive, factor: double.doubleActiveFeedbackFadeFactor,
      shake: double.doubleActiveShakeAngleRadians, lightIntensity: light.intensity, lightVisible: light.visible, lightDistance: light.distance };
    const savedGauge = { position: gaugeFill.position.toArray(), quaternion: gaugeFill.quaternion.toArray(), scale: gaugeFill.scale.toArray(), visible: gaugeFill.visible };
    const savedRoots = game.modules.map((module) => ({ module, parent: module.root.parent, position: module.root.position.toArray(),
      quaternion: module.root.quaternion.toArray(), scale: module.root.scale.toArray(), location: module.location }));

    const resetOriginals = game.modules.map((module) => ({ module, reset: module.resetEffectForRetry.bind(module),
      restore: module.restorePresentationSnapshot.bind(module) }));
    let resetCount = 0; let restoreCount = 0;
    for (const saved of resetOriginals) {
      saved.module.resetEffectForRetry = (config) => { resetCount += 1; saved.reset(config); };
      saved.module.restorePresentationSnapshot = (snapshot) => {
        expect([saved.module.fuelSeconds, saved.module.recoverySeconds, saved.module.chargeSeconds, saved.module.activeSeconds])
          .toEqual(savedScalars.get(saved.module));
        restoreCount += 1; return saved.restore(snapshot);
      };
    }
    const scoreboardCommit = game.scoreboard.commitPreparedActiveProjection.bind(game.scoreboard); let faulted = false;
    game.scoreboard.commitPreparedActiveProjection = (receipt) => {
      scoreboardCommit(receipt); if (!faulted) { faulted = true; throw new Error('late retry publication fault after all Module resets'); }
    };
    const presentationOwner = game.presentation as unknown as { current: import('./presentation/PresentationPlayer').PresentationStep | null };
    expect(game.keyDown('KeyR', false)).toBe(true);
    for (let index = 0; index < 40 && !presentationOwner.current?.id.includes('module-effect-reset'); index += 1) game.update(0.1);
    expect(presentationOwner.current?.id).toContain('module-effect-reset');
    const halfReset = CAMPAIGN_CONFIG.presentation.moduleEffectResetSeconds * 0.5;
    game.update(halfReset * 0.5); game.update(halfReset * 0.5);
    const splitMidpoint = { fastFuel: fast.fuelSeconds, fastRecovery: fast.recoverySeconds,
      doubleCharge: double.chargeSeconds, doubleActive: double.activeSeconds,
      doubleFactor: double.doubleActiveFeedbackFadeFactor, doubleLight: light.intensity, gauge: gaugeFill.scale.x };
    expect(splitMidpoint.fastFuel).toBe(CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds); expect(splitMidpoint.fastRecovery).toBe(0);
    expect(splitMidpoint.doubleActive).toBeGreaterThan(0); expect(splitMidpoint.doubleActive).toBeLessThan(savedScalars.get(double)![3]);
    expect(game.presentation.finishImmediately()).toBe(false);
    expect(resetCount).toBe(2); expect(restoreCount).toBe(3);
    expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage3' }); expect(game.gameOver.root.hidden).toBe(false);
    expect(again.readBodyColor(new THREE.Color()).toArray()).toEqual(savedAgainColor);
    for (const module of game.modules) {
      expect([module.fuelSeconds, module.recoverySeconds, module.chargeSeconds, module.activeSeconds]).toEqual(savedScalars.get(module));
      const currentMaterials = readMaterialStates(module); const expectedMaterials = savedMaterials.get(module)!;
      expect(currentMaterials).toHaveLength(expectedMaterials.length);
      currentMaterials.forEach((current, index) => {
        const expected = expectedMaterials[index]!; expect(current.material).toBe(expected.material); expect(current.color).toEqual(expected.color);
        expect(current.emissive).toEqual(expected.emissive); expect(current.emissiveIntensity).toBe(expected.emissiveIntensity);
        expect(current.opacity).toBe(expected.opacity); expect(current.visible).toBe(expected.visible);
      });
    }
    expect(feedback.position.toArray()).toEqual(savedFeedback.position); expect(feedback.quaternion.toArray()).toEqual(savedFeedback.quaternion);
    expect(feedback.scale.toArray()).toEqual(savedFeedback.scale); expect(feedback.visible).toBe(savedFeedback.visible);
    expect(double.doubleActiveFeedbackActive).toBe(savedFeedback.active); expect(double.doubleActiveFeedbackFadeFactor).toBe(savedFeedback.factor);
    expect(double.doubleActiveShakeAngleRadians).toBe(savedFeedback.shake); expect(light.intensity).toBe(savedFeedback.lightIntensity);
    expect(light.visible).toBe(savedFeedback.lightVisible); expect(light.distance).toBe(savedFeedback.lightDistance);
    expect(gaugeFill.position.toArray()).toEqual(savedGauge.position); expect(gaugeFill.quaternion.toArray()).toEqual(savedGauge.quaternion);
    expect(gaugeFill.scale.toArray()).toEqual(savedGauge.scale); expect(gaugeFill.visible).toBe(savedGauge.visible);
    for (const saved of savedRoots) {
      expect(saved.module.root.parent).toBe(saved.parent); expect(saved.module.root.position.toArray()).toEqual(saved.position);
      expect(saved.module.root.quaternion.toArray()).toEqual(saved.quaternion); expect(saved.module.root.scale.toArray()).toEqual(saved.scale);
      expect(saved.module.location).toBe(saved.location);
    }
    for (const saved of resetOriginals) {
      saved.module.resetEffectForRetry = saved.reset; saved.module.restorePresentationSnapshot = saved.restore;
    }
    game.scoreboard.commitPreparedActiveProjection = scoreboardCommit;
    expect(game.keyDown('KeyR', false)).toBe(true);
    for (let index = 0; index < 40 && !presentationOwner.current?.id.includes('module-effect-reset'); index += 1) game.update(0.1);
    expect(presentationOwner.current?.id).toContain('module-effect-reset'); game.update(halfReset);
    expect(fast.fuelSeconds).toBeCloseTo(splitMidpoint.fastFuel, 10); expect(fast.recoverySeconds).toBeCloseTo(splitMidpoint.fastRecovery, 10);
    expect(double.chargeSeconds).toBeCloseTo(splitMidpoint.doubleCharge, 10); expect(double.activeSeconds).toBeCloseTo(splitMidpoint.doubleActive, 10);
    expect(double.doubleActiveFeedbackFadeFactor).toBeCloseTo(splitMidpoint.doubleFactor, 10);
    expect(light.intensity).toBeCloseTo(splitMidpoint.doubleLight, 10); expect(gaugeFill.scale.x).toBeCloseTo(splitMidpoint.gauge, 10);
    expect(game.presentation.finishImmediately()).toBe(true);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage3' }); expect(double.doubleActiveFeedbackActive).toBe(false);
    expect([fast.fuelSeconds, fast.recoverySeconds]).toEqual([CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds, 0]);
    expect([double.chargeSeconds, double.activeSeconds]).toEqual([0, 0]); expect(gaugeFill.scale.x).toBe(0);
    expect(again.readBodyColor(new THREE.Color()).toArray()).toEqual(savedAgainColor);
    boot.dispose();
  });

  it('keeps capacity cells world-facing and stateful during the actual block turn/swap owner', async () => {
    const assets = await actualAuthoredObjectAssets();
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets });
    const blocks = game.blocks; blocks[0]!.updatePresentation(0, 2, 5, 1); blocks[1]!.updatePresentation(0, 1, 5, 2);
    const roots = blocks.map((block) => block.root.getObjectByName('campaign-block-capacity')!);
    const identities = [...roots]; const worldQuaternions = roots.map((root) => root.getWorldQuaternion(new THREE.Quaternion()));
    const colors = blocks.map((block) => [0, 1, 2, 3, 4].map((index) => block.readCapacityCellColor(index, new THREE.Color()).getHexString()));
    const step = turnAndSwapBlocks('capacity-frame-probe', blocks, CAMPAIGN_CONFIG.presentation.blockTurnSeconds,
      () => { for (const block of blocks) block.setVariant('single-socket', 1); },
      () => { for (const block of blocks) block.setVariant('socketless', 0); });
    step.start?.();
    for (const progress of [0.25, 0.5, 0.75]) {
      step.update?.(progress);
      expect(blocks.some((block) => Math.abs(block.root.rotation.y) > 0.1)).toBe(true);
      roots.forEach((root, index) => {
        expect(root).toBe(identities[index]);
        expect(root.getWorldQuaternion(new THREE.Quaternion()).angleTo(worldQuaternions[index]!)).toBeLessThan(1e-6);
        expect(root.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(blocks[index]!.root.position.x, 8);
        expect([0, 1, 2, 3, 4].map((cell) => blocks[index]!.readCapacityCellColor(cell, new THREE.Color()).getHexString())).toEqual(colors[index]);
      });
    }
    step.finish?.();
    roots.forEach((root, index) => { expect(root).toBe(identities[index]); expect(root.parent).toBe(blocks[index]!.readPresentationRoot()); expect(blocks[index]!.root.rotation.y).toBeCloseTo(0, 8); });

    const rollback = turnAndSwapBlocks('capacity-frame-rollback', blocks, CAMPAIGN_CONFIG.presentation.blockTurnSeconds,
      () => { for (const block of blocks) block.setVariant('double-socket', 2); },
      () => { for (const block of blocks) block.setVariant('single-socket', 1); });
    rollback.start?.(); rollback.update?.(0.6); rollback.cancel?.();
    roots.forEach((root, index) => { expect(root).toBe(identities[index]); expect(root.parent).toBe(blocks[index]!.readPresentationRoot()); expect(blocks[index]!.root.rotation.y).toBeCloseTo(0, 8); expect([0, 1, 2, 3, 4].map((cell) => blocks[index]!.readCapacityCellColor(cell, new THREE.Color()).getHexString())).toEqual(colors[index]); });
    game.dispose(); expect(blocks.every((block) => block.root.parent === null)).toBe(true);
    roots.forEach((root, index) => expect(root.parent).toBe(blocks[index]!.readPresentationRoot()));
  });

  it('uses the same 90-percent configured follow offset across supported viewport shapes', () => {
    const camera = new THREE.PerspectiveCamera();
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera, assets: fakeAssets });
    const prior = new THREE.Vector3(4.443, 11.821, 25.195); const configured = new THREE.Vector3(CAMPAIGN_CONFIG.camera.offsetX, CAMPAIGN_CONFIG.camera.offsetY, CAMPAIGN_CONFIG.camera.offsetZ);
    expect(configured.length()).toBeCloseTo(prior.length() * 0.9, 10); expect(configured.clone().normalize().angleTo(prior.normalize())).toBeLessThan(1e-12);
    for (const [width, height] of [[1920, 1080], [1024, 768], [2560, 1080], [720, 1280]] as const) {
      game.resize(width, height); game.update(0.016);
      expect(camera.aspect).toBeCloseTo(width / height, 12); expect(camera.fov).toBe(21); expect(camera.near).toBe(0.1); expect(camera.far).toBe(100);
      expect(camera.position.x - (game as unknown as { cameraCenterX: number }).cameraCenterX).toBeCloseTo(configured.x, 8);
      expect(camera.position.y).toBeCloseTo(configured.y, 8); expect(camera.position.z).toBeCloseTo(configured.z, 8);
      expect(camera.position.toArray().every(Number.isFinite)).toBe(true);
    }
    game.dispose();
  });

  it('keeps shipped Flour/Bread in compact supported one-to-five tiers while Wheat stays close and Bread points player-forward', async () => {
    const assets = await actualAuthoredObjectAssets();
    for (const type of ['wheat', 'flour', 'bread'] as const) {
      const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
        tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
        scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets });
      const position = new THREE.Vector3(game.player.position.x, 0, game.player.position.y);
      const materials = Array.from({ length: 5 }, () => game.materials.create(type, position));
      const identities = materials.map((material) => material.root);
      for (let index = 0; index < materials.length; index += 1) {
        game.update(0.016); tap(game, 'KeyE');
        if (index % 2 === 0) game.update(CAMPAIGN_CONFIG.materialPresentation.heldTransferSeconds);
        else { game.update(CAMPAIGN_CONFIG.materialPresentation.heldTransferSeconds / 2); game.update(CAMPAIGN_CONFIG.materialPresentation.heldTransferSeconds / 2); }
        expect(materials.map((material) => material.root)).toEqual(identities);
        game.update(0); expect(game.interactionKeycap.label).not.toBe('Q');
        if (type !== 'wheat') {
          const held = materials.slice(0, index + 1); const boxes = held.map((material) => new THREE.Box3().setFromObject(material.root));
          const lateralStep = CAMPAIGN_PREPARED_HELD_LATERAL_WIDTH_METERS[type] - HELD_STACK_LATERAL_OVERLAP_METERS;
          const expectedX = index === 0 ? [0] : index === 1 ? [-lateralStep / 2, lateralStep / 2] : index === 2 ? [-lateralStep / 2, lateralStep / 2, 0] :
            index === 3 ? [-lateralStep / 2, lateralStep / 2, -lateralStep / 2, lateralStep / 2] : [-lateralStep, 0, lateralStep, -lateralStep / 2, lateralStep / 2];
          held.forEach((material, heldIndex) => expect(material.root.position.x - 0.005).toBeCloseTo(expectedX[heldIndex]!, 10));
          const baseY = Math.min(...held.map((material) => material.root.position.y));
          const lower = held.map((material, heldIndex) => ({ material, box: boxes[heldIndex]! })).filter(({ material }) => Math.abs(material.root.position.y - baseY) < 1e-8);
          const upper = held.map((material, heldIndex) => ({ material, box: boxes[heldIndex]! })).filter(({ material }) => material.root.position.y > baseY + 1e-8);
          for (const row of [lower, upper]) {
            const ordered = [...row].sort((left, right) => left.material.root.position.x - right.material.root.position.x);
            for (let sibling = 1; sibling < ordered.length; sibling += 1) {
              expect(ordered[sibling - 1]!.box.max.x - ordered[sibling]!.box.min.x).toBeCloseTo(HELD_STACK_LATERAL_OVERLAP_METERS, 6);
            }
          }
          for (const candidate of upper) {
            const supports = lower.filter(({ box }) => Math.min(box.max.x, candidate.box.max.x) - Math.max(box.min.x, candidate.box.min.x) > 0 &&
              Math.min(box.max.z, candidate.box.max.z) - Math.max(box.min.z, candidate.box.min.z) > 0);
            expect(supports.length, `${type} count${index + 1} upper tier requires a lower-row support`).toBeGreaterThan(0);
            const supportTop = Math.max(...supports.map(({ box }) => box.max.y));
            expect(candidate.box.min.y - supportTop).toBeCloseTo(-HELD_STACK_CONTACT_OVERLAP_METERS, 6);
            expect(candidate.material.root.position.y - baseY).toBeCloseTo(CAMPAIGN_PREPARED_MATERIAL_HEIGHT_METERS[type] - HELD_STACK_CONTACT_OVERLAP_METERS, 8);
          }
        }
      }
      expect(game.player.heldMaterialIds).toHaveLength(5); expect(materials.every((material) => material.root.parent === game.player.root)).toBe(true);
      expect(materials[0]!.root.position.z).toBeCloseTo(type === 'wheat' ? -0.270 : type === 'flour' ? -0.451 : -0.548, 8);
      if (type === 'bread') {
        for (const material of materials) {
          const longAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(material.root.getWorldQuaternion(new THREE.Quaternion())).normalize();
          const playerForward = new THREE.Vector3(game.player.facing.x, 0, game.player.facing.y).normalize();
          expect(Math.abs(longAxis.dot(playerForward))).toBeGreaterThan(0.999);
        }
        const beforeFacingChange = game.player.position.clone(); game.keyDown('ArrowRight', false); game.update(0.1); game.keyUp('ArrowRight');
        expect(game.player.position.distanceTo(beforeFacingChange)).toBeGreaterThan(0);
        for (const material of materials) {
          const longAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(material.root.getWorldQuaternion(new THREE.Quaternion())).normalize();
          const playerForward = new THREE.Vector3(game.player.facing.x, 0, game.player.facing.y).normalize();
          expect(Math.abs(longAxis.dot(playerForward))).toBeGreaterThan(0.999);
        }
      }
      const visual = game.player.root.children.find((child) => child !== game.player.heldAnchor)!;
      const playerBounds = new THREE.Box3().setFromObject(visual); const materialBounds = materials.map((material) => new THREE.Box3().setFromObject(material.root));
      expect(materialBounds.filter((bounds) => bounds.intersectsBox(playerBounds))).toHaveLength(0);
      const authoritativePoses = materials.map((material) => ({ position: material.root.position.clone(), quaternion: material.root.quaternion.clone() }));
      game.update(CAMPAIGN_CONFIG.materialPresentation.heldTransferSeconds / 2); game.update(CAMPAIGN_CONFIG.materialPresentation.heldTransferSeconds / 2);
      materials.forEach((material, index) => { expect(material.root.position).toEqual(authoritativePoses[index]!.position); expect(material.root.quaternion.angleTo(authoritativePoses[index]!.quaternion)).toBeLessThan(1e-6); });
      game.update(0); expect(game.interactionKeycap.label).toBeNull(); expect(game.interactionKeycap.root.visible).toBe(false);
      tap(game, 'KeyQ'); expect(game.player.heldMaterialIds).toHaveLength(0);
      expect(materials.every((material) => material.location === 'world')).toBe(true);
      expect(materials.map((material) => material.root)).toEqual(identities);
      game.dispose();
    }
  });

  it('publishes the executable on-screen Space plane from shipped block roots throughout Stage1 to Stage3', async () => {
    const assets = await actualAuthoredObjectAssets();
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets });
    reachStage1(game);
    const contactDistance = CAMPAIGN_CONFIG.movement.blockHalfExtentMeters + CAMPAIGN_CONFIG.movement.playerRadiusMeters;
    const verifyStage = (): void => {
      for (const block of game.blocks) {
        moveToBlockFront(game, block); expectVisibleSpaceKeycap(game, block); tap(game, 'Space');
        expect(game.player.heldBlockId).toBe(block.id); expect(game.player.facing.distanceTo(
          new THREE.Vector2(block.root.position.x - game.player.position.x, block.root.position.z - game.player.position.y).normalize())).toBeLessThan(1e-8);
        const playerX = game.player.position.x; const blockX = block.root.position.x;
        game.keyDown('ArrowRight', false); game.update(0.02); game.keyUp('ArrowRight');
        expect(game.player.position.x - playerX).toBeCloseTo(block.root.position.x - blockX, 8); expect(game.player.animationState).toBe('blockMoveFront');
        tap(game, 'Space');
        moveToBlockSide(game, block, 'left');
        expectVisibleSpaceKeycap(game, block);
        tap(game, 'Space'); expect(game.player.heldBlockId).toBe(block.id); expectVisibleSpaceKeycap(game, block);
        tap(game, 'Space'); expect(game.player.heldBlockId).toBeNull();
        moveTo(game, block.root.position.x - contactDistance - 0.36, block.root.position.z); game.update(0.016); expect(game.interactionKeycap.label).not.toBe('SPACE');
      }
    };
    verifyStage(); completeCurrentStage(game, 5); verifyStage(); completeCurrentStage(game, 10); verifyStage(); game.dispose();
  });

  it('keeps stage admission closed on a required scoreboard fault and cancels transient CLEAR roots on dispose', () => {
    const canvas = new FakeElement(); const game = new CampaignGame({ document: fakeDocument, window: fakeWindow,
      mount: new FakeElement() as unknown as HTMLElement, tutorialSurface: new FakeElement() as unknown as HTMLElement,
      canvas: canvas as unknown as HTMLCanvasElement, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); const transient = game.materials.create('wheat', new THREE.Vector3(-1, 0, 2)).root;
    const createClear = game.scoreboard.createClearStep.bind(game.scoreboard);
    game.scoreboard.createClearStep = ((...args: Parameters<typeof game.scoreboard.createClearStep>) => {
      const step = createClear(...args); return Object.freeze({ ...step, update: () => { throw new Error('injected required scoreboard fault'); } });
    }) as typeof game.scoreboard.createClearStep;
    for (let index = 0; index < 10; index += 1) game.materials.create('bread', game.submissionDock.root.position.clone());
    game.update(0.016); expect(game.state.phase.kind).toBe('clear-presentation');
    expect(game.submissionDock.readGoalBoardProjectionDiagnostics()).toMatchObject({ numbersVisible: false, numericText: '' });
    expect(game.submissionDock.goalScoreboard.root.visible).toBe(true); expect(game.submissionDock.goalScoreboard.panel.visible).toBe(true);
    for (let index = 0; index < 30 && game.presentation.active; index += 1) game.update(0.1);
    expect(game.presentation.active).toBe(false); expect(game.state.phase).toEqual({ kind: 'clear-presentation', stage: 'stage1', nextStage: 'stage2' });
    expect(canvas.dataset.presentationFailure).toBe('stage1-physical-scoreboard-lifecycle'); expect(transient.parent).toBeNull();
    expect(game.submissionDock.readGoalBoardProjectionDiagnostics()).toMatchObject({ numbersVisible: true, numericText: '5 / 5' });
    game.dispose(); expect(game.state.phase.kind).toBe('disposed'); expect(transient.parent).toBeNull();
  });

  it('restores the prior coherent stage when a timed entrance is cancelled nonterminal', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); const previousRemaining = game.state.remainingSeconds;
    for (let index = 0; index < CAMPAIGN_CONFIG.stages.stage1.targetBreadCount; index += 1) {
      game.materials.create('bread', game.submissionDock.readGameplayPosition(new THREE.Vector3()));
    }
    game.update(0.016);
    const owner = game.presentation as unknown as { current: import('./presentation/PresentationPlayer').PresentationStep | null };
    for (let index = 0; index < 200 && owner.current?.id !== 'stage2-physical-scoreboard-entrance'; index += 1) game.update(0.1);
    expect(owner.current?.id).toBe('stage2-physical-scoreboard-entrance'); game.update(0.14);
    expect(game.scoreboard.readActiveProjectionDiagnostics().state).toBe('entering'); game.presentation.cancel();
    expect(game.state.phase).toEqual({ kind: 'clear-presentation', stage: 'stage1', nextStage: 'stage2' });
    expect((game as unknown as { stage: string }).stage).toBe('stage1'); expect(game.state.remainingSeconds).toBe(previousRemaining);
    expect(game.submissionDock.targetBreadCount).toBe(CAMPAIGN_CONFIG.stages.stage1.targetBreadCount);
    expect(game.submissionDock.submittedBreadCount).toBe(CAMPAIGN_CONFIG.stages.stage1.targetBreadCount);
    expect(game.scoreboard.readActiveProjectionDiagnostics()).toMatchObject({ state: 'hidden', centralVisible: false, auxiliaryVisible: false });
    game.dispose();
  });

  it('rolls back a retry entrance terminal-publication fault and admits one clean second retry', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); game.update(100);
    for (let index = 0; index < 80 && game.state.phase.kind !== 'game-over'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage1' });
    const setPhase = game.state.setPhase.bind(game.state); let faulted = false;
    game.state.setPhase = (phase) => {
      if (!faulted && phase.kind === 'playing' && game.scoreboard.readActiveProjectionDiagnostics().state === 'active') {
        faulted = true; throw new Error('injected timed-stage admission publication fault');
      }
      setPhase(phase);
    };
    expect(game.keyDown('KeyR', false)).toBe(true);
    for (let index = 0; index < 80 && game.state.phase.kind === 'retry-presentation'; index += 1) game.update(0.1);
    expect(faulted).toBe(true); expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage1' });
    expect(game.state.remainingSeconds).toBe(0); expect(game.gameOver.root.hidden).toBe(false);
    expect(game.scoreboard.readActiveProjectionDiagnostics()).toMatchObject({ state: 'hidden', centralVisible: false });
    game.state.setPhase = setPhase; expect(game.keyDown('KeyR', false)).toBe(true);
    for (let index = 0; index < 80 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage1' }); expect(game.state.remainingSeconds).toBe(50);
    game.dispose();
  });

  it('removes every transient CLEAR suction root and suppresses completion when disposed mid-transaction', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); const root = game.materials.create('flour', new THREE.Vector3(-2, 0, 2)).root;
    for (let index = 0; index < 10; index += 1) game.materials.create('bread', game.submissionDock.root.position.clone());
    game.update(0.016); game.update(CAMPAIGN_CONFIG.presentation.wideEnterSeconds);
    game.update(0.28 + CAMPAIGN_CONFIG.presentation.scoreCountSeconds + CAMPAIGN_CONFIG.presentation.scoreHoldSeconds + 0.36 + 0.28);
    game.update(0.05); expect(root.parent).not.toBeNull(); game.dispose();
    expect(root.parent).toBeNull(); expect(game.state.phase.kind).toBe('disposed'); game.update(100); expect(game.state.phase.kind).toBe('disposed');
  });

  it('keeps retry reset uncommitted when return-camera faults and reopens one clean retry', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); const failurePlayer = game.player.position.clone(); const fast = game.modules[0]!; fast.fuelSeconds = 2.75;
    game.update(100); for (let index = 0; index < 40 && game.state.phase.kind !== 'game-over'; index += 1) game.update(0.1);
    const failureFuel = fast.fuelSeconds;
    expect(game.keyDown('KeyR', false)).toBe(true);
    const owner = game.presentation as unknown as { queue: Array<import('./presentation/PresentationPlayer').PresentationStep>; transaction: Array<import('./presentation/PresentationPlayer').PresentationStep> };
    const cameraIndex = owner.queue.findIndex((step) => step.id.includes('camera-return')); const original = owner.queue[cameraIndex]!;
    const faulty = Object.freeze({ ...original, update: () => { throw new Error('injected retry camera fault'); } });
    owner.queue[cameraIndex] = faulty; const transactionIndex = owner.transaction.indexOf(original); owner.transaction[transactionIndex] = faulty;
    game.update(1); game.update(0.1); game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage1' }); expect(game.gameOver.root.hidden).toBe(false);
    expect(game.player.position).toEqual(failurePlayer); expect(fast.fuelSeconds).toBe(failureFuel); expect(game.state.remainingSeconds).toBe(0);
    expect(game.keyDown('KeyR', false)).toBe(true); for (let index = 0; index < 30 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage1' }); expect(fast.fuelSeconds).toBe(CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds); expect(game.gameOver.root.hidden).toBe(true);
    game.dispose();
  });

  it('rolls back dock, scoreboard, and terminal reset faults before one clean retry', () => {
    for (const fault of ['dock-projection', 'scoreboard-projection', 'terminal-commit'] as const) {
      const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
        tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
        scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
      reachStage1(game); const fast = game.modules[0]!; fast.fuelSeconds = 2.75; fast.recoverySeconds = 1.25;
      game.submissionDock.submit(2); game.state.submittedBreadCount = 2; game.update(100);
      for (let index = 0; index < 40 && game.state.phase.kind !== 'game-over'; index += 1) game.update(0.1);
      const failureFuel = fast.fuelSeconds; const failureRecovery = fast.recoverySeconds;
      const score = game.score.snapshot(); const timer = game.state.remainingSeconds; const wheatTimer = game.wheatSource.readTimerSeconds();
      let restoreFault: () => void;
      if (fault === 'dock-projection') {
        const original = game.submissionDock.prepareResetProjection.bind(game.submissionDock);
        game.submissionDock.prepareResetProjection = () => { original(); throw new Error('dock projection after-write fault'); };
        restoreFault = () => { game.submissionDock.prepareResetProjection = original; };
      } else if (fault === 'scoreboard-projection') {
        const original = game.scoreboard.prepareActiveProjection.bind(game.scoreboard);
        game.scoreboard.prepareActiveProjection = (...args) => { original(...args); throw new Error('scoreboard projection after-draw fault'); };
        restoreFault = () => { game.scoreboard.prepareActiveProjection = original; };
      } else {
        const original = fast.resetEffect.bind(fast);
        fast.resetEffect = () => { original(); throw new Error('terminal commit after-module fault'); };
        restoreFault = () => { fast.resetEffect = original; };
      }
      expect(game.keyDown('KeyR', false)).toBe(true);
      for (let index = 0; index < 50 && game.state.phase.kind === 'retry-presentation'; index += 1) game.update(0.1);
      expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage1' }); expect(game.gameOver.root.hidden).toBe(false);
      expect(fast.fuelSeconds).toBe(failureFuel); expect(fast.recoverySeconds).toBe(failureRecovery);
      expect(game.submissionDock.submittedBreadCount).toBe(2); expect(game.state.submittedBreadCount).toBe(2);
      expect(game.score.snapshot()).toEqual(score); expect(game.state.remainingSeconds).toBe(timer); expect(game.wheatSource.readTimerSeconds()).toBe(wheatTimer);
      restoreFault(); expect(game.keyDown('KeyR', false)).toBe(true);
      for (let index = 0; index < 50 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
      expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage1' }); expect(fast.fuelSeconds).toBe(CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds);
      expect(game.submissionDock.submittedBreadCount).toBe(0); expect(game.state.submittedBreadCount).toBe(0); game.dispose();
    }
  });

  it('rejects omitted or one-sided stale reset receipts before any authoritative mutation', () => {
    for (const fault of ['omitted-reset-step', 'lost-dock-receipt', 'lost-scoreboard-receipt'] as const) {
      const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
        tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
        scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
      reachStage1(game); const fast = game.modules[0]!; fast.fuelSeconds = 3.25; game.submissionDock.submit(2); game.state.submittedBreadCount = 2;
      game.update(100); for (let index = 0; index < 40 && game.state.phase.kind !== 'game-over'; index += 1) game.update(0.1);
      const failureFuel = fast.fuelSeconds;
      const score = game.score.snapshot(); const timer = game.state.remainingSeconds; const wheatTimer = game.wheatSource.readTimerSeconds();
      expect(game.keyDown('KeyR', false)).toBe(true);
      const owner = game.presentation as unknown as { queue: Array<import('./presentation/PresentationPlayer').PresentationStep>; current: import('./presentation/PresentationPlayer').PresentationStep | null };
      let restoreProjectionFault = () => undefined;
      if (fault === 'omitted-reset-step') {
        const index = owner.queue.findIndex((step) => step.id.includes('reset-projection')); expect(index).toBeGreaterThanOrEqual(0); owner.queue.splice(index, 1);
      } else {
        if (fault === 'lost-dock-receipt') {
          const prepare = game.submissionDock.prepareResetProjection.bind(game.submissionDock);
          game.submissionDock.prepareResetProjection = () => { const receipt = prepare(); game.submissionDock.cancelPreparedReset(receipt); return receipt; };
          restoreProjectionFault = () => { game.submissionDock.prepareResetProjection = prepare; };
        } else {
          const prepare = game.scoreboard.prepareActiveProjection.bind(game.scoreboard);
          game.scoreboard.prepareActiveProjection = (...args) => { const receipt = prepare(...args); game.scoreboard.cancelPreparedActiveProjection(receipt); return receipt; };
          restoreProjectionFault = () => { game.scoreboard.prepareActiveProjection = prepare; };
        }
      }
      const mutations = { module: 0, dock: 0, stateSubmitted: 0, score: 0, timer: 0, wheat: 0 };
      const moduleResets = game.modules.map((module) => ({ module, reset: module.resetEffect.bind(module) }));
      for (const saved of moduleResets) saved.module.resetEffect = () => { mutations.module += 1; saved.reset(); };
      const dockCommit = game.submissionDock.commitPreparedReset.bind(game.submissionDock);
      game.submissionDock.commitPreparedReset = (receipt) => { mutations.dock += 1; dockCommit(receipt); };
      const submittedDescriptor = Object.getOwnPropertyDescriptor(game.state, 'submittedBreadCount')!;
      let submittedValue = game.state.submittedBreadCount;
      Object.defineProperty(game.state, 'submittedBreadCount', { configurable: true, enumerable: submittedDescriptor.enumerable,
        get: () => submittedValue, set: (value: number) => { mutations.stateSubmitted += 1; submittedValue = value; } });
      const scoreRestore = game.score.restore.bind(game.score);
      game.score.restore = (value) => { mutations.score += 1; scoreRestore(value); };
      const timerReset = game.state.setRemainingSeconds.bind(game.state);
      game.state.setRemainingSeconds = (value) => { mutations.timer += 1; timerReset(value); };
      const wheatReset = game.wheatSource.beginAttempt.bind(game.wheatSource);
      game.wheatSource.beginAttempt = () => { mutations.wheat += 1; wheatReset(); };
      for (let index = 0; index < 50 && game.state.phase.kind === 'retry-presentation'; index += 1) game.update(0.1);
      expect(game.state.phase).toEqual({ kind: 'game-over', stage: 'stage1' }); expect(game.gameOver.root.hidden).toBe(false);
      expect(mutations).toEqual({ module: 1, dock: 0, stateSubmitted: 0, score: 0, timer: 0, wheat: 0 });
      expect(fast.fuelSeconds).toBe(failureFuel); expect(game.submissionDock.submittedBreadCount).toBe(2); expect(game.state.submittedBreadCount).toBe(2);
      expect(game.score.snapshot()).toEqual(score); expect(game.state.remainingSeconds).toBe(timer); expect(game.wheatSource.readTimerSeconds()).toBe(wheatTimer);
      restoreProjectionFault();
      for (const saved of moduleResets) saved.module.resetEffect = saved.reset;
      game.submissionDock.commitPreparedReset = dockCommit;
      Object.defineProperty(game.state, 'submittedBreadCount', { ...submittedDescriptor, value: submittedValue });
      game.score.restore = scoreRestore; game.state.setRemainingSeconds = timerReset; game.wheatSource.beginAttempt = wheatReset;
      expect(game.keyDown('KeyR', false)).toBe(true); for (let index = 0; index < 50 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
      expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage1' }); expect(game.submissionDock.submittedBreadCount).toBe(0); game.dispose();
    }
  });

  it('keeps ordinary active-scoreboard steady frames free of receipt generations and redraws', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); game.update(0);
    const before = game.scoreboard.readActiveProjectionDiagnostics();
    for (let frame = 0; frame < 600; frame += 1) game.update(0);
    expect(game.scoreboard.readActiveProjectionDiagnostics()).toEqual(before);
    game.update(1.01);
    const afterEdge = game.scoreboard.readActiveProjectionDiagnostics();
    expect(afterEdge.receiptGeneration).toBe(before.receiptGeneration);
    expect(afterEdge.centralDrawCount).toBe(before.centralDrawCount + 1);
    game.dispose();
  });

  it('uses one atlas-only prompt and Space press1/move-without-hold/press2 ownership with no retired socket rings', () => {
    const scene = new THREE.Scene(); const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene, camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game);
    const keycap = scene.getObjectByName('campaign-world-keycap')!;
    expect(keycap.children).toHaveLength(1); expect(keycap.children[0]?.name).toBe('campaign-approved-atlas-keycap-plane');
    expect(keycap.children[0]).toBeInstanceOf(THREE.Mesh); expect((keycap.children[0] as THREE.Mesh).geometry).toBeInstanceOf(THREE.PlaneGeometry);
    let rings = 0; scene.traverse((node) => { if (node instanceof THREE.Mesh && node.geometry instanceof THREE.RingGeometry) rings += 1; }); expect(rings).toBe(0);
    const block = game.blocks[0]!; moveToBlockSide(game, block, 'left');
    tap(game, 'Space'); expect(game.player.heldBlockId).toBe(block.id); expect(game.interactionKeycap.label).toBe('SPACE');
    const before = block.root.position.x; game.keyDown('ArrowRight', false); game.update(0.08); game.keyUp('ArrowRight');
    expect(block.root.position.x).toBeGreaterThan(before); expect(game.player.heldBlockId).toBe(block.id);
    game.keyDown('Space', true); game.update(0.016); expect(game.player.heldBlockId).toBe(block.id);
    tap(game, 'Space'); expect(game.player.heldBlockId).toBeNull();
    moveTo(game, CAMPAIGN_MAP_BOUNDS.maxX - 0.5, 3); tap(game, 'Space'); expect(game.player.heldBlockId).toBeNull(); game.dispose();
  });

  it('admits Fast ready before world interaction, preserves it through pickup, recovers idle, consumes active, and resets ready', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); game.state.setRemainingSeconds(100); const fast = game.modules.find((module) => module.type === 'fast')!;
    expect(fast.location.kind).toBe('world'); expect(fast.fuelSeconds).toBe(CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds);
    expect(colorDistance(moduleBodyColor(fast), new THREE.Color(CAMPAIGN_CONFIG.modules.fast.fullFuelColor))).toBeLessThan(1e-6);
    const fill = fast.root.getObjectByName('campaign-module-fast-gauge-fill')!; expect(fill.scale.x).toBe(1);
    const initial = fast.root.getWorldPosition(new THREE.Vector3()); moveTo(game, initial.x, initial.z); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds + 0.01);
    expect(game.player.heldModule).toBe(fast); expect(fast.fuelSeconds).toBe(CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds); expect(fill.scale.x).toBe(1);
    moveTo(game, -1.5, 2.8); game.update(0.016); const target = heldModuleDropTarget(game); expect(target?.kind).toBe('floor-drop');
    const landing = target?.landing.clone() ?? new THREE.Vector3(); tap(game, 'KeyQ'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds);
    expect(fast.root.getWorldPosition(new THREE.Vector3()).distanceTo(landing)).toBeLessThan(1e-6); expect(fast.root.getWorldPosition(new THREE.Vector3()).distanceTo(initial)).toBeGreaterThan(0.5);
    moveTo(game, landing.x, landing.z); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds + 0.01); expect(game.player.heldModule).toBe(fast);
    const socket = game.blocks[0]!.sockets[0]; const socketPosition = socket.readWorldPosition(new THREE.Vector3()); moveTo(game, socketPosition.x, socketPosition.z); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds);
    expect(socket.module).toBe(fast); expect(fast.fuelSeconds).toBe(CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds);
    const compareFastSplit = (fuel: number, recovery: number, expectedProcessing: number): void => {
      const block = game.blocks[0]!; block.processingSeconds = 0; fast.fuelSeconds = fuel; fast.recoverySeconds = recovery; game.update(0.1);
      const direct = [fast.fuelSeconds, fast.recoverySeconds, readProductionModifiers(block, CAMPAIGN_CONFIG).processingSpeedMultiplier, block.processingSeconds];
      block.processingSeconds = 0; fast.fuelSeconds = fuel; fast.recoverySeconds = recovery; game.update(0.05); game.update(0.05);
      expect(fast.fuelSeconds).toBeCloseTo(direct[0]!, 10); expect(fast.recoverySeconds).toBeCloseTo(direct[1]!, 10);
      expect(readProductionModifiers(block, CAMPAIGN_CONFIG).processingSpeedMultiplier).toBe(direct[2]);
      expect(direct[3]).toBeCloseTo(expectedProcessing, 10); expect(block.processingSeconds).toBeCloseTo(expectedProcessing, 10);
    };
    game.blocks[0]!.storedMaterialIds.push('boundary-wheat'); compareFastSplit(0.05, 0, 0.14);
    expect(fast.recoverySeconds).toBeCloseTo(5.95, 10); expect(readProductionModifiers(game.blocks[0]!, CAMPAIGN_CONFIG).processingSpeedMultiplier).toBe(1);
    const nearFullRecoverySeconds = 0.025; compareFastSplit(8 - (8 / 6) * nearFullRecoverySeconds, nearFullRecoverySeconds, 0.16);
    expect(fast.fuelSeconds).toBeCloseTo(7.925, 10); expect(fast.recoverySeconds).toBe(0);
    game.blocks[0]!.storedMaterialIds.length = 0; game.blocks[0]!.processingSeconds = 0;
    fast.fuelSeconds = 0.1; fast.recoverySeconds = 0; game.blocks[0]!.storedMaterialIds.push('effect-wheat'); game.update(0.1);
    expect(fast.fuelSeconds).toBe(0); expect(fast.recoverySeconds).toBe(CAMPAIGN_CONFIG.modules.fast.recoverySeconds); expect(fill.scale.x).toBe(0);
    expect(readProductionModifiers(game.blocks[0]!, CAMPAIGN_CONFIG).processingSpeedMultiplier).toBe(1); game.update(1);
    expect(game.blocks[0]!.processingSeconds).toBeGreaterThan(0); expect(fast.fuelSeconds).toBeCloseTo(8 / 6, 6); expect(fast.recoverySeconds).toBe(5);
    expect(readProductionModifiers(game.blocks[0]!, CAMPAIGN_CONFIG).processingSpeedMultiplier).toBe(1);
    game.blocks[0]!.storedMaterialIds.length = 0; game.presentation.finishImmediately(); moveToSocketInteraction(game, game.blocks[0]!, socket); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds);
    expect(fast.location.kind).toBe('held'); const heldStart = fast.fuelSeconds; game.update(1);
    expect(fast.fuelSeconds - heldStart).toBeCloseTo(CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds / CAMPAIGN_CONFIG.modules.fast.recoverySeconds, 6);
    const heldMidpoint = fast.fuelSeconds; game.setPaused(true); game.update(1); expect(fast.fuelSeconds).toBeCloseTo(heldMidpoint, 8); game.setPaused(false);
    moveTo(game, -2.5, 2.8); game.update(0.016); const worldTarget = heldModuleDropTarget(game); expect(worldTarget?.kind).toBe('floor-drop');
    const worldLanding = worldTarget?.landing.clone() ?? new THREE.Vector3(); tap(game, 'KeyQ'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds);
    expect(fast.location.kind).toBe('world'); fast.fuelSeconds = 0; fast.recoverySeconds = CAMPAIGN_CONFIG.modules.fast.recoverySeconds; const worldStart = fast.fuelSeconds; game.update(1);
    expect(fast.fuelSeconds - worldStart).toBeCloseTo(CAMPAIGN_CONFIG.modules.fast.maxFuelSeconds / CAMPAIGN_CONFIG.modules.fast.recoverySeconds, 6);
    moveTo(game, worldLanding.x, worldLanding.z); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds); expect(fast.location.kind).toBe('held');
    moveTo(game, socketPosition.x, socketPosition.z); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds); expect(fast.location.kind).toBe('socket');
    game.update(CAMPAIGN_CONFIG.modules.fast.recoverySeconds); expect(fast.fuelSeconds).toBe(8); expect(fill.scale.x).toBe(1);
    game.blocks[0]!.storedMaterialIds.push('effect-wheat-2'); game.update(0.5); expect(fast.fuelSeconds).toBeCloseTo(7.5, 6);
    game.blocks[0]!.storedMaterialIds.length = 0; game.update(0.5); expect(fast.fuelSeconds).toBe(8); expect(fill.scale.x).toBe(1);
    game.update(100); for (let index = 0; index < 40 && game.state.phase.kind !== 'game-over'; index += 1) game.update(0.1);
    expect(game.keyDown('KeyR', false)).toBe(true); for (let index = 0; index < 40 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
    expect(fast.location.kind).toBe('socket'); expect(fast.fuelSeconds).toBe(8); expect(fill.scale.x).toBe(1); game.dispose();
  });

  it('commits new collision-safe world landings and public re-pickup for Fast, Double, and Again', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); completeCurrentStage(game, 5); completeCurrentStage(game, 10);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage3' });
    relocateWorldModule(game, game.modules[0]!, 0); relocateWorldModule(game, game.modules[1]!, 1); relocateWorldModule(game, game.modules[2]!, 2);
    expect(game.modules.every((module) => module.location.kind === 'world' && module.root.parent !== null)).toBe(true); game.dispose();
  });

  it('keeps the introduced Double clock split-invariant across public world, held, and socket ownership', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); completeCurrentStage(game, 5); const double = game.modules.find((module) => module.type === 'double')!;
    expect(double.location.kind).toBe('world');
    const compareSplit = (charge: number, active: number): void => {
      double.chargeSeconds = charge; double.activeSeconds = active; game.update(0.1); const direct = [double.chargeSeconds, double.activeSeconds];
      double.chargeSeconds = charge; double.activeSeconds = active; game.update(0.05); game.update(0.05);
      expect(double.chargeSeconds).toBeCloseTo(direct[0]!, 10); expect(double.activeSeconds).toBeCloseTo(direct[1]!, 10);
    };
    compareSplit(8.95, 0); expect(double.activeSeconds).toBeCloseTo(4.45, 10);
    const world = double.root.getWorldPosition(new THREE.Vector3()); moveTo(game, world.x, world.z); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds);
    expect(double.location.kind).toBe('held'); compareSplit(0, 0.05); expect(double.chargeSeconds).toBeCloseTo(0.05, 10);
    const socket = game.blocks[0]!.sockets[0]; const seat = socket.readWorldPosition(new THREE.Vector3()); moveTo(game, seat.x, seat.z); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds);
    expect(socket.module).toBe(double); compareSplit(8.95, 0); expect(double.activeSeconds).toBeCloseTo(4.45, 10);
    expect(readProductionModifiers(game.blocks[0]!, CAMPAIGN_CONFIG).outputCount).toBe(2);
    game.presentation.finishImmediately(); moveToSocketInteraction(game, game.blocks[0]!, socket); tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds);
    expect(double.location.kind).toBe('held'); expect(readProductionModifiers(game.blocks[0]!, CAMPAIGN_CONFIG).outputCount).toBe(1); game.dispose();
  });

  it('uses the approved dock icon identity and shows earned CLEAR components one at a time in ledger order', () => {
    const scene = new THREE.Scene(); const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene, camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    expect(scene.getObjectByName('campaign-compact-goal-board')).toBeUndefined();
    const dockBoard = scene.getObjectByName('i9-dock-goal-scoreboard')!;
    expect(dockBoard.userData.breadPictogramSource).toBe('i9-compact-goal-bread-pictogram-v001'); expect(dockBoard.userData.typography).toMatchObject({ family: 'Galmuri11', weight: 900 });
    reachStage1(game); const delivery = game.submissionDock.readGameplayPosition(new THREE.Vector3());
    for (let index = 0; index < 5; index += 1) game.materials.create('bread', delivery); game.update(0.016); expect(game.state.phase.kind).toBe('clear-presentation');
    expect(game.submissionDock.readGoalBoardProjectionDiagnostics()).toMatchObject({ numbersVisible: false, numericText: '' });
    expect(dockBoard.visible).toBe(true); expect(game.submissionDock.root.visible).toBe(true); expect(game.submissionDock.goalScoreboard.panel.visible).toBe(true);
    const dockIdentity = dockBoard; const auxiliaryIdentity = game.scoreboard.auxiliary.root;
    const owner = game.presentation as unknown as { current: import('./presentation/PresentationPlayer').PresentationStep | null; elapsedSeconds: number };
    for (let index = 0; index < 30 && !owner.current?.id.includes('physical-scoreboard-lifecycle'); index += 1) game.update(0.1);
    expect(owner.current?.id).toContain('physical-scoreboard-lifecycle'); game.update(0.01);
    expect(game.scoreboard.auxiliary.root.userData.earnedComponent).toEqual({ label: 'BREAD', score: 500 });
    game.update(0.28 + CAMPAIGN_CONFIG.presentation.scoreCountSeconds * 0.65);
    const second = game.scoreboard.auxiliary.root.userData.earnedComponent as { label: string; score: number };
    expect(second.label).toBe('TIME BONUS'); expect(second.score).toBe(game.score.snapshot().stage1Score - 500);
    expect(game.scoreboard.central.root.userData.typography).toMatchObject({ family: 'Galmuri11', weight: 900 });
    expect(game.scoreboard.auxiliary.root.userData.typography).toMatchObject({ family: 'Galmuri11', weight: 900 });
    expect(Array.isArray(second)).toBe(false);
    const lowerStart = 0.28 + CAMPAIGN_CONFIG.presentation.scoreCountSeconds + CAMPAIGN_CONFIG.presentation.scoreHoldSeconds + 0.36;
    game.update(Math.max(0, lowerStart - owner.elapsedSeconds));
    const lowerYs: number[] = [];
    for (let sample = 0; sample < 3; sample += 1) {
      game.update(0.28 * 0.25); expect(game.scoreboard.auxiliary.root).toBe(auxiliaryIdentity);
      expect(game.scoreboard.auxiliary.root.visible).toBe(true); lowerYs.push(game.scoreboard.auxiliary.root.position.y);
      expect(game.scoreboard.auxiliary.root.userData.earnedComponent).toEqual(second);
      expect(scene.getObjectByName('i9-dock-goal-scoreboard')).toBe(dockIdentity);
    }
    expect(lowerYs[1]!).toBeLessThan(lowerYs[0]!); expect(lowerYs[2]!).toBeLessThan(lowerYs[1]!);
    game.update(Math.max(0, (owner.current?.durationSeconds ?? 0) - owner.elapsedSeconds)); expect(game.scoreboard.auxiliary.root.visible).toBe(false);
    expect(game.scoreboard.auxiliary.root.position.y).toBeCloseTo(1.385 - 1.55 * 0.25 * 0.5, 8);
    for (let index = 0; index < 100 && game.state.phase.kind !== 'playing'; index += 1) game.update(0.1);
    expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage2' });
    expect(game.submissionDock.readGoalBoardProjectionDiagnostics()).toMatchObject({ numbersVisible: true, numericText: '0 / 10' });
    completeCurrentStage(game, 10); expect(game.state.phase).toEqual({ kind: 'playing', stage: 'stage3' });
    expect(game.submissionDock.readGoalBoardProjectionDiagnostics()).toMatchObject({ numbersVisible: true, numericText: '0 / 40' });
    completeCurrentStage(game, 40); expect(game.state.phase.kind).toBe('final-score');
    expect(game.submissionDock.readGoalBoardProjectionDiagnostics()).toMatchObject({ numbersVisible: false, numericText: '' });
    expect(scene.getObjectByName('i9-dock-goal-scoreboard')).toBe(dockIdentity);
    game.dispose();
  });

  it('consumes production movement speeds, timed tap, dual Shift, and lifecycle cleanup through public input', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    const walkStart = game.player.position.x; game.keyDown('ArrowRight', false); game.update(0.1); game.keyUp('ArrowRight');
    expect(game.player.position.x - walkStart).toBeCloseTo(0.34, 8);
    game.keyDown('ShiftLeft', false); game.keyDown('ShiftRight', false); game.keyUp('ShiftLeft');
    const runStart = game.player.position.x; game.keyDown('ArrowRight', false); game.update(0.1); game.keyUp('ArrowRight');
    expect(game.player.position.x - runStart).toBeCloseTo(0.51, 8);
    game.keyUp('ShiftRight'); const tapStart = game.player.position.x;
    game.keyDown('ArrowRight', false, 1000); game.keyUp('ArrowRight', 1119); game.update(0.016);
    expect(game.player.position.x - tapStart).toBeCloseTo(0.18, 8);
    game.keyDown('ShiftLeft', false); game.keyDown('ShiftRight', false); game.setPaused(true); game.setPaused(false);
    const cleanupStart = game.player.position.x; game.keyDown('ArrowRight', false); game.update(0.1); game.keyUp('ArrowRight');
    expect(game.player.position.x - cleanupStart).toBeCloseTo(0.34, 8);
    game.keyDown('ArrowRight', false); game.update(20); game.keyUp('ArrowRight'); const boundary = game.player.position.x;
    game.keyDown('ArrowRight', false, 2000); game.keyUp('ArrowRight', 2050); game.update(0.016);
    expect(game.player.position.x).toBe(boundary); game.dispose();
  });

  it('consumes block quick taps once and gives simultaneous Space plus E to one block action', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); game.state.setRemainingSeconds(300);
    const block = game.blocks[0]!; moveToBlockSide(game, block, 'left');
    const material = game.materials.create('bread', new THREE.Vector3(block.root.position.x, 0, block.root.position.z));
    game.keyDown('Space', false); game.keyDown('KeyE', false); game.update(0.016);
    game.keyUp('KeyE');
    expect(game.player.heldBlockId).toBe(block.id); expect(game.player.heldMaterialIds).toHaveLength(0); expect(material.location).toBe('world');
    const before = block.root.position.x; game.keyDown('ArrowRight', false, 1000); game.keyUp('ArrowRight', 1119); game.update(0.016);
    expect(block.root.position.x - before).toBeCloseTo(CAMPAIGN_CONFIG.movement.tapMinimumDistanceMeters, 8);
    const afterTap = block.root.position.x; game.update(0.016); expect(block.root.position.x).toBe(afterTap);
    const beforeVerticalTap = game.player.position.y;
    game.keyDown('ArrowUp', false, 2000); game.keyUp('ArrowUp', 2119); game.update(0.016);
    expect(block.root.position.x).toBe(afterTap); expect(game.player.heldBlockId).toBeNull(); expect(game.player.position.y).toBeLessThan(beforeVerticalTap);
    moveToBlockSide(game, block, 'left'); tap(game, 'Space'); expect(game.player.heldBlockId).toBe(block.id);
    game.keyDown('ShiftLeft', false); game.keyDown('ArrowLeft', false, 3000); game.keyUp('ArrowLeft', 3119); game.update(0.016);
    expect(afterTap - block.root.position.x).toBeCloseTo(CAMPAIGN_CONFIG.movement.tapMinimumDistanceMeters, 8);
    game.keyUp('ShiftLeft'); game.keyDown('Space', false); game.update(0.016); expect(game.player.heldBlockId).toBeNull(); game.dispose();
  });

  it('publishes one block action and leaves no hidden E action when a socket module is also reachable', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); game.state.setRemainingSeconds(300); const block = game.blocks[0]!; const fast = game.modules[0]!;
    attachWorldModule(game, fast, block); game.presentation.finishImmediately();
    moveToBlockSide(game, block, 'left');
    expect(game.interactionKeycap.label).toBe('SPACE'); expect(game.interactionKeycap.root.position.x).toBeCloseTo(block.root.position.x, 8);
    tap(game, 'KeyE'); expect(block.sockets[0].module).toBe(fast); expect(game.player.heldModule).toBeNull();
    tap(game, 'Space'); expect(game.player.heldBlockId).toBe(block.id); expect(block.sockets[0].module).toBe(fast); game.dispose();
  });

  it('retires every block-contact tuple and restores collision-legal movement across repeated public Space cycles', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); game.state.setRemainingSeconds(300); const block = game.blocks[0]!;
    for (let index = 0; index < 10; index += 1) {
      moveToBlockSide(game, block, 'left'); tap(game, 'Space');
      expect(game.player.heldBlockId).toBe(block.id); const direction = index % 2 === 0 ? 'ArrowRight' : 'ArrowLeft';
      const blockStart = block.root.position.x; game.keyDown(direction, false); game.update(0.02); game.keyUp(direction);
      expect(block.root.position.x).not.toBeCloseTo(blockStart, 8); tap(game, 'Space'); expect(game.player.heldBlockId).toBeNull();
      const internals = game as unknown as { activeBlock: CampaignGame['blocks'][number] | null; carriedBlockStart: THREE.Vector3 | null; activeBlockPlayerLaneZ: number; activeBlockPlayerOffsetX: number };
      expect(internals.activeBlock).toBeNull(); expect(internals.carriedBlockStart).toBeNull();
      expect(internals.activeBlockPlayerLaneZ).toBe(0); expect(internals.activeBlockPlayerOffsetX).toBe(0);
      const playerStart = game.player.position.clone(); game.keyDown('ArrowDown', false); game.update(0.02); game.keyUp('ArrowDown');
      expect(game.player.position.y).toBeGreaterThan(playerStart.y); expect(game.player.root.position.x).toBeCloseTo(game.player.position.x, 8);
      expect(game.player.root.position.z).toBeCloseTo(game.player.position.y, 8);
    }
    game.dispose();
  });

  it('settles the same material root and hides all actions during ordinary module motion', () => {
    const scene = new THREE.Scene(); const game = new CampaignGame({ document: fakeDocument, window: fakeWindow,
      mount: new FakeElement() as unknown as HTMLElement, tutorialSurface: new FakeElement() as unknown as HTMLElement,
      canvas: new FakeElement() as unknown as HTMLCanvasElement, scene, camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    const bread = game.materials.create('bread', new THREE.Vector3(game.player.position.x + 0.5, 0, game.player.position.y));
    const root = bread.root; moveTo(game, root.position.x, root.position.z); game.update(0.016); tap(game, 'KeyE');
    expect(bread.root).toBe(root); expect(bread.location).toBe('held'); expect(bread.presentationRoot.position.length()).toBeGreaterThan(0);
    game.update(CAMPAIGN_CONFIG.materialPresentation.heldTransferSeconds / 2); expect(bread.presentationRoot.position.length()).toBeGreaterThan(0);
    game.update(CAMPAIGN_CONFIG.materialPresentation.heldTransferSeconds / 2); expect(bread.presentationRoot.position.length()).toBeLessThan(1e-8);
    moveTo(game, -8, 3); tap(game, 'KeyQ'); expect(bread.location).toBe('world'); expect(bread.root).toBe(root); expect(bread.presentationRoot.position.length()).toBeGreaterThan(0);
    const landing = bread.root.getWorldPosition(new THREE.Vector3()); game.update(MATERIAL_FLOOR_DROP_DURATION_SECONDS);
    expect(bread.presentationRoot.position.length()).toBeLessThan(1e-8); expect(bread.root.getWorldPosition(new THREE.Vector3())).toEqual(landing);
    reachStage1(game); const fast = game.modules[0]!; const position = fast.root.getWorldPosition(new THREE.Vector3()); moveTo(game, position.x, position.z); tap(game, 'KeyE');
    expect(game.presentation.active).toBe(true); expect(game.interactionKeycap.label).toBeNull(); game.keyDown('Space', false); game.update(0.016);
    expect(game.player.heldBlockId).toBeNull(); game.presentation.finishImmediately(); game.update(0.016);
    expect(game.interactionKeycap.label).toBeNull(); expect(game.interactionKeycap.root.visible).toBe(false); game.dispose();
  });

  it('terminalizes the visible material child before GAME OVER retry and CLEAR suction take ownership', () => {
    const make = (): CampaignGame => new CampaignGame({ document: fakeDocument, window: fakeWindow,
      mount: new FakeElement() as unknown as HTMLElement, tutorialSurface: new FakeElement() as unknown as HTMLElement,
      canvas: new FakeElement() as unknown as HTMLCanvasElement, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    const retryGame = make(); reachStage1(retryGame); retryGame.state.setRemainingSeconds(0.01);
    const held = retryGame.materials.create('wheat', new THREE.Vector3(retryGame.player.position.x + 0.4, 0, retryGame.player.position.y));
    tap(retryGame, 'KeyE'); expect(held.presentationRoot.position.length()).toBeGreaterThan(0); retryGame.update(0.02);
    retryGame.presentation.finishImmediately(); expect(retryGame.state.phase.kind).toBe('game-over'); retryGame.keyDown('KeyR', false);
    expect(held.presentationRoot.position.length()).toBe(0); expect(held.presentationRoot.quaternion.equals(new THREE.Quaternion())).toBe(true);
    expect(held.presentationRoot.scale.equals(new THREE.Vector3(1, 1, 1))).toBe(true);
    const retryRootStart = held.root.position.clone(); retryGame.update(0.1); expect(held.root.position.equals(retryRootStart)).toBe(false);
    expect(held.presentationRoot.position.length()).toBe(0); retryGame.dispose();

    const clearGame = make(); reachStage1(clearGame); clearGame.state.setRemainingSeconds(300); moveTo(clearGame, 0, 3.2);
    const dropped = clearGame.materials.create('bread', new THREE.Vector3(clearGame.player.position.x + 0.4, 0, clearGame.player.position.y));
    tap(clearGame, 'KeyE'); clearGame.update(CAMPAIGN_CONFIG.materialPresentation.heldTransferSeconds); moveTo(clearGame, -2, 3.2); tap(clearGame, 'KeyQ');
    expect(dropped.location).toBe('world'); expect(dropped.presentationRoot.position.length()).toBeGreaterThan(0);
    for (let index = 0; index < 5; index += 1) clearGame.materials.create('bread', clearGame.submissionDock.readGameplayPosition(new THREE.Vector3()));
    clearGame.update(0.016); expect(clearGame.state.phase.kind).toBe('clear-presentation'); expect(dropped.presentationRoot.position.length()).toBe(0);
    expect(dropped.presentationRoot.quaternion.equals(new THREE.Quaternion())).toBe(true); expect(dropped.presentationRoot.scale.equals(new THREE.Vector3(1, 1, 1))).toBe(true);
    const clearRootStart = dropped.root.position.clone(); let observedSuction = false;
    for (let index = 0; index < 50 && dropped.root.parent !== null; index += 1) {
      clearGame.update(0.1); expect(dropped.presentationRoot.position.length()).toBe(0);
      if (!dropped.root.position.equals(clearRootStart)) { observedSuction = true; break; }
    }
    expect(observedSuction).toBe(true); clearGame.dispose();
  });

  it('uses actual intake surfaces, keeps more than 120 materials, and selects E targets without category priority', () => {
    const game = new CampaignGame({ document: fakeDocument, window: fakeWindow, mount: new FakeElement() as unknown as HTMLElement,
      tutorialSurface: new FakeElement() as unknown as HTMLElement, canvas: new FakeElement() as unknown as HTMLCanvasElement,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), assets: fakeAssets });
    reachStage1(game); game.state.setRemainingSeconds(300);
    const radius = CAMPAIGN_CONFIG.interaction.automaticIntakeRadiusMeters; const half = CAMPAIGN_CONFIG.movement.blockHalfExtentMeters;
    const mill = game.blocks[0]!; const heater = game.blocks[1]!;
    const wheatAt = game.materials.create('wheat', new THREE.Vector3(mill.root.position.x, 0, mill.root.position.z + half + radius));
    const wheatPast = game.materials.create('wheat', new THREE.Vector3(mill.root.position.x, 0, mill.root.position.z + half + radius + 0.01));
    const flourAt = game.materials.create('flour', new THREE.Vector3(heater.root.position.x, 0, heater.root.position.z + half + radius));
    const flourPast = game.materials.create('flour', new THREE.Vector3(heater.root.position.x, 0, heater.root.position.z + half + radius + 0.01));
    const dockBounds = game.submissionDock.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
    const dockX = (dockBounds.minX + dockBounds.maxX) * 0.5;
    const breadAt = game.materials.create('bread', new THREE.Vector3(dockX, 0, dockBounds.maxZ + radius));
    const breadPast = game.materials.create('bread', new THREE.Vector3(dockX, 0, dockBounds.maxZ + radius + 0.01));
    game.update(0.016);
    expect(mill.storedMaterialIds).toContain(wheatAt.id); expect(wheatPast.location).toBe('world');
    expect(heater.storedMaterialIds).toContain(flourAt.id); expect(flourPast.location).toBe('world');
    expect(breadAt.location).toBe('submitted'); expect(breadPast.location).toBe('world');

    const fast = game.modules.find((module) => module.type === 'fast')!; const fastPosition = fast.root.getWorldPosition(new THREE.Vector3());
    moveTo(game, fastPosition.x, fastPosition.z + 1);
    const safeType = [
      { type: 'wheat' as const, distance: mill.distanceToIntakeSurface(game.player.position.x, game.player.position.y) },
      { type: 'flour' as const, distance: heater.distanceToIntakeSurface(game.player.position.x, game.player.position.y) },
      { type: 'bread' as const, distance: game.submissionDock.distanceToIntakeSurface(game.player.position.x, game.player.position.y) },
    ].sort((left, right) => right.distance - left.distance)[0]!;
    expect(safeType.distance).toBeGreaterThan(radius);
    const closerMaterial = game.materials.create(safeType.type, new THREE.Vector3(game.player.position.x, 0, game.player.position.y));
    game.update(0.016); expect(game.interactionKeycap.label).toBe('E');
    expect(game.interactionKeycap.root.position.x).toBeCloseTo(closerMaterial.root.position.x, 8);
    expect(game.interactionKeycap.root.position.z).toBeCloseTo(closerMaterial.root.position.z, 8); tap(game, 'KeyE');
    expect(game.player.heldMaterialIds).toContain(closerMaterial.id); expect(fast.location.kind).toBe('world');
    moveTo(game, 0, 3.2); tap(game, 'KeyQ'); moveTo(game, fastPosition.x, fastPosition.z + 1);
    const fartherMaterial = game.materials.create(safeType.type, fastPosition.clone()); game.update(0.016);
    expect(game.interactionKeycap.root.position.x).toBeCloseTo(fast.root.getWorldPosition(new THREE.Vector3()).x, 8);
    expect(game.interactionKeycap.root.position.z).toBeCloseTo(fast.root.getWorldPosition(new THREE.Vector3()).z, 8);
    tap(game, 'KeyE'); game.update(CAMPAIGN_CONFIG.presentation.moduleInsertSeconds);
    expect(game.player.heldModule).toBe(fast); expect(fartherMaterial.location).toBe('world');

    for (let index = 0; index < 121; index += 1) game.materials.create('flour', new THREE.Vector3(-1 + (index % 3) * 0.02, 0, 3.4));
    const retained = game.materials.all().filter((material) => material.type === 'flour' && material.root.position.z > 3.3).map((material) => material.id);
    game.update(0.016); expect(retained).toHaveLength(121); expect(retained.every((id) => game.materials.get(id)?.location === 'world')).toBe(true);
    game.dispose();
  });
});
