import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVelocityStore } from '../../../store';
import { useFileUpload } from './useFileUpload';

vi.mock('../../../services/opfsFileManager', () => ({
  readFile: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock('./assignOpfsKeyAndLoad', () => ({
  assignOpfsKeyAndLoad: vi.fn(async (_name, _buffer, loadSAV) => {
    await loadSAV('demo.sav', new ArrayBuffer(8));
  }),
  assignOpfsStorageForUpload: vi.fn(async (file: File) => ({
    buffer: await file.arrayBuffer(),
    storageKey: 'opfs-key',
  })),
}));

describe('useFileUpload', () => {
  const setMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useVelocityStore.getState().reset();
    useVelocityStore.setState({
      loadCSV: vi.fn().mockResolvedValue(undefined),
      loadSAV: vi.fn().mockResolvedValue(undefined),
      loadSAVSample: vi.fn().mockResolvedValue(undefined),
      discardPersistedData: vi.fn().mockResolvedValue(undefined),
      setLoadProgress: vi.fn(),
      addToast: vi.fn(),
    });
  });

  it('loads CSV uploads and switches to dashboard mode', async () => {
    const loadCSV = vi.fn().mockResolvedValue(undefined);
    useVelocityStore.setState({ loadCSV });

    const { result } = renderHook(() => useFileUpload(setMode, false));
    const file = new File(['a,b\n1,2'], 'sample.csv', { type: 'text/csv' });
    const event = { target: { files: [file], value: 'sample.csv' } } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleFileUpload(event);
    });

    expect(loadCSV).toHaveBeenCalledWith('sample.csv', 'a,b\n1,2');
    expect(setMode).toHaveBeenCalledWith('dashboard');
  });

  it('shows a format warning for unsupported uploads', async () => {
    const addToast = vi.fn();
    useVelocityStore.setState({ addToast });

    const { result } = renderHook(() => useFileUpload(setMode, false));
    const file = new File(['data'], 'notes.txt', { type: 'text/plain' });
    const event = { target: { files: [file], value: 'notes.txt' } } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleFileUpload(event);
    });

    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }));
    expect(setMode).not.toHaveBeenCalledWith('dashboard');
  });

  it('starts demo mode and loads mock data', () => {
    vi.useFakeTimers();
    const loadCSV = vi.fn().mockResolvedValue(undefined);
    useVelocityStore.setState({ loadCSV });

    const { result } = renderHook(() => useFileUpload(setMode, false));

    act(() => {
      result.current.handleDemoClick();
    });
    expect(setMode).toHaveBeenCalledWith('uploading');

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(loadCSV).toHaveBeenCalledWith('mock_data.csv', expect.any(String));
    vi.useRealTimers();
  });
});
