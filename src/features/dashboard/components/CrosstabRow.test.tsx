import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrosstabRow } from './CrosstabRow';
import type { CrosstabTableData } from './CrosstabRow';
import type { TableRowNode } from '../../../core/analysis/treeBuilder';
import { makeVariable } from '../../../test/fixtures/variables';

const tableData: CrosstabTableData = {
  colKeys: ['1', '2'],
  colLabels: { '1': 'Male', '2': 'Female' },
  colLetters: { '1': 'A', '2': 'B' },
  grandTotal: 100,
};

const makeRow = (overrides: Partial<TableRowNode> = {}): TableRowNode => ({
  key: 'row-1',
  label: 'Yes',
  rawValue: '1',
  depth: 0,
  total: 60,
  rowPath: [{ variable: 'q1', value: '1' }],
  cells: {
    '1': { percent: 40, count: 40, sig: null, sigLetters: null, stats: null },
    '2': { percent: 20, count: 20, sig: null, sigLetters: null, stats: null },
  },
  children: [],
  ...overrides,
});

const defaultProps = {
  tableData,
  rowVariables: [makeVariable({ id: 'q1', name: 'q1', type: 'categorical' })],
  colVariable: makeVariable({ id: 'gender', name: 'gender', type: 'categorical' }),
  expandedKeys: {},
  onToggleRow: vi.fn(),
  dragState: { isDragging: false, draggedItem: null, dropTarget: null, currentX: 0, currentY: 0 },
  onDragStart: vi.fn(),
  selectedRows: new Set<string>(),
  onToggleRowSelection: vi.fn(),
  hoveredCol: null,
  onHoverCol: vi.fn(),
  onCellClick: vi.fn(),
  density: 'compact' as const,
  animationKey: undefined,
  reducedMotion: true,
  haloClass: () => '',
  variableStats: null,
  transformLog: [],
  onRowContextMenu: vi.fn(),
};

describe('CrosstabRow', () => {
  it('renders row label', () => {
    render(
      <table>
        <tbody>
          <CrosstabRow row={makeRow()} {...defaultProps} />
        </tbody>
      </table>,
    );
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('calls onToggleRowSelection when row header cell is clicked', () => {
    const onToggleRowSelection = vi.fn();
    render(
      <table>
        <tbody>
          <CrosstabRow row={makeRow()} {...defaultProps} onToggleRowSelection={onToggleRowSelection} />
        </tbody>
      </table>,
    );
    fireEvent.click(screen.getByText('Yes'));
    expect(onToggleRowSelection).toHaveBeenCalledWith('1');
  });

  it('calls onHoverCol when cell is moused over', () => {
    const onHoverCol = vi.fn();
    const { container } = render(
      <table>
        <tbody>
          <CrosstabRow row={makeRow()} {...defaultProps} onHoverCol={onHoverCol} />
        </tbody>
      </table>,
    );
    const dataCells = container.querySelectorAll('.data-cell');
    if (dataCells[0]) fireEvent.mouseEnter(dataCells[0]);
    expect(onHoverCol).toHaveBeenCalled();
  });

  it('calls onHoverCol(null) when cell is moused out', () => {
    const onHoverCol = vi.fn();
    const { container } = render(
      <table>
        <tbody>
          <CrosstabRow row={makeRow()} {...defaultProps} onHoverCol={onHoverCol} />
        </tbody>
      </table>,
    );
    const dataCells = container.querySelectorAll('.data-cell');
    if (dataCells[0]) fireEvent.mouseLeave(dataCells[0]);
    expect(onHoverCol).toHaveBeenCalledWith(null);
  });

  it('calls onCellClick when a data cell is clicked', () => {
    const onCellClick = vi.fn();
    const { container } = render(
      <table>
        <tbody>
          <CrosstabRow row={makeRow()} {...defaultProps} onCellClick={onCellClick} />
        </tbody>
      </table>,
    );
    const dataCells = container.querySelectorAll('.data-cell');
    if (dataCells[0]) fireEvent.click(dataCells[0]);
    expect(onCellClick).toHaveBeenCalled();
  });

  it('calls onDragStart when row header is mousedown with left button', () => {
    const onDragStart = vi.fn();
    render(
      <table>
        <tbody>
          <CrosstabRow row={makeRow()} {...defaultProps} onDragStart={onDragStart} />
        </tbody>
      </table>,
    );
    const rowHeader = screen.getByText('Yes').closest('td');
    if (rowHeader) fireEvent.mouseDown(rowHeader, { button: 0 });
    expect(onDragStart).toHaveBeenCalled();
  });

  it('renders expand button when row has children', () => {
    const rowWithChildren = makeRow({
      children: [
        {
          key: 'child-1',
          label: 'Sub-Yes',
          rawValue: '1-1',
          depth: 1,
          total: 30,
          rowPath: [
            { variable: 'q1', value: '1' },
            { variable: 'q2', value: '1' },
          ],
          cells: {
            '1': { percent: 30, count: 30, sig: null, sigLetters: null, stats: null },
            '2': { percent: 0, count: 0, sig: null, sigLetters: null, stats: null },
          },
          children: [],
        },
      ],
    });

    render(
      <table>
        <tbody>
          <CrosstabRow row={rowWithChildren} {...defaultProps} expandedKeys={{ 'row-1': true }} />
        </tbody>
      </table>,
    );
    // Should render expand/collapse button
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('calls onToggleRow when expand button is clicked', () => {
    const onToggleRow = vi.fn();
    const rowWithChildren = makeRow({
      children: [
        {
          key: 'child-1',
          label: 'Sub',
          rawValue: '1-1',
          depth: 1,
          total: 10,
          rowPath: [],
          cells: {
            '1': { percent: 10, count: 10, sig: null, sigLetters: null, stats: null },
            '2': { percent: 0, count: 0, sig: null, sigLetters: null, stats: null },
          },
          children: [],
        },
      ],
    });

    render(
      <table>
        <tbody>
          <CrosstabRow
            row={rowWithChildren}
            {...defaultProps}
            expandedKeys={{ 'row-1': true }}
            onToggleRow={onToggleRow}
          />
        </tbody>
      </table>,
    );

    const expandBtn = screen.getAllByRole('button')[0];
    fireEvent.click(expandBtn);
    expect(onToggleRow).toHaveBeenCalledWith('row-1');
  });
});
