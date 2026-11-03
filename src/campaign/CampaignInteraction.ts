import * as THREE from 'three';
import type { CampaignInteractionConfig, CampaignPresentationTiming } from './CampaignConfig';
import type { CampaignCollisionBounds } from './objects/CampaignMap';
import type { Module } from './objects/Module';
import type { Player } from './objects/Player';
import type { ProductionBlock, Socket } from './objects/ProductionBlock';
import type { PresentationPlayer, PresentationStep } from './presentation/PresentationPlayer';

type SocketCandidate = Readonly<{ kind: 'socket'; socket: Socket; distance: number; facingAngle: number }>;
type ModuleCandidate = Readonly<{ kind: 'module'; module: Module; socket: Socket | null; distance: number; facingAngle: number }>;
export type FloorDropCandidate = Readonly<{ kind: 'floor-drop'; module: Module; landing: THREE.Vector3; distance: number; facingAngle: number }>;
export type CampaignInteractionTarget = SocketCandidate | ModuleCandidate | FloorDropCandidate;

const worldPosition = new THREE.Vector3();
const planar = new THREE.Vector2();

function metrics(player: Player, position: THREE.Vector3, surfaceRadiusMeters = 0): { distance: number; facingAngle: number } {
  planar.set(position.x - player.position.x, position.z - player.position.y);
  const centerDistance = planar.length();
  if (centerDistance > 0) planar.multiplyScalar(1 / centerDistance);
  return { distance: Math.max(0, centerDistance - surfaceRadiusMeters), facingAngle: Math.acos(THREE.MathUtils.clamp(planar.dot(player.facing), -1, 1)) };
}

export class CampaignInteraction {
  selected: CampaignInteractionTarget | null = null;
  constructor(
    private readonly player: Player,
    private readonly blocks: readonly ProductionBlock[],
    private readonly modules: readonly Module[],
    private readonly config: CampaignInteractionConfig,
    private readonly presentationOptions?: Readonly<{
      scene: THREE.Scene;
      player: Player;
      presentation: PresentationPlayer;
      durationSeconds: number;
      timing: CampaignPresentationTiming;
      bounds?: Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
      minimumModuleSeparationMeters?: number;
      fixedRoots?: readonly THREE.Object3D[];
      fixedBounds?: readonly CampaignCollisionBounds[];
      onAction?: (action: 'pickup' | 'detach' | 'attach' | 'drop') => void;
    }>,
  ) {}

  updateTarget(): CampaignInteractionTarget | null {
    const candidates: CampaignInteractionTarget[] = [];
    if (this.player.heldMaterialIds.length > 0 || this.player.heldBlockId !== null) {
      this.applyHighlight(null);
      return (this.selected = null);
    }
    if (this.player.heldModule !== null) {
      for (const block of this.blocks) for (const socket of block.sockets) {
        if (!socket.enabled || socket.module !== null) continue;
        const current = metrics(this.player, socket.readWorldPosition(worldPosition));
        if (current.distance <= this.config.interactionRadiusMeters) {
          candidates.push({ kind: 'socket', socket, ...current });
        }
      }
    } else {
      for (const module of this.modules) {
        if (module.presentationLocked || module.location.kind === 'not-introduced' || module.location.kind === 'held') continue;
        const socket = module.location.kind === 'socket'
          ? module.location.block.sockets[module.location.socket]
          : null;
        if (socket === null) {
          module.root.updateWorldMatrix(true, false);
          module.root.getWorldPosition(worldPosition);
        } else {
          socket.readWorldPosition(worldPosition);
        }
        const current = metrics(this.player, worldPosition, this.config.moduleSurfaceRadiusMeters);
        if (current.distance <= this.config.interactionRadiusMeters) {
          candidates.push({ kind: 'module', module, socket, ...current });
        }
      }
    }
    if (candidates.length === 0) { this.applyHighlight(null); return (this.selected = null); }
    const minDistance = Math.min(...candidates.map((candidate) => candidate.distance));
    const tied = candidates.filter((candidate) =>
      candidate.distance <= minDistance + this.config.interactionDistanceTieEpsilonMeters);
    tied.sort((left, right) => left.facingAngle - right.facingAngle ||
      this.targetStableObjectId(left).localeCompare(this.targetStableObjectId(right)) ||
      this.targetSocketIndex(left) - this.targetSocketIndex(right));
    this.selected = tied[0] ?? null;
    this.applyHighlight(this.selected);
    return this.selected;
  }

  clearTarget(): void { this.applyHighlight(null); this.selected = null; }

