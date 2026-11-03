import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EXACT_STATIC_CONTRACTS, FORBIDDEN_CAMPAIGN_PAYLOADS, REQUIRED_CAMPAIGN_ASSETS } from './check-deployment-readiness.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('campaign deployment manifest', () => {
  it('contains the complete unique preload set', () => {
    expect(REQUIRED_CAMPAIGN_ASSETS.length).toBe(24);
    expect(new Set(REQUIRED_CAMPAIGN_ASSETS).size).toBe(REQUIRED_CAMPAIGN_ASSETS.length);
    expect(REQUIRED_CAMPAIGN_ASSETS).toContain('galmuri/Galmuri14.woff2');
    expect(REQUIRED_CAMPAIGN_ASSETS).toContain('galmuri/Galmuri11-Bold.woff2');
    expect(REQUIRED_CAMPAIGN_ASSETS).toContain('just_make_bread_thumbnail.png');
    expect(REQUIRED_CAMPAIGN_ASSETS.filter((asset) => asset.endsWith('.sidecar.json'))).toHaveLength(7);
  });

  it('keeps retired character and keycap payloads outside the runtime manifest', () => {
    expect(FORBIDDEN_CAMPAIGN_PAYLOADS).toHaveLength(9);
    for (const payload of FORBIDDEN_CAMPAIGN_PAYLOADS) expect(REQUIRED_CAMPAIGN_ASSETS.some((asset) => asset.endsWith(payload))).toBe(false);
    expect(REQUIRED_CAMPAIGN_ASSETS.filter((asset) => asset.endsWith('stage1-worker-user-motion-v010a.glb'))).toHaveLength(1);
    expect(REQUIRED_CAMPAIGN_ASSETS.filter((asset) => asset.endsWith('keycaps-atlas-1x.png'))).toHaveLength(1);
  });

  it('binds the approved thumbnail bytes to the exact readiness contract', async () => {
    const relativePath = 'just_make_bread_thumbnail.png';
    const content = await readFile(path.join(repositoryRoot, relativePath));
    const metadata = await stat(path.join(repositoryRoot, relativePath));
    const digest = createHash('sha256').update(content).digest('hex').toUpperCase();

    expect(EXACT_STATIC_CONTRACTS[relativePath]).toEqual([metadata.size, digest]);
  });
});
