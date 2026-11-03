import * as THREE from 'three';
import { campaignScoreboardFont } from './CampaignScoreboardTypography';

export interface ObjectSurfaceLabelMetrics {
  readonly glyphPixelHeight: number;
  readonly measuredPixelWidth: number;
  readonly outlinePixelWidth: number;
}

export interface ObjectSurfaceLabelStyle {
  readonly outlineMultiplier?: number;
}

/** Fits and draws one object-owned label without clipping its outline. */
export function drawObjectSurfaceLabel(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: string,
  fill: string,
  outline: string | null,
  style: ObjectSurfaceLabelStyle = {},
): ObjectSurfaceLabelMetrics {
  const outlineMultiplier = style.outlineMultiplier ?? 1;
  if (!Number.isFinite(outlineMultiplier) || outlineMultiplier <= 0) throw new Error('Object label outline multiplier is invalid.');
  const paddingX = Math.round(canvas.width * 0.055);
  const paddingY = Math.round(canvas.height * 0.09);
  const availableWidth = canvas.width - paddingX * 2;
  const availableHeight = canvas.height - paddingY * 2;
  let low = 1; let high = availableHeight; let selected = 1; let selectedWidth = 0; let selectedOutline = 0;
  while (low <= high) {
    const candidate = Math.floor((low + high) * 0.5);
    context.font = campaignScoreboardFont(candidate);
    const metrics = context.measureText(text);
    const measuredHeight = Math.max(candidate, (metrics.actualBoundingBoxAscent || 0) + (metrics.actualBoundingBoxDescent || 0));
    const outlineWidth = outline === null ? 0 : Math.max(8, Math.ceil(candidate * 0.055)) * outlineMultiplier;
    if (metrics.width + outlineWidth * 2 <= availableWidth && measuredHeight + outlineWidth * 2 <= availableHeight) {
      selected = candidate; selectedWidth = metrics.width; selectedOutline = outlineWidth; low = candidate + 1;
    } else high = candidate - 1;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = campaignScoreboardFont(selected);
  context.lineJoin = 'round'; context.lineWidth = selectedOutline; context.strokeStyle = outline ?? fill;
  if (outline !== null) context.strokeText(text, canvas.width * 0.5, canvas.height * 0.5);
  context.fillStyle = fill; context.fillText(text, canvas.width * 0.5, canvas.height * 0.5);
  return Object.freeze({ glyphPixelHeight: selected, measuredPixelWidth: selectedWidth, outlinePixelWidth: selectedOutline });
}

export function configureObjectSurfaceTexture(texture: THREE.CanvasTexture, anisotropy: number): void {
  if (!Number.isFinite(anisotropy) || anisotropy <= 0) throw new Error('Object label anisotropy capability is invalid.');
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
}
