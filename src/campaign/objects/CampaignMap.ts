import * as THREE from 'three';
import { CAMPAIGN_CONFIG } from '../CampaignConfig';

export interface CampaignWorldBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export const CAMPAIGN_MAP_BOUNDS: CampaignWorldBounds = Object.freeze({
  minX: -12.35,
  maxX: 12.35,
  minZ: -3.6,
  maxZ: 3.6,
});

export const CAMPAIGN_MAP_ANCHORS = Object.freeze({
  player: Object.freeze({ x: -10, z: 1.05 }),
  mill: Object.freeze({ x: -5.5, z: -2.5 }),
  heater: Object.freeze({ x: 2.2, z: -2.5 }),
  wheatSource: Object.freeze({ x: -11.5, z: 0.8 }),
  submissionDockWallMount: Object.freeze({ x: 9.9, z: -3.6 }),
  submissionDockGameplay: Object.freeze({ x: 9.9, z: -3.135 }),
});
export const CAMPAIGN_PLAYER_SPAWN = Object.freeze({
  position: CAMPAIGN_MAP_ANCHORS.player,
  facing: Object.freeze({ x: 0, z: -1 }),
});

export const CAMPAIGN_PLAYER_COLLISION_RADIUS = CAMPAIGN_CONFIG.movement.playerRadiusMeters;
export const CAMPAIGN_COLLISION_EPSILON_METERS = 1e-6;
const WALL_THICKNESS = 0.34;
const WALL_HEIGHT = 2.2;

export const CAMPAIGN_WALL_PRESENTATION = (() => {
  const north = Object.freeze({ minX: CAMPAIGN_MAP_BOUNDS.minX - WALL_THICKNESS,
    maxX: CAMPAIGN_MAP_BOUNDS.maxX + WALL_THICKNESS,
    minZ: CAMPAIGN_MAP_BOUNDS.minZ - WALL_THICKNESS, maxZ: CAMPAIGN_MAP_BOUNDS.minZ });
  const sideMinZ = CAMPAIGN_MAP_BOUNDS.minZ;
  const sideMaxZ = CAMPAIGN_MAP_BOUNDS.maxZ + WALL_THICKNESS / 2;
  return Object.freeze({
    thickness: WALL_THICKNESS, height: WALL_HEIGHT, north,
    west: Object.freeze({ minX: CAMPAIGN_MAP_BOUNDS.minX - WALL_THICKNESS, maxX: CAMPAIGN_MAP_BOUNDS.minX,
      minZ: sideMinZ, maxZ: sideMaxZ }),
    east: Object.freeze({ minX: CAMPAIGN_MAP_BOUNDS.maxX, maxX: CAMPAIGN_MAP_BOUNDS.maxX + WALL_THICKNESS,
      minZ: sideMinZ, maxZ: sideMaxZ }),
  });
})();

export interface CampaignCollisionBounds { minX: number; maxX: number; minZ: number; maxZ: number; }

export function resolveEscapeAwareAxisDelta(start: number, delta: number, minimum: number, maximum: number): number {
  if (delta === 0) return 0;
  const epsilon = CAMPAIGN_COLLISION_EPSILON_METERS;
  if (start <= minimum + epsilon) {
    if (delta < 0) return delta;
    return start < minimum - epsilon ? Math.min(delta, minimum - start) : 0;
  }
  if (start >= maximum - epsilon) {
    if (delta > 0) return delta;
    return start > maximum + epsilon ? Math.max(delta, maximum - start) : 0;
  }
  const midpoint = (minimum + maximum) * 0.5;
  if (delta < 0 && start <= midpoint + epsilon) return delta;
  if (delta > 0 && start >= midpoint - epsilon) return delta;
  return 0;
}

export function resolveEscapeAwareBoundsDelta(start: number, delta: number, minimum: number, maximum: number): number {
  if (delta === 0) return 0;
  const epsilon = CAMPAIGN_COLLISION_EPSILON_METERS;
  if (start <= minimum + epsilon) return delta > 0 ? delta : 0;
  if (start >= maximum - epsilon) return delta < 0 ? delta : 0;
  return THREE.MathUtils.clamp(start + delta, minimum, maximum) - start;
}

