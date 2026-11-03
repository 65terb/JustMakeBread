import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CAMPAIGN_CONFIG } from './CampaignConfig';
import { CAMPAIGN_SCOREBOARD_FONT_LOAD_SAMPLE, CAMPAIGN_SCOREBOARD_FONT_LOAD_SPEC } from './presentation/CampaignScoreboardTypography';

export type CampaignAssetId = 'player' | 'stage0-block' | 'stage1-block' | 'stage2-block' | 'fast' | 'double' | 'again' | 'wheat' | 'flour' | 'bread' | 'wheat-source' | 'submission-dock';
export const CAMPAIGN_MODULE_BODY_MESH_NAME = 'sharedCubeGeometry';
interface BinaryContract { readonly url: string; readonly bytes: number; readonly sha256: string; readonly boundsMin: readonly [number, number, number]; readonly boundsMax: readonly [number, number, number]; readonly meshes: number; readonly materials: number; readonly sidecar?: string; }
function contract(url: string, bytes: number, sha256: string, boundsMin: readonly [number, number, number], boundsMax: readonly [number, number, number], sidecar?: string, meshes = 1, materials = 1): BinaryContract { return Object.freeze({ url, bytes, sha256, boundsMin, boundsMax, meshes, materials, sidecar }); }

export const CAMPAIGN_ASSET_CONTRACTS: Readonly<Record<CampaignAssetId, BinaryContract>> = Object.freeze({
  player: contract('/assets/characters/stage1-worker/stage1-worker-user-motion-v010a.glb', 326688, '7FFB53974131C8481F44EB22C17E3533AB55E15FE679E5E37C9FD2CFBE315F5F', [-0.35005029527920534, 0.004869129028408866, -0.16997029623759788], [0.3406027112428591, 1.2039963198996726, 0.16229291086391895]),
  'stage0-block': contract('/assets/objects/stage2-q40/shared-process-block-stage0-v012.glb', 25748, '82291B557E13F8EE96827C87E474FA04F4A8B42181EF2C4018DD3ADF5412718C', [-0.949999988079071, -0.8600000143051147, -0.949999988079071], [1.2000000476837158, 0.8600000143051147, 0.949999988079071], '/assets/objects/stage2-q40/shared-process-block-stage0-v012.sidecar.json'),
  'stage1-block': contract('/assets/objects/stage2-q40/shared-process-block-stage1-v010.glb', 26080, 'C910EEC88852015170E06CF9B222B20F35116DA9A3A123CB8119B5EFBFAEF369', [-0.949999988079071, -0.8600000143051147, -0.949999988079071], [1.2000000476837158, 0.8600000143051147, 0.949999988079071], '/assets/objects/stage2-q40/shared-process-block-stage1-v010.sidecar.json'),
  'stage2-block': contract('/assets/objects/stage2-q40/shared-process-block-stage2-v014.glb', 29244, '83CCD58C23C7472A0868207999696D1F2BE0C7F089B3BDBB2C93C7682170852E', [-0.949999988079071, -0.8600000143051147, -0.949999988079071], [1.2000000476837158, 0.8600000143051147, 0.949999988079071], '/assets/objects/stage2-q40/shared-process-block-stage2-v014.sidecar.json'),
  fast: contract('/assets/objects/stage2-q40/shared-cube-master-v008.glb', 15384, 'FE6CECF782405AA474CC9BA57D154A2A266BEAABE5664111C01302F5C80D7E29', [-0.3400000035762787, -0.3400000035762787, -0.3400000035762787], [0.3400000035762787, 0.3400000035762787, 0.3400000035762787], '/assets/objects/stage2-q40/shared-cube-master-v008.sidecar.json'),
  double: contract('/assets/objects/stage2-q40/shared-cube-master-v008.glb', 15384, 'FE6CECF782405AA474CC9BA57D154A2A266BEAABE5664111C01302F5C80D7E29', [-0.3400000035762787, -0.3400000035762787, -0.3400000035762787], [0.3400000035762787, 0.3400000035762787, 0.3400000035762787], '/assets/objects/stage2-q40/shared-cube-master-v008.sidecar.json'),
  again: contract('/assets/objects/stage2-q40/shared-cube-master-v008.glb', 15384, 'FE6CECF782405AA474CC9BA57D154A2A266BEAABE5664111C01302F5C80D7E29', [-0.3400000035762787, -0.3400000035762787, -0.3400000035762787], [0.3400000035762787, 0.3400000035762787, 0.3400000035762787], '/assets/objects/stage2-q40/shared-cube-master-v008.sidecar.json'),
  wheat: contract('/assets/objects/stage1-wheat-token/wheat-token-v010-color-a-v001.glb', 2843448, 'BE5F9CAF6B1B7E6C3E5090E07A3FFDEF529C0CE8739D08EED398596B4A1CFE1F', [-0.16772396862506866, -0.5, -0.24300456047058105], [0.16772396862506866, 0.5, 0.24300456047058105]),
  flour: contract('/assets/materials/stage1/stage1-flour-token-b2-v014.glb', 2249484, '270820AE7A5C21B5825DA1D7284E6ACD540544E93C08891773F9CAB4F3FF8660', [-0.32640889286994934, -0.4269358217716217, -0.5], [0.32640889286994934, 0.4269358217716217, 0.5], '/assets/materials/stage1/stage1-flour-token-b2-v014.sidecar.json'),
  bread: contract('/assets/objects/stage1-bread-token/stage1-bread-token-tripo-color-a-v002.glb', 2647132, '1E84A567BB72D9491101884644E1A7AC52B4A9DA65C7594172A66AB32D485515', [-0.10999999940395355, 0, -0.0814913958311081], [0.10999999940395355, 0.09817922115325928, 0.0814913958311081]),
  'wheat-source': contract('/assets/objects/stage1-wheat-source/stage1-wheat-source-v014-textured.glb', 3013048, 'ADC78BF98B72ED807A26008E08F3273DDBC6570E5582B8A453F6C6DC29578BC8', [-0.4981782436, -0.4937635064, -0.5], [0.4981782436, 0.4937635064, 0.5], '/assets/objects/stage1-wheat-source/stage1-wheat-source-v014.sidecar.json'),
  'submission-dock': contract('/assets/objects/stage1-submission-dock/stage1-submission-dock-local-trial-v006.glb', 51544, '440A270CD78EE2C289E4E64D530B24A67E8909B35840DF9AF7182522D10E7CFF', [-0.9750000238418579, -0.41999998688697815, -0.6299999952316284], [0.9750000238418579, 0.41999998688697815, 0], '/assets/objects/stage1-submission-dock/stage1-submission-dock-local-trial-v006.sidecar.json', 4, 4),
});
const PREPARED_BOUNDS: Readonly<Record<CampaignAssetId, Readonly<{ min: readonly [number, number, number]; max: readonly [number, number, number] }>>> = Object.freeze({
  player: { min: [-0.41190618582799543, 0, -0.19626812028872603], max: [0.42333157434443053, 1.4501584726442083, 0.2055527279034578] },
  'stage0-block': { min: [-0.949999988079071, 0.0009999999948852034, -0.949999988079071], max: [1.2000000476837158, 1.7210000286051147, 0.949999988079071] },
  'stage1-block': { min: [-0.949999988079071, 0.0009999999948852034, -0.949999988079071], max: [1.2000000476837158, 1.7210000286051147, 0.949999988079071] },
  'stage2-block': { min: [-0.949999988079071, 0.0009999999948852034, -0.949999988079071], max: [1.2000000476837158, 1.7210000286051147, 0.949999988079071] },
  fast: { min: [-0.3400000035762787, -0.3400000035762787, -0.3400000035762787], max: [0.3400000035762787, 0.3400000035762787, 0.3400000035762787] },
  double: { min: [-0.3400000035762787, -0.3400000035762787, -0.3400000035762787], max: [0.3400000035762787, 0.3400000035762787, 0.3400000035762787] },
  again: { min: [-0.3400000035762787, -0.3400000035762787, -0.3400000035762787], max: [0.3400000035762787, 0.3400000035762787, 0.3400000035762787] },
  wheat: { min: [-0.12076125741004944, 0, -0.17496328353881835], max: [0.12076125741004944, 0.72, 0.17496328353881835] },
  flour: { min: [-0.10510851477938808, 0, -0.161007431285376], max: [0.10510851477938808, 0.2749593599486397, 0.161007431285376] },
  bread: { min: [-0.2513279986381531, 0, -0.1861915411949158], max: [0.2513279986381531, 0.22431988449096682, 0.1861915411949158] },
  'wheat-source': { min: [-0.42843328952789305, 0, -0.43], max: [0.42843328952789305, 0.8492732310295105, 0.43] },
  'submission-dock': { min: [-0.9750000238418579, -0.41999998688697815, -0.6299999952316284], max: [0.9750000238418579, 0.41999998688697815, 0] },
});
export const CAMPAIGN_PREPARED_MATERIAL_HEIGHT_METERS: Readonly<Record<'flour' | 'bread', number>> = Object.freeze({
  flour: PREPARED_BOUNDS.flour.max[1] - PREPARED_BOUNDS.flour.min[1],
  bread: PREPARED_BOUNDS.bread.max[1] - PREPARED_BOUNDS.bread.min[1],
});
export const CAMPAIGN_PREPARED_HELD_LATERAL_WIDTH_METERS: Readonly<Record<'flour' | 'bread', number>> = Object.freeze({
  flour: PREPARED_BOUNDS.flour.max[0] - PREPARED_BOUNDS.flour.min[0],
  bread: PREPARED_BOUNDS.bread.max[2] - PREPARED_BOUNDS.bread.min[2],
});
const REQUIRED_PLAYER_CLIPS = Object.freeze(['BlockMoveFront_A', 'BlockPull_A', 'BlockPush_A', 'CarryWalking_A', 'Holding_A', 'Idle_A', 'Running_A', 'Walking_A']);
export const CAMPAIGN_REQUIRED_SIDECARS = Object.freeze([...new Set(Object.values(CAMPAIGN_ASSET_CONTRACTS).flatMap((entry) => entry.sidecar === undefined ? [] : [entry.sidecar]))]);
export const CAMPAIGN_SIDECAR_BYTE_CONTRACTS: Readonly<Record<string, Readonly<{ bytes: number; sha256: string }>>> = Object.freeze({
  '/assets/objects/stage1-wheat-source/stage1-wheat-source-v014.sidecar.json': Object.freeze({ bytes: 2271, sha256: '8EBD6CE9F6DA0FDA6EBA126390B46E6607405822031CB0BE31C18273A45EDF25' }),
  '/assets/objects/stage1-submission-dock/stage1-submission-dock-local-trial-v006.sidecar.json': Object.freeze({ bytes: 3943, sha256: '68323E4378EA9BFEB693AA251338B0DF9941B8682F356261F79ECE858B17C574' }),
  '/assets/objects/stage2-q40/shared-process-block-stage0-v012.sidecar.json': Object.freeze({ bytes: 4699, sha256: 'F09614B57D88DA3555B7CB2512E5621E8586697931C58CB4DDAB4D42113656DB' }),
  '/assets/objects/stage2-q40/shared-process-block-stage1-v010.sidecar.json': Object.freeze({ bytes: 5524, sha256: '6492E7FCF0C20181534CF827FADC64054667A615613AEC19A6CEB1B836E78ABC' }),
  '/assets/objects/stage2-q40/shared-process-block-stage2-v014.sidecar.json': Object.freeze({ bytes: 8993, sha256: '74704D99C19DFB12B86FE9237439D168161F56CBDB03E762CC93C83E692F3539' }),
  '/assets/objects/stage2-q40/shared-cube-master-v008.sidecar.json': Object.freeze({ bytes: 1914, sha256: 'B7A793EED5C42E0DA2A330C9A4CBEE7E13B629A6E70D1EDD62FA975AB2E77751' }),
  '/assets/materials/stage1/stage1-flour-token-b2-v014.sidecar.json': Object.freeze({ bytes: 6872, sha256: '612B2A04AFF3A0D04C1DFACA1EC5069E9EC1888AE35B55A12C64FA8205E5F9FC' }),
});
export const CAMPAIGN_STATIC_BINARY_CONTRACTS: Readonly<Record<string, Readonly<{ bytes: number; sha256: string }>>> = Object.freeze({
  '/ui/i9-scoreboard-keycaps/deliverables/keycaps/keycaps-atlas-1x.png': Object.freeze({ bytes: 85692, sha256: '3520DA92A522B2C6E5BE54AD9A51BEC1740E1C7EA5A11A3E1A2677AB394711C2' }),
  '/audio/stage1/stage_complete_a.wav': Object.freeze({ bytes: 109392, sha256: '3C851939CCF9146E49C1BE0272386FDCA1B1442BB034A5E6DCDFB3E0E144A411' }),
  '/audio/stage1/pickup-mouth-pop.wav': Object.freeze({ bytes: 88244, sha256: 'D604FFB77E3E794886BD3AEF0DAF54AB7AF8CA980712997B50A5567A7EF7DC43' }),
  '/audio/stage1/deposit_small_latch.wav': Object.freeze({ bytes: 77840, sha256: 'DA6DD440770196C2EFFC08C63ACAA8BB0D8BA6263CAB46E5D36B91069DDE2E9E' }),
  'galmuri-font': Object.freeze({ bytes: 564892, sha256: '79B34B22B86536D0FE9EBE7105DD5F20F56558D691C67A0C6432807A03EC5A82' }),
  'galmuri11-bold-font': Object.freeze({ bytes: 166632, sha256: '8643094F395AA2DBAD6BC4385CC043314801EAEC2E759D549435EC8AC4F2D078' }),
});
export class CampaignAssetLoadError extends Error { constructor(readonly asset: string, cause?: unknown) { super(`Required campaign asset failed: ${asset}`, { cause }); } }
export const CAMPAIGN_ASSET_REQUEST_TIMEOUT_MS = 10_000;
export interface CampaignAssetTransport {
  readonly binary: (url: string, signal?: AbortSignal) => Promise<ArrayBuffer>;
  readonly json: (url: string, signal?: AbortSignal) => Promise<unknown>;
  readonly image: (url: string, signal?: AbortSignal) => Promise<HTMLImageElement>;
  readonly ready: (signal?: AbortSignal) => Promise<void>;
}

