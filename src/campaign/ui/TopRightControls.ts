import type { AudioSettingsPanel } from './AudioSettingsPanel';
import type { TipPanel } from './TipPanel';

export class TopRightControls {
  readonly root: HTMLElement;
  private readonly tip: TipPanel;
  private readonly audio: AudioSettingsPanel;
  private readonly setSettingsPaused: (paused: boolean) => void;
  private disposed = false;
  private readonly openTip = (): void => { this.closeAudio(); this.tip.openPanel(); };
  private readonly openAudio = (): void => {
    this.tip.closePanel();
    if (!this.audio.open) { this.setSettingsPaused(true); this.audio.openPanel(); }
  };
  private readonly closeAudio = (): void => {
    if (!this.audio.open) return;
    this.audio.closePanel();
    this.setSettingsPaused(false);
  };

  constructor(document: Document, tip: TipPanel, audio: AudioSettingsPanel, setSettingsPaused: (paused: boolean) => void) {
    this.tip = tip;
    this.audio = audio;
    this.setSettingsPaused = setSettingsPaused;
    this.root = document.createElement('div');
    this.root.className = 'campaign-top-right-controls';
    this.root.setAttribute('role', 'toolbar');
    this.root.setAttribute('aria-label', '게임 설정과 팁');
    this.tip.setOpenRequestHandler(this.openTip);
    this.audio.setOpenRequestHandler(this.openAudio);
    this.audio.setCloseRequestHandler(this.closeAudio);
    this.root.append(tip.root, audio.root);
  }

  get openPopover(): 'tip' | 'audio' | null { return this.tip.open ? 'tip' : this.audio.open ? 'audio' : null; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.tip.setOpenRequestHandler(null);
    this.audio.setOpenRequestHandler(null);
    this.audio.setCloseRequestHandler(null);
    this.tip.closePanel();
    if (this.audio.open) { this.audio.closePanel(); this.setSettingsPaused(false); }
    this.root.remove();
  }
}
