import * as THREE from 'three';

export type WorldKeycapLabel = 'E' | 'Q' | 'SPACE';
export class WorldInteractionKeycap {
  readonly root = new THREE.Group(); private readonly face: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  label: WorldKeycapLabel | null = null;
  constructor(scene: THREE.Scene, private readonly textures: Readonly<Record<WorldKeycapLabel, THREE.Texture>>) {
    this.root.name = 'campaign-world-keycap';
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.44), new THREE.MeshBasicMaterial({
      map: textures.E, transparent: true, alphaTest: 0.01, depthWrite: false, depthTest: true,
      toneMapped: false, side: THREE.DoubleSide,
    }));
    this.face.name = 'campaign-approved-atlas-keycap-plane';
    this.face.userData.transparentBackground = true;
    this.face.renderOrder = 100;
    this.root.add(this.face); this.root.visible = false; scene.add(this.root);
  }
  update(target: THREE.Object3D | null, label: WorldKeycapLabel | null, camera: THREE.Camera, enabled: boolean): void {
    this.root.visible = enabled && target !== null && label !== null; this.label = this.root.visible ? label : null; if (!this.root.visible || target === null || label === null) return;
    this.face.material.map = this.textures[label]; this.face.material.needsUpdate = true; this.root.scale.x = label === 'SPACE' ? 1 : 0.5;
    target.getWorldPosition(this.root.position); this.root.position.y += 1.25; this.root.quaternion.copy(camera.quaternion); this.root.userData.keycapLabel = label;
    this.root.userData.approvedAtlasRegion = this.textures[label].userData.approvedAtlasRegion;
  }
  hide(): void { this.root.visible = false; this.label = null; }
  dispose(): void { this.root.removeFromParent(); for (const texture of Object.values(this.textures)) texture.dispose(); }
}
