import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import {
  EASINGS,
  DURATIONS,
  buildVariants,
  getMotionProps,
  getPresenceTransition,
  getModalPresenceProps,
  getBackdropProps,
  getSlideInProps,
  cssTransition,
  useReducedMotion,
} from './motion';
import { renderHook } from '@testing-library/react';

describe('Motion DSL (STAB-UI-A)', () => {
  describe('constants', () => {
    it('has expected easing curves', () => {
      expect(EASINGS.standard).toEqual([0.4, 0.0, 0.2, 1]);
      expect(EASINGS.snappy).toEqual([0.16, 1, 0.3, 1]);
    });

    it('has expected durations', () => {
      expect(DURATIONS.fast).toBe(0.15);
      expect(DURATIONS.normal).toBe(0.2);
      expect(DURATIONS.enter).toBe(0.3);
    });
  });

  describe('buildVariants', () => {
    it('returns fade preset by default', () => {
      const v = buildVariants();
      expect(v.hidden).toMatchObject({ opacity: 0 });
      expect(v.visible).toMatchObject({ opacity: 1 });
    });

    it('applies custom duration and ease', () => {
      const v = buildVariants({ duration: 0.5, ease: 'snappy' });
      const visible = v.visible as Record<string, unknown>;
      expect(visible.transition).toMatchObject({
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      });
    });

    it('supports numeric ease arrays', () => {
      const v = buildVariants({ ease: [0.1, 0.2, 0.3, 0.4] });
      const visible = v.visible as Record<string, unknown>;
      expect(visible.transition).toMatchObject({
        ease: [0.1, 0.2, 0.3, 0.4],
      });
    });

    it('strips transforms when reducedMotion is true', () => {
      const v = buildVariants({ preset: 'fadeUp', reducedMotion: true });
      expect(v.hidden).toMatchObject({ opacity: 0 });
      expect(v.visible).toMatchObject({ opacity: 1 });
      expect(v.hidden).not.toHaveProperty('y');
      expect(v.visible).not.toHaveProperty('y');
    });

    it('retains transforms when reducedMotion is false', () => {
      const v = buildVariants({ preset: 'fadeUp', reducedMotion: false });
      expect(v.hidden).toMatchObject({ opacity: 0, y: 10 });
      expect(v.visible).toMatchObject({ opacity: 1, y: 0 });
    });

    it('includes staggerChildren when provided', () => {
      const v = buildVariants({ staggerChildren: 0.05 });
      const visible = v.visible as Record<string, unknown>;
      expect(visible.transition).toMatchObject({ staggerChildren: 0.05 });
    });
  });

  describe('getMotionProps', () => {
    it('returns initial/animate/exit for direct spreading', () => {
      const props = getMotionProps({ preset: 'scale' });
      expect(props.initial).toMatchObject({ opacity: 0, scale: 0.9 });
      expect(props.animate).toMatchObject({ opacity: 1, scale: 1 });
      expect(props.exit).toMatchObject({ opacity: 0, scale: 0.9 });
    });
  });

  describe('getPresenceTransition', () => {
    it('returns transition alongside animate props', () => {
      const pt = getPresenceTransition({ preset: 'slideUp', duration: 0.3 });
      expect(pt.initial).toMatchObject({ opacity: 0, y: 20 });
      expect(pt.transition.duration).toBe(0.3);
    });
  });

  describe('modal helpers', () => {
    it('getModalPresenceProps returns fadeScale with normal duration', () => {
      const props = getModalPresenceProps(false);
      expect(props.initial).toMatchObject({ opacity: 0, scale: 0.95 });
      expect(props.animate).toMatchObject({ opacity: 1, scale: 1 });
    });

    it('getModalPresenceProps strips transforms when reduced', () => {
      const props = getModalPresenceProps(true);
      expect(props.initial).toMatchObject({ opacity: 0 });
      expect(props.initial).not.toHaveProperty('scale');
    });

    it('getBackdropProps returns fade preset', () => {
      const props = getBackdropProps(false);
      expect(props.initial).toMatchObject({ opacity: 0 });
      expect(props.animate).toMatchObject({ opacity: 1 });
    });

    it('getSlideInProps returns slideRight preset', () => {
      const props = getSlideInProps(false);
      expect(props.initial).toMatchObject({ opacity: 0, x: -20 });
    });
  });

  describe('cssTransition', () => {
    it('generates single property transition', () => {
      const t = cssTransition('opacity', 'fast', 'standard');
      expect(t).toBe('opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)');
    });

    it('generates multiple property transitions', () => {
      const t = cssTransition(['opacity', 'transform'], 'normal', 'decelerate');
      expect(t).toBe(
        'opacity 200ms cubic-bezier(0, 0, 0.2, 1), transform 200ms cubic-bezier(0, 0, 0.2, 1)'
      );
    });
  });

  describe('useReducedMotion', () => {
    let mql: MediaQueryList;
    let listeners: Array<(e: MediaQueryListEvent) => void> = [];

    beforeEach(() => {
      listeners = [];
      mql = {
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: vi.fn((_, cb) => listeners.push(cb as (e: MediaQueryListEvent) => void)),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      } as unknown as MediaQueryList;
      vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns false when motion is not reduced', () => {
      Object.defineProperty(mql, 'matches', { value: false, writable: true });
      const { result } = renderHook(() => useReducedMotion());
      expect(result.current).toBe(false);
    });

    it('returns true when motion is reduced', () => {
      Object.defineProperty(mql, 'matches', { value: true, writable: true });
      const { result } = renderHook(() => useReducedMotion());
      expect(result.current).toBe(true);
    });

    it('reacts to media query changes', () => {
      Object.defineProperty(mql, 'matches', { value: false, writable: true });
      const { result } = renderHook(() => useReducedMotion());
      expect(result.current).toBe(false);

      // Simulate system preference change
      act(() => {
        listeners.forEach(cb => cb({ matches: true } as MediaQueryListEvent));
      });
      expect(result.current).toBe(true);
    });
  });
});
