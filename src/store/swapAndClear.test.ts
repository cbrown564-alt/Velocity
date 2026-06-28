import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVelocityStore } from './index';

describe('Store: swapAxes and clearConfiguration', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useVelocityStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('swapAxes', () => {
    it('should swap 1 Row and 0 Col', () => {
      const { result } = renderHook(() => useVelocityStore());
      act(() => {
        result.current.setTableConfig({ rowVars: ['r1'], colVar: null });
      });
      act(() => {
        result.current.swapAxes();
      });
      expect(result.current.tableConfig.rowVars).toEqual([]);
      expect(result.current.tableConfig.colVar).toBe('r1');
    });

    it('should swap 0 Row and 1 Col', () => {
      const { result } = renderHook(() => useVelocityStore());
      act(() => {
        result.current.setTableConfig({ rowVars: [], colVar: 'c1' });
      });
      act(() => {
        result.current.swapAxes();
      });
      expect(result.current.tableConfig.rowVars).toEqual(['c1']);
      expect(result.current.tableConfig.colVar).toBeNull();
    });

    it('should swap 1 Row and 1 Col', () => {
      const { result } = renderHook(() => useVelocityStore());
      act(() => {
        result.current.setTableConfig({ rowVars: ['r1'], colVar: 'c1' });
      });
      act(() => {
        result.current.swapAxes();
      });
      expect(result.current.tableConfig.rowVars).toEqual(['c1']);
      expect(result.current.tableConfig.colVar).toBe('r1');
    });

    it('should swap Multiple Rows and 1 Col', () => {
      const { result } = renderHook(() => useVelocityStore());
      act(() => {
        result.current.setTableConfig({ rowVars: ['r1', 'r2'], colVar: 'c1' });
      });
      // Logic: Col becomes Row[0], Row[0] becomes Col
      act(() => {
        result.current.swapAxes();
      });
      expect(result.current.tableConfig.rowVars).toEqual(['c1', 'r2']);
      expect(result.current.tableConfig.colVar).toBe('r1');
    });

    it('should swap Multiple Rows and 0 Col', () => {
      const { result } = renderHook(() => useVelocityStore());
      act(() => {
        result.current.setTableConfig({ rowVars: ['r1', 'r2'], colVar: null });
      });
      // Logic: Row[0] becomes Col. Rows shift.
      act(() => {
        result.current.swapAxes();
      });
      expect(result.current.tableConfig.rowVars).toEqual(['r2']);
      expect(result.current.tableConfig.colVar).toBe('r1');
    });
  });

  describe('clearConfiguration', () => {
    it('should clear rows, cols, and results', () => {
      const { result } = renderHook(() => useVelocityStore());
      act(() => {
        result.current.setTableConfig({ rowVars: ['r1'], colVar: 'c1' });
        // @ts-ignore - simulating result presence
        useVelocityStore.setState({ queryResult: [{}] });
      });

      expect(result.current.tableConfig.rowVars.length).toBe(1);
      expect(result.current.queryResult.length).toBe(1);

      act(() => {
        result.current.clearConfiguration();
      });

      expect(result.current.tableConfig.rowVars).toEqual([]);
      expect(result.current.tableConfig.colVar).toBeNull();
      expect(result.current.queryResult).toEqual([]);
    });
  });
});
