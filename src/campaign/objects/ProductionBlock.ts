import * as THREE from 'three';
import type { Player } from './Player';
import type { Module } from './Module';
import type { CampaignCollisionBounds } from './CampaignMap';
import { CAMPAIGN_CONFIG } from '../CampaignConfig';
import { CAMPAIGN_SCOREBOARD_TYPOGRAPHY } from '../presentation/CampaignScoreboardTypography';
import { configureObjectSurfaceTexture, drawObjectSurfaceLabel } from '../presentation/ObjectSurfaceLabel';
import type { PresentationStep } from '../presentation/PresentationPlayer';

export type ProductionBlockType = 'mill' | 'heater';
export type SocketIndex = 0 | 1;
export type ProductionBlockVariant = 'socketless' | 'single-socket' | 'double-socket';

export class Socket {
  readonly anchor = new THREE.Group();
  module: Module | null = null; enabled = false;
  private readonly scratch = new THREE.Vector3();
  private readonly quaternionScratch = new THREE.Quaternion();
  constructor(readonly block: ProductionBlock, readonly index: SocketIndex) { this.anchor.name = `${block.id}-socket-${index}`; }
  readWorldPosition(target = this.scratch): THREE.Vector3 { return this.anchor.getWorldPosition(target); }
  readOutwardDirection(target = this.scratch): THREE.Vector3 { return target.set(0, 0, 1).applyQuaternion(this.anchor.getWorldQuaternion(this.quaternionScratch)).normalize(); }
  attach(module: Module, player: Player): boolean { if (!this.enabled || this.module !== null || !module.placeInSocket(this.block, this.index, this.anchor, player)) return false; this.module = module; return true; }
  detach(player: Player): Module | null { const module = this.module; if (module === null || !module.detachTo(player)) return null; this.module = null; return module; }
}

const BLOCK_SURFACE = Object.freeze({
  labelSafeInset: 0.04, labelMaximumHeight: 0.92, surfaceEpsilon: 0.006,
  progressWidth: 1.46, progressHeight: 0.2, capacityFloatOffset: 0.7,
});

function surfaceText(text: string, anisotropy: number): THREE.Mesh {
  if (!Number.isFinite(anisotropy) || anisotropy <= 0) throw new Error('Block label anisotropy capability is invalid.');
  if (typeof document === 'undefined') return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#111111', transparent: true, opacity: 0 }));
  const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 768;
  const context = canvas.getContext('2d'); if (context === null) throw new Error('Block label canvas unavailable.');
  const metrics = drawObjectSurfaceLabel(context, canvas, text, '#111111', null);
  const texture = new THREE.CanvasTexture(canvas); configureObjectSurfaceTexture(texture, anisotropy);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.01, toneMapped: false })); mesh.name = 'campaign-block-function-surface'; mesh.userData.glyphColor = '#111111'; mesh.userData.canvasResolution = '2048x768'; mesh.userData.glyphPixelHeight = metrics.glyphPixelHeight; mesh.userData.measuredPixelWidth = metrics.measuredPixelWidth; mesh.userData.typography = CAMPAIGN_SCOREBOARD_TYPOGRAPHY; return mesh;
}

