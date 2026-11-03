import * as THREE from 'three';
import { CAMPAIGN_CONFIG, type CampaignConfig, type ModuleType } from '../CampaignConfig';
import type { Player } from './Player';
import type { ProductionBlock, SocketIndex } from './ProductionBlock';
import { CAMPAIGN_MODULE_BODY_MESH_NAME } from '../CampaignAssets';
import { CAMPAIGN_SCOREBOARD_TYPOGRAPHY } from '../presentation/CampaignScoreboardTypography';
import { configureObjectSurfaceTexture, drawObjectSurfaceLabel } from '../presentation/ObjectSurfaceLabel';

export type ModuleInteractionAction = 'pickup' | 'detach' | 'attach' | 'drop';
export type ModuleLocation = Readonly<{ kind: 'not-introduced' }> | Readonly<{ kind: 'world' }> | Readonly<{ kind: 'held' }> | Readonly<{ kind: 'socket'; block: ProductionBlock; socket: SocketIndex }>;
const colors: Record<ModuleType, THREE.ColorRepresentation> = {
  fast: CAMPAIGN_CONFIG.modules.fast.fullFuelColor,
  double: CAMPAIGN_CONFIG.modules.double.bodyColor,
  again: CAMPAIGN_CONFIG.modules.again.baseColor,
};
const labels: Record<ModuleType, string> = { fast: '빨리!', double: '두 배!', again: '또!' };
const MODULE_LABEL_OUTLINE_MULTIPLIER = 2.5;
export const CAMPAIGN_MODULE_BODY_MATERIAL = Object.freeze({
  fast: Object.freeze({ roughness: 0.82, metalness: 0.02 }),
  double: Object.freeze({ roughness: 0.36, metalness: 0 }),
  again: Object.freeze({ roughness: 0.82, metalness: 0.02 }),
});
const GAUGE_CLEARANCE_METERS = 0.006;
const MODULE_LABEL_CANVAS = Object.freeze({ width: 2048, height: 1024 });
const MODULE_LABEL_SAFE_INSET_METERS = 0.025;
const MODULE_SURFACE_CLEARANCE_METERS = 0.006;
const FEEDBACK_ENVELOPE_TERMINAL_EPSILON = 1e-10;
type ModuleLabelFace = 'front' | 'rear' | 'left' | 'right' | 'top';

declare const modulePresentationSnapshotBrand: unique symbol;
export interface ModulePresentationSnapshot { readonly [modulePresentationSnapshotBrand]: true }
export interface ModuleEffectResetTransition {
  readonly module: Module;
  update(progress: number): void;
  finish(): void;
  cancel(): void;
}
type ColorSnapshot = readonly [number, number, number];
type ObjectTransformSnapshot = Readonly<{
  position: readonly [number, number, number];
  quaternion: readonly [number, number, number, number];
  scale: readonly [number, number, number];
  visible: boolean;
}>;
type PresentationMaterialSnapshot = Readonly<{
  material: THREE.Material;
  color: ColorSnapshot | null;
  emissive: ColorSnapshot | null;
  emissiveIntensity: number | null;
  opacity: number;
  visible: boolean;
}>;
type PointLightSnapshot = Readonly<{
  color: ColorSnapshot;
  intensity: number;
  distance: number;
  visible: boolean;
}>;
type ModulePresentationSnapshotState = Readonly<{
  owner: Module;
  epoch: number;
  bodyColor: ColorSnapshot;
  targetBodyColor: ColorSnapshot;
  feedbackTransform: ObjectTransformSnapshot;
  feedbackVisible: boolean;
  feedbackFactor: number;
  shakeRadians: number;
  pointLight: PointLightSnapshot | null;
  gaugeFillTransform: ObjectTransformSnapshot | null;
  materials: readonly PresentationMaterialSnapshot[];
}>;
const modulePresentationSnapshots = new WeakMap<ModulePresentationSnapshot, ModulePresentationSnapshotState>();
const restoredModulePresentationSnapshots = new WeakSet<ModulePresentationSnapshot>();