export class CampaignAssets {
  private roots: ReadonlyMap<CampaignAssetId, THREE.Object3D> = new Map();
  private animations: ReadonlyMap<CampaignAssetId, readonly THREE.AnimationClip[]> = new Map();
  private keycapAtlas: HTMLImageElement | null = null;
  constructor(private readonly transport: CampaignAssetTransport = createCampaignBrowserAssetTransport()) {}
  async load(onProgress: (label: string) => void, signal: AbortSignal = new AbortController().signal): Promise<void> {
    const attempt = new AbortController();
    const abortAttempt = (): void => { if (!attempt.signal.aborted) attempt.abort(signal.reason); };
    if (signal.aborted) abortAttempt(); else signal.addEventListener('abort', abortAttempt, { once: true });
    const candidateRoots = new Map<CampaignAssetId, THREE.Object3D>();
    const candidateAnimations = new Map<CampaignAssetId, readonly THREE.AnimationClip[]>();
    let candidateKeycapAtlas: HTMLImageElement | null = null;
    const loader = new GLTFLoader(); const parsedByUrl = new Map<string, GLTF>(); const sidecars = new Map<string, unknown>();
    const ensureCurrent = (asset: string): void => { if (attempt.signal.aborted) throw new CampaignAssetLoadError(asset, attempt.signal.reason); };
    try {
      for (const url of CAMPAIGN_REQUIRED_SIDECARS) {
        ensureCurrent(url); const bytes = await this.transport.binary(url, attempt.signal); ensureCurrent(url);
        await validateCampaignSidecarBytes(url, bytes); ensureCurrent(url); sidecars.set(url, JSON.parse(new TextDecoder().decode(bytes)));
      }
      for (const [idValue, definition] of Object.entries(CAMPAIGN_ASSET_CONTRACTS)) {
        const id = idValue as CampaignAssetId; ensureCurrent(definition.url); onProgress(`불러오는 중: ${id}`);
        try {
          let gltf = parsedByUrl.get(definition.url);
          if (gltf === undefined) {
            const bytes = await this.transport.binary(definition.url, attempt.signal); ensureCurrent(definition.url);
            await validateCampaignAssetBytes(id, bytes, definition); ensureCurrent(definition.url);
            gltf = await loader.parseAsync(bytes, definition.url.slice(0, definition.url.lastIndexOf('/') + 1)); ensureCurrent(definition.url); parsedByUrl.set(definition.url, gltf);
          }
          validateParsedAsset(id, gltf, definition); if (definition.sidecar !== undefined) validateCampaignSidecar(id, sidecars.get(definition.sidecar), definition);
          candidateRoots.set(id, gltf.scene); candidateAnimations.set(id, Object.freeze([...gltf.animations]));
        } catch (error) { throw error instanceof CampaignAssetLoadError ? error : new CampaignAssetLoadError(definition.url, error); }
      }
      const staticUrls = Object.keys(CAMPAIGN_STATIC_BINARY_CONTRACTS).filter((url) => url !== 'galmuri-font' && url !== 'galmuri11-bold-font');
      await Promise.all(staticUrls.map(async (url) => { const bytes = await this.transport.binary(url, attempt.signal); ensureCurrent(url); await validateCampaignStaticBytes(url, bytes); }));
      ensureCurrent('static assets');
      const fontUrl = new URL('../../galmuri/Galmuri14.woff2', import.meta.url).href;
      await validateCampaignStaticBytes('galmuri-font', await this.transport.binary(fontUrl, attempt.signal)); ensureCurrent('galmuri-font');
      const scoreboardFontUrl = new URL('../../galmuri/Galmuri11-Bold.woff2', import.meta.url).href;
      await validateCampaignStaticBytes('galmuri11-bold-font', await this.transport.binary(scoreboardFontUrl, attempt.signal)); ensureCurrent('galmuri11-bold-font');
      candidateKeycapAtlas = await this.transport.image('/ui/i9-scoreboard-keycaps/deliverables/keycaps/keycaps-atlas-1x.png', attempt.signal); ensureCurrent('keycaps-atlas');
      if (candidateKeycapAtlas.naturalWidth !== 2176 || candidateKeycapAtlas.naturalHeight !== 384) throw new CampaignAssetLoadError('keycaps-atlas dimensions');
      await this.transport.ready(attempt.signal); ensureCurrent('font readiness');
      this.roots = candidateRoots; this.animations = candidateAnimations; this.keycapAtlas = candidateKeycapAtlas;
    } catch (error) {
      abortAttempt();
      throw error instanceof CampaignAssetLoadError ? error : new CampaignAssetLoadError('campaign asset attempt', error);
    } finally {
      signal.removeEventListener('abort', abortAttempt);
    }
  }
  clonePrepared(id: CampaignAssetId): THREE.Object3D {
    const source = this.roots.get(id); if (source === undefined) throw new CampaignAssetLoadError(id); return prepareCampaignAssetRoot(id, source);
  }
  clips(id: CampaignAssetId): readonly THREE.AnimationClip[] { return this.animations.get(id) ?? Object.freeze([]); }
  createKeycapTexture(label: 'W' | 'A' | 'S' | 'D' | 'E' | 'Q' | 'ARROWUP' | 'ARROWLEFT' | 'ARROWDOWN' | 'ARROWRIGHT' | 'SPACE' | 'SHIFT'): THREE.Texture {
    if (this.keycapAtlas === null) throw new CampaignAssetLoadError('keycaps-atlas'); const wide = label === 'SPACE' || label === 'SHIFT';
    const column = label === 'W' ? 1 : label === 'A' ? 2 : label === 'S' ? 3 : label === 'D' ? 4 : label === 'E' ? 5 : label === 'SPACE' ? 8 : label === 'SHIFT' ? 10 :
      label === 'Q' ? 12 : label === 'ARROWUP' ? 13 : label === 'ARROWLEFT' ? 14 : label === 'ARROWDOWN' ? 15 : 16;
    const canvas = document.createElement('canvas'); canvas.width = wide ? 256 : 128; canvas.height = 128; const context = canvas.getContext('2d'); if (context === null) throw new CampaignAssetLoadError('keycaps-atlas canvas');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(this.keycapAtlas, column * 128, 0, wide ? 256 : 128, 128, 0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
    const regionLabel = label.startsWith('ARROW') ? `arrow-${label.slice(5).toLowerCase()}` : label.toLowerCase();
    texture.userData.approvedAtlasRegion = label === 'SPACE' ? 'wide-space-normal' : label === 'SHIFT' ? 'wide-shift-normal' : `standard-${regionLabel}-normal`;
    return texture;
  }
  createEKeycapTexture(): THREE.Texture { return this.createKeycapTexture('E'); }
}

export function prepareCampaignAssetRoot(id: CampaignAssetId, source: THREE.Object3D): THREE.Object3D {
  const wrapper = new THREE.Group(); wrapper.name = `${id}-prepared`; const visual = cloneSkeleton(source); visual.name = `${id}-authored-visual`; wrapper.add(visual);
  if (id === 'player') { visual.scale.setScalar(1.209345); visual.position.y = -0.004869129028408866 * 1.209345; visual.rotation.y = Math.PI; }
  else if (id === 'wheat-source') { visual.scale.setScalar(0.86); visual.position.y = 0.42463661551475525; addAnchor(wrapper, 'wallAttachment', -0.42843328952789305, 0.42463661551475525, 0); addAnchor(wrapper, 'outletLip', 0.37331305861473085, 0.42463661551475525, 0); addAnchor(wrapper, 'wheatSpawn', 0.1515436127865448, 0.42463661551475525, 0); addAnchor(wrapper, 'wheatExit', 0.5533130586147308, 0.42463661551475525, 0); }
  else if (id.endsWith('-block')) visual.position.y = 0.8610000143; else if (id === 'wheat') { visual.scale.setScalar(CAMPAIGN_CONFIG.materialPresentation.wheatRuntimeScale); visual.position.y = 0.5 * CAMPAIGN_CONFIG.materialPresentation.wheatRuntimeScale; } else if (id === 'flour') { const scale = 0.1897240659 * CAMPAIGN_CONFIG.materialPresentation.flourRuntimeScale; visual.scale.setScalar(scale); visual.position.y = 0.4269358 * scale; } else if (id === 'bread') visual.scale.setScalar(CAMPAIGN_CONFIG.materialPresentation.breadRuntimeScale);
  wrapper.traverse((node) => { if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; } }); validateFiniteRoot(id, wrapper); const bounds = new THREE.Box3().setFromObject(wrapper); assertVector(id, 'prepared min/pivot', bounds.min, PREPARED_BOUNDS[id].min); assertVector(id, 'prepared max/axis/scale', bounds.max, PREPARED_BOUNDS[id].max); return wrapper;
}
function addAnchor(root: THREE.Object3D, name: string, x: number, y: number, z: number): void { const anchor = new THREE.Group(); anchor.name = name; anchor.position.set(x, y, z); root.add(anchor); }

