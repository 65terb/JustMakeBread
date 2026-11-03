import * as THREE from 'three';
import './style.css';
import { CampaignBoot } from './campaign/CampaignBoot';
import { CampaignFrameClock } from './campaign/CampaignFrameClock';
import { installCampaignLifecycleOwner } from './campaign/CampaignLifecycle';
import { installCampaignKeyboardOwner } from './campaign/CampaignKeyboard';
import { CAMPAIGN_CONFIG } from './campaign/CampaignConfig';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const mount = document.querySelector<HTMLElement>('#game-shell');
const tutorialSurface = document.querySelector<HTMLElement>('#status-text');
if (canvas === null || mount === null || tutorialSurface === null) {
  throw new Error('Campaign document is missing its required surface.');
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CAMPAIGN_CONFIG.camera.fovDegrees, 1, CAMPAIGN_CONFIG.camera.near, CAMPAIGN_CONFIG.camera.far);

let listenersInstalled = false;
let disposed = false;
const boot = new CampaignBoot({
  document, window, mount, tutorialSurface, canvas, renderer, scene, camera,
  onRunning: () => installGameListeners(),
});

function isTopRightControlsTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.campaign-top-right-controls') !== null;
}
const frameClock = new CampaignFrameClock(performance.now());
function setPaused(paused: boolean): void { frameClock.pauseTransition(performance.now(), paused); boot.setPaused(paused); }
let removeLifecycleOwner: (() => void) | null = null;
let removeKeyboardOwner: (() => void) | null = null;
function installGameListeners(): void {
  if (listenersInstalled || disposed) return;
  listenersInstalled = true;
  removeKeyboardOwner = installCampaignKeyboardOwner({ window, receiver: boot, isIgnoredTarget: isTopRightControlsTarget });
  removeLifecycleOwner = installCampaignLifecycleOwner({ document, window, setPaused });
}
function removeGameListeners(): void {
  if (!listenersInstalled) return;
  listenersInstalled = false;
  removeKeyboardOwner?.(); removeKeyboardOwner = null;
  removeLifecycleOwner?.(); removeLifecycleOwner = null;
}
function resize(): void { boot.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio); }
window.addEventListener('resize', resize);
resize();

function frame(now: number): void {
  if (disposed) return;
  boot.update(frameClock.sample(now));
  boot.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
void boot.load();

window.addEventListener('pagehide', () => {
  if (disposed) return;
  disposed = true;
  removeGameListeners();
  window.removeEventListener('resize', resize);
  boot.dispose();
}, { once: true });
