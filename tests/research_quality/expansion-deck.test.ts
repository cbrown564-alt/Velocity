import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { buildExpansionExport, exportExpansionDeck } from '../../scripts/research-expansion-deck';

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
function fixture(unit = 'days') {
  const analysis = {
    study_id: 'SBT-004',
    source_sha256: 'rows-v1',
    tables: {
      change: {
        title: 'Unplanned shopping days',
        universe: 'Valid reported days, effort need versus no effort need',
        weighting: 'wt_final',
        values: { difference: 1.2 },
        chart: { labels: ['Effort need', 'No effort need'], values: [3.2, 2], unit, bases: [400, 800] },
      },
    },
  };
  const review = {
    kind: 'reviewed_research_prototype',
    schema_version: 1,
    study_id: 'SBT-004',
    source_sha256: 'rows-v1',
    analysis_sha256: hash(analysis),
    approved_at: '2026-09-22T00:00:00Z',
    preparation_review: { prepared: true },
    review: { approved: true },
    findings: [
      {
        model_finding_id: 'F1',
        proposition: 'More reported disruption',
        original_proposition: 'Original wording',
        evidence_refs: ['tables.change.values'],
        review: { decision: 'revise', reason: 'Qualification added' },
      },
    ],
    story: { beats: [{ order: 1, finding_refs: ['F1'], headline_intent: 'Effort needs accompany more disruption' }] },
  };
  return { analysis, review };
}
describe('new-study approved evidence export', () => {
  it('keeps metric units and native editable data with original finding provenance', async () => {
    const { analysis, review } = fixture();
    const config = buildExpansionExport(review, analysis);
    expect(config.analyses[0].options?.showPercents).toBe(false);
    expect(config.analyses[0].result.series[0].data.map((p) => p.value)).toEqual([3.2, 2]);
    const zip = await JSZip.loadAsync(await exportExpansionDeck(review, analysis));
    const chart = Object.keys(zip.files).find((p) => /^ppt\/charts\/chart\d+.xml$/.test(p))!;
    expect(await zip.file(chart)!.async('string')).toContain('<c:v>3.2</c:v>');
    expect(await zip.file('ppt/notesSlides/notesSlide2.xml')!.async('string')).toContain('Original wording');
  });
  it('requires renewed approval after data changes and updates chart numbers', () => {
    const { analysis, review } = fixture();
    analysis.tables.change.chart.values[0] = 3.5;
    expect(() => buildExpansionExport(review, analysis)).toThrow(/Evidence changed/);
    review.analysis_sha256 = hash(analysis);
    expect(buildExpansionExport(review, analysis).analyses[0].result.series[0].data[0].value).toBe(3.5);
  });
  it('rejects unapproved findings, missing evidence, inconsistent identities and malformed charts', () => {
    const { analysis, review } = fixture();
    expect(() => buildExpansionExport({ ...review, study_id: 'SBT-005' }, analysis)).toThrow(/study/);
    review.findings[0].review.decision = 'reject';
    expect(() => buildExpansionExport(review, analysis)).toThrow(/Unapproved/);
    review.findings[0].review.decision = 'accept';
    review.findings[0].evidence_refs = ['tables.missing'];
    expect(() => buildExpansionExport(review, analysis)).toThrow(/Unresolved/);
    review.findings[0].evidence_refs = ['tables.change.values'];
    analysis.tables.change.chart.labels.pop();
    review.analysis_sha256 = hash(analysis);
    expect(() => buildExpansionExport(review, analysis)).toThrow(/Chart/);
  });
});

it('accepts explicit analysis-file JSON pointers emitted by the first expansion run', () => {
  const { analysis, review } = fixture();
  review.findings[0].evidence_refs = ['analysis_results.json#/tables/change/values'];
  expect(buildExpansionExport(review, analysis).analyses).toHaveLength(1);
});

it('anchors percentage bars at zero and labels non-integer metric values without rounding to counts', async () => {
  for (const unit of ['percent', 'days']) {
    const { analysis, review } = fixture(unit);
    const zip = await JSZip.loadAsync(await exportExpansionDeck(review, analysis));
    const name = Object.keys(zip.files).find((p) => /^ppt\/charts\/chart\d+.xml$/.test(p))!;
    const xml = await zip.file(name)!.async('string');
    expect(xml).toContain('<c:min val="0"/>');
    if (unit === 'percent') expect(xml).toContain('<c:max val="100"/>');
    else expect(xml).toContain('formatCode="0.0"');
  }
});

it('encodes flat categories as a single-level string reference for portable rendering', async () => {
  const { analysis, review } = fixture('percent');
  analysis.tables.change.chart.labels = ['Control', 'Assigned'];
  review.analysis_sha256 = hash(analysis);
  const zip = await JSZip.loadAsync(await exportExpansionDeck(review, analysis));
  const name = Object.keys(zip.files).find((p) => /^ppt\/charts\/chart\d+.xml$/.test(p))!;
  const xml = await zip.file(name)!.async('string');
  expect(xml).toContain('<c:strRef>');
  expect(xml).not.toContain('<c:multiLvlStrRef>');
  expect(xml).toContain('<c:v>Control</c:v>');
  expect(xml).toContain('<c:v>Assigned</c:v>');
});
