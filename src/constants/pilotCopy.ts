/** Shared pilot-facing copy (PILOT-1). */

export const PILOT_PRIVACY_HEADLINE =
  'Your respondent data never leaves this device. Analysis runs locally in your browser.';

export const PILOT_PRIVACY_DETAIL =
  'Velocity does not upload survey files to a server. Datasets are stored in browser storage (OPFS) on this machine. Portable .velocity session files contain deck and metadata only — no respondent rows.';

export const PILOT_BROWSER_LIMITS = {
  recommendedBrowsers: 'Chrome or Edge 120+, Safari 17+ (desktop)',
  fileFormats: '.sav and .csv',
  warnFileSizeMb: 50,
  hardFileSizeMb: 200,
  highRiskCells: 40_000_000,
  singleTab: 'Use one browser tab per Velocity session to avoid storage lock conflicts.',
} as const;
