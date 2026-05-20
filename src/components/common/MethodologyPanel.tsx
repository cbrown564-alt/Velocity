import React, { useState, useLayoutEffect, useCallback, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '../../lib/motion';
import { X, ArrowUp, ArrowDown } from 'lucide-react';

const POPOVER_WIDTH = 300;
const POPOVER_MAX_HEIGHT = 280;
const GAP = 6;
const VIEWPORT_MARGIN = 8;

interface PopoverCoords {
  top: number;
  left: number;
  placement: 'below' | 'above';
}

function computePopoverCoords(anchor: HTMLElement): PopoverCoords {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - VIEWPORT_MARGIN;
  const placement =
    spaceBelow < POPOVER_MAX_HEIGHT * 0.6 && spaceAbove > spaceBelow ? 'above' : 'below';

  let left = rect.left;
  if (left + POPOVER_WIDTH > window.innerWidth - VIEWPORT_MARGIN) {
    left = window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN;
  }
  if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

  const top = placement === 'below' ? rect.bottom + GAP : rect.top - GAP;

  return { top, left, placement };
}

interface MethodologyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}

type SectionId = 'cell-vs-rest' | 'welchs-t' | 'ess' | 'confidence';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'cell-vs-rest', label: 'Cell vs Rest' },
  { id: 'welchs-t', label: "Welch's t" },
  { id: 'ess', label: 'ESS' },
  { id: 'confidence', label: 'Confidence' },
];

function SectionContent({ id }: { id: SectionId }) {
  switch (id) {
    case 'cell-vs-rest':
      return (
        <div className="space-y-2 text-[var(--text-secondary)] text-xs leading-relaxed">
          <p>
            Each cell is compared to the <strong className="text-[var(--text-primary)]">rest of the table</strong>{' '}
            (all other cells combined). Arrows mark cells that are unusually high or low.
          </p>
          <div className="rounded border border-[var(--border-color)] bg-[var(--bg-active)] px-2.5 py-2 font-mono text-[10px] leading-snug">
            <div className="text-[var(--text-primary)] font-semibold mb-1">Example</div>
            <div>Cell: Brand A, 25–34 = 45%</div>
            <div>Rest: other ages for Brand A = 38%</div>
            <div className="mt-1 text-[var(--color-success)]">→ over-index in 25–34</div>
          </div>
        </div>
      );
    case 'welchs-t':
      return (
        <div className="space-y-2 text-[var(--text-secondary)] text-xs leading-relaxed">
          <p>
            <strong className="text-[var(--text-primary)]">Welch&apos;s t-test</strong> does not assume equal variance
            between groups — appropriate when column bases differ.
          </p>
          <div className="rounded border border-[var(--border-color)] bg-[var(--bg-active)] px-2.5 py-2 font-mono text-[10px]">
            t = (x̄₁ − x̄₂) / √(s₁²/n₁ + s₂²/n₂)
          </div>
          <p>The t-score is converted to a <strong className="text-[var(--text-primary)]">p-value</strong> for significance.</p>
        </div>
      );
    case 'ess':
      return (
        <div className="space-y-2 text-[var(--text-secondary)] text-xs leading-relaxed">
          <p>
            With weights, <strong className="text-[var(--text-primary)]">ESS</strong> (Kish) estimates effective sample size:
          </p>
          <div className="rounded border border-[var(--border-color)] bg-[var(--bg-active)] px-2.5 py-2 font-mono text-[10px]">
            ESS = (Σw)² / Σw²
          </div>
          <p>High weight concentration lowers ESS and makes significance harder to reach.</p>
        </div>
      );
    case 'confidence':
      return (
        <div className="space-y-2 text-[var(--text-secondary)] text-xs leading-relaxed">
          <div className="flex gap-2">
            <div className="flex-1 rounded border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5">
              <div className="text-[var(--text-primary)] font-semibold text-[11px] mb-1">95%</div>
              <div className="flex items-center gap-1 flex-wrap text-[10px]">
                <ArrowUp size={10} style={{ color: 'var(--color-success)' }} aria-hidden />
                <span style={{ color: 'var(--color-success)' }}>Higher</span>
                <ArrowDown size={10} style={{ color: 'var(--color-error)' }} aria-hidden />
                <span style={{ color: 'var(--color-error)' }}>Lower</span>
              </div>
              <div className="text-[10px] mt-1 text-[var(--color-success)]">Strong evidence (p &lt; .05)</div>
            </div>
            <div className="flex-1 rounded border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5">
              <div className="text-[var(--text-primary)] font-semibold text-[11px] mb-1">80%</div>
              <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                <ArrowUp size={10} aria-hidden />
                <ArrowDown size={10} aria-hidden />
                <span>Directional</span>
              </div>
              <div className="text-[10px] mt-1 text-[var(--text-secondary)]">Exploratory indicator</div>
            </div>
          </div>
          <p className="text-[10px] text-[var(--text-tertiary)]">Report at 95%; use 80% to flag patterns worth validating.</p>
        </div>
      );
  }
}

/**
 * Compact methodology popover — opens from the statistics footer pill.
 */
export const MethodologyDrawer: React.FC<MethodologyDrawerProps> = ({ isOpen, onClose, anchorRef }) => {
  const [activeSection, setActiveSection] = useState<SectionId>('cell-vs-rest');
  const [coords, setCoords] = useState<PopoverCoords | null>(null);
  const reducedMotion = useReducedMotion();

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    setCoords(computePopoverCoords(anchor));
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setCoords(null);
      return;
    }
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Close methodology"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-transparent cursor-default"
          />

          {coords && (
          <motion.div
            role="dialog"
            aria-labelledby="methodology-popover-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? { duration: 0.01 } : { duration: 0.18, ease: 'easeOut' }}
            className="methodology-popover fixed z-50 w-[min(300px,calc(100vw-1.5rem))] max-h-[min(42vh,280px)] flex flex-col rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-lg overflow-hidden"
            style={{
              top: coords.top,
              left: coords.left,
              transform: coords.placement === 'above' ? 'translateY(-100%)' : undefined,
            }}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-color)] shrink-0">
              <div className="min-w-0">
                <h2
                  id="methodology-popover-title"
                  className="text-sm font-semibold text-[var(--text-primary)] truncate"
                >
                  Methodology
                </h2>
                <p className="text-[10px] text-[var(--text-secondary)]">How significance is calculated</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 p-1 rounded hover:bg-[var(--bg-active)] text-[var(--text-secondary)] transition-colors"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>

            <div
              className="flex gap-0.5 px-2 py-1.5 border-b border-[var(--border-color)] shrink-0 overflow-x-auto"
              role="tablist"
            >
              {SECTIONS.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveSection(section.id)}
                    className={`
                      shrink-0 px-2 py-1 rounded text-[10px] font-medium transition-colors
                      ${isActive
                        ? 'bg-[var(--bg-active)] text-[var(--color-accent)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)]'
                      }
                    `}
                  >
                    {section.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 bg-[var(--bg-app)]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0.01 : 0.12 }}
                >
                  <SectionContent id={activeSection} />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
          )}
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default MethodologyDrawer;