function box(width: number, height: number, depth: number, color: THREE.ColorRepresentation, roughness: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class CampaignMap {
  readonly root = new THREE.Group();
  readonly bounds = CAMPAIGN_MAP_BOUNDS;
  readonly anchors = CAMPAIGN_MAP_ANCHORS;
  readonly playerCollisionRadius = CAMPAIGN_PLAYER_COLLISION_RADIUS;
  constructor(scene: THREE.Scene) {
    this.root.name = 'campaign-map';
    scene.background = new THREE.Color('#aeb9be');
    scene.fog = null;

    const extension = WALL_THICKNESS / 2;
    const outer = Object.freeze({
      minX: this.bounds.minX - extension,
      maxX: this.bounds.maxX + extension,
      minZ: this.bounds.minZ - extension,
      maxZ: this.bounds.maxZ + extension,
    });
    const width = outer.maxX - outer.minX;
    const depth = outer.maxZ - outer.minZ;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: '#dde2e5', roughness: 0.96, metalness: 0 }),
    );
    floor.name = 'campaign-map-floor';
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.root.add(floor);

    const authoredWalls = CAMPAIGN_WALL_PRESENTATION;
    const northWidth = authoredWalls.north.maxX - authoredWalls.north.minX;
    const sideDepth = authoredWalls.west.maxZ - authoredWalls.west.minZ;
    const walls = [
      Object.assign(box(northWidth, authoredWalls.height, authoredWalls.thickness, '#f7f8f8', 0.86), { name: 'campaign-wall-north' }),
      Object.assign(box(authoredWalls.thickness, authoredWalls.height, sideDepth, '#f7f8f8', 0.86), { name: 'campaign-wall-west' }),
      Object.assign(box(authoredWalls.thickness, authoredWalls.height, sideDepth, '#f7f8f8', 0.86), { name: 'campaign-wall-east' }),
    ];
    walls[0]!.position.set((authoredWalls.north.minX + authoredWalls.north.maxX) / 2, authoredWalls.height / 2,
      (authoredWalls.north.minZ + authoredWalls.north.maxZ) / 2);
    walls[1]!.position.set((authoredWalls.west.minX + authoredWalls.west.maxX) / 2, authoredWalls.height / 2,
      (authoredWalls.west.minZ + authoredWalls.west.maxZ) / 2);
    walls[2]!.position.set((authoredWalls.east.minX + authoredWalls.east.maxX) / 2, authoredWalls.height / 2,
      (authoredWalls.east.minZ + authoredWalls.east.maxZ) / 2);
    this.root.add(...walls);

    const ambient = new THREE.HemisphereLight('#f7f8f8', '#829098', 1.9);
    ambient.name = 'campaign-map-ambient-light';
    const key = new THREE.DirectionalLight('#fffaf0', 2.35);
    key.name = 'campaign-map-key-light';
    key.position.set(-4, 12, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -16;
    key.shadow.camera.right = 16;
    key.shadow.camera.top = 16;
    key.shadow.camera.bottom = -16;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 40;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    key.target.name = 'campaign-map-key-target';
    this.root.add(ambient, key, key.target);
    scene.add(this.root);
  }

  clampPlayer(position: THREE.Vector2): void {
    position.x = THREE.MathUtils.clamp(position.x, this.bounds.minX + this.playerCollisionRadius, this.bounds.maxX - this.playerCollisionRadius);
    position.y = THREE.MathUtils.clamp(position.y, this.bounds.minZ + this.playerCollisionRadius, this.bounds.maxZ - this.playerCollisionRadius);
  }

  resolvePlayerMovement(position: THREE.Vector2, requestedDelta: THREE.Vector2,
    obstacles: readonly CampaignCollisionBounds[], output = new THREE.Vector2()): THREE.Vector2 {
    output.copy(position);
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(requestedDelta.x), Math.abs(requestedDelta.y)) / 0.2));
    const stepX = requestedDelta.x / steps; const stepZ = requestedDelta.y / steps;
    for (let index = 0; index < steps; index += 1) {
      const boundedStepX = resolveEscapeAwareBoundsDelta(output.x, stepX,
        this.bounds.minX + this.playerCollisionRadius, this.bounds.maxX - this.playerCollisionRadius);
      output.x = this.resolveAxis(output.x, output.y, boundedStepX, obstacles, 'x');
      const boundedStepZ = resolveEscapeAwareBoundsDelta(output.y, stepZ,
        this.bounds.minZ + this.playerCollisionRadius, this.bounds.maxZ - this.playerCollisionRadius);
      output.y = this.resolveAxis(output.y, output.x, boundedStepZ, obstacles, 'z');
    }
    return output;
  }

  private resolveAxis(start: number, cross: number, delta: number, obstacles: readonly CampaignCollisionBounds[], axis: 'x' | 'z'): number {
    let terminal = start + delta; const radius = this.playerCollisionRadius;
    for (const obstacle of obstacles) {
      const crossMin = (axis === 'x' ? obstacle.minZ : obstacle.minX) - radius;
      const crossMax = (axis === 'x' ? obstacle.maxZ : obstacle.maxX) + radius;
      if (cross <= crossMin + CAMPAIGN_COLLISION_EPSILON_METERS || cross >= crossMax - CAMPAIGN_COLLISION_EPSILON_METERS) continue;
      const minimum = (axis === 'x' ? obstacle.minX : obstacle.minZ) - radius;
      const maximum = (axis === 'x' ? obstacle.maxX : obstacle.maxZ) + radius;
      terminal = start + resolveEscapeAwareAxisDelta(start, terminal - start, minimum, maximum);
    }
    return terminal;
  }

  dispose(): void { this.root.removeFromParent(); }
}
