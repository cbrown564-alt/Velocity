import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ExportPreviewLane } from './ExportPreviewLane';

const baseSlides = [
  {
    slideId: 's1',
    index: 1,
    title: 'Gender by Region',
    recipeSummary: 'gender × region',
    visualizationType: 'table' as const,
    status: 'ready' as const,
    issues: [],
  },
  {
    slideId: 's2',
    index: 2,
    title: 'Brand preference',
    recipeSummary: 'brand',
    visualizationType: 'chart' as const,
    status: 'warning' as const,
    issues: [
      {
        slideId: 's2',
        slideTitle: 'Brand preference',
        code: 'unresolved_weight_var' as const,
        severity: 'warn' as const,
        message: 'Weight variable missing',
      },
    ],
  },
];

describe('ExportPreviewLane', () => {
  it('renders filmstrip thumbnails and significance audit', () => {
    render(
      <ExportPreviewLane
        slides={baseSlides}
        selectedSlideId="s1"
        onSelectSlide={() => {}}
        showPercents
        showCounts={false}
        significanceAudit={{
          exportMarkers: 'Included in export (▲▼ markers)',
          methodology: "Welch's t · cell vs rest · correction: none",
          significanceLevel: '95% solid markers · 80% hollow markers when enabled',
          weight: 'Unweighted',
        }}
        issueCount={1}
      />,
    );

    expect(screen.getByTestId('export-preview-lane')).toBeInTheDocument();
    expect(screen.getByTestId('export-preview-significance-audit')).toBeInTheDocument();
  });

  it('updates recipe summary when a different thumbnail is selected', () => {
    function PreviewHarness() {
      const [selectedSlideId, setSelectedSlideId] = useState('s1');
      return (
        <ExportPreviewLane
          slides={baseSlides}
          selectedSlideId={selectedSlideId}
          onSelectSlide={setSelectedSlideId}
          showPercents
          showCounts={false}
          significanceAudit={{
            exportMarkers: 'Included in export (▲▼ markers)',
            methodology: "Welch's t · cell vs rest · correction: none",
            significanceLevel: '95% solid markers · 80% hollow markers when enabled',
            weight: 'Unweighted',
          }}
          issueCount={1}
        />
      );
    }

    render(<PreviewHarness />);
    fireEvent.click(screen.getByTestId('export-preview-thumb-2'));
    expect(screen.getByTestId('export-preview-recipe-summary')).toHaveTextContent(/brand preference/i);
  });
});
