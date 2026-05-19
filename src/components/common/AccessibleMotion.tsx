/**
 * AccessibleMotion
 *
 * Wrapper around Framer Motion components that automatically respects
 * `prefers-reduced-motion`. When the user prefers reduced motion,
 * transforms are stripped and durations shortened.
 *
 * Usage:
 *   <AccessibleMotion preset="fadeUp" duration="normal">
 *     {(props) => <motion.div {...props}>Content</motion.div>}
 *   </AccessibleMotion>
 *
 * Or use the hook directly:
 *   const reduced = useReducedMotion();
 *   <motion.div {...getMotionProps({ preset: 'fade', reducedMotion: reduced })} />
 */

import React from 'react';
import type { MotionProps } from 'framer-motion';
import { useReducedMotion, getMotionProps, type MotionPreset, type VariantOptions } from '../../lib/motion';

interface AccessibleMotionProps {
  /** Animation preset */
  preset?: MotionPreset;
  /** Duration key or explicit seconds */
  duration?: VariantOptions['duration'];
  /** Easing key or custom cubic-bezier array */
  ease?: VariantOptions['ease'];
  /** Stagger delay for children */
  staggerChildren?: number;
  /** Delay before animation starts */
  delay?: number;
  /** Force reduced motion regardless of system preference */
  forceReducedMotion?: boolean;
  /** Render prop or direct children */
  children: React.ReactNode | ((props: Pick<MotionProps, 'initial' | 'animate' | 'exit'>) => React.ReactElement);
}

export const AccessibleMotion: React.FC<AccessibleMotionProps> = ({
  preset = 'fade',
  duration,
  ease,
  staggerChildren,
  delay,
  forceReducedMotion,
  children,
}) => {
  const systemReduced = useReducedMotion();
  const reducedMotion = forceReducedMotion ?? systemReduced;

  const motionProps = getMotionProps({
    preset,
    duration,
    ease,
    staggerChildren,
    delay,
    reducedMotion,
  });

  if (typeof children === 'function') {
    return children(motionProps);
  }

  // When children is a node, wrap in a plain div with the motion props.
  // Callers should use the render-prop form for motion.div.
  return <div>{children}</div>;
};
