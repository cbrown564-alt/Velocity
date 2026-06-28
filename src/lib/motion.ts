/**
 * Velocity Motion DSL
 *
 * Unified animation language for the Velocity UI.
 * All Framer Motion variants, easings, and durations are defined here
 * so that components consume presets instead of one-off magic numbers.
 *
 * Respects prefers-reduced-motion via useReducedMotion().
 */

import { useEffect, useState } from 'react';
import type { Transition, Variants, TargetAndTransition } from 'framer-motion';

/* -------------------------------------------------------------------------- */
/*  Easings                                                                   */
/* -------------------------------------------------------------------------- */

export const EASINGS = {
  /** Material Design standard — default for most UI transitions */
  standard: [0.4, 0.0, 0.2, 1] as const,
  /** Enter / emphasis — decelerate */
  decelerate: [0.0, 0.0, 0.2, 1] as const,
  /** Exit — accelerate */
  accelerate: [0.4, 0.0, 1, 1] as const,
  /** Snappy spring-like feel for micro-interactions */
  snappy: [0.16, 1, 0.3, 1] as const,
  /** Linear for continuous animations */
  linear: [0.25, 0.1, 0.25, 1] as const,
} as const;

/* -------------------------------------------------------------------------- */
/*  Durations (seconds)                                                       */
/* -------------------------------------------------------------------------- */

export const DURATIONS = {
  /** 100ms — instant feedback (hover states, toggles) */
  instant: 0.1,
  /** 150ms — fast UI transitions */
  fast: 0.15,
  /** 200ms — standard UI transitions */
  normal: 0.2,
  /** 250ms — emphasis transitions */
  emphasis: 0.25,
  /** 300ms — enter animations */
  enter: 0.3,
  /** 400ms — complex / shared-element transitions */
  complex: 0.4,
  /** 600ms — dramatic / page transitions */
  dramatic: 0.6,
} as const;

/* -------------------------------------------------------------------------- */
/*  Transitions                                                               */
/* -------------------------------------------------------------------------- */

export type MotionPreset =
  | 'fade'
  | 'fadeUp'
  | 'fadeDown'
  | 'fadeScale'
  | 'slideLeft'
  | 'slideRight'
  | 'slideUp'
  | 'slideDown'
  | 'scale'
  | 'layout'
  | 'none';

const PRESET_VARIANTS: Record<MotionPreset, Variants> = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  },
  fadeUp: {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
  },
  fadeDown: {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },
  fadeScale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  slideLeft: {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  slideRight: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  slideUp: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },
  slideDown: {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  },
  layout: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  },
  none: {
    hidden: {},
    visible: {},
    exit: {},
  },
};

/* -------------------------------------------------------------------------- */
/*  useReducedMotion                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Hook that detects the user's `prefers-reduced-motion` preference.
 * Returns `true` if the user prefers reduced motion.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);

    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/* -------------------------------------------------------------------------- */
/*  Variant builders                                                          */
/* -------------------------------------------------------------------------- */

export interface VariantOptions {
  /** Animation preset */
  preset?: MotionPreset;
  /** Duration in seconds */
  duration?: number;
  /** Custom easing array or named easing */
  ease?: keyof typeof EASINGS | number[];
  /** Stagger children delay in seconds */
  staggerChildren?: number;
  /** Delay before animation starts */
  delay?: number;
  /** Reduced motion override: if true, skip positional transforms */
  reducedMotion?: boolean;
}

/**
 * Build Framer Motion variants from a preset and options.
 * Automatically flattens to opacity-only when reducedMotion is true.
 */
export function buildVariants(options: VariantOptions = {}): Variants {
  const {
    preset = 'fade',
    duration = DURATIONS.normal,
    ease = 'standard',
    staggerChildren,
    delay = 0,
    reducedMotion = false,
  } = options;

  const base = PRESET_VARIANTS[preset];
  const easingArray = Array.isArray(ease) ? ease : EASINGS[ease];

  const transition: Transition = {
    duration,
    ease: easingArray as [number, number, number, number],
    delay,
  };

  if (staggerChildren !== undefined) {
    transition.staggerChildren = staggerChildren;
  }

  if (reducedMotion) {
    // Strip out transforms; keep only opacity changes
    return {
      hidden: { opacity: 0, transition },
      visible: { opacity: 1, transition },
      exit: { opacity: 0, transition: { ...transition, duration: DURATIONS.fast } },
    };
  }

  return {
    hidden: { ...base.hidden, transition },
    visible: { ...base.visible, transition },
    exit: { ...base.exit, transition: { ...transition, duration: Math.max(duration * 0.75, DURATIONS.fast) } },
  };
}

/**
 * Convenience: get just the initial/animate/exit props for a single element.
 */
export function getMotionProps(options: VariantOptions = {}) {
  const variants = buildVariants(options);
  return {
    initial: variants.hidden as TargetAndTransition,
    animate: variants.visible as TargetAndTransition,
    exit: variants.exit as TargetAndTransition,
  };
}

/* -------------------------------------------------------------------------- */
/*  AnimatePresence helpers                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Returns transition props suitable for AnimatePresence children.
 * When reducedMotion is active, durations are shortened and transforms removed.
 */
export function getPresenceTransition(options: VariantOptions = {}): {
  initial: object;
  animate: object;
  exit: object;
  transition: Transition;
} {
  const variants = buildVariants(options);
  const transition = (variants.visible as Record<string, unknown>).transition as Transition;

  return {
    initial: variants.hidden,
    animate: variants.visible,
    exit: variants.exit,
    transition,
  };
}

/* -------------------------------------------------------------------------- */
/*  Modal / Overlay presets                                                   */
/* -------------------------------------------------------------------------- */

/** Standard modal enter/exit — used by ~10 overlay components */
export function getModalPresenceProps(reducedMotion = false) {
  return getMotionProps({
    preset: 'fadeScale',
    duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal,
    ease: 'standard',
    reducedMotion,
  });
}

/** Modal backdrop fade */
export function getBackdropProps(reducedMotion = false) {
  return getMotionProps({
    preset: 'fade',
    duration: reducedMotion ? DURATIONS.instant : DURATIONS.fast,
    reducedMotion,
  });
}

/** Slide-in panel (right side) */
export function getSlideInProps(reducedMotion = false) {
  return getMotionProps({
    preset: 'slideRight',
    duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal,
    ease: 'decelerate',
    reducedMotion,
  });
}

/* -------------------------------------------------------------------------- */
/*  CSS transition shorthand                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Generate a CSS transition string that respects the design-system tokens.
 * Use for non-Framer-Motion transitions (e.g. hover states in CSS/Tailwind).
 */
export function cssTransition(
  properties: string | string[],
  durationKey: keyof typeof DURATIONS = 'fast',
  easeKey: keyof typeof EASINGS = 'standard',
): string {
  const props = Array.isArray(properties) ? properties : [properties];
  const duration = `${DURATIONS[durationKey] * 1000}ms`;
  const ease = `cubic-bezier(${EASINGS[easeKey].join(', ')})`;
  return props.map((p) => `${p} ${duration} ${ease}`).join(', ');
}
