import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { AnimatedNumber } from '../../../components/common/AnimatedNumber';

type CellSig = 'high_95' | 'high_80' | 'low_95' | 'low_80';

export interface CrosstabCellProps {
  variant: 'frequency' | 'metric' | 'count';
  isZero?: boolean;
  isSignificant?: boolean;
  percent?: number;
  mean?: number;
  count?: number;
  validCount?: number;
  stdDev?: number;
  sig?: CellSig | null;
  sigLetters?: string;
  showMeanBadge?: boolean;
  /** If provided, primary values animate on mount and when this key changes */
  animationTrigger?: string;
  /** Respects prefers-reduced-motion; passed from parent DataTable */
  reducedMotion?: boolean;
}

function primaryTextClass(isZero: boolean, isSignificant: boolean): string {
  if (isZero) return 'text-[var(--text-secondary)] opacity-50';
  if (isSignificant) return 'stat-significant';
  return 'text-[var(--text-primary)]';
}

function secondaryTextClass(isZero: boolean): string {
  return isZero ? 'text-[var(--text-secondary)] opacity-40' : 'text-[var(--text-secondary)]';
}

function smallBaseClass(n: number | undefined): string {
  if (n !== undefined && n > 0 && n < 30) return 'text-[var(--status-warning-text)]';
  return '';
}

/** Fade-in wrapper for secondary metadata (n=, SD) */
function FadeIn({
  children,
  delay = 0,
  animationTrigger,
  reducedMotion,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  animationTrigger?: string;
  reducedMotion?: boolean;
  className?: string;
}) {
  if (!animationTrigger || reducedMotion) {
    return <span className={className}>{children}</span>;
  }
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay }}
      data-animated="true"
    >
      {children}
    </motion.span>
  );
}

/** Spring "lock-in" wrapper for significance markers */
function SpringLock({
  children,
  animationTrigger,
  reducedMotion,
  className,
}: {
  children: React.ReactNode;
  animationTrigger?: string;
  reducedMotion?: boolean;
  className?: string;
}) {
  if (!animationTrigger || reducedMotion) {
    return <span className={className}>{children}</span>;
  }
  return (
    <motion.span
      className={className}
      initial={{ scale: 1.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.35 }}
      data-animated="true"
    >
      {children}
    </motion.span>
  );
}

function SignificanceMarkers({
  sig,
  sigLetters,
  animationTrigger,
  reducedMotion,
}: {
  sig?: CellSig | null;
  sigLetters?: string;
  animationTrigger?: string;
  reducedMotion?: boolean;
}) {
  if (sigLetters) {
    return (
      <SpringLock animationTrigger={animationTrigger} reducedMotion={reducedMotion}>
        <span className="text-[10px] font-mono font-semibold text-[var(--color-success)] align-super">
          {sigLetters}
        </span>
      </SpringLock>
    );
  }
  if (sig === 'high_95') {
    return (
      <SpringLock animationTrigger={animationTrigger} reducedMotion={reducedMotion}>
        <ArrowUp size={12} style={{ color: 'var(--color-success)' }} className="shrink-0" aria-hidden />
      </SpringLock>
    );
  }
  if (sig === 'high_80') {
    return (
      <SpringLock animationTrigger={animationTrigger} reducedMotion={reducedMotion}>
        <ArrowUp size={12} style={{ color: 'var(--text-secondary)' }} className="shrink-0" aria-hidden />
      </SpringLock>
    );
  }
  if (sig === 'low_95') {
    return (
      <SpringLock animationTrigger={animationTrigger} reducedMotion={reducedMotion}>
        <ArrowDown size={12} style={{ color: 'var(--color-error)' }} className="shrink-0" aria-hidden />
      </SpringLock>
    );
  }
  if (sig === 'low_80') {
    return (
      <SpringLock animationTrigger={animationTrigger} reducedMotion={reducedMotion}>
        <ArrowDown size={12} style={{ color: 'var(--text-secondary)' }} className="shrink-0" aria-hidden />
      </SpringLock>
    );
  }
  return null;
}

/**
 * Strategy B crosstab cell: left-aligned stack of primary value + secondary metadata.
 * Supports entry animations (Settling Scale) when animationTrigger is provided.
 */
