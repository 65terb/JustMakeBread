export interface CampaignLifecycleDocument {
  readonly hidden: boolean;
  hasFocus(): boolean;
}

export function synchronizeCampaignLifecyclePause(
  document: CampaignLifecycleDocument,
  setPaused: (paused: boolean) => void,
): boolean {
  const paused = document.hidden || !document.hasFocus();
  setPaused(paused);
  return paused;
}

export interface CampaignLifecycleEventSource {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

export function installCampaignLifecycleOwner(options: Readonly<{
  document: CampaignLifecycleDocument & CampaignLifecycleEventSource;
  window: CampaignLifecycleEventSource;
  setPaused: (paused: boolean) => void;
}>): () => void {
  const synchronize = (): void => { synchronizeCampaignLifecyclePause(options.document, options.setPaused); };
  const pause = (): void => { options.setPaused(true); };
  options.document.addEventListener('visibilitychange', synchronize);
  options.window.addEventListener('blur', pause);
  options.window.addEventListener('focus', synchronize);
  synchronize();
  return () => {
    options.document.removeEventListener('visibilitychange', synchronize);
    options.window.removeEventListener('blur', pause);
    options.window.removeEventListener('focus', synchronize);
  };
}
