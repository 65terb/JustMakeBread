import { CAMPAIGN_RESTART_ACTION } from '../CampaignActions';
import type { CampaignScoreSnapshot } from '../CampaignScore';

export class FinalScoreOverlay {
  readonly root: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly total: HTMLElement;
  private readonly breakdown: HTMLElement;
  private committed = false;
  constructor(document: Document, onRestart: () => void) {
    this.root = document.createElement('section');
    this.root.className = 'campaign-result-overlay campaign-final-score';
    this.root.dataset.screen = 'campaign-result';
    this.root.hidden = true;
    this.root.innerHTML = `<div class="campaign-result-overlay__scrim" aria-hidden="true"></div><section class="campaign-result-panel campaign-final-score__panel" role="dialog" aria-modal="true" aria-labelledby="campaign-final-score-heading"><h1 id="campaign-final-score-heading" class="campaign-result-panel__heading">캠페인 완료</h1><p class="campaign-result-panel__total-label">총 점수<output class="campaign-result-panel__score campaign-final-score__total" aria-label="총 점수"></output></p><ol class="campaign-result-panel__rows campaign-final-score__breakdown"></ol><button class="campaign-result-panel__action" type="button" data-action-id="${CAMPAIGN_RESTART_ACTION.id}">${CAMPAIGN_RESTART_ACTION.label}</button></section>`;
    this.button = this.root.querySelector('button')!;
    this.total = this.root.querySelector('.campaign-final-score__total')!;
    this.breakdown = this.root.querySelector('.campaign-final-score__breakdown')!;
    this.button.addEventListener('keydown', (event) => {
      if (['KeyR', 'Enter', 'Space', 'KeyE'].includes(event.code)) { event.preventDefault(); event.stopPropagation(); }
    });
    this.button.addEventListener('click', () => {
      if (this.committed) return;
      this.committed = true;
      this.button.disabled = true;
      onRestart();
    });
  }
  show(score: CampaignScoreSnapshot): void {
    this.total.textContent = String(score.totalScore);
    this.breakdown.innerHTML = [score.stage0Score, score.stage1Score, score.stage2Score, score.stage3Score]
      .map((value, index) => `<li class="campaign-result-panel__row" data-stage="stage${index}"><span class="campaign-result-panel__row-label">Stage ${index}</span><output class="campaign-result-panel__row-score" aria-label="Stage ${index} score">${value}</output></li>`).join('');
    this.root.dataset.totalScore = String(score.totalScore);
    this.committed = false; this.root.hidden = false; this.button.disabled = false; this.button.focus();
  }
  hide(): void { this.root.hidden = true; }
  dispose(): void { this.root.remove(); }
}
