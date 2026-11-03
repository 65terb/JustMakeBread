export interface CampaignKeyboardReceiver {
  unlockAudio(): void;
  cancelGameplayInput(): void;
  keyDown(code: string, repeat: boolean, nowMilliseconds?: number): boolean;
  keyUp(code: string, nowMilliseconds?: number): boolean;
}

export interface CampaignKeyboardEventOwner {
  addEventListener(type: 'keydown' | 'keyup' | 'pointerdown' | 'pointercancel' | 'contextmenu', listener: EventListener): void;
  removeEventListener(type: 'keydown' | 'keyup' | 'pointerdown' | 'pointercancel' | 'contextmenu', listener: EventListener): void;
}

export interface CampaignKeyboardOwnerOptions {
  readonly window: CampaignKeyboardEventOwner;
  readonly receiver: CampaignKeyboardReceiver;
  readonly isIgnoredTarget?: (target: EventTarget | null) => boolean;
}

export function installCampaignKeyboardOwner(options: CampaignKeyboardOwnerOptions): () => void {
  const ignored = options.isIgnoredTarget ?? (() => false);
  const onKeyDown: EventListener = (rawEvent) => {
    const event = rawEvent as KeyboardEvent;
    if (ignored(event.target)) return;
    options.receiver.unlockAudio();
    if (options.receiver.keyDown(event.code, event.repeat, event.timeStamp)) event.preventDefault();
  };
  const onKeyUp: EventListener = (rawEvent) => {
    const event = rawEvent as KeyboardEvent;
    const handled = options.receiver.keyUp(event.code, event.timeStamp);
    if (!ignored(event.target) && handled) event.preventDefault();
  };
  const onPointerDown: EventListener = (rawEvent) => {
    const event = rawEvent as PointerEvent;
    options.receiver.unlockAudio();
    if (event.button === 2 || ignored(event.target)) options.receiver.cancelGameplayInput();
  };
  const onPointerCancel: EventListener = () => { options.receiver.cancelGameplayInput(); };
  const onContextMenu: EventListener = () => { options.receiver.cancelGameplayInput(); };
  options.window.addEventListener('keydown', onKeyDown);
  options.window.addEventListener('keyup', onKeyUp);
  options.window.addEventListener('pointerdown', onPointerDown);
  options.window.addEventListener('pointercancel', onPointerCancel);
  options.window.addEventListener('contextmenu', onContextMenu);
  return () => {
    options.window.removeEventListener('keydown', onKeyDown);
    options.window.removeEventListener('keyup', onKeyUp);
    options.window.removeEventListener('pointerdown', onPointerDown);
    options.window.removeEventListener('pointercancel', onPointerCancel);
    options.window.removeEventListener('contextmenu', onContextMenu);
  };
}
