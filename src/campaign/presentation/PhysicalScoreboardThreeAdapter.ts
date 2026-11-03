import * as THREE from 'three';
import { CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE, CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE_ID, type CampaignPhysicalScoreboardContract } from './PhysicalScoreboardTemplate';

const frameGeometry = new THREE.BoxGeometry(CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.frame.width, CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.frame.height, CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.frame.depth);
const panelGeometry = new THREE.PlaneGeometry(CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.panel.width, CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.panel.height);
const frameMaterial = new THREE.MeshStandardMaterial({ color: CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.frame.color, roughness: CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.frame.roughness, metalness: CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.frame.metalness });

export interface CampaignThreePhysicalScoreboard { readonly contract: CampaignPhysicalScoreboardContract; readonly root: THREE.Group; readonly frame: THREE.Mesh; readonly panel: THREE.Mesh; readonly panelMaterial: THREE.MeshBasicMaterial; }
export function createCampaignThreePhysicalScoreboard(contract: CampaignPhysicalScoreboardContract, texture: THREE.Texture): CampaignThreePhysicalScoreboard {
  if (contract.templateId !== CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE_ID) throw new Error('Physical scoreboard template mismatch.');
  const root = new THREE.Group(); root.name = contract.instanceId; root.userData.i9TemplateId = contract.templateId; root.userData.i9BoardRole = contract.role;
  const frame = new THREE.Mesh(frameGeometry, frameMaterial); frame.name = 'frame'; frame.position.z = CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.frame.positionZ; frame.userData.i9TemplateOwner = contract.templateId;
  const panelMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', map: texture, side: THREE.DoubleSide, toneMapped: false });
  const panel = new THREE.Mesh(panelGeometry, panelMaterial); panel.name = 'panel'; panel.position.z = CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.panel.positionZ; panel.userData.i9TemplateOwner = contract.templateId; panel.userData.i9ContentOwner = 'panel.material.map';
  root.add(frame, panel); root.position.set(contract.position.x, contract.position.y, contract.position.z); root.scale.setScalar(contract.uniformScale); return Object.freeze({ contract, root, frame, panel, panelMaterial });
}
