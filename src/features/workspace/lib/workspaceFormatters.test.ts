import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatFileSize,
  formatRelativeTime,
  getStorageHealthStatus,
  PROJECT_COLORS,
} from './workspaceFormatters';

describe('workspaceFormatters', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(formatFileSize(512)).toBe('512 B');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(2048)).toBe('2.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });

    it('formats gigabytes', () => {
      expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2.0 GB');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns Just now for recent timestamps', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-24T12:00:00Z'));
      expect(formatRelativeTime(Date.now() - 30_000)).toBe('Just now');
    });

    it('returns minutes ago', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-24T12:00:00Z'));
      expect(formatRelativeTime(Date.now() - 5 * 60_000)).toBe('5m ago');
    });

    it('returns hours ago', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-24T12:00:00Z'));
      expect(formatRelativeTime(Date.now() - 3 * 3_600_000)).toBe('3h ago');
    });

    it('returns days ago', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-24T12:00:00Z'));
      expect(formatRelativeTime(Date.now() - 2 * 86_400_000)).toBe('2d ago');
    });

    it('returns locale date for older timestamps', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-24T12:00:00Z'));
      const old = new Date('2026-06-01T12:00:00Z').getTime();
      expect(formatRelativeTime(old)).toBe(new Date(old).toLocaleDateString());
    });
  });

  describe('getStorageHealthStatus', () => {
    it('returns healthy below 70%', () => {
      expect(getStorageHealthStatus(60, 100)).toBe('healthy');
    });

    it('returns warning between 70% and 90%', () => {
      expect(getStorageHealthStatus(80, 100)).toBe('warning');
    });

    it('returns critical at or above 90%', () => {
      expect(getStorageHealthStatus(95, 100)).toBe('critical');
    });
  });

  describe('PROJECT_COLORS', () => {
    it('exposes a non-empty palette', () => {
      expect(PROJECT_COLORS.length).toBeGreaterThan(0);
      expect(PROJECT_COLORS.every(c => c.startsWith('#'))).toBe(true);
    });
  });
});
