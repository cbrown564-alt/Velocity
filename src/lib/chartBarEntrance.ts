import type { CSSProperties } from 'react';
import type { SVGMotionProps } from 'framer-motion';

export const CHART_BAR_ENTRANCE_DURATION_S = 0.3;
export const CHART_BAR_ENTRANCE_STAGGER_S = 0.025;

type BarOrientation = 'horizontal' | 'vertical';

export type BarEntranceMotionProps = Partial<SVGMotionProps<SVGRectElement>> & {
  style?: CSSProperties;
};

/**
 * Framer-motion props for inspector distribution bar grow (§9.2).
 * Horizontal bars scale on X from the left; vertical/histogram bars scale on Y from the baseline.
 */
export function getBarEntranceMotionProps(
  orientation: BarOrientation,
  index: number,
  enabled: boolean
): BarEntranceMotionProps {
  if (!enabled) return {};

  const delay = index * CHART_BAR_ENTRANCE_STAGGER_S;
  const transition = { duration: CHART_BAR_ENTRANCE_DURATION_S, ease: 'easeOut' as const, delay };

  if (orientation === 'horizontal') {
    return {
      initial: { scaleX: 0 },
      animate: { scaleX: 1 },
      transition,
      style: { transformOrigin: 'left center', transformBox: 'fill-box' },
    };
  }

  return {
    initial: { scaleY: 0 },
    animate: { scaleY: 1 },
    transition,
    style: { transformOrigin: 'bottom center', transformBox: 'fill-box' },
  };
}
