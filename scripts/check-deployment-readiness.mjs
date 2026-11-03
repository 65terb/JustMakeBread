import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const EXACT_STATIC_CONTRACTS = Object.freeze({
  'public/ui/i9-scoreboard-keycaps/deliverables/keycaps/keycaps-atlas-1x.png': [85692, '3520DA92A522B2C6E5BE54AD9A51BEC1740E1C7EA5A11A3E1A2677AB394711C2'],
  'public/audio/stage1/stage_complete_a.wav': [109392, '3C851939CCF9146E49C1BE0272386FDCA1B1442BB034A5E6DCDFB3E0E144A411'],
  'public/audio/stage1/pickup-mouth-pop.wav': [88244, 'D604FFB77E3E794886BD3AEF0DAF54AB7AF8CA980712997B50A5567A7EF7DC43'],
  'public/audio/stage1/deposit_small_latch.wav': [77840, 'DA6DD440770196C2EFFC08C63ACAA8BB0D8BA6263CAB46E5D36B91069DDE2E9E'],
  'galmuri/Galmuri14.woff2': [564892, '79B34B22B86536D0FE9EBE7105DD5F20F56558D691C67A0C6432807A03EC5A82'],
  'galmuri/Galmuri11-Bold.woff2': [166632, '8643094F395AA2DBAD6BC4385CC043314801EAEC2E759D549435EC8AC4F2D078'],
  'just_make_bread_thumbnail.png': [1921246, '988FD2654367EE2A139170FF5C4491DB9AA12F9FEBFF72354D9BA4B0B1DE30B7'],
});

export const REQUIRED_CAMPAIGN_ASSETS = Object.freeze([
  'public/assets/characters/stage1-worker/stage1-worker-user-motion-v010a.glb',
  'public/assets/objects/stage2-q40/shared-process-block-stage0-v012.glb',
  'public/assets/objects/stage2-q40/shared-process-block-stage1-v010.glb',
  'public/assets/objects/stage2-q40/shared-process-block-stage2-v014.glb',
  'public/assets/objects/stage2-q40/shared-cube-master-v008.glb',
  'public/assets/objects/stage1-wheat-token/wheat-token-v010-color-a-v001.glb',
  'public/assets/materials/stage1/stage1-flour-token-b2-v014.glb',
  'public/assets/materials/stage1/stage1-flour-token-b2-v014.sidecar.json',
  'public/assets/objects/stage1-bread-token/stage1-bread-token-tripo-color-a-v002.glb',
  'public/assets/objects/stage1-wheat-source/stage1-wheat-source-v014-textured.glb',
  'public/assets/objects/stage1-wheat-source/stage1-wheat-source-v014.sidecar.json',
  'public/assets/objects/stage1-submission-dock/stage1-submission-dock-local-trial-v006.glb',
  'public/assets/objects/stage1-submission-dock/stage1-submission-dock-local-trial-v006.sidecar.json',
  'public/assets/objects/stage2-q40/shared-process-block-stage0-v012.sidecar.json',
  'public/assets/objects/stage2-q40/shared-process-block-stage1-v010.sidecar.json',
  'public/assets/objects/stage2-q40/shared-process-block-stage2-v014.sidecar.json',
  'public/assets/objects/stage2-q40/shared-cube-master-v008.sidecar.json',
  'public/ui/i9-scoreboard-keycaps/deliverables/keycaps/keycaps-atlas-1x.png',
  'public/audio/stage1/stage_complete_a.wav',
  'public/audio/stage1/pickup-mouth-pop.wav',
  'public/audio/stage1/deposit_small_latch.wav',
  'galmuri/Galmuri14.woff2',
  'galmuri/Galmuri11-Bold.woff2',
  'just_make_bread_thumbnail.png',
]);

export const FORBIDDEN_CAMPAIGN_PAYLOADS = Object.freeze([
  'assets/characters/stage1-worker/stage1-worker-v002.glb',
  'assets/characters/stage1-worker/stage1-worker-user-v005.glb',
  'assets/characters/stage1-worker/stage1-worker-user-motion-v007.glb',
  'assets/characters/stage1-worker/stage1-worker-user-motion-v008.glb',
  'ui/i9-scoreboard-keycaps/deliverables/keycaps/keycaps-atlas-1x.json',
  'ui/i9-scoreboard-keycaps/deliverables/keycaps/keycaps-atlas-2x.json',
  'ui/i9-scoreboard-keycaps/deliverables/keycaps/keycaps-atlas-2x.png',
  'ui/i9-scoreboard-keycaps/qa/asset-metadata.json',
  'ui/i9-scoreboard-keycaps/SHA256SUMS.txt',
]);

async function assertFile(relativePath) {
  const absolute = path.join(repositoryRoot, relativePath);
  const metadata = await stat(absolute);
  if (!metadata.isFile() || metadata.size === 0) throw new Error(`Missing deployment file: ${relativePath}`);
  const contract = EXACT_STATIC_CONTRACTS[relativePath];
  if (contract !== undefined) {
    const content = await readFile(absolute); const digest = createHash('sha256').update(content).digest('hex').toUpperCase();
    if (metadata.size !== contract[0] || digest !== contract[1]) throw new Error(`Changed deployment file: ${relativePath}`);
  }
}

export async function verifyDeploymentFiles() {
  for (const asset of REQUIRED_CAMPAIGN_ASSETS) await assertFile(asset);
  await assertFile('dist/index.html');
  const html = await readFile(path.join(repositoryRoot, 'dist/index.html'), 'utf8');
  if (!html.includes('Just Make BREAD!') || !/assets\/[^"']+\.js/u.test(html)) {
    throw new Error('Built entrypoint does not contain the campaign application.');
  }
  for (const relativePath of FORBIDDEN_CAMPAIGN_PAYLOADS) {
    for (const prefix of ['public', 'dist']) {
      try { await stat(path.join(repositoryRoot, prefix, relativePath)); throw new Error(`Retired deployment payload remains: ${prefix}/${relativePath}`); }
      catch (error) { if (error instanceof Error && !('code' in error && error.code === 'ENOENT')) throw error; }
    }
  }
  return Object.freeze({ assetCount: REQUIRED_CAMPAIGN_ASSETS.length });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyDeploymentFiles()
    .then(({ assetCount }) => console.log(`Deployment readiness PASS (${assetCount} required assets).`))
    .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