export class ProductionBlock {
  readonly root = new THREE.Group(); readonly sockets: readonly [Socket, Socket];
  readonly storedMaterialIds: string[] = []; outputMaterialIds: string[] = []; processingSeconds = 0;
  private visual: THREE.Object3D; private currentVariant: ProductionBlockVariant = 'socketless';
  private readonly presentationRoot = new THREE.Group();
  private stage0RevealState: 'hidden' | 'scheduled' | 'revealing' | 'revealed' = 'revealed';
  private readonly progressRoot = new THREE.Group(); private readonly capacityRoot = new THREE.Group(); private readonly interactionPromptAnchor = new THREE.Group(); private readonly functionLabel: THREE.Mesh;
  private readonly progressFill: THREE.Mesh; private readonly capacityCells: readonly THREE.Mesh[];
  private readonly localScratch = new THREE.Vector3(); private readonly rootQ = new THREE.Quaternion(); private readonly authoredQ = new THREE.Quaternion();
  private readonly capacityAuthoredPosition = new THREE.Vector3(); private readonly capacityAuthoredQuaternion = new THREE.Quaternion();
  private readonly capacityPresentationWorldQuaternion = new THREE.Quaternion(); private capacityPresentationFrameActive = false;
  private readonly outputScratch = new THREE.Vector3();
  private readonly outputMouthAuthoredLocal = new THREE.Vector3(); private readonly tokenExitAuthoredLocal = new THREE.Vector3();
  private readonly visualBounds = new THREE.Box3(); private readonly inverseRootMatrix = new THREE.Matrix4();
  private readonly boundsCorner = new THREE.Vector3();

