import React, { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

export interface AnimatedNumberProps {
  value: number;
  formatter: (n: number) => string;
  duration?: number;
  delay?: number;
  reducedMotion?: boolean;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  formatter,
  duration = 0.4,
  delay = 0,
  reducedMotion = false,
  className,
}) => {
  const motionValue = useMotionValue(0);
  const display = useTransform(motionValue, (latest) => formatter(latest));

  useEffect(() => {
    if (reducedMotion) return;
    const controls = animate(motionValue, value, {
      duration,
      delay,
      ease: [0.4, 0.0, 0.2, 1],
    });
    return controls.stop;
  }, [value, motionValue, duration, delay, reducedMotion]);

  if (reducedMotion) {
    return <span className={className}>{formatter(value)}</span>;
  }

  return (
    <motion.span className={className} data-animated="true">
      {display}
    </motion.span>
  );
};
