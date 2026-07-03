import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkspaceOutcomePreview } from './WorkspaceOutcomePreview';

describe('WorkspaceOutcomePreview', () => {
  it('renders export preview table and badge', () => {
    render(<WorkspaceOutcomePreview />);
    expect(screen.getByTestId('workspace-outcome-preview')).toBeInTheDocument();
    expect(screen.getByText('Editable PPTX')).toBeInTheDocument();
    expect(screen.getByText('sex × marital status')).toBeInTheDocument();
    expect(screen.getByText('Male')).toBeInTheDocument();
    expect(screen.getByText(/native PowerPoint tables/i)).toBeInTheDocument();
  });
});
