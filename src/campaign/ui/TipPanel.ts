export type CampaignTipId = 'stage0-absorption' | 'stage1' | 'stage2' | 'stage3';

export class TipPanel {
  readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly body: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private tipId: CampaignTipId | null = null;
  private openRequestHandler: (() => void) | null = null;
  private disposed = false;
  private readonly onClose = (): void => { this.closePanel(); };

  constructor(document: Document) {
    this.root = document.createElement('aside');
    this.root.className = 'campaign-tip';
    this.root.innerHTML = '<section id="campaign-tip-panel" class="campaign-tip__panel" role="dialog" aria-labelledby="campaign-tip-title" hidden><span id="campaign-tip-title" class="campaign-tip__title">Tip.</span><p class="campaign-tip__body"></p><button class="campaign-tip__close" type="button" aria-label="Tip 닫기">×</button></section>';
    this.panel = this.root.querySelector<HTMLElement>('.campaign-tip__panel')!;
    this.body = this.root.querySelector<HTMLElement>('.campaign-tip__body')!;
    this.closeButton = this.root.querySelector<HTMLButtonElement>('.campaign-tip__close')!;
    this.panel.hidden = true;
    this.closeButton.addEventListener('click', this.onClose);
  }

  publish(id: CampaignTipId, body: string): void {
    if (this.disposed) return;
    const changed = this.tipId !== id;
    this.tipId = id;
    this.body.textContent = body;
    this.root.dataset.tipId = id;
    if (changed) this.requestOpen();
  }

  clear(): void {
    if (this.disposed) return;
    this.tipId = null;
    this.body.textContent = '';
    delete this.root.dataset.tipId;
    this.closePanel();
  }

  get currentTipId(): CampaignTipId | null { return this.tipId; }
  get currentBody(): string { return this.body.textContent ?? ''; }
  get open(): boolean { return !this.panel.hidden; }
  setOpenRequestHandler(handler: (() => void) | null): void { this.openRequestHandler = handler; }
  openPanel(): void { if (!this.disposed && this.tipId !== null) this.setOpen(true); }
  closePanel(): void { if (!this.disposed) this.setOpen(false); }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.openRequestHandler = null;
    this.closeButton.removeEventListener('click', this.onClose);
    this.root.remove();
  }

  private requestOpen(): void {
    if (this.tipId === null) return;
    if (this.openRequestHandler !== null) this.openRequestHandler(); else this.openPanel();
  }

  private setOpen(open: boolean): void {
    const visible = open && this.tipId !== null;
    this.panel.hidden = !visible;
  }
}