  constructor(readonly id: string, readonly type: ProductionBlockType, position: THREE.Vector3, private readonly visualFactory: (variant: ProductionBlockVariant) => THREE.Object3D,
    labelAnisotropy = 1) {
    this.root.name = `campaign-block-${id}`; this.root.position.copy(position); this.presentationRoot.name = `campaign-block-${id}-presentation`;
    this.visual = this.createVisual('socketless'); this.root.add(this.presentationRoot); this.presentationRoot.add(this.visual);
    const socket0 = new Socket(this, 0); const socket1 = new Socket(this, 1); this.root.add(socket0.anchor, socket1.anchor); this.sockets = Object.freeze([socket0, socket1]);
    this.functionLabel = surfaceText(type === 'mill' ? '분쇄' : '굽기', labelAnisotropy);
    this.progressRoot.name = 'campaign-block-progress'; this.capacityRoot.name = 'campaign-block-capacity'; this.interactionPromptAnchor.name = `campaign-block-${id}-interaction-prompt`;
    this.root.add(this.interactionPromptAnchor);
    const track = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.2, 0.045), new THREE.MeshBasicMaterial({ color: '#263746' })); this.progressRoot.add(track);
    this.progressFill = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.14, 0.05), new THREE.MeshBasicMaterial({ color: type === 'mill' ? '#39d3e0' : '#ff9a4d' })); this.progressFill.position.z = 0.03; this.progressRoot.add(this.progressFill);
    this.capacityCells = Object.freeze(Array.from({ length: 5 }, (_, index) => { const cell = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.024), new THREE.MeshBasicMaterial({ color: '#7e8a86' })); cell.name = `campaign-block-capacity-cell-${index}`; cell.position.x = (index - 2) * 0.29; this.capacityRoot.add(cell); return cell; }));
    this.bindAuthoredSurfaces(); this.updatePresentation(0, 0, 5);
  }
  setVariant(variant: ProductionBlockVariant, enabledSocketCount: 0 | 1 | 2): void {
    if (variant !== this.currentVariant) { const old = this.visual; this.visual = this.createVisual(variant); this.presentationRoot.add(this.visual); old.removeFromParent(); this.currentVariant = variant; this.bindAuthoredSurfaces(); }
    this.sockets[0].enabled = enabledSocketCount >= 1; this.sockets[1].enabled = enabledSocketCount >= 2;
    const anchors = variant === 'single-socket' ? [this.visual.getObjectByName('fastPocketSeat')] : variant === 'double-socket' ? [this.visual.getObjectByName('fastPocketSeatLeft'), this.visual.getObjectByName('fastPocketSeatRight')] : [];
    this.root.updateWorldMatrix(true, true);
    for (let index = 0; index < anchors.length; index += 1) { const authored = anchors[index]; const socket = this.sockets[index]; if (authored === undefined || socket === undefined) throw new Error(`${this.id}: authored socket anchor missing.`); authored.getWorldPosition(this.localScratch); this.root.worldToLocal(this.localScratch); socket.anchor.position.copy(this.localScratch); this.root.getWorldQuaternion(this.rootQ); authored.getWorldQuaternion(this.authoredQ); socket.anchor.quaternion.copy(this.rootQ).invert().multiply(this.authoredQ); }
  }
  moveBy(delta: THREE.Vector3): void { this.root.position.add(delta); }
  readCollisionBounds(target: CampaignCollisionBounds): CampaignCollisionBounds { const half = CAMPAIGN_CONFIG.movement.blockHalfExtentMeters; target.minX = this.root.position.x - half; target.maxX = this.root.position.x + half; target.minZ = this.root.position.z - half; target.maxZ = this.root.position.z + half; return target; }
  distanceToIntakeSurface(x: number, z: number): number {
    const half = CAMPAIGN_CONFIG.movement.blockHalfExtentMeters;
    const dx = Math.max(Math.abs(x - this.root.position.x) - half, 0);
    const dz = Math.max(Math.abs(z - this.root.position.z) - half, 0);
    return Math.hypot(dx, dz);
  }
  readOutputMouthPosition(target = this.outputScratch): THREE.Vector3 { return this.root.localToWorld(target.copy(this.outputMouthAuthoredLocal)); }
  readTokenExitPosition(target = this.outputScratch): THREE.Vector3 { return this.root.localToWorld(target.copy(this.tokenExitAuthoredLocal)); }
  readInteractionPromptRoot(): THREE.Object3D { return this.interactionPromptAnchor; }
  readPresentationRoot(): THREE.Object3D { return this.presentationRoot; }
  get interactionAvailable(): boolean { return this.root.visible && this.stage0RevealState === 'revealed'; }
  hideForStage0Reveal(): void {
    this.stage0RevealState = 'hidden'; this.root.visible = false; this.presentationRoot.visible = false;
    this.presentationRoot.position.set(0, 0, 0); this.presentationRoot.quaternion.identity(); this.presentationRoot.scale.setScalar(1);
  }
  showImmediately(): void {
    this.stage0RevealState = 'revealed'; this.root.visible = true; this.presentationRoot.visible = true;
    this.presentationRoot.position.set(0, 0, 0); this.presentationRoot.quaternion.identity(); this.presentationRoot.scale.setScalar(1);
  }
  createStage0RevealStep(durationSeconds: number, heightMeters: number): PresentationStep | null {
    if (this.stage0RevealState !== 'hidden') return null;
    this.stage0RevealState = 'scheduled';
    const terminalize = (): void => this.showImmediately();
    return Object.freeze({
      id: `stage0-${this.id}-block-drop`, durationSeconds,
      start: () => {
        if (this.stage0RevealState !== 'scheduled') return;
        this.stage0RevealState = 'revealing'; this.root.visible = true; this.presentationRoot.visible = true;
        this.presentationRoot.position.set(0, heightMeters, 0); this.presentationRoot.quaternion.identity(); this.presentationRoot.scale.setScalar(1);
      },
      update: (progress) => {
        if (this.stage0RevealState !== 'revealing') return;
        const clamped = THREE.MathUtils.clamp(progress, 0, 1);
        this.presentationRoot.position.set(0, heightMeters * (1 - clamped * clamped), 0);
      },
      finish: terminalize,
      cancel: terminalize,
    });
  }
  clearAttemptMaterials(): void { this.storedMaterialIds.length = 0; this.outputMaterialIds.length = 0; this.processingSeconds = 0; this.updatePresentation(0, 0, 5); }
  updatePresentation(processingProgress: number, stored: number, capacity: number, reserved = 0): void {
    const progress = THREE.MathUtils.clamp(processingProgress, 0, 1); this.progressFill.scale.x = progress; this.progressFill.position.x = -0.71 + 0.71 * progress;
    const storedCount = Math.min(stored, capacity); const reservedCount = Math.min(reserved, capacity - storedCount);
    for (let index = 0; index < this.capacityCells.length; index += 1) { const cell = this.capacityCells[index]!; (cell.material as THREE.MeshBasicMaterial).color.set(index < storedCount ? '#d9a441' : index < storedCount + reservedCount ? '#e2c987' : '#7e8a86'); cell.visible = index < capacity; }
  }
  readCapacityCellColor(index: number, target: THREE.Color): THREE.Color {
    const cell = this.capacityCells[index]; if (cell === undefined) throw new Error(`${this.id}: invalid capacity cell ${index}.`);
    return target.copy((cell.material as THREE.MeshBasicMaterial).color);
  }
  beginCapacityPresentationFrame(): void {
    this.root.updateWorldMatrix(true, true);
    this.capacityRoot.getWorldQuaternion(this.capacityPresentationWorldQuaternion);
    this.capacityPresentationFrameActive = true;
  }
  updateCapacityPresentationFrame(): void {
    if (!this.capacityPresentationFrameActive) return;
    this.root.updateWorldMatrix(true, false);
    this.root.getWorldQuaternion(this.rootQ);
    this.capacityRoot.quaternion.copy(this.rootQ).invert().multiply(this.capacityPresentationWorldQuaternion);
    this.capacityRoot.updateWorldMatrix(false, true);
  }
  endCapacityPresentationFrame(): void {
    this.capacityPresentationFrameActive = false;
    this.capacityRoot.position.copy(this.capacityAuthoredPosition);
    this.capacityRoot.quaternion.copy(this.capacityAuthoredQuaternion);
    this.capacityRoot.updateWorldMatrix(false, true);
  }
  private createVisual(variant: ProductionBlockVariant): THREE.Object3D { const visual = this.visualFactory(variant); visual.name = `${this.id}-${variant}-visual`; visual.traverse((node) => { if (node instanceof THREE.Mesh) {
    const materials = Array.isArray(node.material) ? node.material.map((material) => material.clone()) : [node.material.clone()];
    for (const material of materials) if (material instanceof THREE.MeshStandardMaterial) {
      material.color.set('#f3f5f4'); material.roughness = 0.84; material.metalness = 0;
    }
    node.material = Array.isArray(node.material) ? materials : materials[0]!;
  } }); return visual; }
  private bindAuthoredSurfaces(): void {
    const label = this.visual.getObjectByName('functionNameFace'); const progress = this.visual.getObjectByName('topProgressAnchor'); const capacity = this.visual.getObjectByName('topCapacityAnchor'); const footprint = this.visual.getObjectByName('collisionFootprintAnchor');
    const outputMouth = this.visual.getObjectByName('outputMouth'); const tokenExit = this.visual.getObjectByName('tokenExitAnchor');
    if (label === undefined || progress === undefined || capacity === undefined || footprint === undefined || outputMouth === undefined || tokenExit === undefined) throw new Error(`${this.id}: block surface anchors required.`);
    this.readVisualLocalBounds(this.visualBounds);
    this.root.updateWorldMatrix(true, true);
    label.getWorldPosition(this.localScratch); this.root.worldToLocal(this.localScratch);
    const frontX = this.localScratch.x;
    const frontY = this.localScratch.y;
    const frontZ = this.localScratch.z;
    progress.getWorldPosition(this.localScratch); this.root.worldToLocal(this.localScratch); const progressFrameY = this.localScratch.y;
    capacity.getWorldPosition(this.localScratch); this.root.worldToLocal(this.localScratch); const capacityFrameY = this.localScratch.y;
    const topY = Math.min(progressFrameY, capacityFrameY);
    footprint.getWorldPosition(this.localScratch); this.root.worldToLocal(this.localScratch);
    const centerX = this.localScratch.x; const centerZ = this.localScratch.z;
    const bodyHalfX = Math.min(centerX - this.visualBounds.min.x, this.visualBounds.max.x - centerX);
    const bodyHalfZ = Math.min(centerZ - this.visualBounds.min.z, this.visualBounds.max.z - centerZ);
    const labelWidth = bodyHalfX * 2 - BLOCK_SURFACE.labelSafeInset * 2;
    const labelHeight = Math.min(BLOCK_SURFACE.labelMaximumHeight, bodyHalfZ * 2 - BLOCK_SURFACE.labelSafeInset * 2);
    if (labelWidth <= 0 || labelHeight <= 0) throw new Error(`${this.id}: authored body top face required.`);
    this.functionLabel.geometry.dispose(); this.functionLabel.geometry = new THREE.PlaneGeometry(labelWidth, labelHeight);
    this.functionLabel.userData.surfaceWidth = labelWidth; this.functionLabel.userData.surfaceHeight = labelHeight;
    this.functionLabel.userData.bodyFaceBounds = Object.freeze({ minX: centerX - bodyHalfX, maxX: centerX + bodyHalfX,
      minZ: centerZ - bodyHalfZ, maxZ: centerZ + bodyHalfZ });
    this.functionLabel.removeFromParent(); this.presentationRoot.add(this.functionLabel);
    this.functionLabel.position.set(centerX, topY + BLOCK_SURFACE.surfaceEpsilon, centerZ);
    this.root.getWorldQuaternion(this.rootQ); progress.getWorldQuaternion(this.authoredQ);
    this.functionLabel.quaternion.copy(this.rootQ).invert().multiply(this.authoredQ).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)));
    this.progressRoot.removeFromParent(); this.presentationRoot.add(this.progressRoot);
    this.progressRoot.position.set(frontX, frontY + BLOCK_SURFACE.progressHeight * 0.5 - 0.005, frontZ + BLOCK_SURFACE.surfaceEpsilon);
    this.root.getWorldQuaternion(this.rootQ); label.getWorldQuaternion(this.authoredQ);
    this.progressRoot.quaternion.copy(this.rootQ).invert().multiply(this.authoredQ);
    this.capacityRoot.removeFromParent(); this.presentationRoot.add(this.capacityRoot);
    this.capacityRoot.position.set(centerX, topY + BLOCK_SURFACE.capacityFloatOffset, centerZ);
    this.capacityRoot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(CAMPAIGN_CONFIG.camera.offsetX, CAMPAIGN_CONFIG.camera.offsetY, CAMPAIGN_CONFIG.camera.offsetZ).normalize());
    this.capacityAuthoredPosition.copy(this.capacityRoot.position);
    this.capacityAuthoredQuaternion.copy(this.capacityRoot.quaternion);
    this.interactionPromptAnchor.position.set(centerX, topY, centerZ);
    outputMouth.getWorldPosition(this.localScratch); this.root.worldToLocal(this.localScratch); this.outputMouthAuthoredLocal.copy(this.localScratch);
    tokenExit.getWorldPosition(this.localScratch); this.root.worldToLocal(this.localScratch); this.tokenExitAuthoredLocal.copy(this.localScratch);
  }
  private readVisualLocalBounds(target: THREE.Box3): THREE.Box3 {
    target.makeEmpty(); this.root.updateWorldMatrix(true, true); this.inverseRootMatrix.copy(this.root.matrixWorld).invert();
    this.visual.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.geometry.boundingBox === null) node.geometry.computeBoundingBox();
      const bounds = node.geometry.boundingBox; if (bounds === null) return;
      for (let mask = 0; mask < 8; mask += 1) {
        this.boundsCorner.set(mask & 1 ? bounds.max.x : bounds.min.x, mask & 2 ? bounds.max.y : bounds.min.y, mask & 4 ? bounds.max.z : bounds.min.z)
          .applyMatrix4(node.matrixWorld).applyMatrix4(this.inverseRootMatrix);
        target.expandByPoint(this.boundsCorner);
      }
    });
    if (target.isEmpty()) throw new Error(`${this.id}: block visual bounds required.`);
    return target;
  }
}
