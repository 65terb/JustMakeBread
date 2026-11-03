export interface CampaignInputActions {
  readonly interactPressed: boolean;
  readonly interactHeld: boolean;
  readonly dropPressed: boolean;
  readonly moveBlockPressed: boolean;
  readonly retryPressed: boolean;
}

const MOVEMENT_CODES = Object.freeze(['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

export class CampaignInput {
  private readonly keys = new Set<string>();
  private readonly shiftKeys = new Set<'ShiftLeft' | 'ShiftRight'>();
  private readonly cancelledKeys = new Set<string>();
  private readonly cancelledShiftKeys = new Set<'ShiftLeft' | 'ShiftRight'>();
  private readonly keyDownTimes = new Map<string, number>();
  private readonly runQualifiedKeys = new Set<string>();
  private tapX = 0;
  private tapY = 0;
  private tapRunning = false;
  private interactPressed = false;
  private interactHeld = false;
  private dropPressed = false;
  private moveBlockPressed = false;
  private retryPressed = false;
  private readonly actionSnapshot = { interactPressed: false, interactHeld: false, dropPressed: false,
    moveBlockPressed: false, retryPressed: false };

  keyDown(code: string, repeat: boolean, nowMilliseconds?: number): boolean {
    if (MOVEMENT_CODES.includes(code)) {
      if (repeat && this.cancelledKeys.has(code)) return true;
      if (repeat) return true;
      if (!repeat && !this.keys.has(code)) {
        this.cancelledKeys.delete(code);
        if (Number.isFinite(nowMilliseconds)) this.keyDownTimes.set(code, nowMilliseconds!);
        if (this.isRunning) this.runQualifiedKeys.add(code); else this.runQualifiedKeys.delete(code);
      }
      this.keys.add(code); return true;
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      if (repeat && this.cancelledShiftKeys.has(code)) return true;
      if (!repeat) { this.cancelledShiftKeys.delete(code); this.shiftKeys.add(code); }
      return true;
    }
    if (repeat) return code === 'KeyE' || code === 'KeyQ' || code === 'KeyR' || code === 'Space';
    if (code === 'KeyE') {
      if (!this.interactHeld) this.interactPressed = true;
      this.interactHeld = true;
      return true;
    }
    if (code === 'KeyQ') { this.dropPressed = true; return true; }
    if (code === 'KeyR') { this.retryPressed = true; return true; }
    if (code === 'Space') { this.moveBlockPressed = true; return true; }
    return false;
  }
  keyUp(code: string, nowMilliseconds?: number, tapMaximumMilliseconds = 120, tapMinimumDistanceMeters = 0.18): boolean {
    if (MOVEMENT_CODES.includes(code)) {
      this.keys.delete(code);
      if (this.cancelledKeys.delete(code)) { this.keyDownTimes.delete(code); this.runQualifiedKeys.delete(code); return true; }
      const started = this.keyDownTimes.get(code); this.keyDownTimes.delete(code);
      if (started !== undefined && Number.isFinite(nowMilliseconds) && nowMilliseconds! - started < tapMaximumMilliseconds) {
        this.tapX = code === 'ArrowRight' ? tapMinimumDistanceMeters : code === 'ArrowLeft' ? -tapMinimumDistanceMeters : 0;
        this.tapY = code === 'ArrowDown' ? tapMinimumDistanceMeters : code === 'ArrowUp' ? -tapMinimumDistanceMeters : 0;
        this.tapRunning = this.runQualifiedKeys.has(code);
      }
      this.runQualifiedKeys.delete(code);
      return true;
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight') { this.shiftKeys.delete(code); this.cancelledShiftKeys.delete(code); return true; }
    if (code === 'KeyE') { this.interactHeld = false; return true; }
    if (code === 'Space') return true;
    return code === 'KeyQ' || code === 'KeyR';
  }
  readMovement(out: { x: number; y: number }): void {
    out.x = (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0);
    out.y = (this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('ArrowUp') ? 1 : 0);
  }
  get isRunning(): boolean { return this.shiftKeys.size > 0; }
  consumeTap(out: { x: number; y: number }): boolean {
    out.x = this.tapX; out.y = this.tapY;
    const pending = this.tapX !== 0 || this.tapY !== 0;
    this.tapX = 0; this.tapY = 0; return pending;
  }
  consumeTapRunning(): boolean { const running = this.tapRunning; this.tapRunning = false; return running; }
  consumeActions(): CampaignInputActions {
    this.actionSnapshot.interactPressed = this.interactPressed;
    this.actionSnapshot.interactHeld = this.interactHeld;
    this.actionSnapshot.dropPressed = this.dropPressed;
    this.actionSnapshot.moveBlockPressed = this.moveBlockPressed;
    this.actionSnapshot.retryPressed = this.retryPressed;
    this.interactPressed = false;
    this.dropPressed = false;
    this.moveBlockPressed = false;
    this.retryPressed = false;
    return this.actionSnapshot;
  }
  clear(): void {
    for (const key of this.keys) this.cancelledKeys.add(key);
    for (const key of this.shiftKeys) this.cancelledShiftKeys.add(key);
    this.keys.clear(); this.shiftKeys.clear(); this.keyDownTimes.clear(); this.runQualifiedKeys.clear();
    this.tapX = 0; this.tapY = 0; this.tapRunning = false; this.interactPressed = false; this.interactHeld = false;
    this.dropPressed = false; this.moveBlockPressed = false; this.retryPressed = false;
  }
}
