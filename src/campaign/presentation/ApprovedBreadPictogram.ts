export const CAMPAIGN_APPROVED_BREAD_PICTOGRAM_ID = 'i9-compact-goal-bread-pictogram-v001';

/** Exact approved compact-goal bread source retained from i9 compactGoalTexture. */
export function drawCampaignApprovedBreadPictogram(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  const halfWidth = size * 0.44;
  const halfHeight = size * 0.25;
  context.save();
  context.translate(x, y);
  context.fillStyle = '#d97824';
  context.strokeStyle = '#ffffff';
  context.lineWidth = Math.max(3, size * 0.045);
  context.beginPath();
  context.moveTo(-halfWidth, halfHeight * 0.9);
  context.quadraticCurveTo(-halfWidth * 1.08, -halfHeight * 0.55, -halfWidth * 0.46, -halfHeight);
  context.quadraticCurveTo(0, -halfHeight * 1.32, halfWidth * 0.46, -halfHeight);
  context.quadraticCurveTo(halfWidth * 1.08, -halfHeight * 0.55, halfWidth, halfHeight * 0.9);
  context.closePath();
  context.fill();
  context.stroke();
  context.strokeStyle = '#f7c56f';
  context.lineWidth = Math.max(2, size * 0.025);
  for (const offset of [-0.28, 0, 0.28]) {
    context.beginPath();
    context.moveTo(offset * size - size * 0.04, -halfHeight * 0.34);
    context.quadraticCurveTo(offset * size, halfHeight * 0.05, offset * size + size * 0.04, halfHeight * 0.32);
    context.stroke();
  }
  context.restore();
}
