import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';

import { RecentVariableStrip } from './RecentVariableStrip';
import { useVelocityStore } from '../../../store';
import { mockNominalSet, mockOrdinalSet } from '../../../test/fixtures/variables';

describe('RecentVariableStrip', () => {
  beforeEach(() => {
    useVelocityStore.setState({
      focusMode: false,
      variableSets: [mockNominalSet, mockOrdinalSet],
      tableConfig: { rowVars: [mockNominalSet.id], colVar: mockOrdinalSet.id },
      pinnedVariableSetIds: [mockNominalSet.id],
      recentVariableSetIds: [mockOrdinalSet.id, mockNominalSet.id],
      recentStripCollapsed: false,
      dataset: null,
    });
  });

  it('renders pinned-first MRU chips at 32px height budget', () => {
    render(
      <DndContext>
        <RecentVariableStrip />
      </DndContext>,
    );

    expect(screen.getByTestId('recent-variable-strip').className).toContain('h-8');
    const chips = within(screen.getByTestId('recent-variable-strip-items')).getAllByRole('button');
    expect(chips[0]).toHaveAttribute('data-variable-set-id', mockNominalSet.id);
  });

  it('hides in focus mode', () => {
    useVelocityStore.setState({ focusMode: true });
    render(
      <DndContext>
        <RecentVariableStrip />
      </DndContext>,
    );
    expect(screen.queryByTestId('recent-variable-strip')).not.toBeInTheDocument();
  });

  it('collapses chip row', () => {
    render(
      <DndContext>
        <RecentVariableStrip />
      </DndContext>,
    );
    fireEvent.click(screen.getByTestId('recent-variable-strip-toggle'));
    expect(screen.queryByTestId('recent-variable-strip-items')).not.toBeInTheDocument();
  });

  it('forwards click handler', () => {
    const onClick = vi.fn();
    render(
      <DndContext>
        <RecentVariableStrip onVariableClick={onClick} />
      </DndContext>,
    );
    fireEvent.click(screen.getByTestId(`strip-variable-${mockNominalSet.id}`));
    expect(onClick).toHaveBeenCalledWith(mockNominalSet, expect.any(Object));
  });
});