export const CrosstabCell: React.FC<CrosstabCellProps> = ({
  variant,
  isZero = false,
  isSignificant = false,
  percent,
  mean,
  count,
  validCount,
  stdDev,
  sig,
  sigLetters,
  showMeanBadge = false,
  animationTrigger,
  reducedMotion = false,
}) => {
  const primaryClass = primaryTextClass(isZero, isSignificant);
  const secondaryClass = secondaryTextClass(isZero);

  if (variant === 'count') {
    const n = count ?? 0;
    const display = animationTrigger ? (
      <AnimatedNumber
        key={`count-${animationTrigger}`}
        value={n}
        formatter={(v) => `${Math.round(v)}`}
        reducedMotion={reducedMotion}
        className={`font-mono text-sm font-bold tabular-nums ${primaryClass}`}
      />
    ) : (
      <span className={`font-mono text-sm font-bold tabular-nums ${primaryClass}`}>{n}</span>
    );
    return (
      <div className="flex flex-col items-start gap-0.5 text-left" data-testid="crosstab-cell-count">
        {display}
        <FadeIn animationTrigger={animationTrigger} reducedMotion={reducedMotion} delay={0.1} className={`text-[10px] font-mono tracking-tight ${secondaryClass}`}>
          base
        </FadeIn>
      </div>
    );
  }

  if (variant === 'metric') {
    const displayMean = mean !== undefined ? mean.toFixed(1) : '—';
    const sampleN = validCount ?? count;
    const meanEl = animationTrigger ? (
      <AnimatedNumber
        key={`mean-${animationTrigger}`}
        value={mean ?? 0}
        formatter={(v) => v.toFixed(1)}
        reducedMotion={reducedMotion}
        className={`font-mono text-sm font-bold tabular-nums ${primaryClass}`}
      />
    ) : (
      <span className={`font-mono text-sm font-bold tabular-nums ${primaryClass}`}>{displayMean}</span>
    );
    return (
      <div className="flex flex-col items-start gap-0.5 text-left" data-testid="crosstab-cell-metric">
        <div className="flex items-baseline gap-1">
          {meanEl}
          {sigLetters ? (
            <SpringLock animationTrigger={animationTrigger} reducedMotion={reducedMotion}>
              <span className="text-[10px] font-mono font-semibold text-[var(--color-success)] align-super">
                {sigLetters}
              </span>
            </SpringLock>
          ) : (
            showMeanBadge &&
            !isZero &&
            !sigLetters && (
              <FadeIn animationTrigger={animationTrigger} reducedMotion={reducedMotion} delay={0.1} className={`text-[10px] ${secondaryClass} bg-[var(--bg-panel)] px-1 rounded font-mono`}>
                Mean
              </FadeIn>
            )
          )}
        </div>
        <FadeIn animationTrigger={animationTrigger} reducedMotion={reducedMotion} delay={0.1} className={`text-[10px] font-mono tracking-tight ${secondaryClass}`}>
          {stdDev !== undefined && <span className="mr-2">SD: {stdDev.toFixed(1)}</span>}
          {sampleN !== undefined && (
            <span className={smallBaseClass(sampleN)} data-small-base={smallBaseClass(sampleN) ? 'true' : undefined}>
              n={sampleN}
            </span>
          )}
        </FadeIn>
      </div>
    );
  }

  const displayPercent = percent !== undefined ? `${percent.toFixed(1)}%` : '—';
  const baseClass = smallBaseClass(count);
  const percentEl = animationTrigger ? (
    <AnimatedNumber
      key={`pct-${animationTrigger}`}
      value={percent ?? 0}
      formatter={(v) => `${v.toFixed(1)}%`}
      reducedMotion={reducedMotion}
      className={`font-mono text-sm font-bold tabular-nums ${primaryClass}`}
    />
  ) : (
    <span className={`font-mono text-sm font-bold tabular-nums ${primaryClass}`}>{displayPercent}</span>
  );

  return (
    <div className="flex flex-col items-start gap-0.5 text-left" data-testid="crosstab-cell-frequency">
      <div className="flex items-center gap-0.5">
        {percentEl}
        <SignificanceMarkers
          sig={sig}
          sigLetters={sigLetters}
          animationTrigger={animationTrigger}
          reducedMotion={reducedMotion}
        />
      </div>
      {count !== undefined && (
        <FadeIn
          animationTrigger={animationTrigger}
          reducedMotion={reducedMotion}
          delay={0.15}
          className={`text-[10px] font-mono tracking-tight ${secondaryClass} ${baseClass}`}
        >
          <span data-small-base={baseClass ? 'true' : undefined}>n={count}</span>
        </FadeIn>
      )}
    </div>
  );
};
