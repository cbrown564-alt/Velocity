import { describe, it, expect, beforeEach } from 'vitest';
import { useVelocityStore } from '../../store';

describe('UISlice — Focus Mode', () => {
  beforeEach(() => {
    useVelocityStore.setState({ focusMode: false });
  });

  it('defaults focusMode to false', () => {
    expect(useVelocityStore.getState().focusMode).toBe(false);
  });

  it('toggles focusMode on and off', () => {
    useVelocityStore.getState().toggleFocusMode();
    expect(useVelocityStore.getState().focusMode).toBe(true);

    useVelocityStore.getState().toggleFocusMode();
    expect(useVelocityStore.getState().focusMode).toBe(false);
  });

  it('sets focusMode explicitly', () => {
    useVelocityStore.getState().setFocusMode(true);
    expect(useVelocityStore.getState().focusMode).toBe(true);

    useVelocityStore.getState().setFocusMode(false);
    expect(useVelocityStore.getState().focusMode).toBe(false);
  });
});

describe('UISlice — Table Density', () => {
  beforeEach(() => {
    useVelocityStore.setState({ tableDensity: 'compact' });
  });

  it('defaults tableDensity to compact', () => {
    expect(useVelocityStore.getState().tableDensity).toBe('compact');
  });

  it('toggles density between compact and generous', () => {
    useVelocityStore.getState().toggleTableDensity();
    expect(useVelocityStore.getState().tableDensity).toBe('generous');

    useVelocityStore.getState().toggleTableDensity();
    expect(useVelocityStore.getState().tableDensity).toBe('compact');
  });

  it('sets density explicitly', () => {
    useVelocityStore.getState().setTableDensity('generous');
    expect(useVelocityStore.getState().tableDensity).toBe('generous');

    useVelocityStore.getState().setTableDensity('compact');
    expect(useVelocityStore.getState().tableDensity).toBe('compact');
  });
});

describe('UISlice — Toast Layer', () => {
  beforeEach(() => {
    useVelocityStore.setState({ toasts: [] });
  });

  it('defaults to empty toasts', () => {
    expect(useVelocityStore.getState().toasts).toEqual([]);
  });

  it('adds a toast with generated id', () => {
    useVelocityStore.getState().addToast({ message: 'Hello', type: 'info' });
    const toasts = useVelocityStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Hello');
    expect(toasts[0].type).toBe('info');
    expect(toasts[0].id).toBeDefined();
    expect(toasts[0].duration).toBe(4000);
  });

  it('allows custom duration', () => {
    useVelocityStore.getState().addToast({ message: 'Quick', type: 'warning', duration: 1000 });
    const toast = useVelocityStore.getState().toasts[0];
    expect(toast.duration).toBe(1000);
  });

  it('dismisses a toast by id', () => {
    useVelocityStore.getState().addToast({ message: 'A', type: 'info' });
    useVelocityStore.getState().addToast({ message: 'B', type: 'success' });
    const id = useVelocityStore.getState().toasts[0].id;
    useVelocityStore.getState().dismissToast(id);
    expect(useVelocityStore.getState().toasts).toHaveLength(1);
    expect(useVelocityStore.getState().toasts[0].message).toBe('B');
  });

  it('clears all toasts', () => {
    useVelocityStore.getState().addToast({ message: 'A', type: 'info' });
    useVelocityStore.getState().addToast({ message: 'B', type: 'error' });
    useVelocityStore.getState().clearToasts();
    expect(useVelocityStore.getState().toasts).toEqual([]);
  });
});