function captureColor(color: THREE.Color): ColorSnapshot { return Object.freeze([color.r, color.g, color.b]); }
function restoreColor(color: THREE.Color, snapshot: ColorSnapshot): void {
  color.r = snapshot[0]; color.g = snapshot[1]; color.b = snapshot[2];
}
function captureTransform(object: THREE.Object3D): ObjectTransformSnapshot {
  return Object.freeze({ position: Object.freeze([object.position.x, object.position.y, object.position.z] as const),
    quaternion: Object.freeze([object.quaternion.x, object.quaternion.y, object.quaternion.z, object.quaternion.w] as const),
    scale: Object.freeze([object.scale.x, object.scale.y, object.scale.z] as const), visible: object.visible });
}
function restoreTransform(object: THREE.Object3D, snapshot: ObjectTransformSnapshot): void {
  object.position.set(snapshot.position[0], snapshot.position[1], snapshot.position[2]);
  object.quaternion.set(snapshot.quaternion[0], snapshot.quaternion[1], snapshot.quaternion[2], snapshot.quaternion[3]);
  object.scale.set(snapshot.scale[0], snapshot.scale[1], snapshot.scale[2]); object.visible = snapshot.visible;
}

function easeModuleEffectReset(progress: number): number {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

const labelFaces = Object.freeze({
  fast: Object.freeze(['front', 'left', 'right', 'top'] satisfies ModuleLabelFace[]),
  double: Object.freeze(['front', 'left', 'right', 'top'] satisfies ModuleLabelFace[]),
  again: Object.freeze(['front', 'rear', 'left', 'right', 'top'] satisfies ModuleLabelFace[]),
}) satisfies Readonly<Record<ModuleType, readonly ModuleLabelFace[]>>;

function labelTexture(type: ModuleType, anisotropy: number): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = MODULE_LABEL_CANVAS.width; canvas.height = MODULE_LABEL_CANVAS.height;
  const context = canvas.getContext('2d'); if (context === null) throw new Error('Module label canvas unavailable.');
  const metrics = drawObjectSurfaceLabel(context, canvas, labels[type], '#ffffff', '#111111', { outlineMultiplier: MODULE_LABEL_OUTLINE_MULTIPLIER });
  const texture = new THREE.CanvasTexture(canvas); configureObjectSurfaceTexture(texture, anisotropy);
  texture.userData.labelMetrics = metrics; texture.userData.labelText = labels[type]; return texture;
}

function labelSurface(type: ModuleType, texture: THREE.CanvasTexture | null, face: ModuleLabelFace, width: number, height: number): THREE.Mesh {
  const material = texture === null
    ? new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 })
    : new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.01, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = `campaign-module-${type}-label-${face}`;
  mesh.userData.typography = CAMPAIGN_SCOREBOARD_TYPOGRAPHY; mesh.userData.fill = '#ffffff'; mesh.userData.outline = '#111111';
  mesh.userData.surfaceWidth = width; mesh.userData.surfaceHeight = height;
  mesh.userData.face = face;
  return mesh;
}

function bindLabelSurface(body: THREE.Mesh, bounds: THREE.Box3, label: THREE.Mesh, face: ModuleLabelFace): void {
  const centerX = (bounds.min.x + bounds.max.x) * 0.5;
  const centerY = (bounds.min.y + bounds.max.y) * 0.5;
  const centerZ = (bounds.min.z + bounds.max.z) * 0.5;
  if (face === 'front') label.position.set(centerX, centerY, bounds.max.z + MODULE_SURFACE_CLEARANCE_METERS);
  else if (face === 'rear') { label.position.set(centerX, centerY, bounds.min.z - MODULE_SURFACE_CLEARANCE_METERS); label.rotation.y = Math.PI; }
  else if (face === 'left') { label.position.set(bounds.min.x - MODULE_SURFACE_CLEARANCE_METERS, centerY, centerZ); label.rotation.y = -Math.PI / 2; }
  else if (face === 'right') { label.position.set(bounds.max.x + MODULE_SURFACE_CLEARANCE_METERS, centerY, centerZ); label.rotation.y = Math.PI / 2; }
  else { label.position.set(centerX, bounds.max.y + MODULE_SURFACE_CLEARANCE_METERS, centerZ); label.rotation.x = -Math.PI / 2; }
  body.add(label);
}

