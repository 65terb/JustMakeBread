export const CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE_ID = 'i9-physical-scoreboard-template-v001';
export const CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE = Object.freeze({
  id: CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE_ID,
  root: Object.freeze({ childOrder: Object.freeze(['frame', 'panel'] as const) }),
  frame: Object.freeze({ width: 4.15, height: 1.55, depth: 0.26, positionZ: -0.12, color: '#34454C', roughness: 0.72, metalness: 0.05 }),
  panel: Object.freeze({ width: 3.8, height: 1.25, positionZ: 0.03, backgroundColor: '#263746', glyphColor: '#F2F1EA' }),
  font: CAMPAIGN_SCOREBOARD_TYPOGRAPHY,
  faceDirection: '+Z', lifecycleTransformOwner: 'instance-root',
});

export type CampaignPhysicalScoreboardRole = 'central-lifecycle' | 'result-auxiliary' | 'dock-goal';
export interface CampaignPhysicalScoreboardContract {
  readonly templateId: typeof CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE_ID;
  readonly instanceId: string;
  readonly role: CampaignPhysicalScoreboardRole;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly uniformScale: number;
  readonly sceneGraph: Readonly<{ children: readonly ['frame', 'panel']; panelContentOwner: 'panel.material.map'; standaloneContentChildren: 0 }>;
}
export function createCampaignPhysicalScoreboardContract(instanceId: string, role: CampaignPhysicalScoreboardRole,
  position: Readonly<{ x: number; y: number; z: number }>, uniformScale = 1): CampaignPhysicalScoreboardContract {
  if (instanceId.length === 0 || ![position.x, position.y, position.z, uniformScale].every(Number.isFinite) || uniformScale <= 0) throw new Error('Invalid physical scoreboard contract.');
  return Object.freeze({ templateId: CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE_ID, instanceId, role, position: Object.freeze({ ...position }), uniformScale,
    sceneGraph: Object.freeze({ children: CAMPAIGN_PHYSICAL_SCOREBOARD_TEMPLATE.root.childOrder, panelContentOwner: 'panel.material.map', standaloneContentChildren: 0 }) });
}
import { CAMPAIGN_SCOREBOARD_TYPOGRAPHY } from './CampaignScoreboardTypography';
