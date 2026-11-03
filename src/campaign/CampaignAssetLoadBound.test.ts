import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CAMPAIGN_ASSET_REQUEST_TIMEOUT_MS, CampaignAssetLoadError, CampaignAssets,
  createCampaignBrowserAssetTransport, type CampaignAssetTransport,
} from './CampaignAssets';

function publicFile(url: string): string {
  if (url.startsWith('file:')) { const pathname = decodeURIComponent(new URL(url).pathname); return /^\/[A-Za-z]:\//.test(pathname) ? pathname.slice(1) : pathname; }
  return path.join(process.cwd(), 'public', ...url.split('/').filter(Boolean));
}

function fileTransport(overrides: Partial<CampaignAssetTransport> = {}): CampaignAssetTransport {
  return {
    binary: async (url, signal) => { if (signal?.aborted) throw new CampaignAssetLoadError(url, signal.reason); return new Uint8Array(await readFile(publicFile(url))).slice().buffer; },
    json: async (url, signal) => { if (signal?.aborted) throw new CampaignAssetLoadError(url, signal.reason); return JSON.parse(await readFile(publicFile(url), 'utf8')); },
    image: async () => ({ naturalWidth: 2176, naturalHeight: 384 }) as HTMLImageElement,
    ready: async (signal) => { if (signal?.aborted) throw new CampaignAssetLoadError('font readiness', signal.reason); },
    ...overrides,
  };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 200 && !predicate(); index += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  expect(predicate()).toBe(true);
}

describe('campaign asset load attempt boundary', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('loads and atomically publishes the shipped asset candidate on the normal path', async () => {
    vi.stubGlobal('self', globalThis); vi.stubGlobal('createImageBitmap', async () => ({ width: 1, height: 1, close: () => undefined }));
    const controller = new AbortController(); const assets = new CampaignAssets(fileTransport());
    await expect(assets.load(() => undefined, controller.signal)).resolves.toBeUndefined();
    expect(controller.signal.aborted).toBe(false);
    expect(assets.clonePrepared('player').name).toBe('player-prepared');
    expect((assets as unknown as { keycapAtlas: HTMLImageElement | null }).keycapAtlas).not.toBeNull();
  });

  it('keeps all candidates private when an abort-ignoring transport settles late', async () => {
    const base = fileTransport(); let release: (() => void) | null = null; let held = true;
    const transport = fileTransport({
      binary: (url, signal) => {
        if (held && url.includes('shared-process-block-stage0-v012.glb')) {
          held = false;
          return new Promise<ArrayBuffer>((resolve, reject) => { release = () => { void base.binary(url, signal).then(resolve, reject); }; });
        }
        return base.binary(url, signal);
      },
    });
    const assets = new CampaignAssets(transport); const controller = new AbortController(); const pending = assets.load(() => undefined, controller.signal);
    await waitUntil(() => release !== null); controller.abort(); release!();
    await expect(pending).rejects.toBeInstanceOf(CampaignAssetLoadError);
    expect(() => assets.clonePrepared('player')).toThrow(CampaignAssetLoadError);
    expect(() => assets.createKeycapTexture('E')).toThrow(CampaignAssetLoadError);
  });

  it('aborts a pending parallel sibling when one required static request fails', async () => {
    vi.stubGlobal('self', globalThis); vi.stubGlobal('createImageBitmap', async () => ({ width: 1, height: 1, close: () => undefined }));
    const base = fileTransport(); let siblingAbortCount = 0;
    const transport = fileTransport({
      binary: (url, signal) => {
        if (url.endsWith('stage_complete_a.wav')) return Promise.reject(new CampaignAssetLoadError(url));
        if (url.endsWith('pickup-mouth-pop.wav')) return new Promise<ArrayBuffer>((_resolve, reject) => signal?.addEventListener('abort', () => {
          siblingAbortCount += 1; reject(new CampaignAssetLoadError(url, signal.reason));
        }, { once: true }));
        return base.binary(url, signal);
      },
    });
    const assets = new CampaignAssets(transport);
    await expect(assets.load(() => undefined)).rejects.toBeInstanceOf(CampaignAssetLoadError);
    expect(siblingAbortCount).toBe(1); expect(() => assets.clonePrepared('player')).toThrow(CampaignAssetLoadError);
  });

  it('bounds the main-used browser binary request and aborts its fetch', async () => {
    vi.useFakeTimers(); let requestSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => { requestSignal = init?.signal as AbortSignal; return new Promise<Response>((_resolve, reject) => requestSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })); }));
    const pending = createCampaignBrowserAssetTransport().binary('/pending.glb');
    const rejected = expect(pending).rejects.toBeInstanceOf(CampaignAssetLoadError);
    await vi.advanceTimersByTimeAsync(CAMPAIGN_ASSET_REQUEST_TIMEOUT_MS);
    await rejected;
    expect(requestSignal?.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans image handlers on timeout and ignores a late callback', async () => {
    vi.useFakeTimers(); let instance: { onload: (() => void) | null; onerror: (() => void) | null; src: string } | null = null;
    class PendingImage { onload: (() => void) | null = null; onerror: (() => void) | null = null; src = ''; constructor() { instance = this; } }
    vi.stubGlobal('Image', PendingImage);
    const pending = createCampaignBrowserAssetTransport().image('/pending.png');
    const rejected = expect(pending).rejects.toBeInstanceOf(CampaignAssetLoadError);
    await vi.advanceTimersByTimeAsync(CAMPAIGN_ASSET_REQUEST_TIMEOUT_MS);
    await rejected;
    expect(instance!.onload).toBeNull(); expect(instance!.onerror).toBeNull(); expect(instance!.src).toBe(''); expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans image handlers and timers when its attempt is cancelled', async () => {
    vi.useFakeTimers(); let instance: { onload: (() => void) | null; onerror: (() => void) | null; src: string } | null = null;
    class PendingImage { onload: (() => void) | null = null; onerror: (() => void) | null = null; src = ''; constructor() { instance = this; } }
    vi.stubGlobal('Image', PendingImage); const controller = new AbortController();
    const pending = createCampaignBrowserAssetTransport().image('/cancel.png', controller.signal);
    const rejected = expect(pending).rejects.toBeInstanceOf(CampaignAssetLoadError); controller.abort(); await rejected;
    expect(instance!.onload).toBeNull(); expect(instance!.onerror).toBeNull(); expect(instance!.src).toBe(''); expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds font readiness without accepting fallback fonts', async () => {
    vi.useFakeTimers(); const check = vi.fn(() => true); const load = vi.fn(async () => [{} as FontFace]);
    vi.stubGlobal('document', { fonts: { load, ready: new Promise<void>(() => undefined), check } });
    const pending = createCampaignBrowserAssetTransport().ready();
    const rejected = expect(pending).rejects.toBeInstanceOf(CampaignAssetLoadError);
    await vi.advanceTimersByTimeAsync(CAMPAIGN_ASSET_REQUEST_TIMEOUT_MS);
    await rejected;
    expect(load).toHaveBeenCalledWith('900 16px Galmuri11', '0 / 30'); expect(check).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects an empty explicit Galmuri11 Bold face result before readiness publication', async () => {
    const check = vi.fn(() => true); const load = vi.fn(async () => [] as FontFace[]);
    vi.stubGlobal('document', { fonts: { load, ready: Promise.resolve(), check } });
    await expect(createCampaignBrowserAssetTransport().ready()).rejects.toBeInstanceOf(CampaignAssetLoadError);
    expect(load).toHaveBeenCalledWith('900 16px Galmuri11', '0 / 30'); expect(check).not.toHaveBeenCalled();
  });

  it('cleans a successful browser request without aborting it', async () => {
    vi.useFakeTimers(); let requestSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => { requestSignal = init?.signal as AbortSignal; return new Response(new Uint8Array([1, 2, 3])); }));
    await expect(createCampaignBrowserAssetTransport().binary('/ok.bin')).resolves.toEqual(new Uint8Array([1, 2, 3]).buffer);
    expect(requestSignal?.aborted).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
});
