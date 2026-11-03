export const CAMPAIGN_SCOREBOARD_TYPOGRAPHY = Object.freeze({
  family: 'Galmuri11',
  cssFamily: 'Galmuri11, system-ui, sans-serif',
  weight: 900,
  fontAsset: 'galmuri/Galmuri11-Bold.woff2',
  fontSha256: '8643094F395AA2DBAD6BC4385CC043314801EAEC2E759D549435EC8AC4F2D078',
});

export const CAMPAIGN_SCOREBOARD_FONT_LOAD_SPEC =
  `${CAMPAIGN_SCOREBOARD_TYPOGRAPHY.weight} 16px ${CAMPAIGN_SCOREBOARD_TYPOGRAPHY.family}`;
export const CAMPAIGN_SCOREBOARD_FONT_LOAD_SAMPLE = '0 / 30';

export function campaignScoreboardFont(pixelSize: number): string {
  return `${CAMPAIGN_SCOREBOARD_TYPOGRAPHY.weight} ${pixelSize}px ${CAMPAIGN_SCOREBOARD_TYPOGRAPHY.cssFamily}`;
}