  interact(): boolean {
    return this.perform(this.updateTarget());
  }

  interactSelected(): boolean {
    return this.perform(this.selected);
  }

  interactTarget(target: CampaignInteractionTarget): boolean {
    return this.perform(target);
  }

  readHeldModuleDropTarget(): FloorDropCandidate | null {
    const held = this.player.heldModule;
    if (held === null || held.presentationLocked) return null;
    const landing = this.readHeldModuleDropLanding(held);
    if (landing === null) return null;
    const retainedLanding = landing.clone();
    Object.freeze(retainedLanding);
    return Object.freeze({ kind: 'floor-drop', module: held, landing: retainedLanding, distance: 0, facingAngle: 0 });
  }

  private perform(target: CampaignInteractionTarget | null): boolean {
    if (this.presentationOptions?.presentation.active === true) return false;
    if (target !== null && !this.isStillValid(target)) return false;
    if (target?.kind === 'floor-drop') {
      const held = this.player.heldModule;
      if (held !== target.module || this.presentationOptions === undefined) return false;
      const worldStart = held.root.getWorldPosition(new THREE.Vector3());
      if (!held.dropTo(this.presentationOptions.scene, target.landing, this.player)) return false;
      const localEnd = held.root.position.clone();
      const localStart = this.presentationOptions.scene.worldToLocal(worldStart.clone());
      held.root.position.copy(localStart); held.root.scale.setScalar(1);
      this.playMotion(`drop-${held.id}`, held, localStart, localEnd, 'drop', null);
      return true;
    }
    if (target === null) return false;
    if (target.kind === 'socket') {
      const module = this.player.heldModule;
      if (module === null) return false;
      const worldStart = module.root.getWorldPosition(new THREE.Vector3());
      const worldQuaternion = module.root.getWorldQuaternion(new THREE.Quaternion());
      if (!target.socket.attach(module, this.player)) return false;
      const localEnd = module.root.position.clone(); const localEndQuaternion = module.root.quaternion.clone(); const localStart = target.socket.anchor.worldToLocal(worldStart.clone()); module.root.position.copy(localStart); module.root.scale.setScalar(1);
      const anchorQuaternion = target.socket.anchor.getWorldQuaternion(new THREE.Quaternion());
      const insertionDirection = target.socket.readOutwardDirection(new THREE.Vector3()).applyQuaternion(anchorQuaternion.clone().invert()).normalize();
      module.root.quaternion.copy(anchorQuaternion.invert().multiply(worldQuaternion));
      if (module.type === 'again') localEnd.copy(module.readSocketSeatPosition(target.socket.anchor, new THREE.Vector3()));
      this.playMotion(`attach-${module.id}`, module, localStart, localEnd, 'attach', insertionDirection, localEndQuaternion);
      return true;
    }
    if (target.socket !== null) {
      const worldStart = target.module.root.getWorldPosition(new THREE.Vector3());
      const detached = target.socket.detach(this.player); if (detached === null) return false;
      const localStart = this.player.heldAnchor.worldToLocal(worldStart.clone()); detached.root.position.copy(localStart);
      detached.root.scale.setScalar(1); this.playMotion(`detach-${detached.id}`, detached, localStart, new THREE.Vector3(), 'detach', null);
      return true;
    }
    const worldStart = target.module.root.getWorldPosition(new THREE.Vector3());
    if (!target.module.pickUp(this.player)) return false;
    const localStart = this.player.heldAnchor.worldToLocal(worldStart.clone()); target.module.root.position.copy(localStart);
    target.module.root.scale.setScalar(1); this.playMotion(`pickup-${target.module.id}`, target.module, localStart, new THREE.Vector3(), 'pickup', null);
    return true;
  }

  private isStillValid(target: CampaignInteractionTarget): boolean {
    if (target.kind === 'floor-drop') {
      return this.player.heldModule === target.module && !target.module.presentationLocked &&
        this.isModuleDropLandingValid(target.module, target.landing);
    }
    if (target.kind === 'socket') {
      if (this.player.heldModule === null || !target.socket.enabled || target.socket.module !== null) return false;
      return metrics(this.player, target.socket.readWorldPosition(worldPosition)).distance <= this.config.interactionRadiusMeters;
    }
    if (this.player.heldModule !== null || target.module.presentationLocked) return false;
    if (target.socket === null) {
      if (target.module.location.kind !== 'world') return false;
      target.module.root.getWorldPosition(worldPosition);
    } else {
      if (target.module.location.kind !== 'socket' || target.socket.module !== target.module) return false;
      target.socket.readWorldPosition(worldPosition);
    }
    return metrics(this.player, worldPosition, this.config.moduleSurfaceRadiusMeters).distance <= this.config.interactionRadiusMeters;
  }

