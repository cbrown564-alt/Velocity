import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { buildReviewedExport, exportReviewedDeck } from '../../scripts/research-reviewed-deck';

function fixture() {
  const cell = (p: number) => ({ top2_pct: p, n_unweighted: 10, n_weighted: 10 });
  const analysis = {
    project_id: 'SBT-002',
    source_sha256: 'data-v1',
    concept_metrics: { appeal_5: { Flex: cell(60), Plus: cell(50), Simple: cell(40) } },
  };
  const review = {
    schema_version: 1,
    kind: 'reviewed_research_prototype',
    study_id: 'SBT-002',
    source_sha256: 'data-v1',
    analysis_sha256: createHash('sha256').update(JSON.stringify(analysis)).digest('hex'),
    approved_at: '2026-09-22T00:00:00Z',
    preparation_review: { prepared: true },
    review: { approved: true },
    findings: [
      {
        model_finding_id: 'F1',
        proposition: 'QA fixture: compare appeal.',
        original_proposition: 'Original QA wording.',
        qualification: 'Synthetic test only.',
        evidence_refs: ['concept_metrics.appeal_5'],
        review: { decision: 'revise', reason: 'QA edit' },
      },
    ],
    story: { beats: [{ order: 1, headline_intent: 'QA fixture: appeal by concept', finding_refs: ['F1'] }] },
  };
  return { review, analysis };
}

describe('reviewed evidence to existing native PPTX exporter', () => {
  it('binds current approved numbers and preserves revision provenance in native chart notes', async () => {
    const { review, analysis } = fixture();
    const config = buildReviewedExport(review, analysis);
    expect(config.analyses[0].result.series[0].data.map((p) => p.percent)).toEqual([60, 50, 40]);
    const zip = await JSZip.loadAsync(await exportReviewedDeck(review, analysis));
    expect(Object.keys(zip.files).some((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name))).toBe(true);
    const notes = await zip.file('ppt/notesSlides/notesSlide2.xml')!.async('string');
    expect(notes).toContain('Original QA wording.');
    expect(notes).toContain('data-v1');
  });

  it('rejects stale evidence and unapproved narratives instead of retaining stale numbers', () => {
    const { review, analysis } = fixture();
    const changed = structuredClone(analysis);
    changed.concept_metrics.appeal_5.Flex.top2_pct = 65;
    expect(() => buildReviewedExport(review, changed)).toThrow(/changed/);
    const renewed = { ...review, analysis_sha256: createHash('sha256').update(JSON.stringify(changed)).digest('hex') };
    expect(buildReviewedExport(renewed, changed).analyses[0].result.series[0].data[0].percent).toBe(65);
    expect(() => buildReviewedExport({ ...review, review: { approved: false } }, analysis)).toThrow(/approved/);
  });
  it('preserves all five ordinal categories so polarisation remains visible', () => {
    const { review, analysis } = fixture();
    const cells = analysis.concept_metrics.appeal_5;
    const richer = {
      ...analysis,
      concept_metrics: {
        appeal_5: Object.fromEntries(
          Object.entries(cells).map(([name, cell]) => [
            name,
            { ...cell, distribution_pct: { '1': 10, '2': 15, '3': 25, '4': 20, '5': 30 } },
          ]),
        ),
      },
    };
    const approved = { ...review, analysis_sha256: createHash('sha256').update(JSON.stringify(richer)).digest('hex') };
    const slide = buildReviewedExport(approved, richer).analyses[0];
    expect(slide.chartType).toBe('stacked-bar');
    expect(slide.result.series.map((s) => s.data[0].percent)).toEqual([10, 15, 25, 20, 30]);
  });

  it('rejects unresolved evidence and duplicate story positions', () => {
    const { review, analysis } = fixture();
    const broken = structuredClone(review);
    broken.findings[0].evidence_refs.push('missing.table');
    expect(() => buildReviewedExport(broken, analysis)).toThrow(/Unresolved evidence/);
    const repeated = structuredClone(review);
    repeated.story.beats.push({ ...repeated.story.beats[0] });
    expect(() => buildReviewedExport(repeated, analysis)).toThrow(/story positions/);
  });
  it('keeps tiny segment values editable while omitting overlapping labels', async () => {
    const { review, analysis } = fixture();
    const richer = {
      ...analysis,
      concept_metrics: {
        appeal_5: Object.fromEntries(
          Object.entries(analysis.concept_metrics.appeal_5).map(([name, cell]) => [
            name,
            { ...cell, distribution_pct: { '1': 1, '2': 24, '3': 25, '4': 20, '5': 30 } },
          ]),
        ),
      },
    };
    const approved = { ...review, analysis_sha256: createHash('sha256').update(JSON.stringify(richer)).digest('hex') };
    const zip = await JSZip.loadAsync(await exportReviewedDeck(approved, richer));
    const chartPath = Object.keys(zip.files).find((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name))!;
    const xml = await zip.file(chartPath)!.async('string');
    expect(xml).toContain('<c:dLbl><c:idx val="0"/><c:delete val="1"/></c:dLbl>');
    expect(xml).toContain('<c:pt idx="0"><c:v>1</c:v></c:pt>');
    expect(xml).toContain('<c:max val="100"/>');
  });
});
