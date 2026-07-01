import { RefObject, useEffect, useState } from 'react';
import { COL_OVERSCAN, ColWindow, DEFAULT_VIEWPORT_WIDTH, computeColWindow } from './crosstabColumnVirtualization';

interface UseCrosstabColWindowParams {
  /** When false, the full range is returned (no windowing). */
  enabled: boolean;
  /** Scroll container (the table's overflow-auto region — shared with rows). */
  containerRef: RefObject<HTMLElement | null>;
  /** Number of body (data) columns. */
  colCount: number;
  /** Fixed data-column width in px. */
  colWidth: number;
  /** Width (px) of the always-rendered row-label column, offsetting the first
   *  data column in the scroll content. */
  leftOffset: number;
}

/**
 * Tracks the scroll container's horizontal scroll position and width and returns
 * the window of columns to render. Reads layout imperatively (scrollLeft /
 * clientWidth) and recomputes on scroll and resize. Falls back to a default
 * viewport when measurements are unavailable (e.g. before first paint or in
 * non-layout test environments), so an initial window is always rendered.
 *
 * This shares the same scroll container as {@link useCrosstabRowWindow}; the two
 * are orthogonal (one reads scrollTop, the other scrollLeft) and compose for
 * tables that are both tall and wide.
 */
export function useCrosstabColWindow({
  enabled,
  containerRef,
  colCount,
  colWidth,
  leftOffset,
}: UseCrosstabColWindowParams): ColWindow {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(DEFAULT_VIEWPORT_WIDTH);

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
        setScrollLeft(el.scrollLeft);
      });
    };
    const measure = () => {
      setViewportWidth(el.clientWidth || DEFAULT_VIEWPORT_WIDTH);
      setScrollLeft(el.scrollLeft);
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
  }, [enabled, containerRef]);

  if (!enabled) {
    return { startIndex: 0, endIndex: colCount, leftPadding: 0, rightPadding: 0 };
  }

  return computeColWindow({ scrollLeft, viewportWidth, colWidth, colCount, leftOffset, overscan: COL_OVERSCAN });
}
