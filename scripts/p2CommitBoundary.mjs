/**
 * Commit-boundary manifest for the reviewed P2 production wiring.
 *
 * This is intentionally a manifest, not a build-time import. It lets the
 * reviewer stage the verified hunks from mixed files while leaving unrelated
 * current-tree work in place.
 */
export const P2_BOUNDARY_INCLUDED_PATHS = Object.freeze([
  'scripts/check-deployment-readiness.mjs',
  'scripts/check-deployment-readiness.test.js',
  'scripts/p2CommitBoundary.mjs',
  'scripts/p2CommitBoundary.test.js',
  'src/p2FastRuntimeBoundary.ts',
  'src/p2FastRuntimeBoundary.test.ts',
  'src/fastModuleInsertionMotion.ts',
  'src/fastModuleInsertionMotion.test.ts',
  'src/fastModuleInteractionGate.ts',
  'src/fastModuleInteractionGate.test.ts',
  'src/playerRuntimeBoundary.ts',
  'src/audioRuntimeBoundary.ts',
  'src/flourRuntimeBoundary.ts',
  'src/i9PrimaryInteractionPrompt.ts',
  'src/i9PrimaryInteractionPrompt.test.ts',
  'src/i9InteractionPrompt.ts',
  'src/p4RPrimaryIntegration.test.ts',
  'src/heldStackVisual.ts',
  'src/main.ts',
]);

export const P2_BOUNDARY_RETAINED_RUNTIME_TEST_PATHS = Object.freeze([
  'src/p2FastRuntimeBoundary.test.ts',
  'src/fastModuleInsertionMotion.test.ts',
  'src/fastModuleInteractionGate.test.ts',
  'src/i9PrimaryInteractionPrompt.test.ts',
  'src/p4RPrimaryIntegration.test.ts',
  'src/q40AssetRuntimeVisual.test.ts',
  'src/q40FastLabelFit.test.ts',
  'src/i9Presentation/keycapPresentation.test.ts',
  'src/i9Presentation/keycapThreeAdapter.test.ts',
  'src/p4CResetPromptThreeFixture.test.ts',
]);

export const P2_BOUNDARY_HUNKS = Object.freeze({
  'scripts/check-deployment-readiness.mjs': Object.freeze([
    'optional character/Flour/audio deployment profile',
    'profile-aware public payload, model, rollback, and audio verification',
  ]),
  'scripts/check-deployment-readiness.test.js': Object.freeze([
    'reduced commit-safe payload fixture and profile oracle',
  ]),
  'scripts/p2CommitBoundary.test.js': Object.freeze([
    'Git-aware baseline player compile and automatic excluded-file classification',
  ]),
  'src/main.ts': Object.freeze([
    'boundary imports for Fast, player, Flour, and audio runtime consumers',
    'P2 Fast interaction/motion consumer call sites',
    'optional audio-settings DOM startup boundary',
    'empty optional Flour candidate guard',
  ]),
  'src/i9PrimaryInteractionPrompt.ts': Object.freeze([
    'P2 presentation-admission boundary import and use',
  ]),
  'src/p4RPrimaryIntegration.test.ts': Object.freeze([
    'P2 boundary wiring recurrence oracle',
  ]),
  'src/heldStackVisual.ts': Object.freeze([
    'runtime profile imports through Flour boundary',
  ]),
  'src/heldStackVisual.test.ts': Object.freeze([
    'runtime profile imports through player/Flour boundaries',
  ]),
  'src/q24FTokenVisual.test.ts': Object.freeze([
    'runtime profile imports through player/Flour boundaries',
  ]),
});

export const P2_BOUNDARY_EXCLUDED_PATHS = Object.freeze([
  'index.html',
  'src/style.css',
  'src/playerRuntimeVisual.ts',
  'src/playerRuntimeVisual.test.ts',
  'src/flourRuntimeVisual.ts',
  'src/flourRuntimeVisual.test.js',
  'src/audio/audioController.ts',
  'src/audio/audioManager.ts',
  'src/audio/audioSettings.ts',
  'src/audio/audioSettingsInput.ts',
  'src/audio/audioTypes.ts',
  'galmuri/Galmuri11.woff2',
  'src/heldStackVisual.test.ts',
  'src/q24FPrimaryIntegration.test.js',
  'src/q24FScaleAuthority.test.js',
  'src/q24FTokenVisual.test.ts',
  'src/i9Presentation/scoreboardAssetContract.test.js',
  'src/b1RuntimeAssets.test.js',
  'src/q24CFlourPrimaryIntegration.test.js',
]);

export const P2_BOUNDARY_EXCLUDED_PUBLIC_PREFIXES = Object.freeze([
  'assets/characters/stage1-worker/',
  'audio/',
  'assets/materials/stage1/LICENSE-FLOUR-TOKEN-V014.txt',
  'assets/materials/stage1/PROVENANCE-FLOUR-TOKEN-V014.json',
  'assets/materials/stage1/PROVENANCE-FLOUR-TOKEN-V014.md',
  'assets/materials/stage1/stage1-flour-token-b2-v014.sidecar.json',
  'assets/materials/stage1/stage1-flour-token-b2-v014.glb',
]);

export const P2_BOUNDARY_EXCLUDED_SOURCE_PREFIXES = Object.freeze([
  'ui/i9-scoreboard-keycaps/sources/',
  'galmuri/',
]);

const normalizePath = (value) => value.replaceAll('\\', '/');

export function isP2BoundaryPath(value) {
  const normalized = normalizePath(value);
  return P2_BOUNDARY_INCLUDED_PATHS.includes(normalized);
}

export function assertP2ProspectivePaths(paths) {
  const normalized = paths.map(normalizePath);
  const excluded = normalized.filter((path) => P2_BOUNDARY_EXCLUDED_PATHS.includes(path));
  if (excluded.length > 0) {
    throw new Error(`P2 prospective boundary contains excluded paths: ${excluded.join(', ')}`);
  }
  return normalized;
}
