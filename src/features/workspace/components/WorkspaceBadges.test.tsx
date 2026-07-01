import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectBadge, WaveBadge } from './WorkspaceBadges';
import type { Project } from '../types';

const mockProject: Project = {
  id: 'proj-1',
  name: 'Brand Tracker',
  color: '#3b82f6',
  isLongitudinal: false,
  datasetIds: [],
  createdAt: Date.now(),
};

describe('ProjectBadge', () => {
  it('renders project name', () => {
    render(<ProjectBadge project={mockProject} />);
    expect(screen.getByText('Brand Tracker')).toBeInTheDocument();
  });

  it('renders longitudinal link icon when isLongitudinal', () => {
    const longProj = { ...mockProject, isLongitudinal: true };
    const { container } = render(<ProjectBadge project={longProj} />);
    // Lucide Link2 renders an SVG
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders without error when compact prop is set', () => {
    const { container } = render(<ProjectBadge project={mockProject} compact />);
    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByText('Brand Tracker')).toBeInTheDocument();
  });
});

describe('WaveBadge', () => {
  it('renders wave number', () => {
    render(<WaveBadge waveNumber={3} />);
    expect(screen.getByText('Wave 3')).toBeInTheDocument();
  });

  it('renders wave 1', () => {
    render(<WaveBadge waveNumber={1} />);
    expect(screen.getByText('Wave 1')).toBeInTheDocument();
  });
});
