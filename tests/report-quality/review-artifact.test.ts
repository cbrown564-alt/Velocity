import { describe, expect, it } from 'vitest';
import {
  buildExemplarDiffMarkdown,
  buildVisualReviewMarkdown,
  summarizeInspectionForReview,
} from '../../scripts/report-quality/review-artifact.mjs';

const cleanInspection = {
  status: 'passed',
  slideCount: 4,
  notesSlideCount: 4,
  editableTextBoxCount: 12,
  tableCount: 3,
  chartCount: 1,
  remainingTokens: [],
  emptySlides: [],
  overflowWarnings: [],
  fonts: ['Aptos'],
  colors: ['1F4E79', 'FFFFFF', '2E7D32'],
  warnings: [],
};

describe('review artifact builders', () => {
  it('builds a forced uncanny-valley review with inspection gates', () => {
    const markdown = buildVisualReviewMarkdown({
      pptxPath: 'demo/output.pptx',
      inspection: cleanInspection,
      renderedSlides: ['slide-1.png'],
      renderer: { status: 'available', command: 'soffice' },
    });

    expect(markdown).toContain('Could this be mistaken for a deck a competent consultant made by hand?');
    expect(markdown).toContain('- [ ] Cite three specifics');
    expect(markdown).toContain('Rendered slide evidence: 1 image');
    expect(markdown).toContain('No unresolved placeholder tokens');
  });

  it('marks missing render support without treating the review as passed', () => {
    const markdown = buildVisualReviewMarkdown({
      pptxPath: 'demo/output.pptx',
      inspection: cleanInspection,
      renderedSlides: [],
      renderer: { status: 'unavailable', command: null },
    });

    expect(markdown).toContain('Rendered slide evidence: unavailable');
    expect(markdown).toContain('Status: needs manual render');
  });

  it('summarizes blockers for exemplar diffs', () => {
    const summary = summarizeInspectionForReview({
      ...cleanInspection,
      remainingTokens: ['{{slide.title}}'],
      emptySlides: [2],
    });
    const markdown = buildExemplarDiffMarkdown({
      generatedPptxPath: 'generated.pptx',
      exemplarPath: 'exemplar.pptx',
      inspectionSummary: summary,
    });

    expect(markdown).toContain('Generated deck: `generated.pptx`');
    expect(markdown).toContain('North-star exemplar: `exemplar.pptx`');
    expect(markdown).toContain('Unresolved placeholder tokens');
    expect(markdown).toContain('Empty slides detected');
  });
});
