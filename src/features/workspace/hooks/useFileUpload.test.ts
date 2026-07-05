import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVelocityStore } from '../../../store';
import { assignOpfsKeyAndLoad } from './assignOpfsKeyAndLoad';
import {
  BACKUP_EXAMPLE_SAV_NAME,
  BACKUP_EXAMPLE_SAV_URL,
  EXAMPLE_SAV_NAME,
  EXAMPLE_SAV_URL,
  useFileUpload,
} from './useFileUpload';

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

  it('loads dropped SAV files through the shared upload path', async () => {
    const loadSAV = vi.fn().mockResolvedValue(undefined);
    useVelocityStore.setState({ loadSAV });

    const { result } = renderHook(() => useFileUpload(setMode, true));
    const file = new File([new Uint8Array([1, 2, 3])], 'client.sav', { type: 'application/octet-stream' });

    await act(async () => {
      await result.current.handleDroppedFile(file);
    });

    expect(loadSAV).toHaveBeenCalled();
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

  it('loads the bundled brand tracker example dataset as the primary example', async () => {
    const loadSAV = vi.fn().mockResolvedValue(undefined);
    const addToast = vi.fn();
    useVelocityStore.setState({ loadSAV, addToast });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

    const { result } = renderHook(() => useFileUpload(setMode, true));

    await act(async () => {
      result.current.handleDemoClick();
      await Promise.resolve();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(EXAMPLE_SAV_URL);
    expect(EXAMPLE_SAV_NAME).toBe('brandtracker_w4.sav');
    expect(assignOpfsKeyAndLoad).toHaveBeenCalledWith(
      EXAMPLE_SAV_NAME,
      expect.any(ArrayBuffer),
      loadSAV,
      expect.objectContaining({ opfsFileKey: 'opfs-key' }),
    );
    expect(setMode).toHaveBeenCalledWith('dashboard');
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Brand tracker example loaded',
      }),
    );
  });

  it('falls back to sleep.sav when the brand tracker example is unavailable', async () => {
    const loadSAV = vi.fn().mockResolvedValue(undefined);
    const addToast = vi.fn();
    useVelocityStore.setState({ loadSAV, addToast });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === EXAMPLE_SAV_URL) {
        return new Response(null, { status: 404 });
      }
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    });

    const { result } = renderHook(() => useFileUpload(setMode, true));

    await act(async () => {
      result.current.handleDemoClick();
      await Promise.resolve();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(EXAMPLE_SAV_URL);
    expect(globalThis.fetch).toHaveBeenCalledWith(BACKUP_EXAMPLE_SAV_URL);
    expect(assignOpfsKeyAndLoad).toHaveBeenCalledWith(
      BACKUP_EXAMPLE_SAV_NAME,
      expect.any(ArrayBuffer),
      loadSAV,
      expect.objectContaining({ opfsFileKey: 'opfs-key' }),
    );
    expect(setMode).toHaveBeenCalledWith('dashboard');
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sleep study example loaded',
      }),
    );
  });
});