  private playMotion(id: string, module: Module, start: THREE.Vector3, end: THREE.Vector3,
    action: 'pickup' | 'detach' | 'attach' | 'drop', insertionDirection: THREE.Vector3 | null, terminalQuaternion: THREE.Quaternion | null = null): void {
    const root = module.root;
    const options = this.presentationOptions; if (options === undefined) { root.position.copy(end); if (terminalQuaternion !== null) root.quaternion.copy(terminalQuaternion); return; }
    const startQuaternion = root.quaternion.clone();
    const endQuaternion = terminalQuaternion?.clone() ?? startQuaternion.clone();
    const flipQuaternion = new THREE.Quaternion();
    const flipAxis = new THREE.Vector3(1, 0, 0);
    const entrance = insertionDirection === null ? end.clone() : end.clone().addScaledVector(insertionDirection, 0.36);
    const step: PresentationStep = Object.freeze({
      id, durationSeconds: action === 'attach' && module.type === 'again'
        ? options.timing.againAttachApproachSeconds + options.timing.againAttachInsertSeconds + options.timing.againAttachSettleSeconds
        : options.durationSeconds,
      update: (progress) => {
        const eased = 1 - Math.pow(1 - progress, 3);
        if (action !== 'attach') root.position.lerpVectors(start, end, eased);
        if (action === 'attach') {
          if (module.type === 'again') {
            const total = options.timing.againAttachApproachSeconds + options.timing.againAttachInsertSeconds + options.timing.againAttachSettleSeconds;
            const approachEnd = options.timing.againAttachApproachSeconds / total;
            const insertEnd = (options.timing.againAttachApproachSeconds + options.timing.againAttachInsertSeconds) / total;
            if (progress <= approachEnd) root.position.lerpVectors(start, entrance, 1 - Math.pow(1 - progress / approachEnd, 3));
            else if (progress <= insertEnd) root.position.lerpVectors(entrance, end, (progress - approachEnd) / (insertEnd - approachEnd));
            else { const settle = (progress - insertEnd) / (1 - insertEnd); root.position.copy(end).addScaledVector(insertionDirection!, -Math.sin(settle * Math.PI) * 0.035); }
            root.quaternion.slerpQuaternions(startQuaternion, endQuaternion, eased);
          }
          else {
            const approachEnd = options.timing.moduleAttachApproachSeconds / options.timing.moduleInsertSeconds;
            const flipEnd = (options.timing.moduleAttachApproachSeconds + options.timing.moduleAttachFlipSeconds) / options.timing.moduleInsertSeconds;
            const insertEnd = (options.timing.moduleAttachApproachSeconds + options.timing.moduleAttachFlipSeconds + options.timing.moduleAttachInsertSeconds) / options.timing.moduleInsertSeconds;
            if (progress <= approachEnd) root.position.lerpVectors(start, entrance, 1 - Math.pow(1 - progress / approachEnd, 3));
            else if (progress <= flipEnd) root.position.copy(entrance);
            else if (progress <= insertEnd) root.position.lerpVectors(entrance, end, (progress - flipEnd) / (insertEnd - flipEnd));
            else { const contact = (progress - insertEnd) / (1 - insertEnd); root.position.copy(end).addScaledVector(insertionDirection!, -Math.sin(contact * Math.PI) * 0.045); }
            root.quaternion.slerpQuaternions(startQuaternion, endQuaternion, THREE.MathUtils.clamp((progress - approachEnd) / (flipEnd - approachEnd), 0, 1));
            flipQuaternion.setFromAxisAngle(flipAxis, Math.sin(THREE.MathUtils.clamp((progress - approachEnd) / (flipEnd - approachEnd), 0, 1) * Math.PI) * Math.PI);
            root.quaternion.multiply(flipQuaternion);
          }
        }
      },
      finish: () => { root.position.copy(end); if (action === 'attach') root.quaternion.copy(endQuaternion); module.presentationLocked = false; },
      cancel: () => { root.position.copy(end); if (action === 'attach') root.quaternion.copy(endQuaternion); module.presentationLocked = false; },
    });
    module.presentationLocked = true;
    options.onAction?.(action);
    if (!options.presentation.play([step], () => undefined)) { root.position.copy(end); module.presentationLocked = false; }
  }

