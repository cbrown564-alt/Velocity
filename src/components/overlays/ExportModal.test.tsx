import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JSZip from 'jszip';
import { ExportModal } from './ExportModal';
import { useVelocityStore } from '../../store';

describe('ExportModal accessibility', () => {
  beforeEach(() => {
    localStorage.clear();
    useVelocityStore.setState({
      slides: [{ id: 's1', title: 'Slide 1', analysisState: { rowVars: [], colVar: null, filters: [], weightVar: null } }],
      activeSlideId: 's1',
      tableConfig: { rowVars: [], colVar: null },
      activeFilters: [],
      dataset: {
        id: 'd1',
        name: 'Dataset',
        rowCount: 10,
        source: 'csv',
        variables: [],
      },
      variableSets: [],
      browserEngine: { runAnalysis: vi.fn() },
      isQuerying: false,
      analysisSettings: {},
    } as never);
  });

  it('exposes export format choices as named radio controls', () => {
    render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        config={{ title: 'Report', analyses: [] }}
      />
    );

    expect(screen.getByRole('radiogroup', { name: /export format/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'PowerPoint' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Excel' })).toBeInTheDocument();
  });

  it('blocks export and shows review issues when slide recipes are incomplete', () => {
    useVelocityStore.setState({
      slides: [{
        id: 's1',
        title: 'Broken Slide',
        subtitle: '',
        analysisState: { rowVars: [], colVar: null, filters: [], weightVar: null },
        visualizationType: 'table',
        layoutMode: 'focus',
        cells: [{ id: 'c1', content: { type: 'table' } }],
        createdAt: 1,
        updatedAt: 1,
      }],
      activeSlideId: 's1',
      tableConfig: { rowVars: [], colVar: null },
      activeFilters: [],
      dataset: {
        id: 'd1',
        name: 'Dataset',
        rowCount: 10,
        source: 'csv',
        variables: [],
      },
      variableSets: [],
      browserEngine: { runAnalysis: vi.fn() },
      isQuerying: false,
      analysisSettings: {},
    } as never);

    render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        config={{ title: 'Report', analyses: [] }}
      />
    );

    expect(screen.getByTestId('export-review-list')).toBeInTheDocument();
    expect(screen.getByText(/add at least one row variable/i)).toBeInTheDocument();
    expect(screen.getByTestId('export-modal-submit')).toBeDisabled();
  });

  it('shows template mode controls and wave refresh options when template config is present', () => {
    render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        config={{
          title: 'Report',
          analyses: [],
          templateOptions: {
            template: {
              id: 'tmpl-1',
              filename: 'client-template.pptx',
              placeholders: [{ id: 'p1', token: '{{slide.title}}' }],
              diagnostics: [],
            },
            mapping: {
              templateId: 'tmpl-1',
              bindings: [{ placeholderId: 'p1', slot: 'slide.title' }],
            },
            slideRecipes: [
              {
                slideId: 's1',
                title: 'Slide 1',
                subtitle: '',
                analysisState: { rowVars: ['q1'], colVar: null, filters: [], weightVar: null },
                visualizationType: 'table',
              },
            ],
          },
        }}
      />
    );

    expect(screen.getByText(/template mode/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/apply mapped placeholders/i));
    expect(screen.getByLabelText(/wave refresh/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full rebuild/i)).toBeInTheDocument();
  });

  it('shows template applicability warnings in review-before-export list', () => {
    render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        config={{
          title: 'Report',
          analyses: [],
          templateOptions: {
            template: {
              id: 'tmpl-1',
              filename: 'client-template.pptx',
              placeholders: [{ id: 'p1', token: '{{slide.title}}' }],
              diagnostics: [],
            },
            mapping: {
              templateId: 'tmpl-mismatch',
              bindings: [{ placeholderId: 'p1', slot: 'slide.title' }],
            },
            slideRecipes: [
              {
                slideId: 's1',
                title: 'Slide 1',
                subtitle: '',
                analysisState: { rowVars: ['q1'], colVar: null, filters: [], weightVar: null },
                visualizationType: 'table',
              },
            ],
          },
        }}
      />
    );

    fireEvent.click(screen.getByLabelText(/apply mapped placeholders/i));

    expect(screen.getByTestId('export-review-list')).toBeInTheDocument();
    expect(screen.getAllByText(/template mapping references/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('export-modal-submit')).toBeDisabled();
  });

  it('imports template binary and restores it on modal reopen', async () => {
    const zip = new JSZip();
    zip.file('ppt/slides/slide1.xml', '<p:sld><a:t>{{slide.title}}</a:t></p:sld>');
    const binary = await zip.generateAsync({ type: 'uint8array' });
    const file = new File([binary], 'client-template.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });

    const { unmount } = render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        config={{ title: 'Report', analyses: [] }}
      />
    );

    fireEvent.change(screen.getByLabelText(/import client template/i), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/apply mapped placeholders/i)).toBeEnabled();
    });

    unmount();

    render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        config={{ title: 'Report', analyses: [] }}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/apply mapped placeholders/i)).toBeEnabled();
    });
  });
});
