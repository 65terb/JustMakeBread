import { CAMPAIGN_RETRY_ACTION } from '../CampaignActions';

export class GameOverOverlay {
  readonly root: HTMLElement;
  private readonly button: HTMLButtonElement;
  private pending = false;
  constructor(document: Document, onRetry: () => void) {
    this.root = document.createElement('section');
    this.root.className = 'campaign-game-over-action';
    this.root.hidden = true;
    this.root.innerHTML = `<button type="button" data-action-id="${CAMPAIGN_RETRY_ACTION.id}">${CAMPAIGN_RETRY_ACTION.label}</button>`;
    this.button = this.root.querySelector('button')!;
    this.button.addEventListener('click', () => { if (!this.pending) onRetry(); });
  }
  show(): void { this.pending = false; this.root.hidden = false; this.button.disabled = false; this.button.focus(); }
  markPending(): void { this.pending = true; this.button.disabled = true; this.root.hidden = true; }
  hide(): void { this.root.hidden = true; this.pending = false; }
  dispose(): void { this.root.remove(); }
}
