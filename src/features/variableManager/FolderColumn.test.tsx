import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { FolderColumn } from './FolderColumn';
import { useVelocityStore } from '../../store';

function renderWithDnd(ui: React.ReactElement) {
  return render(<DndContext>{ui}</DndContext>);
}

function setupStore(overrides: Record<string, unknown> = {}) {
  const setActiveFolderId = vi.fn();
  const createFolder = vi.fn().mockReturnValue('new-folder-id');
  const deleteFolder = vi.fn();

  useVelocityStore.setState({
    dataset: { id: 'ds-1', name: 'test.sav', rowCount: 100, variables: [], source: 'sav' },
    folders: [],
    variableSets: [
      { id: 'vs-1', name: 'Gender', variableIds: ['v1'], type: 'categorical', structure: 'single' },
      { id: 'vs-2', name: 'Region', variableIds: ['v2'], type: 'categorical', structure: 'single' },
    ],
    activeFolderId: null,
    setActiveFolderId,
    createFolder,
    deleteFolder,
    ...overrides,
  });

  return { setActiveFolderId, createFolder, deleteFolder };
}

describe('FolderColumn', () => {
  beforeEach(() => {
    setupStore();
  });

  it('renders All Variables and Ungrouped items', () => {
    renderWithDnd(<FolderColumn />);
    expect(screen.getByText('All Variables')).toBeInTheDocument();
    expect(screen.getByText('Ungrouped')).toBeInTheDocument();
    expect(screen.getByText('Folders')).toBeInTheDocument();
  });

  it('shows variable count', () => {
    renderWithDnd(<FolderColumn />);
    // Total variable sets: 2
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
  });

  it('calls setActiveFolderId(null) when All Variables is clicked', () => {
    const { setActiveFolderId } = setupStore();
    renderWithDnd(<FolderColumn />);
    fireEvent.click(screen.getByText('All Variables'));
    expect(setActiveFolderId).toHaveBeenCalledWith(null);
  });

  it('calls setActiveFolderId("ungrouped") when Ungrouped is clicked', () => {
    const { setActiveFolderId } = setupStore();
    renderWithDnd(<FolderColumn />);
    fireEvent.click(screen.getByText('Ungrouped'));
    expect(setActiveFolderId).toHaveBeenCalledWith('ungrouped');
  });

  it('shows new folder input when create button is clicked', () => {
    renderWithDnd(<FolderColumn />);
    fireEvent.click(screen.getByTitle('Create folder'));
    expect(screen.getByPlaceholderText('Folder name...')).toBeInTheDocument();
  });

  it('creates folder when Enter is pressed in the input', () => {
    const { createFolder } = setupStore();
    renderWithDnd(<FolderColumn />);
    fireEvent.click(screen.getByTitle('Create folder'));

    const input = screen.getByPlaceholderText('Folder name...');
    fireEvent.change(input, { target: { value: 'Demographics' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(createFolder).toHaveBeenCalledWith('Demographics');
  });

  it('hides input on Escape key', () => {
    renderWithDnd(<FolderColumn />);
    fireEvent.click(screen.getByTitle('Create folder'));

    const input = screen.getByPlaceholderText('Folder name...');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByPlaceholderText('Folder name...')).not.toBeInTheDocument();
  });

  it('renders custom folders from store', () => {
    useVelocityStore.setState({
      folders: [{ id: 'f-1', name: 'Demographics', order: 0 }],
    });
    renderWithDnd(<FolderColumn />);
    expect(screen.getByText('Demographics')).toBeInTheDocument();
  });

  it('calls setActiveFolderId when a folder item is clicked', () => {
    const { setActiveFolderId } = setupStore();
    useVelocityStore.setState({
      folders: [{ id: 'f-1', name: 'Demographics', order: 0 }],
    });
    renderWithDnd(<FolderColumn />);
    fireEvent.click(screen.getByText('Demographics'));
    expect(setActiveFolderId).toHaveBeenCalledWith('f-1');
  });
});
