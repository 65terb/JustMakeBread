export type PresentationStep = Readonly<{
  id: string;
  durationSeconds: number;
  start?: () => void;
  update?: (progress: number) => void;
  finish?: () => void;
  cancel?: () => void;
}>;

export type PresentationFailure = Readonly<{ stepId: string; error: unknown }>;

export class PresentationPlayer {
  private queue: PresentationStep[] = [];
  private transaction: PresentationStep[] = [];
  private current: PresentationStep | null = null;
  private elapsedSeconds = 0;
  private paused = false;
  private completion: (() => void) | null = null;
  private failure: ((failure: PresentationFailure) => void) | null = null;
  lastFailure: PresentationFailure | null = null;

  play(steps: readonly PresentationStep[], completion: () => void,
    failure?: (failure: PresentationFailure) => void): boolean {
    if (this.current !== null || this.queue.length > 0) return false;
    this.transaction = [...steps];
    this.queue = [...steps];
    this.completion = completion;
    this.failure = failure ?? null;
    this.lastFailure = null;
    this.startNext();
    return this.lastFailure === null;
  }
  finishCurrentAndPlay(steps: readonly PresentationStep[], completion: () => void,
    failure?: (failure: PresentationFailure) => void): boolean {
    if (this.active && !this.finishImmediately()) return false;
    return this.play(steps, completion, failure);
  }
  finishCurrentThenBuildAndPlay(buildSteps: () => readonly PresentationStep[], completion: () => void,
    failure?: (failure: PresentationFailure) => void): boolean {
    if (this.active && !this.finishImmediately()) return false;
    let steps: readonly PresentationStep[];
    try { steps = buildSteps(); }
    catch (error) { this.recordBuildFailure(error, failure); return false; }
    return this.play(steps, completion, failure);
  }
  update(deltaSeconds: number): void {
    if (this.paused || this.current === null || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    this.elapsedSeconds += deltaSeconds;
    const duration = Math.max(0, this.current.durationSeconds);
    try { this.current.update?.(duration === 0 ? 1 : Math.min(1, this.elapsedSeconds / duration)); }
    catch (error) { this.fail(error); return; }
    if (this.elapsedSeconds < duration) return;
    try { this.current.finish?.(); }
    catch (error) { this.fail(error); return; }
    this.startNext();
    this.drainZeroDurationSteps();
  }
  setPaused(paused: boolean): void { this.paused = paused; }
  finishImmediately(): boolean {
    if (this.current === null) return true;
    try {
      this.current.update?.(1);
      this.current.finish?.();
      while (this.queue.length > 0) {
        this.current = this.queue.shift()!;
        this.current.start?.(); this.current.update?.(1); this.current.finish?.();
      }
    } catch (error) { this.fail(error); return false; }
    this.queue.length = 0;
    this.current = null;
    const completion = this.completion;
    const failure = this.failure;
    this.completion = null;
    this.failure = null;
    try { completion?.(); this.transaction.length = 0; }
    catch (error) {
      const failed = Object.freeze({ stepId: 'presentation-completion', error });
      this.lastFailure = failed; this.cancel(); failure?.(failed); return false;
    }
    return true;
  }
  cancel(): void {
    const steps = [...this.transaction].reverse();
    this.queue.length = 0;
    this.transaction.length = 0;
    this.current = null;
    this.completion = null;
    this.failure = null;
    this.elapsedSeconds = 0;
    for (const step of steps) { try { step.cancel?.(); } catch { /* cancellation cannot admit completion */ } }
  }
  get active(): boolean { return this.current !== null; }
  private startNext(): void {
    this.current = this.queue.shift() ?? null;
    this.elapsedSeconds = 0;
    if (this.current !== null) {
      try { this.current.start?.(); }
      catch (error) { this.fail(error); }
      return;
    }
    const completion = this.completion;
    const failure = this.failure;
    this.completion = null;
    this.failure = null;
    try { completion?.(); this.transaction.length = 0; }
    catch (error) {
      const failed = Object.freeze({ stepId: 'presentation-completion', error });
      this.lastFailure = failed; this.cancel(); failure?.(failed);
    }
  }
  private drainZeroDurationSteps(): void {
    while (this.current !== null && Math.max(0, this.current.durationSeconds) === 0) {
      try { this.current.update?.(1); this.current.finish?.(); }
      catch (error) { this.fail(error); return; }
      this.startNext();
      if (this.lastFailure !== null) return;
    }
  }
  private fail(error: unknown): void {
    const failed = Object.freeze({ stepId: this.current?.id ?? 'presentation-owner', error });
    const failure = this.failure;
    this.lastFailure = failed;
    this.cancel();
    failure?.(failed);
  }
  private recordBuildFailure(error: unknown, failure?: (failure: PresentationFailure) => void): void {
    const failed = Object.freeze({ stepId: 'presentation-plan-build', error });
    this.lastFailure = failed;
    failure?.(failed);
  }
}
