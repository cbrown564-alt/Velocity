import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { createHandoff, verifyHandoff } from '../../scripts/research-handoff';

const paths: string[] = [];
afterEach(async () => {
  await Promise.all(paths.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'velocity-handoff-'));
  paths.push(dir);
  const analysis = {
    study_id: 'SBT-004',
    source_sha256: 'rows',
    tables: {
      contrast: {
        title: 'Reported shopping days',
        universe: 'Valid respondents',
        weighting: 'wt_final',
        values: { difference: 1 },
        chart: { labels: ['Need', 'Other'], values: [3, 2], unit: 'days', bases: [200, 300] },
      },
    },
  };
  const review = {
    kind: 'reviewed_research_prototype',
    schema_version: 1,
    study_id: 'SBT-004',
    source_sha256: 'rows',
    analysis_sha256: createHash('sha256').update(JSON.stringify(analysis)).digest('hex'),
    approved_at: '2026-09-26T10:00:00Z',
    preparation_review: { prepared: true },
    review: { approved: true },
    findings: [
      {
        model_finding_id: 'F1',
        proposition: 'Reported difference',
        original_proposition: 'Original draft',
        qualification: 'Association does not establish causation.',
        evidence_refs: ['tables.contrast'],
        review: { decision: 'revise', reason: 'Retain causal limit' },
      },
    ],
    story: { beats: [{ order: 1, finding_refs: ['F1'], headline_intent: 'Reported days differ' }] },
  };
  const reviewPath = join(dir, 'review.json'),
    analysisPath = join(dir, 'analysis.json');
  await writeFile(reviewPath, JSON.stringify(review, null, 2));
  await writeFile(analysisPath, JSON.stringify(analysis, null, 2));
  return { dir, reviewPath, analysisPath, review, analysis, out: join(dir, 'handoff') };
}

describe('portable reviewed research handoff', () => {
  it('reopens exact reviewed evidence and retains native chart data, edits and caveats', async () => {
    const f = await fixture();
    const receipt = await createHandoff(f.reviewPath, f.analysisPath, f.out);
    expect((await verifyHandoff(f.out)).study_id).toBe('SBT-004');
    expect(receipt.exhibits).toHaveLength(1);
    expect(await readFile(join(f.out, 'approved-review.json'), 'utf8')).toBe(await readFile(f.reviewPath, 'utf8'));
    const zip = await JSZip.loadAsync(await readFile(join(f.out, 'reviewed.pptx')));
    const notes = await zip.file('ppt/notesSlides/notesSlide2.xml')!.async('string');
    expect(notes).toContain('Original draft');
    expect(notes).toContain('Association does not establish causation.');
    const chart = Object.keys(zip.files).find((p) => /^ppt\/charts\/chart\d+.xml$/.test(p))!;
    expect(await zip.file(chart)!.async('string')).toContain('<c:v>3</c:v>');
    expect(Object.keys(zip.files).some((p) => p.startsWith('ppt/embeddings/') && p.endsWith('.xlsx'))).toBe(true);
    await expect(createHandoff(f.reviewPath, f.analysisPath, f.out)).rejects.toThrow();
    await writeFile(join(f.out, 'analysis_results.json'), '{}');
    await expect(verifyHandoff(f.out)).rejects.toThrow(/file changed/);
  });
  it('refuses stale evidence and unapproved drafts before creating a handoff', async () => {
    const f = await fixture();
    f.analysis.tables.contrast.chart.values[0] = 4;
    await writeFile(f.analysisPath, JSON.stringify(f.analysis));
    await expect(createHandoff(f.reviewPath, f.analysisPath, f.out)).rejects.toThrow(/Evidence changed/);
    f.review.review.approved = false;
    await writeFile(f.reviewPath, JSON.stringify(f.review));
    await expect(createHandoff(f.reviewPath, f.analysisPath, f.out)).rejects.toThrow(/approved/);
  });
});
