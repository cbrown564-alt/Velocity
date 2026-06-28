import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JSZip from 'jszip';
import { ExportModal } from './ExportModal';
import { useVelocityStore } from '../../store';

describe('ExportModal accessibility', () => {
  beforeEach(() => {
    localStorage.clear();
    useVelocityStore.setState({
      slides: [
        { id: 's1', title: 'Slide 1', analysisState: { rowVars: [], colVar: null, filters: [], weightVar: null } },
      ],
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
    render(<ExportModal isOpen onClose={vi.fn()} config={{ title: 'Report', analyses: [] }} />);

    expect(screen.getByRole('radiogroup', { name: /export format/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'PowerPoint' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Excel' })).toBeInTheDocument();
  });

  it('resolves default slide titles from the active analysis state before export', () => {
    useVelocityStore.setState({
      slides: [
        {
          id: 's1',
          title: 'New Slide',
          subtitle: '',
          analysisState: { rowVars: [], colVar: null, filters: [], weightVar: null },
          visualizationType: 'table',
          layoutMode: 'focus',
          cells: [{ id: 'c1', content: { type: 'table' } }],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeSlideId: 's1',
      tableConfig: { rowVars: ['gender'], colVar: 'region' },
      activeFilters: [],
      dataset: {
        id: 'd1',
        name: 'Dataset',
        rowCount: 10,
        source: 'csv',
        variables: [
          { id: 'gender', name: 'gender', label: 'Gender', type: 'nominal' },
          { id: 'region', name: 'region', label: 'Region', type: 'nominal' },
        ],
      },
      variableSets: [
        { id: 'gender', name: 'gender', variableIds: ['gender'], structure: 'single' },
        { id: 'region', name: 'region', variableIds: ['region'], structure: 'single' },
      ],
      browserEngine: { runAnalysis: vi.fn() },
      isQuerying: false,
      analysisSettings: {},
    } as never);

    render(<ExportModal isOpen onClose={vi.fn()} config={{ title: 'New Slide', analyses: [] }} />);

    expect(screen.getByLabelText(/report title/i)).toHaveValue('Gender by Region');
    expect(screen.getByText(/current slide \(gender by region\)/i)).toBeInTheDocument();
  });

  it('uses a single centered modal shell instead of a duplicated backdrop overlay', () => {
    const { container } = render(<ExportModal isOpen onClose={vi.fn()} config={{ title: 'Report', analyses: [] }} />);

    expect(container.children).toHaveLength(1);
    expect(screen.getByTestId('export-modal').parentElement).toBe(container.firstElementChild);
  });

  it('blocks export and shows review issues when slide recipes are incomplete', () => {
    useVelocityStore.setState({
      slides: [
        {
          id: 's1',
          title: 'Broken Slide',
          subtitle: '',
          analysisState: { rowVars: [], colVar: null, filters: [], weightVar: null },
          visualizationType: 'table',
          layoutMode: 'focus',
          cells: [{ id: 'c1', content: { type: 'table' } }],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
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

    render(<ExportModal isOpen onClose={vi.fn()} config={{ title: 'Report', analyses: [] }} />);

    expect(screen.getByTestId('export-review-list')).toBeInTheDocument();
    expect(screen.getByTestId('deck-readiness-status')).toHaveTextContent(/blocked/i);
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
              placeholders: [{ id: 'p1', token: '{{slide.title}}', key: 'slide.title' }],
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
      />,
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
              placeholders: [{ id: 'p1', token: '{{slide.title}}', key: 'slide.title' }],
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
      />,
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

    const { unmount } = render(<ExportModal isOpen onClose={vi.fn()} config={{ title: 'Report', analyses: [] }} />);

    fireEvent.change(screen.getByLabelText(/import client template/i), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/apply mapped placeholders/i)).toBeEnabled();
    });

    unmount();

    render(<ExportModal isOpen onClose={vi.fn()} config={{ title: 'Report', analyses: [] }} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/apply mapped placeholders/i)).toBeEnabled();
    });
  });
});
