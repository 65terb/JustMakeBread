export class CampaignFrameClock {
  private previousMilliseconds: number;
  private zeroNextDelta = false;

  constructor(initialMilliseconds: number) {
    this.previousMilliseconds = initialMilliseconds;
  }

  pauseTransition(nowMilliseconds: number, paused: boolean): void {
    this.previousMilliseconds = nowMilliseconds;
    if (!paused) this.zeroNextDelta = true;
  }

  sample(nowMilliseconds: number): number {
    const deltaSeconds = this.zeroNextDelta
      ? 0
      : Math.min(0.1, Math.max(0, (nowMilliseconds - this.previousMilliseconds) / 1000));
    this.zeroNextDelta = false;
    this.previousMilliseconds = nowMilliseconds;
    return deltaSeconds;
  }
}
