import { RefObject, useEffect, useState } from 'react';
import { DEFAULT_VIEWPORT_HEIGHT, RowWindow, computeRowWindow } from './crosstabVirtualization';

interface UseCrosstabRowWindowParams {
  /** When false, the full range is returned (no windowing). */
  enabled: boolean;
  /** Scroll container (the table's overflow-auto region). */
  containerRef: RefObject<HTMLElement | null>;
  /** Sticky header element, used to offset the visible-row calculation. */
  headerRef: RefObject<HTMLElement | null>;
  /** Number of flattened rows. */
  rowCount: number;
  /** Estimated row height in px. */
  rowHeight: number;
}

/**
 * Tracks the scroll container's scroll position and size and returns the window
 * of rows to render. Reads layout imperatively (scrollTop / clientHeight /
 * header height) and recomputes on scroll and resize. Falls back to a default
 * viewport when measurements are unavailable (e.g. before first paint or in
 * non-layout test environments), so an initial window is always rendered.
 */
export function useCrosstabRowWindow({
  enabled,
  containerRef,
  headerRef,
  rowCount,
  rowHeight,
}: UseCrosstabRowWindowParams): RowWindow {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const [headerOffset, setHeaderOffset] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    // rAF-throttle scroll so fast scrolling coalesces to one re-render per frame.
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setScrollTop(el.scrollTop);
      });
    };
    const measure = () => {
      setViewportHeight(el.clientHeight || DEFAULT_VIEWPORT_HEIGHT);
      setHeaderOffset(headerRef.current?.offsetHeight ?? 0);
      setScrollTop(el.scrollTop);
    };

    measure();
    el.addEventListener('scroll', onScroll, { passive: true });

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(el);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      el.removeEventListener('scroll', onScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else if (typeof window !== 'undefined') {
        window.removeEventListener('resize', measure);
      }
    };
  }, [enabled, containerRef, headerRef]);

  if (!enabled) {
    return { startIndex: 0, endIndex: rowCount, topPadding: 0, bottomPadding: 0 };
  }

  return computeRowWindow({ scrollTop, viewportHeight, rowHeight, rowCount, headerOffset });
}
