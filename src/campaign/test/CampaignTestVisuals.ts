import * as THREE from 'three';
import type { ProductionBlockVariant } from '../objects/ProductionBlock';

function anchors(names: readonly string[]): THREE.Object3D {
  const root = new THREE.Group(); for (const name of names) { const anchor = new THREE.Group(); anchor.name = name; root.add(anchor); } return root;
}
export function testPlayerVisual(): THREE.Object3D { return new THREE.Group(); }
export function testModuleVisual(): THREE.Object3D { const root = anchors(['frontLabelFace', 'rearGaugeFace', 'insertionAxis', 'rotationPivot']); root.getObjectByName('frontLabelFace')!.position.z = 0.34; root.getObjectByName('rearGaugeFace')!.position.z = -0.34; const body = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.68, 0.68), new THREE.MeshStandardMaterial()); body.name = 'sharedCubeGeometry'; root.add(body); return root; }
export function testBlockVisual(variant: ProductionBlockVariant): THREE.Object3D {
  const names = ['functionNameFace', 'topProgressAnchor', 'topCapacityAnchor', 'outputMouth', 'tokenExitAnchor', 'rotationPivot', 'collisionFootprintAnchor'];
  if (variant === 'single-socket') names.push('fastPocketSeat');
  if (variant === 'double-socket') names.push('fastPocketSeatLeft', 'fastPocketSeatRight');
  const root = anchors(names); const shell = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.72, 1.9), new THREE.MeshStandardMaterial()); shell.name = 'shell'; shell.position.y = 0.86; root.add(shell); root.getObjectByName('outputMouth')?.position.set(0, 0.7, 0.92); root.getObjectByName('tokenExitAnchor')?.position.set(0, 0.5, 1.16);
  root.getObjectByName('functionNameFace')?.position.set(0, 1.29, 0.951); root.getObjectByName('topProgressAnchor')?.position.set(-0.18, 1.721, 0.1); root.getObjectByName('topCapacityAnchor')?.position.set(0.62, 1.721, 0.1);
  root.getObjectByName('fastPocketSeatLeft')?.position.set(-0.4, 1, 0); root.getObjectByName('fastPocketSeatRight')?.position.set(0.4, 1, 0); return root;
}