export async function validateCampaignAssetBytes(id: CampaignAssetId, bytes: ArrayBuffer, definition = CAMPAIGN_ASSET_CONTRACTS[id]): Promise<void> { if (bytes.byteLength !== definition.bytes) throw new CampaignAssetLoadError(`${id}: byte length`); const digest = await crypto.subtle.digest('SHA-256', bytes); const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase(); if (hash !== definition.sha256) throw new CampaignAssetLoadError(`${id}: sha256`); }
export async function validateCampaignSidecarBytes(url: string, bytes: ArrayBuffer): Promise<void> { const definition = CAMPAIGN_SIDECAR_BYTE_CONTRACTS[url]; if (definition === undefined || bytes.byteLength !== definition.bytes) throw new CampaignAssetLoadError(`${url}: byte length`); const digest = await crypto.subtle.digest('SHA-256', bytes); const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase(); if (hash !== definition.sha256) throw new CampaignAssetLoadError(`${url}: sha256`); }
export async function validateCampaignStaticBytes(id: string, bytes: ArrayBuffer): Promise<void> { const definition = CAMPAIGN_STATIC_BINARY_CONTRACTS[id]; if (definition === undefined || bytes.byteLength !== definition.bytes) throw new CampaignAssetLoadError(`${id}: byte length`); const digest = await crypto.subtle.digest('SHA-256', bytes); const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase(); if (hash !== definition.sha256) throw new CampaignAssetLoadError(`${id}: sha256`); }
export function validateCampaignSidecar(id: CampaignAssetId, value: unknown, definition = CAMPAIGN_ASSET_CONTRACTS[id]): void { if (!isRecord(value) || value.schemaVersion !== '1.0') throw new CampaignAssetLoadError(`${id}: sidecar schema`); const serialized = JSON.stringify(value); if (!serialized.includes(definition.sha256)) throw new CampaignAssetLoadError(`${id}: sidecar sha256`); if (id !== 'stage0-block' && !serialized.includes(String(definition.bytes))) throw new CampaignAssetLoadError(`${id}: sidecar bytes`); if (id === 'wheat-source') requireSidecar(value, ['transform', 'inventory', 'namedRendererAnchors', 'runtimeProxy']); else if (id === 'submission-dock') requireSidecar(value, ['coordinateSystem', 'geometry', 'materials', 'namedAnchors', 'replacementContract']); else if (id === 'flour') requireSidecar(value, ['sourceGeometry', 'canonicalTransform', 'canonicalBoundsThreeMeters', 'namedAnchors']); else if (id.endsWith('-block')) requireSidecar(value, ['boundsAndCollision', 'presentationLayoutProfile']); else requireSidecar(value, ['geometry', 'requiredAnchors']); }
export function validateParsedAsset(id: CampaignAssetId, gltf: GLTF, definition = CAMPAIGN_ASSET_CONTRACTS[id]): void {
  validateFiniteRoot(id, gltf.scene); const bounds = new THREE.Box3().setFromObject(gltf.scene); assertVector(id, 'raw min', bounds.min, definition.boundsMin); assertVector(id, 'raw max', bounds.max, definition.boundsMax); let meshes = 0; const materials = new Set<THREE.Material>(); gltf.scene.traverse((node) => { if (node instanceof THREE.Mesh) { meshes += 1; for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material); } }); if (meshes !== definition.meshes || materials.size !== definition.materials) throw new CampaignAssetLoadError(`${id}: geometry/material inventory`);
  if (id === 'player') { const names = new Set(gltf.animations.map((clip) => clip.name)); for (const name of REQUIRED_PLAYER_CLIPS) if (!names.has(name)) throw new CampaignAssetLoadError(`${id}: ${name}`); }
  const sharedBlock = ['functionNameFace', 'topProgressAnchor', 'topCapacityAnchor', 'outputMouth', 'tokenExitAnchor', 'rotationPivot', 'collisionFootprintAnchor']; const required = id === 'stage0-block' ? sharedBlock : id === 'stage1-block' ? [...sharedBlock, 'fastPocketSeat'] : id === 'stage2-block' ? [...sharedBlock, 'fastPocketSeatLeft', 'fastPocketSeatRight'] : id === 'fast' || id === 'double' || id === 'again' ? [CAMPAIGN_MODULE_BODY_MESH_NAME, 'frontLabelFace', 'rearGaugeFace', 'insertionAxis', 'rotationPivot'] : id === 'submission-dock' ? ['dockRoot', 'wallMountPlane', 'outwardNormal', 'breadContact', 'suctionTarget', 'goalBoardMount', 'interactionProxyReference'] : []; for (const anchor of required) if (gltf.scene.getObjectByName(anchor) === undefined) throw new CampaignAssetLoadError(`${id}: ${anchor}`);
}
function assertVector(id: string, label: string, actual: THREE.Vector3, expected: readonly number[]): void { if (actual.toArray().some((value, index) => Math.abs(value - expected[index]!) > 1e-5)) throw new CampaignAssetLoadError(`${id}: ${label} ${actual.toArray().join(',')} != ${expected.join(',')}`); }
function validateFiniteRoot(id: string, root: THREE.Object3D): void { root.traverse((node) => { if ([...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray()].some((value) => !Number.isFinite(value))) throw new CampaignAssetLoadError(id); }); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function requireSidecar(value: Record<string, unknown>, keys: readonly string[]): void { for (const key of keys) if (!(key in value)) throw new CampaignAssetLoadError(`sidecar: ${key}`); }
export function createCampaignBrowserAssetTransport(): CampaignAssetTransport {
  return Object.freeze({
    binary: (url: string, signal?: AbortSignal) => fetchBodyWithTimeout(url, signal, (response) => response.arrayBuffer()),
    json: (url: string, signal?: AbortSignal) => fetchBodyWithTimeout(url, signal, (response) => response.json()),
    image: (url: string, signal?: AbortSignal) => loadImageWithTimeout(url, signal),
    ready: async (signal?: AbortSignal) => {
      const scoreboardFaces = await waitWithTimeout('Galmuri11 Bold scoreboard font load',
        document.fonts.load(CAMPAIGN_SCOREBOARD_FONT_LOAD_SPEC, CAMPAIGN_SCOREBOARD_FONT_LOAD_SAMPLE), signal);
      if (scoreboardFaces.length === 0) throw new CampaignAssetLoadError('Galmuri11 Bold scoreboard font load');
      await waitWithTimeout('font readiness', document.fonts.ready, signal);
      if (!document.fonts.check('700 16px Galmuri')) throw new CampaignAssetLoadError('Galmuri font');
      if (!document.fonts.check(CAMPAIGN_SCOREBOARD_FONT_LOAD_SPEC, CAMPAIGN_SCOREBOARD_FONT_LOAD_SAMPLE)) throw new CampaignAssetLoadError('Galmuri11 Bold scoreboard font');
    },
  });
}

async function fetchBodyWithTimeout<T>(url: string, signal: AbortSignal | undefined, read: (response: Response) => Promise<T>): Promise<T> {
  const controller = new AbortController(); let timedOut = false;
  const abort = (): void => { if (!controller.signal.aborted) controller.abort(signal?.reason); };
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, CAMPAIGN_ASSET_REQUEST_TIMEOUT_MS);
  try { const response = await fetch(url, { signal: controller.signal }); if (!response.ok) throw new CampaignAssetLoadError(url); return await read(response); }
  catch (error) { throw new CampaignAssetLoadError(timedOut ? `${url}: timeout` : url, error); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

function loadImageWithTimeout(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(); let settled = false;
    const cleanup = (): void => { clearTimeout(timer); signal?.removeEventListener('abort', abort); image.onload = null; image.onerror = null; };
    const finish = (error?: CampaignAssetLoadError): void => { if (settled) return; settled = true; cleanup(); if (error === undefined) resolve(image); else reject(error); };
    const abort = (): void => { finish(new CampaignAssetLoadError(url, signal?.reason)); image.src = ''; };
    const timer = setTimeout(() => { finish(new CampaignAssetLoadError(`${url}: timeout`)); image.src = ''; }, CAMPAIGN_ASSET_REQUEST_TIMEOUT_MS);
    image.onload = () => finish(); image.onerror = () => finish(new CampaignAssetLoadError(url));
    if (signal?.aborted) abort(); else { signal?.addEventListener('abort', abort, { once: true }); image.src = url; }
  });
}

function waitWithTimeout<T>(asset: string, pending: PromiseLike<T>, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    const finish = (value: T): void => { if (settled) return; settled = true; cleanup(); resolve(value); };
    const fail = (error: unknown): void => { if (settled) return; settled = true; cleanup(); reject(error instanceof CampaignAssetLoadError ? error : new CampaignAssetLoadError(asset, error)); };
    const abort = (): void => fail(new CampaignAssetLoadError(asset, signal?.reason));
    const timer = setTimeout(() => fail(new CampaignAssetLoadError(`${asset}: timeout`)), CAMPAIGN_ASSET_REQUEST_TIMEOUT_MS);
    if (signal?.aborted) abort(); else { signal?.addEventListener('abort', abort, { once: true }); Promise.resolve(pending).then(finish, fail); }
  });
}
