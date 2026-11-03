import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMPAIGN_ASSET_REQUEST_TIMEOUT_MS, CampaignAssetLoadError, createCampaignBrowserAssetTransport, type CampaignAssets } from './CampaignAssets';
import { CampaignBoot } from './CampaignBoot';
import { testBlockVisual, testModuleVisual, testPlayerVisual } from './test/CampaignTestVisuals';

class ElementStub {
  className = ''; innerHTML = ''; hidden = false; textContent: string | null = ''; disabled = false; checked = false; value = '0.35'; width = 0; height = 0;
  readonly style: Record<string, string> = {}; readonly dataset: Record<string, string> = {}; readonly children = new Map<string, ElementStub>(); readonly appended: unknown[] = []; removed = false;
  append(...nodes: unknown[]): void { this.appended.push(...nodes); } remove(): void { this.removed = true; } focus(): void {} setAttribute(): void {} addEventListener(): void {} removeEventListener(): void {} replaceChildren(): void {}
  querySelector<T>(selector: string): T { let child = this.children.get(selector); if (child === undefined) { child = new ElementStub(); this.children.set(selector, child); } return child as T; }
  getContext(): CanvasRenderingContext2D { const context = { fillStyle: '', textAlign: 'center', textBaseline: 'middle', font: '', lineJoin: 'round', lineWidth: 0, strokeStyle: '', fillRect: () => undefined, clearRect: () => undefined,
    fillText: () => undefined, strokeText: () => undefined, measureText: (text: string) => { const size = Number(context.font.match(/(\d+)px/)?.[1] ?? 16); return { width: text.length * size * 0.82, actualBoundingBoxAscent: size * 0.78, actualBoundingBoxDescent: size * 0.22 } as TextMetrics; }, drawImage: () => undefined, roundRect: () => undefined, fill: () => undefined, save: () => undefined, restore: () => undefined,
    translate: () => undefined, beginPath: () => undefined, moveTo: () => undefined, quadraticCurveTo: () => undefined, closePath: () => undefined,
    stroke: () => undefined, createLinearGradient: () => ({ addColorStop: () => undefined }) } as unknown as CanvasRenderingContext2D; return context; }
}
class AudioStub { preload = ''; volume = 0; currentTime = 0; cloneNode(): AudioStub { return new AudioStub(); } play(): Promise<void> { return Promise.resolve(); } pause(): void {} }
const documentStub = { createElement: () => new ElementStub(), createElementNS: () => new ElementStub() } as unknown as Document;

function preparedAssets(load: (progress: (label: string) => void, signal?: AbortSignal) => Promise<void>): CampaignAssets {
  return {
    load,
    clonePrepared(id: string): THREE.Object3D {
      if (id === 'player') return testPlayerVisual(); if (id === 'fast' || id === 'double' || id === 'again') return testModuleVisual();
      if (id === 'stage0-block') return testBlockVisual('socketless'); if (id === 'stage1-block') return testBlockVisual('single-socket'); if (id === 'stage2-block') return testBlockVisual('double-socket');
      const root = new THREE.Group();
      if (id === 'wheat-source') for (const name of ['wallAttachment', 'wheatSpawn', 'wheatExit']) { const anchor = new THREE.Group(); anchor.name = name; root.add(anchor); }
      if (id === 'submission-dock') for (const name of ['interactionProxyReference', 'breadContact', 'suctionTarget', 'goalBoardMount', 'outwardNormal']) { const anchor = new THREE.Group(); anchor.name = name; root.add(anchor); }
      return root;
    },
    createKeycapTexture: () => new THREE.Texture(), createEKeycapTexture: () => new THREE.Texture(), clips: () => [],
  } as unknown as CampaignAssets;
}

function bootWith(assets: CampaignAssets, onRunning: () => void = () => undefined): { boot: CampaignBoot; scene: THREE.Scene; mount: ElementStub } {
  const scene = new THREE.Scene(); const mount = new ElementStub();
  const renderer = { render: () => undefined, setPixelRatio: () => undefined, setSize: () => undefined, dispose: () => undefined,
    capabilities: { getMaxAnisotropy: () => 1 } } as unknown as THREE.WebGLRenderer;
  const boot = new CampaignBoot({ document: documentStub,
    window: { location: { reload: () => undefined } } as unknown as Window, mount: mount as unknown as HTMLElement,
    tutorialSurface: new ElementStub() as unknown as HTMLElement, canvas: new ElementStub() as unknown as HTMLCanvasElement,
    renderer, scene, camera: new THREE.PerspectiveCamera(), assets, onRunning });
  boot.resize(1280, 720, 1); return { boot, scene, mount };
}