  private targetStableObjectId(target: CampaignInteractionTarget): string {
    return target.kind === 'socket' ? target.socket.block.id : target.module.id;
  }
  private targetSocketIndex(target: CampaignInteractionTarget): number {
    return target.kind === 'socket' ? target.socket.index : target.kind === 'module' ? target.socket?.index ?? 0 : 0;
  }
  private findModuleDropLanding(held: Module, preferred: THREE.Vector3): THREE.Vector3 | null {
    const minimum = this.presentationOptions?.minimumModuleSeparationMeters ?? 1.15;
    const halfExtent = this.config.floorModuleHalfExtentMeters;
    const candidates = [preferred.clone()];
    for (const distance of [minimum, minimum * 1.5, minimum * 2]) for (let index = 0; index < 12; index += 1) {
      const angle = index * Math.PI / 6; candidates.push(new THREE.Vector3(preferred.x + Math.cos(angle) * distance, preferred.y, preferred.z + Math.sin(angle) * distance));
    }
    const bounds = this.presentationOptions?.bounds;
    if (bounds !== undefined) for (let z = bounds.minZ + halfExtent; z <= bounds.maxZ - halfExtent + 1e-8; z += minimum) for (let x = bounds.minX + halfExtent; x <= bounds.maxX - halfExtent + 1e-8; x += minimum) candidates.push(new THREE.Vector3(x, preferred.y, z));
    candidates.sort((left, right) => left.distanceToSquared(preferred) - right.distanceToSquared(preferred) || left.z - right.z || left.x - right.x);
    for (const candidate of candidates) {
      if (bounds !== undefined) {
        candidate.x = THREE.MathUtils.clamp(candidate.x, bounds.minX + halfExtent, bounds.maxX - halfExtent);
        candidate.z = THREE.MathUtils.clamp(candidate.z, bounds.minZ + halfExtent, bounds.maxZ - halfExtent);
      }
      if (this.isModuleDropLandingValid(held, candidate)) return candidate;
    }
    return null;
  }
  private isModuleDropLandingValid(held: Module, landing: Readonly<THREE.Vector3>): boolean {
    if (![landing.x, landing.y, landing.z].every(Number.isFinite)) return false;
    const minimum = this.presentationOptions?.minimumModuleSeparationMeters ?? 1.15;
    const halfExtent = this.config.floorModuleHalfExtentMeters;
    const bounds = this.presentationOptions?.bounds;
    if (bounds !== undefined && (landing.x < bounds.minX + halfExtent ||
      landing.x > bounds.maxX - halfExtent ||
      landing.z < bounds.minZ + halfExtent ||
      landing.z > bounds.maxZ - halfExtent)) return false;
    if (Math.hypot(this.player.position.x - landing.x, this.player.position.y - landing.z) < minimum) return false;
    for (const block of this.blocks) {
      const fixed = block.readCollisionBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
      if (landing.x > fixed.minX - halfExtent && landing.x < fixed.maxX + halfExtent &&
        landing.z > fixed.minZ - halfExtent && landing.z < fixed.maxZ + halfExtent) return false;
    }
    for (const fixed of this.presentationOptions?.fixedBounds ?? []) {
      if (landing.x > fixed.minX - halfExtent && landing.x < fixed.maxX + halfExtent &&
        landing.z > fixed.minZ - halfExtent && landing.z < fixed.maxZ + halfExtent) return false;
    }
    for (const module of this.modules) {
      if (module === held || module.location.kind === 'not-introduced') continue;
      module.root.getWorldPosition(worldPosition);
      if (Math.hypot(worldPosition.x - landing.x, worldPosition.z - landing.z) < minimum) return false;
    }
    return true;
  }
  private readHeldModuleDropLanding(held: Module): THREE.Vector3 | null {
    const preferred = new THREE.Vector3(this.player.position.x + this.player.facing.x * 1.25, 0.35,
      this.player.position.y + this.player.facing.y * 1.25);
    const bounds = this.presentationOptions?.bounds;
    const halfExtent = this.config.floorModuleHalfExtentMeters;
    if (bounds !== undefined) {
      preferred.x = THREE.MathUtils.clamp(preferred.x, bounds.minX + halfExtent, bounds.maxX - halfExtent);
      preferred.z = THREE.MathUtils.clamp(preferred.z, bounds.minZ + halfExtent, bounds.maxZ - halfExtent);
    }
    return this.findModuleDropLanding(held, preferred);
  }
  private applyHighlight(target: CampaignInteractionTarget | null): void {
    // Socket rings/highlight writers are retired. The approved atlas keycap is
    // the single world interaction affordance for every target kind.
    void target;
  }
}
