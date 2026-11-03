import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  CAMPAIGN_ASSET_CONTRACTS, CAMPAIGN_REQUIRED_SIDECARS, CAMPAIGN_STATIC_BINARY_CONTRACTS, CampaignAssetLoadError,
  prepareCampaignAssetRoot, validateCampaignAssetBytes, validateCampaignSidecar, validateCampaignSidecarBytes, validateCampaignStaticBytes, validateParsedAsset,
  type CampaignAssetId,
} from './CampaignAssets';

function diskPath(url: string): string { return path.join(process.cwd(), 'public', ...url.split('/').filter(Boolean)); }
async function bytes(url: string): Promise<ArrayBuffer> { const data = await readFile(diskPath(url)); return new Uint8Array(data).slice().buffer; }

function decodeRgbaPng(data: Uint8Array): Readonly<{ width: number; height: number; alpha: (x: number, y: number) => number }> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength); const readU32 = (offset: number): number => view.getUint32(offset);
  const width = readU32(16); const height = readU32(20); const chunks: Uint8Array[] = []; let totalLength = 0;
  for (let offset = 8; offset < data.length;) { const length = readU32(offset); const type = String.fromCharCode(...data.subarray(offset + 4, offset + 8)); if (type === 'IDAT') { const chunk = data.subarray(offset + 8, offset + 8 + length); chunks.push(chunk); totalLength += chunk.length; } offset += length + 12; }
  const compressed = new Uint8Array(totalLength); let writeOffset = 0; for (const chunk of chunks) { compressed.set(chunk, writeOffset); writeOffset += chunk.length; }
  const raw = inflateSync(compressed); const stride = width * 4; const rows: Uint8Array[] = []; let previous = new Uint8Array(stride);
  const paeth = (left: number, up: number, upperLeft: number): number => { const value = left + up - upperLeft; const dl = Math.abs(value - left); const du = Math.abs(value - up); const dul = Math.abs(value - upperLeft); return dl <= du && dl <= dul ? left : du <= dul ? up : upperLeft; };
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!; const row = new Uint8Array(stride); const start = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x += 1) { const left = x >= 4 ? row[x - 4]! : 0; const up = previous[x]!; const upperLeft = x >= 4 ? previous[x - 4]! : 0;
      row[x] = (raw[start + x]! + (filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : filter === 4 ? paeth(left, up, upperLeft) : 0)) & 255; }
    rows.push(row); previous = row;
  }
  return { width, height, alpha: (x, y) => rows[y]![x * 4 + 3]! };
}

describe('shipped campaign asset contracts', () => {
  it('validates every exact deployed GLB and every required sidecar from the canonical table', async () => {
    for (const [idValue, definition] of Object.entries(CAMPAIGN_ASSET_CONTRACTS)) {
      const id = idValue as CampaignAssetId;
      await expect(validateCampaignAssetBytes(id, await bytes(definition.url))).resolves.toBeUndefined();
      if (definition.sidecar !== undefined) { await validateCampaignSidecarBytes(definition.sidecar, await bytes(definition.sidecar)); validateCampaignSidecar(id, JSON.parse(await readFile(diskPath(definition.sidecar), 'utf8'))); }
    }
    expect(CAMPAIGN_REQUIRED_SIDECARS).toHaveLength(7);
  });

  it('rejects one-byte GLB and sidecar mutations before a prepared game object exists', async () => {
    const definition = CAMPAIGN_ASSET_CONTRACTS['stage1-block']; const changed = new Uint8Array(await bytes(definition.url)); changed[changed.length - 1] ^= 1;
    await expect(validateCampaignAssetBytes('stage1-block', changed.buffer)).rejects.toBeInstanceOf(CampaignAssetLoadError);
    const sidecar = JSON.parse(await readFile(diskPath(definition.sidecar!), 'utf8')) as Record<string, unknown>;
    sidecar.approvedGeometry = { ...(sidecar.approvedGeometry as Record<string, unknown>), sha256: '0'.repeat(64) };
    expect(() => validateCampaignSidecar('stage1-block', sidecar)).toThrow(CampaignAssetLoadError);
    const exactSidecar = new Uint8Array(await bytes(definition.sidecar!)); exactSidecar[exactSidecar.length - 2] ^= 1;
    await expect(validateCampaignSidecarBytes(definition.sidecar!, exactSidecar.buffer)).rejects.toBeInstanceOf(CampaignAssetLoadError);
  });

  it('validates exact keycap, audio, and font bytes and rejects a changed retained asset', async () => {
    for (const [id, definition] of Object.entries(CAMPAIGN_STATIC_BINARY_CONTRACTS)) {
      const relative = id === 'galmuri-font' ? 'galmuri/Galmuri14.woff2' : id === 'galmuri11-bold-font' ? 'galmuri/Galmuri11-Bold.woff2' : `public${id}`;
      const data = await readFile(path.join(process.cwd(), relative)); const exact = new Uint8Array(data).slice();
      expect(exact.byteLength).toBe(definition.bytes); await expect(validateCampaignStaticBytes(id, exact.buffer)).resolves.toBeUndefined();
      exact[exact.length - 1] ^= 1; await expect(validateCampaignStaticBytes(id, exact.buffer)).rejects.toBeInstanceOf(CampaignAssetLoadError);
    }
  });

  it('keeps every tutorial keycap crop transparent at its corners and opaque at its center', async () => {
    const png = decodeRgbaPng(await readFile(diskPath('/ui/i9-scoreboard-keycaps/deliverables/keycaps/keycaps-atlas-1x.png')));
    expect([png.width, png.height]).toEqual([2176, 384]);
    for (const [column, width] of [[1, 128], [2, 128], [3, 128], [4, 128], [5, 128], [8, 256], [10, 256],
      [12, 128], [13, 128], [14, 128], [15, 128], [16, 128]] as const) {
      const x = column * 128;
      expect([png.alpha(x, 0), png.alpha(x + width - 1, 127)]).toEqual([0, 0]);
      expect(png.alpha(x + Math.floor(width / 2), 64)).toBe(255);
    }
  });

  it('parses the shipped authored block/module roots through the production validation and preparation seam', async () => {
    const loader = new GLTFLoader();
    for (const id of ['player', 'stage0-block', 'stage1-block', 'stage2-block', 'fast'] as const) {
      const definition = CAMPAIGN_ASSET_CONTRACTS[id]; const gltf = await loader.parseAsync(await bytes(definition.url), '');
      validateParsedAsset(id, gltf); const prepared = prepareCampaignAssetRoot(id, gltf.scene);
      expect(prepared.getObjectByName(`${id}-authored-visual`)).toBeDefined();
      expect(prepared.getObjectByName(id === 'player' ? 'player-authored-visual' : id === 'stage1-block' ? 'fastPocketSeat' : id === 'stage2-block' ? 'fastPocketSeatLeft' : id === 'fast' ? 'frontLabelFace' : 'functionNameFace')).toBeDefined();
    }
  });
});
