export class LoadingScreen {
  readonly root: HTMLElement;
  readonly thumbnail: HTMLImageElement;
  private readonly status: HTMLElement;
  private readonly retry: HTMLButtonElement;
  constructor(document: Document, thumbnailUrl: string, onRetry: () => void) {
    this.root = document.createElement('section');
    this.root.className = 'campaign-loading';
    this.root.setAttribute('aria-label', '게임 로딩');
    this.root.innerHTML = `<img class="campaign-loading__thumbnail" alt=""><div class="campaign-loading__shade"><p class="campaign-loading__status">불러오는 중…</p><button type="button" hidden>다시 불러오기</button></div>`;
    this.thumbnail = this.root.querySelector('.campaign-loading__thumbnail')!;
    this.thumbnail.src = thumbnailUrl;
    this.status = this.root.querySelector('.campaign-loading__status')!;
    this.retry = this.root.querySelector('button')!;
    this.retry.addEventListener('click', onRetry);
  }
  setLoading(label: string): void { this.status.textContent = label; this.retry.hidden = true; }
  setFailed(file: string): void { this.status.textContent = `불러오지 못했습니다: ${file}`; this.retry.hidden = false; this.retry.focus(); }
  dispose(): void { this.root.remove(); }
}
