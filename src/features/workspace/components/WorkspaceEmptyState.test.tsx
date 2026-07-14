import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PILOT_LANDING_TEMPLATE_TITLE } from '../../../constants/pilotCopy';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';

describe('WorkspaceEmptyState template entry', () => {
  it('calls onStartFromTemplate when template action is clicked', () => {
    const onStartFromTemplate = vi.fn();
    render(
      <WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={vi.fn()} onStartFromTemplate={onStartFromTemplate} />,
    );
    fireEvent.click(screen.getByTestId('workspace-start-template'));
    expect(onStartFromTemplate).toHaveBeenCalledTimes(1);
  });

  it('shows start-from-template on first-run landing', () => {
    render(<WorkspaceEmptyState onUpload={vi.fn()} onLoadExample={vi.fn()} onStartFromTemplate={vi.fn()} isFirstRun />);
    expect(screen.getByText(PILOT_LANDING_TEMPLATE_TITLE)).toBeInTheDocument();
  });
});
