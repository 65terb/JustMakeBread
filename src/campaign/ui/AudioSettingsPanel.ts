import type { CampaignAudio } from '../CampaignAudio';

export class AudioSettingsPanel {
  readonly root: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly backdrop: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly controls: HTMLElement;
  private readonly range: HTMLInputElement;
  private readonly muteButton: HTMLButtonElement;
  private readonly muteMark: SVGPathElement;
  private openRequestHandler: (() => void) | null = null;
  private closeRequestHandler: (() => void) | null = null;
  private disposed = false;
  private readonly onToggle = (): void => { if (this.open) this.requestClose(); else this.requestOpen(); };
  private readonly onClose = (): void => { this.requestClose(); };
  private readonly onRangeInput: () => void;
  private readonly onMuteToggle: () => void;

  constructor(document: Document, audio: CampaignAudio) {
    const settings = audio.settings();
    this.root = document.createElement('aside'); this.root.className = 'audio-settings';
    this.root.innerHTML = `<button class="audio-settings__trigger" type="button" aria-label="설정" aria-controls="campaign-settings-modal"><svg class="audio-settings__gear" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.7 2h4.6l.55 2.2c.48.2.94.47 1.36.79l2.14-.66 2.3 3.98-1.6 1.55c.07.52.07 1.04 0 1.56l1.6 1.55-2.3 3.98-2.14-.66c-.42.32-.88.59-1.36.79L14.3 19h-4.6l-.55-2.2a7.5 7.5 0 0 1-1.36-.79l-2.14.66-2.3-3.98 1.6-1.55a6 6 0 0 1 0-1.56l-1.6-1.55 2.3-3.98 2.14.66c.42-.32.88-.59 1.36-.79L9.7 2Zm2.3 5.1a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z"/></svg></button><div class="audio-settings__backdrop" hidden><section id="campaign-settings-modal" class="audio-settings__modal" role="dialog" aria-modal="true" aria-labelledby="campaign-settings-title"><div class="audio-settings__heading"><h2 id="campaign-settings-title">설정</h2><button class="audio-settings__close" type="button" aria-label="설정 닫기">×</button></div><div class="audio-settings__controls"><label class="audio-settings__volume" for="campaign-settings-volume">볼륨</label><input id="campaign-settings-volume" class="audio-settings__range" type="range" min="0" max="1" step="0.05" value="${settings.volume}"><button class="audio-settings__mute" type="button" aria-label="음소거" aria-pressed="${settings.muted}"><svg class="audio-settings__speaker" viewBox="0 0 28 24" aria-hidden="true" focusable="false"><path class="audio-settings__speaker-shape" d="M3 9h5l6-5v16l-6-5H3V9Zm14.5-1.9a6 6 0 0 1 0 9.8l-1.7-2.1a3.3 3.3 0 0 0 0-5.6l1.7-2.1Zm2.8-3.1a10 10 0 0 1 0 16l-1.7-2.1a7.3 7.3 0 0 0 0-11.8L20.3 4Z"/><path class="audio-settings__mute-mark" d="M9 6 19 18M19 6 9 18"/></svg></button></div></section></div>`;
    this.toggle = this.root.querySelector<HTMLButtonElement>('.audio-settings__trigger')!;
    this.backdrop = this.root.querySelector<HTMLElement>('.audio-settings__backdrop')!;
    this.closeButton = this.root.querySelector<HTMLButtonElement>('.audio-settings__close')!;
    this.controls = this.root.querySelector<HTMLElement>('.audio-settings__controls')!;
    this.range = this.root.querySelector<HTMLInputElement>('input[type="range"]')!;
    this.muteButton = this.root.querySelector<HTMLButtonElement>('.audio-settings__mute')!;
    this.muteMark = this.root.querySelector<SVGPathElement>('.audio-settings__mute-mark')!;
    this.onRangeInput = () => audio.setVolume(Number(this.range.value));
    this.onMuteToggle = () => { audio.setMuted(!audio.settings().muted); this.renderMuted(audio.settings().muted); };
    this.renderMuted(settings.muted);
    this.backdrop.hidden = true;
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.addEventListener('click', this.onToggle);
    this.closeButton.addEventListener('click', this.onClose);
    this.range.addEventListener('input', this.onRangeInput);
    this.muteButton.addEventListener('click', this.onMuteToggle);
  }

  get open(): boolean { return !this.backdrop.hidden; }
  setOpenRequestHandler(handler: (() => void) | null): void { this.openRequestHandler = handler; }
  setCloseRequestHandler(handler: (() => void) | null): void { this.closeRequestHandler = handler; }
  openPanel(): void { if (!this.disposed) this.setOpen(true); }
  closePanel(): void { if (!this.disposed) this.setOpen(false); }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.openRequestHandler = null;
    this.closeRequestHandler = null;
    this.toggle.removeEventListener('click', this.onToggle);
    this.closeButton.removeEventListener('click', this.onClose);
    this.range.removeEventListener('input', this.onRangeInput);
    this.muteButton.removeEventListener('click', this.onMuteToggle);
    this.root.remove();
  }

  private requestOpen(): void { if (this.openRequestHandler !== null) this.openRequestHandler(); else this.openPanel(); }
  private requestClose(): void { if (this.closeRequestHandler !== null) this.closeRequestHandler(); else this.closePanel(); }
  private renderMuted(muted: boolean): void {
    this.controls.setAttribute('data-muted', muted ? 'true' : 'false');
    this.muteButton.setAttribute('aria-pressed', muted ? 'true' : 'false');
    this.muteMark.style.display = muted ? '' : 'none';
  }
  private setOpen(open: boolean): void {
    this.backdrop.hidden = !open;
    this.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}
