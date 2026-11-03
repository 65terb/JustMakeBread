import type { CampaignStage } from './CampaignConfig';

export type TimedCampaignStage = 'stage1' | 'stage2' | 'stage3';
export type CampaignPhase =
  | Readonly<{ kind: 'playing'; stage: CampaignStage }>
  | Readonly<{ kind: 'clear-presentation'; stage: CampaignStage; nextStage: CampaignStage }>
  | Readonly<{ kind: 'game-over-presentation'; stage: TimedCampaignStage }>
  | Readonly<{ kind: 'game-over'; stage: TimedCampaignStage }>
  | Readonly<{ kind: 'retry-presentation'; stage: TimedCampaignStage }>
  | Readonly<{ kind: 'final-score'; stage: 'stage3' }>
  | Readonly<{ kind: 'restarting' }>
  | Readonly<{ kind: 'disposed' }>;

export interface Vec2 { x: number; z: number }

export type StageAttemptBaseline = Readonly<{
  stage: CampaignStage;
  playerPosition: Readonly<Vec2>;
  playerFacing: Readonly<Vec2>;
  score: import('./CampaignScore').CampaignScoreSnapshot;
}>;

export type ScoreBreakdownEntry = Readonly<{ label: string; score: number }>;
export type StageClearedEvent = Readonly<{
  type: 'stage-cleared';
  stage: CampaignStage;
  stageScore: number;
  totalScore: number;
  breakdown: readonly ScoreBreakdownEntry[];
}>;
export type StageFailedEvent = Readonly<{ type: 'stage-failed'; stage: TimedCampaignStage }>;
export type RetryRequestedEvent = Readonly<{ type: 'retry-requested'; source: 'pointer' | 'keyboard-r' }>;
export type RestartRequestedEvent = Readonly<{ type: 'restart-requested'; source: 'pointer' }>;
export type CampaignEvent = StageClearedEvent | StageFailedEvent | RetryRequestedEvent | RestartRequestedEvent;

export class CampaignState {
  phase: CampaignPhase = Object.freeze({ kind: 'playing', stage: 'stage0' });
  remainingSeconds: number | null = null;
  submittedBreadCount = 0;
  private readonly events: CampaignEvent[] = [];

  setPhase(phase: CampaignPhase): void { this.phase = Object.freeze(phase); }
  setRemainingSeconds(value: number | null): void {
    this.remainingSeconds = value === null ? null : Math.max(0, value);
  }
  publish(event: CampaignEvent): void { this.events.push(Object.freeze(event)); }
  drainEvents(): readonly CampaignEvent[] { return this.events.splice(0); }
}
