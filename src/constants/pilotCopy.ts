/** Shared pilot-facing copy (PILOT-1). */

export const PILOT_PRIVACY_HEADLINE =
  'Your respondent data never leaves this device. Analysis runs locally in your browser.';

export const PILOT_PRIVACY_DETAIL =
  'Velocity does not upload survey files to a server. Datasets are stored in browser storage (OPFS) on this machine. Portable .velocity session files contain deck and metadata only — no respondent rows.';

/** First-run landing (Workshop Door) — shared across empty state and instrumentation. */
export const PILOT_LANDING_EYEBROW = 'Survey file to PowerPoint deck';

/** Uses the single allowed "client" mention on the intro page. */
export const PILOT_LANDING_HEADLINE = 'Turn a client survey file into an editable PowerPoint deck — in your browser';

export const PILOT_LANDING_SUBHEAD =
  'Weighted crosstabs with significance testing. Export slides your stakeholders can edit. Everything stays on your device.';

/** Uses the single allowed ".sav" mention on the intro page (step 1 detail). */
export const PILOT_LANDING_WORKFLOW_STEPS = [
  { label: 'Import survey', detail: 'Supports .sav files' },
  { label: 'Build crosstabs', detail: 'Weighted cuts & significance' },
  { label: 'Export deck', detail: 'Native PowerPoint slides' },
] as const;

export const PILOT_LANDING_DROP_LABEL = 'Drop your survey file here';

export const PILOT_LANDING_DROP_HINT =
  'SPSS and CSV files welcome · weights preserved · nothing uploads to a server';

export const PILOT_LANDING_UPLOAD_CTA = 'Upload survey file';

export const PILOT_LANDING_EXAMPLE_TITLE = 'Try the brand tracker example';

export const PILOT_LANDING_EXAMPLE_DESC = 'See a weighted crosstab and PowerPoint deck · ~2 min';

/** @deprecated Use PILOT_LANDING_EXAMPLE_TITLE — kept for event naming compatibility */
export const PILOT_LANDING_EXAMPLE_CTA = PILOT_LANDING_EXAMPLE_TITLE;

export const PILOT_LANDING_EXAMPLE_SHORT = PILOT_LANDING_EXAMPLE_TITLE;

export const PILOT_LANDING_IMPORT_LABEL = 'Import a saved session';

export const PILOT_LANDING_IMPORT_HINT = '— deck layout only, no respondent data';

export const PILOT_LANDING_PREVIEW_LABEL = "What you'll export";

export const PILOT_LANDING_PREVIEW_BADGE = 'Editable PowerPoint';

export const PILOT_LANDING_LIBRARY_HINT =
  'Upload a survey file or try the brand tracker example to see significance testing and PowerPoint export.';

export const PILOT_LANDING_LIBRARY_UPLOAD = 'Upload survey file';

export const PILOT_BROWSER_LIMITS = {
  recommendedBrowsers: 'Chrome or Edge 120+, Safari 17+ (desktop)',
  fileFormats: '.sav and .csv',
  warnFileSizeMb: 50,
  hardFileSizeMb: 200,
  highRiskCells: 40_000_000,
  singleTab: 'Use one browser tab per Velocity session to avoid storage lock conflicts.',
} as const;
