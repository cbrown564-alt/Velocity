import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkspaceOutcomePreview } from './WorkspaceOutcomePreview';

describe('WorkspaceOutcomePreview', () => {
  it('renders brand tracker export preview with action title and table', () => {
    render(<WorkspaceOutcomePreview />);
    expect(screen.getByTestId('workspace-outcome-preview')).toBeInTheDocument();
    expect(screen.getByText('Editable PowerPoint')).toBeInTheDocument();
    expect(screen.getByText('Brand preference × segment')).toBeInTheDocument();
    expect(screen.getByText('Atlas')).toBeInTheDocument();
    expect(screen.getByText('Beacon')).toBeInTheDocument();
    expect(screen.getByText(/Beacon overtook Meridian on consideration/i)).toBeInTheDocument();
    expect(screen.getByText(/n=1,200 weighted/i)).toBeInTheDocument();
  });
});