function gaugeTexture(type: ModuleType): THREE.CanvasTexture | null {
  if (typeof document === 'undefined' || type === 'again') return null;
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 32;
  const context = canvas.getContext('2d'); if (context === null) throw new Error('Module gauge canvas unavailable.');
  const gradient = context.createLinearGradient(0, 0, 256, 0);
  if (type === 'fast') { gradient.addColorStop(0, '#e0a43a'); gradient.addColorStop(1, '#c9473a'); }
  else { gradient.addColorStop(0, '#36d7e8'); gradient.addColorStop(1, '#f2f1ea'); }
  context.fillStyle = gradient; context.fillRect(0, 0, 256, 32);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

export class Module {
  readonly root = new THREE.Group(); location: ModuleLocation = Object.freeze({ kind: 'not-introduced' });
  presentationLocked = false;
  fuelSeconds = 0; recoverySeconds = 0; chargeSeconds = 0; activeSeconds = 0;
  private readonly gaugeFill: THREE.Mesh | null;
  private readonly labelSurfaces: readonly THREE.Mesh[];
  private readonly bodyMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly bodyMaterialEmissive: THREE.Color[] = [];
  private readonly bodyMaterialEmissiveIntensity: number[] = [];
  private readonly presentationMaterials: THREE.Material[] = [];
  private readonly bodyColor = new THREE.Color();
  private readonly targetBodyColor = new THREE.Color();
  private readonly activeFeedbackRoot = new THREE.Group();
  private readonly activeFeedbackLight: THREE.PointLight | null;
  private doubleActiveFeedbackVisible = false;
  private doubleActiveFeedbackFactor = 0;
  private doubleShakeRadians = 0;
  private presentationSnapshotEpoch = 0;
  private readonly insertionAxis: THREE.Object3D;
  private readonly rotationPivot: THREE.Object3D;
  private readonly rearGaugeAnchor: THREE.Object3D;
  private readonly rearGaugeSurface: THREE.Group | null;
  private readonly rootWorldQuaternion = new THREE.Quaternion(); private readonly faceWorldQuaternion = new THREE.Quaternion();
  private readonly anchorWorldQuaternion = new THREE.Quaternion(); private readonly relativeFaceQuaternion = new THREE.Quaternion();
  private readonly desiredRootWorldQuaternion = new THREE.Quaternion();
  private readonly rearFaceFlipQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  constructor(readonly id: string, readonly type: ModuleType, visual: THREE.Object3D, labelAnisotropy = 1) {
    this.root.name = `campaign-module-${id}`;
    this.activeFeedbackRoot.name = `campaign-module-${id}-active-feedback`;
    this.activeFeedbackLight = type === 'double' ? new THREE.PointLight(colors.double, 0, 2) : null;
    if (this.activeFeedbackLight !== null) {
      this.activeFeedbackLight.name = `campaign-module-${id}-active-light`;
      this.activeFeedbackLight.visible = false; this.activeFeedbackLight.castShadow = false;
      this.activeFeedbackLight.userData.presentationOnly = true;
      this.activeFeedbackRoot.add(this.activeFeedbackLight);
    }
    this.bodyColor.set(colors[type]);
    let bodyMesh: THREE.Mesh | null = null;
    visual.traverse((node) => { if (node instanceof THREE.Mesh) { const material = node.material; const paint = Array.isArray(material) ? material.map((entry) => entry.clone()) : material.clone(); node.material = paint; if (node.name === CAMPAIGN_MODULE_BODY_MESH_NAME) { bodyMesh = node; for (const entry of Array.isArray(paint) ? paint : [paint]) if (entry instanceof THREE.MeshStandardMaterial) { entry.color.copy(this.bodyColor); entry.roughness = CAMPAIGN_MODULE_BODY_MATERIAL[type].roughness; entry.metalness = CAMPAIGN_MODULE_BODY_MATERIAL[type].metalness; entry.transparent = false; entry.opacity = 1; this.bodyMaterials.push(entry); this.bodyMaterialEmissive.push(entry.emissive.clone()); this.bodyMaterialEmissiveIntensity.push(entry.emissiveIntensity); } } node.castShadow = true; } });
    if (this.bodyMaterials.length === 0) throw new Error(`${type}: module body mesh required.`);
    this.root.add(visual); const front = visual.getObjectByName('frontLabelFace'); const rear = visual.getObjectByName('rearGaugeFace'); const insertionAxis = visual.getObjectByName('insertionAxis'); const rotationPivot = visual.getObjectByName('rotationPivot'); if (front === undefined || rear === undefined || insertionAxis === undefined || rotationPivot === undefined || bodyMesh === null) throw new Error(`${type}: module surface anchors required.`); this.insertionAxis = insertionAxis; this.rotationPivot = rotationPivot; this.rearGaugeAnchor = rear;
    const body = bodyMesh as THREE.Mesh; if (body.geometry.boundingBox === null) body.geometry.computeBoundingBox();
    const bounds = body.geometry.boundingBox; if (bounds === null) throw new Error(`${type}: module body bounds required.`);
    const safeWidth = bounds.max.x - bounds.min.x - MODULE_LABEL_SAFE_INSET_METERS * 2;
    const safeHeight = bounds.max.y - bounds.min.y - MODULE_LABEL_SAFE_INSET_METERS * 2;
    const safeDepth = bounds.max.z - bounds.min.z - MODULE_LABEL_SAFE_INSET_METERS * 2;
    if (safeWidth <= 0 || safeHeight <= 0 || safeDepth <= 0) throw new Error(`${type}: module label safe surface required.`);
    const texture = labelTexture(type, labelAnisotropy);
    this.labelSurfaces = labelFaces[type].map((face) => {
      const surfaceWidth = face === 'left' || face === 'right' ? safeDepth : safeWidth;
      const availableHeight = face === 'top' ? safeDepth : safeHeight;
      const surfaceHeight = Math.min(availableHeight, surfaceWidth * MODULE_LABEL_CANVAS.height / MODULE_LABEL_CANVAS.width);
      const label = labelSurface(type, texture, face, surfaceWidth, surfaceHeight);
      label.userData.bodyFaceBounds = Object.freeze({ minX: bounds.min.x, maxX: bounds.max.x, minY: bounds.min.y,
        maxY: bounds.max.y, minZ: bounds.min.z, maxZ: bounds.max.z });
      label.userData.safeInsetMeters = MODULE_LABEL_SAFE_INSET_METERS;
      label.userData.clearanceMeters = MODULE_SURFACE_CLEARANCE_METERS;
      label.userData.canvasResolution = `${MODULE_LABEL_CANVAS.width}x${MODULE_LABEL_CANVAS.height}`;
      label.userData.glyphPixelHeight = texture?.userData.labelMetrics?.glyphPixelHeight ?? 0;
      label.userData.outlinePixelWidth = texture?.userData.labelMetrics?.outlinePixelWidth ?? 0;
      label.userData.labelText = labels[type];
      label.userData.outlineMultiplier = MODULE_LABEL_OUTLINE_MULTIPLIER;
      bindLabelSurface(body, bounds, label, face);
      return label;
    });
    if (type !== 'again') { const group = new THREE.Group(); group.name = `campaign-module-${type}-rear-gauge`; const track = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.09), new THREE.MeshBasicMaterial({ color: '#263746' })); track.name = `campaign-module-${type}-gauge-track`; const texture = gaugeTexture(type); this.gaugeFill = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.07), new THREE.MeshBasicMaterial(texture === null ? { color: type === 'fast' ? '#ef5b43' : '#39d9e8' } : { map: texture })); this.gaugeFill.name = `campaign-module-${type}-gauge-fill`; this.gaugeFill.position.z = 0.002; group.add(track, this.gaugeFill); group.position.z = -GAUGE_CLEARANCE_METERS; group.rotation.y = Math.PI; rear.add(group); this.rearGaugeSurface = group; } else { this.gaugeFill = null; this.rearGaugeSurface = null; }
    visual.add(this.activeFeedbackRoot); visual.updateWorldMatrix(true, true);
    this.activeFeedbackRoot.attach(body);
    if (this.rearGaugeSurface !== null) this.activeFeedbackRoot.attach(this.rearGaugeSurface);
    this.activeFeedbackRoot.userData.presentationOnly = true;
    this.activeFeedbackRoot.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (!this.presentationMaterials.includes(material)) this.presentationMaterials.push(material);
      }
    });
    this.root.visible = false;
  }
  updatePresentation(config: CampaignConfig, deltaSeconds = 0): void {
    if (this.type === 'fast') {
      const amount = THREE.MathUtils.clamp(this.fuelSeconds / config.modules.fast.maxFuelSeconds, 0, 1);
      this.bodyColor.set(config.modules.fast.emptyFuelColor); this.targetBodyColor.set(config.modules.fast.fullFuelColor); this.bodyColor.lerp(this.targetBodyColor, amount);
    } else if (this.type === 'double') this.bodyColor.set(config.modules.double.bodyColor);
    else {
      this.targetBodyColor.set(config.modules.again.baseColor);
      if (this.location.kind === 'socket') {
        let fast: Module | null = null; let hasDouble = false;
        for (const socket of this.location.block.sockets) { const companion = socket.module; if (companion === null || companion === this) continue; if (companion.type === 'fast') fast = companion; else if (companion.type === 'double') hasDouble = true; }
        if (fast !== null) this.targetBodyColor.copy(fast.bodyColor);
        else if (hasDouble) this.targetBodyColor.set(config.modules.double.bodyColor);
      }
      const factor = deltaSeconds <= 0 ? 1 : 1 - Math.exp(-deltaSeconds / config.modules.again.colorTransitionSeconds); this.bodyColor.lerp(this.targetBodyColor, factor);
    }
    for (const material of this.bodyMaterials) material.color.copy(this.bodyColor);
    this.updateDoubleActiveFeedback(config);
    for (const label of this.labelSurfaces) (label.material as THREE.MeshBasicMaterial).color.set('#ffffff');
    if (this.gaugeFill !== null) { const amount = this.type === 'fast'
      ? THREE.MathUtils.clamp(this.fuelSeconds / config.modules.fast.maxFuelSeconds, 0, 1)
      : THREE.MathUtils.clamp(this.activeSeconds > 0 ? this.activeSeconds / config.modules.double.activeSeconds : this.chargeSeconds / config.modules.double.chargeSeconds, 0, 1);
    this.gaugeFill.scale.x = amount; this.gaugeFill.position.x = -0.24 + 0.24 * amount; } }
  private updateDoubleActiveFeedback(config: CampaignConfig): void {
    const introduced = this.type === 'double' && this.location.kind !== 'not-introduced';
    if (!introduced) { this.clearActiveFeedback(); return; }
    const active = this.activeSeconds > 0;
    this.doubleActiveFeedbackVisible = active;
    const profile = config.presentation.doubleActiveFeedback;
    for (let index = 0; index < this.bodyMaterials.length; index += 1) {
      const material = this.bodyMaterials[index]!;
      if (this.doubleActiveFeedbackFactor > 0) material.emissive.copy(this.bodyColor);
      else material.emissive.copy(this.bodyMaterialEmissive[index]!);
      material.emissiveIntensity = THREE.MathUtils.lerp(this.bodyMaterialEmissiveIntensity[index]!,
        profile.glowEmissiveIntensity, this.doubleActiveFeedbackFactor);
    }
    if (this.activeFeedbackLight !== null) {
      this.activeFeedbackLight.color.copy(this.bodyColor);
      this.activeFeedbackLight.intensity = profile.pointLightIntensity * this.doubleActiveFeedbackFactor;
      this.activeFeedbackLight.distance = profile.pointLightDistanceMeters;
      this.activeFeedbackLight.visible = this.doubleActiveFeedbackFactor > 0;
    }
    if (!active) { this.doubleShakeRadians = 0; this.activeFeedbackRoot.rotation.set(0, 0, 0); return; }
    const elapsed = Math.max(0, config.modules.double.activeSeconds - this.activeSeconds);
    const completedBoundaryCount = Math.floor((elapsed + 1e-10) / profile.shakeIntervalSeconds);
    const sinceBoundary = elapsed - completedBoundaryCount * profile.shakeIntervalSeconds;
    const shakeProgress = completedBoundaryCount > 0 && sinceBoundary >= 0 && sinceBoundary < profile.shakeDurationSeconds
      ? sinceBoundary / profile.shakeDurationSeconds
      : -1;
    this.doubleShakeRadians = shakeProgress < 0 ? 0 : THREE.MathUtils.degToRad(profile.shakeAngleDegrees) * Math.sin(shakeProgress * Math.PI * 2);
    this.activeFeedbackRoot.rotation.y = this.doubleShakeRadians;
  }
  advanceDoubleActiveFeedbackEnvelope(active: boolean, deltaSeconds: number, config: CampaignConfig): void {
    if (this.type !== 'double' || this.location.kind === 'not-introduced' || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    const duration = active ? config.presentation.doubleActiveFeedback.fadeInSeconds : config.presentation.doubleActiveFeedback.fadeOutSeconds;
    const next = THREE.MathUtils.clamp(this.doubleActiveFeedbackFactor + (active ? 1 : -1) * deltaSeconds / duration, 0, 1);
    this.doubleActiveFeedbackFactor = next <= FEEDBACK_ENVELOPE_TERMINAL_EPSILON ? 0 : next >= 1 - FEEDBACK_ENVELOPE_TERMINAL_EPSILON ? 1 : next;
  }
  private clearActiveFeedback(): void {
    this.doubleActiveFeedbackVisible = false; this.doubleActiveFeedbackFactor = 0; this.doubleShakeRadians = 0; this.activeFeedbackRoot.rotation.set(0, 0, 0);
    for (let index = 0; index < this.bodyMaterials.length; index += 1) {
      this.bodyMaterials[index]!.emissive.copy(this.bodyMaterialEmissive[index]!);
      this.bodyMaterials[index]!.emissiveIntensity = this.bodyMaterialEmissiveIntensity[index]!;
    }
    if (this.activeFeedbackLight !== null) { this.activeFeedbackLight.intensity = 0; this.activeFeedbackLight.visible = false; }
  }
  get doubleActiveFeedbackActive(): boolean { return this.doubleActiveFeedbackVisible; }
  get doubleActiveFeedbackFadeFactor(): number { return this.doubleActiveFeedbackFactor; }
  get doubleActiveShakeAngleRadians(): number { return this.doubleShakeRadians; }
  capturePresentationSnapshot(): ModulePresentationSnapshot {
    const snapshot = Object.freeze({}) as ModulePresentationSnapshot;
    const epoch = this.presentationSnapshotEpoch + 1; this.presentationSnapshotEpoch = epoch;
    modulePresentationSnapshots.set(snapshot, this.capturePresentationState(epoch));
    return snapshot;
  }
  private capturePresentationState(epoch: number): ModulePresentationSnapshotState {
    const materials = Object.freeze(this.presentationMaterials.map((material) => {
      const candidate = material as THREE.Material & { color?: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number };
      return Object.freeze({ material, color: candidate.color === undefined ? null : captureColor(candidate.color),
        emissive: candidate.emissive === undefined ? null : captureColor(candidate.emissive),
        emissiveIntensity: candidate.emissiveIntensity ?? null, opacity: material.opacity, visible: material.visible });
    }));
    return Object.freeze({ owner: this, epoch, bodyColor: captureColor(this.bodyColor),
      targetBodyColor: captureColor(this.targetBodyColor), feedbackTransform: captureTransform(this.activeFeedbackRoot),
      feedbackVisible: this.doubleActiveFeedbackVisible, feedbackFactor: this.doubleActiveFeedbackFactor, shakeRadians: this.doubleShakeRadians,
      pointLight: this.activeFeedbackLight === null ? null : Object.freeze({ color: captureColor(this.activeFeedbackLight.color),
        intensity: this.activeFeedbackLight.intensity, distance: this.activeFeedbackLight.distance, visible: this.activeFeedbackLight.visible }),
      gaugeFillTransform: this.gaugeFill === null ? null : captureTransform(this.gaugeFill), materials });
  }
  private restorePresentationState(state: ModulePresentationSnapshotState): boolean {
    if (state.owner !== this || state.materials.length !== this.presentationMaterials.length ||
      !state.materials.every((entry, index) => entry.material === this.presentationMaterials[index])) return false;
    restoreColor(this.bodyColor, state.bodyColor); restoreColor(this.targetBodyColor, state.targetBodyColor);
    restoreTransform(this.activeFeedbackRoot, state.feedbackTransform);
    this.doubleActiveFeedbackVisible = state.feedbackVisible; this.doubleActiveFeedbackFactor = state.feedbackFactor; this.doubleShakeRadians = state.shakeRadians;
    if (this.activeFeedbackLight !== null && state.pointLight !== null) {
      restoreColor(this.activeFeedbackLight.color, state.pointLight.color); this.activeFeedbackLight.intensity = state.pointLight.intensity;
      this.activeFeedbackLight.distance = state.pointLight.distance; this.activeFeedbackLight.visible = state.pointLight.visible;
    }
    if (this.gaugeFill !== null && state.gaugeFillTransform !== null) restoreTransform(this.gaugeFill, state.gaugeFillTransform);
    for (const saved of state.materials) {
      const material = saved.material as THREE.Material & { color?: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number };
      if (material.color !== undefined && saved.color !== null) restoreColor(material.color, saved.color);
      if (material.emissive !== undefined && saved.emissive !== null) restoreColor(material.emissive, saved.emissive);
      if (material.emissiveIntensity !== undefined && saved.emissiveIntensity !== null) material.emissiveIntensity = saved.emissiveIntensity;
      material.opacity = saved.opacity; material.visible = saved.visible;
    }
    return true;
  }
  canRestorePresentationSnapshot(snapshot: ModulePresentationSnapshot): boolean {
    const state = modulePresentationSnapshots.get(snapshot);
    return state !== undefined && state.owner === this && state.epoch === this.presentationSnapshotEpoch &&
      !restoredModulePresentationSnapshots.has(snapshot) && state.materials.length === this.presentationMaterials.length &&
      state.materials.every((entry, index) => entry.material === this.presentationMaterials[index]);
  }
  restorePresentationSnapshot(snapshot: ModulePresentationSnapshot): boolean {
    const state = modulePresentationSnapshots.get(snapshot);
    if (state === undefined || !this.canRestorePresentationSnapshot(snapshot)) return false;
    if (!this.restorePresentationState(state)) return false;
    restoredModulePresentationSnapshots.add(snapshot);
    return true;
  }
  get canResetIntroducedEffect(): boolean { return this.location.kind !== 'not-introduced' && this.type !== 'again'; }
  beginEffectResetTransition(config: CampaignConfig): ModuleEffectResetTransition | null {
    if (!this.canResetIntroducedEffect) return null;
    const presentationStart = this.capturePresentationState(this.presentationSnapshotEpoch);
    const startFuelSeconds = this.fuelSeconds; const startRecoverySeconds = this.recoverySeconds;
    const startChargeSeconds = this.chargeSeconds; const startActiveSeconds = this.activeSeconds;
    const startFeedbackFactor = this.doubleActiveFeedbackFactor; const startShakeRadians = this.doubleShakeRadians;
    let cancelled = false; let finished = false;
    const project = (progress: number): void => {
      const eased = easeModuleEffectReset(progress);
      if (this.type === 'fast') {
        this.fuelSeconds = THREE.MathUtils.lerp(startFuelSeconds, config.modules.fast.maxFuelSeconds, eased);
        this.recoverySeconds = THREE.MathUtils.lerp(startRecoverySeconds, 0, eased);
      } else {
        this.chargeSeconds = THREE.MathUtils.lerp(startChargeSeconds, 0, eased);
        this.activeSeconds = THREE.MathUtils.lerp(startActiveSeconds, 0, eased);
        this.doubleActiveFeedbackFactor = THREE.MathUtils.lerp(startFeedbackFactor, 0, eased);
      }
      this.updatePresentation(config, 0);
      if (this.type === 'double') {
        this.doubleShakeRadians = THREE.MathUtils.lerp(startShakeRadians, 0, eased);
        this.activeFeedbackRoot.rotation.y = this.doubleShakeRadians;
      }
      if (progress >= 1 && !finished) { finished = true; this.resetEffectForRetry(config); }
    };
    return Object.freeze({ module: this,
      update: (progress: number) => { if (!cancelled) project(progress); },
      finish: () => { if (!cancelled && !finished) project(1); },
      cancel: () => {
        if (cancelled) return;
        cancelled = true;
        this.fuelSeconds = startFuelSeconds; this.recoverySeconds = startRecoverySeconds;
        this.chargeSeconds = startChargeSeconds; this.activeSeconds = startActiveSeconds;
        if (!this.restorePresentationState(presentationStart)) throw new Error(`${this.id}: Module effect reset presentation restore rejected.`);
      },
    });
  }
  readBodyColor(target: THREE.Color): THREE.Color { return target.copy(this.bodyColor); }
  revealAt(parent: THREE.Object3D, position: THREE.Vector3): void { parent.attach(this.root); this.root.position.copy(position); this.root.visible = true; this.location = Object.freeze({ kind: 'world' }); }
  initializeForAdmission(config: CampaignConfig): void {
    if (this.type === 'fast') { this.fuelSeconds = config.modules.fast.maxFuelSeconds; this.recoverySeconds = 0; }
    else { this.chargeSeconds = 0; this.activeSeconds = 0; }
    this.updatePresentation(config);
  }
  readInsertionDirection(target: THREE.Vector3): THREE.Vector3 { const quaternion = this.insertionAxis.getWorldQuaternion(new THREE.Quaternion()); return target.set(0, 0, 1).applyQuaternion(quaternion).normalize(); }
  readSocketSeatPosition(anchor: THREE.Object3D, target: THREE.Vector3): THREE.Vector3 { this.root.updateWorldMatrix(true, true); const pivot = anchor.worldToLocal(this.rotationPivot.getWorldPosition(new THREE.Vector3())); return target.copy(this.root.position).sub(pivot); }
  pickUp(player: Player): boolean { if (this.location.kind !== 'world' || player.heldModule !== null || player.heldMaterialIds.length > 0 || player.heldBlockId !== null) return false; player.heldModule = this; player.heldAnchor.attach(this.root); this.root.position.set(0, 0, 0); this.location = Object.freeze({ kind: 'held' }); return true; }
  placeInSocket(block: ProductionBlock, socket: SocketIndex, anchor: THREE.Object3D, player: Player): boolean {
    if (this.location.kind !== 'held' || player.heldModule !== this) return false;
    if (this.type !== 'again' && this.rearGaugeSurface === null) return false;
    this.root.updateWorldMatrix(true, true); this.root.getWorldQuaternion(this.rootWorldQuaternion);
    this.rearGaugeAnchor.getWorldQuaternion(this.faceWorldQuaternion).multiply(this.rearFaceFlipQuaternion);
    this.relativeFaceQuaternion.copy(this.rootWorldQuaternion).invert().multiply(this.faceWorldQuaternion);
    anchor.getWorldQuaternion(this.anchorWorldQuaternion);
    this.desiredRootWorldQuaternion.copy(this.anchorWorldQuaternion).multiply(this.relativeFaceQuaternion.invert());
    player.heldModule = null; anchor.attach(this.root);
    anchor.getWorldQuaternion(this.anchorWorldQuaternion);
    this.root.quaternion.copy(this.anchorWorldQuaternion).invert().multiply(this.desiredRootWorldQuaternion);
    this.root.position.set(0, 0, 0); this.root.position.copy(this.readSocketSeatPosition(anchor, new THREE.Vector3()));
    this.location = Object.freeze({ kind: 'socket', block, socket }); return true;
  }
  detachTo(player: Player): boolean { if (this.location.kind !== 'socket' || player.heldModule !== null || player.heldMaterialIds.length > 0 || player.heldBlockId !== null) return false; player.heldModule = this; player.heldAnchor.attach(this.root); this.root.position.set(0, 0, 0); this.location = Object.freeze({ kind: 'held' }); return true; }
  dropTo(parent: THREE.Object3D, worldPosition: THREE.Vector3, player: Player): boolean {
    if (this.location.kind !== 'held' || player.heldModule !== this) return false;
    player.heldModule = null; parent.attach(this.root);
    this.root.position.copy(parent.worldToLocal(worldPosition.clone()));
    this.location = Object.freeze({ kind: 'world' }); return true;
  }
  resetEffect(): void { this.fuelSeconds = 0; this.recoverySeconds = 0; this.chargeSeconds = 0; this.activeSeconds = 0; this.clearActiveFeedback(); }
  resetEffectForRetry(config: CampaignConfig): void {
    this.resetEffect();
    if (this.type === 'fast' && this.location.kind !== 'not-introduced') this.fuelSeconds = config.modules.fast.maxFuelSeconds;
    this.updatePresentation(config);
  }
  dispose(): void { this.presentationSnapshotEpoch += 1; this.clearActiveFeedback(); this.root.removeFromParent(); }
}
