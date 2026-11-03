import * as THREE from 'three';
import { CampaignAssets, CampaignAssetLoadError } from './CampaignAssets';
import { CampaignGame } from './CampaignGame';
import { LoadingScreen } from './ui/LoadingScreen';
import { CAMPAIGN_CONFIG, validateCampaignConfig } from './CampaignConfig';

export type CampaignBootPhase = 'loading' | 'load-failed' | 'starting' | 'running' | 'disposed';

export interface CampaignViewport {
  readonly widthCssPixels: number;
  readonly heightCssPixels: number;
  readonly pixelRatio: number;
}

export interface CampaignBootOptions {
  readonly document: Document;
  readonly window: Window;
  readonly mount: HTMLElement;
  readonly tutorialSurface: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly onRunning?: () => void;
  readonly assets?: CampaignAssets;
}

export class CampaignBoot {
  phase: CampaignBootPhase = 'loading';
  private readonly loading: LoadingScreen;
  private readonly assets: CampaignAssets;
  private game: CampaignGame | null = null;
  private loadEpoch = 0;
  private loadController: AbortController | null = null;
  private disposed = false;
  private viewport: CampaignViewport | null = null;

  constructor(private readonly options: CampaignBootOptions) {
    this.assets = options.assets ?? new CampaignAssets();
    const thumbnailUrl = new URL('../../just_make_bread_thumbnail.png', import.meta.url).href;
    this.loading = new LoadingScreen(options.document, thumbnailUrl, () => { void this.load(); });
    options.mount.append(this.loading.root);
  }

  async load(): Promise<boolean> {
    if (this.disposed) return false;
    this.loadController?.abort();
    const controller = new AbortController(); this.loadController = controller;
    const epoch = ++this.loadEpoch;
    this.phase = 'loading';
    this.loading.setLoading('필수 자산을 불러오는 중…');
    try {
      await this.assets.load((label) => { if (epoch === this.loadEpoch && !controller.signal.aborted) this.loading.setLoading(label); }, controller.signal);
      validateCampaignConfig(CAMPAIGN_CONFIG);
      if (this.disposed || epoch !== this.loadEpoch || controller.signal.aborted) return false;
      if (this.viewport === null) throw new Error('Campaign viewport must be initialized before the game starts.');
      this.phase = 'starting';
      this.game = new CampaignGame({
        document: this.options.document,
        window: this.options.window,
        mount: this.options.mount,
        tutorialSurface: this.options.tutorialSurface,
        canvas: this.options.canvas,
        scene: this.options.scene,
        camera: this.options.camera,
        assets: this.assets,
        maxTextureAnisotropy: this.options.renderer.capabilities.getMaxAnisotropy(),
      });
      this.applyViewportToGame(this.viewport);
      this.loading.dispose();
      this.phase = 'running';
      this.options.canvas.focus();
      this.options.onRunning?.();
      this.render();
      return true;
    } catch (error) {
      if (this.disposed || epoch !== this.loadEpoch || controller.signal.aborted) return false;
      this.phase = 'load-failed';
      this.loading.setFailed(error instanceof CampaignAssetLoadError ? error.asset : '알 수 없는 파일');
      return false;
    } finally { if (this.loadController === controller) this.loadController = null; }
  }

  keyDown(key: string, repeat: boolean, nowMilliseconds?: number): boolean { return this.game?.keyDown(key, repeat, nowMilliseconds) ?? false; }
  keyUp(key: string, nowMilliseconds?: number): boolean { return this.game?.keyUp(key, nowMilliseconds) ?? false; }
  unlockAudio(): void { this.game?.unlockAudio(); }
  cancelGameplayInput(): void { this.game?.cancelGameplayInput(); }
  update(deltaSeconds: number): void { this.game?.update(deltaSeconds); }
  render(): void {
    if (this.phase !== 'running' || this.game === null || this.viewport === null) return;
    this.options.renderer.render(this.options.scene, this.options.camera);
  }
  resize(width: number, height: number, pixelRatio: number): void {
    this.viewport = Object.freeze({
      widthCssPixels: Math.max(1, width),
      heightCssPixels: Math.max(1, height),
      pixelRatio: Math.min(2, Math.max(1, pixelRatio)),
    });
    this.options.renderer.setPixelRatio(this.viewport.pixelRatio);
    this.options.renderer.setSize(this.viewport.widthCssPixels, this.viewport.heightCssPixels, false);
    if (this.game !== null) this.applyViewportToGame(this.viewport);
  }
  setPaused(paused: boolean): void { this.game?.setPaused(paused); }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.phase = 'disposed'; this.loadEpoch += 1; this.loadController?.abort(); this.loadController = null;
    this.game?.dispose(); this.game = null; this.loading.dispose(); this.options.renderer.dispose();
  }
  private applyViewportToGame(viewport: CampaignViewport): void {
    this.game?.resize(viewport.widthCssPixels, viewport.heightCssPixels);
  }
}