describe('CampaignBoot required-asset boundary', () => {
  beforeEach(() => { Object.assign(globalThis, { document: documentStub, Audio: AudioStub, localStorage: { getItem: () => null, setItem: () => undefined } }); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); delete (globalThis as { document?: unknown }).document; delete (globalThis as { Audio?: unknown }).Audio; delete (globalThis as { localStorage?: unknown }).localStorage; });
  it('keeps the loading owner and creates no game graph or input owner when a required asset fails', async () => {
    const scene = new THREE.Scene(); let runningCount = 0; const mount = new ElementStub();
    const renderer = { render: () => undefined, setPixelRatio: () => undefined, setSize: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer;
    const boot = new CampaignBoot({ document: { createElement: () => new ElementStub() } as unknown as Document, window: {} as Window,
      mount: mount as unknown as HTMLElement, tutorialSurface: new ElementStub() as unknown as HTMLElement, canvas: Object.assign(new ElementStub(), { focus: () => undefined }) as unknown as HTMLCanvasElement,
      renderer, scene, camera: new THREE.PerspectiveCamera(), onRunning: () => { runningCount += 1; } });
    (boot as unknown as { assets: { load: () => Promise<void> } }).assets = { load: () => Promise.reject(new CampaignAssetLoadError('required.glb')) };
    expect(await boot.load()).toBe(false); expect(boot.phase).toBe('load-failed'); expect(runningCount).toBe(0); expect(scene.getObjectByName('campaign-map')).toBeUndefined();
    expect(scene.getObjectByName('campaign-player')).toBeUndefined(); expect(scene.children).toHaveLength(0); boot.dispose();
  });

  it('cancels a prior attempt, ignores its stale settlement, and publishes the successful retry once', async () => {
    let loadCount = 0; let abortCount = 0; let runningCount = 0; let settleFirst: (() => void) | null = null;
    const assets = preparedAssets((_progress, signal) => {
      loadCount += 1;
      if (loadCount === 1) return new Promise<void>((resolve) => { settleFirst = resolve; signal?.addEventListener('abort', () => { abortCount += 1; }, { once: true }); });
      return Promise.resolve();
    });
    const { boot, scene } = bootWith(assets, () => { runningCount += 1; });
    const first = boot.load(); await Promise.resolve(); const retry = boot.load();
    await expect(retry).resolves.toBe(true); expect(abortCount).toBe(1); expect(runningCount).toBe(1); expect(scene.getObjectByName('campaign-map')).toBeDefined();
    settleFirst!(); await expect(first).resolves.toBe(false); expect(runningCount).toBe(1); boot.dispose();
  });

  it('publishes a browser request timeout as load-failed and admits one fresh successful retry', async () => {
    vi.useFakeTimers(); let fetchCount = 0;
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
      fetchCount += 1; const signal = init?.signal as AbortSignal;
      if (fetchCount === 1) return new Promise<Response>((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
      return Promise.resolve(new Response(new Uint8Array([1])));
    }));
    const transport = createCampaignBrowserAssetTransport(); let loadCount = 0; let runningCount = 0;
    const assets = preparedAssets(async (_progress, signal) => { loadCount += 1; if (loadCount === 1) await transport.binary('/pending.glb', signal); });
    const { boot } = bootWith(assets, () => { runningCount += 1; });
    const timedOut = boot.load(); await vi.advanceTimersByTimeAsync(CAMPAIGN_ASSET_REQUEST_TIMEOUT_MS);
    await expect(timedOut).resolves.toBe(false); expect(boot.phase).toBe('load-failed'); expect(runningCount).toBe(0);
    await expect(boot.load()).resolves.toBe(true); expect(boot.phase).toBe('running'); expect(runningCount).toBe(1); boot.dispose();
  });

  it('aborts a pending attempt on dispose and publishes no game or late progress', async () => {
    let abortCount = 0; let lateProgress: (() => void) | null = null;
    const assets = preparedAssets((progress, signal) => new Promise<void>((_resolve, reject) => {
      lateProgress = () => progress('late'); signal?.addEventListener('abort', () => { abortCount += 1; reject(new CampaignAssetLoadError('cancelled')); }, { once: true });
    }));
    const { boot, scene, mount } = bootWith(assets); const loading = mount.appended[0] as ElementStub;
    const pending = boot.load(); await Promise.resolve(); boot.dispose(); lateProgress!();
    await expect(pending).resolves.toBe(false); expect(abortCount).toBe(1); expect(boot.phase).toBe('disposed'); expect(scene.children).toHaveLength(0);
    expect(loading.removed).toBe(true);
  });
});
