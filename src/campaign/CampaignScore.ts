import type { CampaignStage, CampaignStageConfig } from './CampaignConfig';

export interface CampaignScoreSnapshot {
  readonly stage0Score: number;
  readonly stage1Score: number;
  readonly stage2Score: number;
  readonly stage3Score: number;
  readonly totalScore: number;
  readonly committedStages: readonly CampaignStage[];
}

const zeroScores = (): Record<CampaignStage, number> => ({ stage0: 0, stage1: 0, stage2: 0, stage3: 0 });

export class CampaignScore {
  private scores = zeroScores();
  private committed = new Set<CampaignStage>();

  commit(stage: CampaignStage, config: CampaignStageConfig, submitted: number, remainingSeconds: number | null): number {
    if (this.committed.has(stage)) return this.scores[stage];
    const timeScore = remainingSeconds === null
      ? 0
      : Math.floor(remainingSeconds) * config.timeScoring.scorePerRemainingSecond;
    this.scores[stage] = submitted * config.scorePerBread + timeScore;
    this.committed.add(stage);
    return this.scores[stage];
  }

  restore(snapshot: CampaignScoreSnapshot): void {
    this.scores = {
      stage0: snapshot.stage0Score,
      stage1: snapshot.stage1Score,
      stage2: snapshot.stage2Score,
      stage3: snapshot.stage3Score,
    };
    this.committed = new Set(snapshot.committedStages);
  }

  snapshot(): CampaignScoreSnapshot {
    const committedStages = Object.freeze([...this.committed]);
    return Object.freeze({
      stage0Score: this.scores.stage0,
      stage1Score: this.scores.stage1,
      stage2Score: this.scores.stage2,
      stage3Score: this.scores.stage3,
      totalScore: this.scores.stage0 + this.scores.stage1 + this.scores.stage2 + this.scores.stage3,
      committedStages,
    });
  }
}
