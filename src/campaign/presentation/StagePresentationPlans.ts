import type { PresentationStep } from './PresentationPlayer';

export interface StagePresentationPlanParts {
  readonly dockGoalProjection: PresentationStep;
  readonly scoreboard: PresentationStep;
  readonly suction: PresentationStep;
  readonly resultCamera: PresentationStep;
  readonly blockTransition: PresentationStep | null;
  readonly moduleEffectReset: PresentationStep | null;
  readonly moduleReveal: readonly PresentationStep[];
  readonly returnCamera: PresentationStep;
  readonly stageConfiguration: PresentationStep;
  readonly scoreboardEntrance: PresentationStep;
  readonly finish: PresentationStep;
}

export function createStageClearPlan(parts: StagePresentationPlanParts): readonly PresentationStep[] {
  return Object.freeze([
    parts.dockGoalProjection,
    parts.resultCamera,
    parts.scoreboard,
    parts.suction,
    ...(parts.blockTransition === null ? [] : [parts.blockTransition]),
    ...(parts.moduleEffectReset === null ? [] : [parts.moduleEffectReset]),
    ...parts.moduleReveal,
    parts.returnCamera,
    parts.stageConfiguration,
    parts.scoreboardEntrance,
    parts.finish,
  ]);
}

export function createFinalStagePlan(parts: Readonly<{
  dockGoalProjection: PresentationStep;
  scoreboard: PresentationStep;
  suction: PresentationStep;
  resultCamera: PresentationStep;
  finalScore: PresentationStep;
  moduleEffectReset: PresentationStep | null;
  finish: PresentationStep;
}>): readonly PresentationStep[] {
  return Object.freeze([parts.dockGoalProjection, parts.resultCamera, parts.scoreboard, parts.suction,
    ...(parts.moduleEffectReset === null ? [] : [parts.moduleEffectReset]), parts.finalScore, parts.finish]);
}

export function createRetryPlan(parts: Readonly<{
  suction: PresentationStep;
  baselineProjection: PresentationStep;
  returnCamera: PresentationStep;
  resetProjection: PresentationStep;
  moduleEffectReset: PresentationStep | null;
  commitReset: PresentationStep;
  scoreboardEntrance: PresentationStep;
  admit: PresentationStep;
}>): readonly PresentationStep[] {
  return Object.freeze([parts.suction, parts.baselineProjection, parts.returnCamera, parts.resetProjection,
    ...(parts.moduleEffectReset === null ? [] : [parts.moduleEffectReset]), parts.commitReset,
    parts.scoreboardEntrance, parts.admit]);
}
