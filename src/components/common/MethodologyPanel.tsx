import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '../../lib/motion';
import { X, BookOpen, Calculator, Scale, Info } from 'lucide-react';

interface MethodologyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * MethodologyDrawer
 *
 * A slide-out panel explaining the statistical methodology used
 * in Velocity's analysis. Covers Cell-vs-Rest testing, ESS calculation,
 * and confidence level interpretation.
 */
export const MethodologyDrawer: React.FC<MethodologyDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeSection, setActiveSection] = useState<string>('cell-vs-rest');

  const sections = [
    {
      id: 'cell-vs-rest',
      icon: Calculator,
      title: 'Cell vs Rest Testing',
      content: (
        <div className="space-y-4 text-[var(--text-secondary)] text-sm">
          <p>
            Velocity uses a <strong className="text-[var(--text-primary)]">Cell vs Rest</strong> comparison
            methodology. For each cell in your crosstab, we compare its value against the complement
            (all other cells combined).
          </p>
          <div className="bg-[var(--bg-active)] rounded p-4 font-mono text-xs border border-[var(--border-color)]">
            <div className="text-[var(--text-primary)] mb-2 font-semibold">Example:</div>
            <div className="space-y-1">
              <div>Cell: Brand A, Age 25-34 = 45%</div>
              <div>Rest: All other Age groups for Brand A = 38%</div>
            </div>
            <div className="mt-3 text-[var(--color-success)] font-semibold">
              Result: Brand A over-indexes with 25-34 year olds
            </div>
          </div>
          <p>
            This approach answers: <em>"Is this cell unusually high or low compared to
              everything else?"</em> It's ideal for quickly spotting patterns in survey data.
          </p>
        </div>
      ),
    },
    {
      id: 'welchs-t',
      icon: Scale,
      title: "Welch's T-Test",
      content: (
        <div className="space-y-4 text-[var(--text-secondary)] text-sm">
          <p>
            We use <strong className="text-[var(--text-primary)]">Welch's T-Test</strong> rather
            than Student's T-Test because it doesn't assume equal variances between groups.
            This is more appropriate for survey data where group sizes often differ.
          </p>
          <div className="bg-[var(--bg-active)] rounded p-4 font-mono text-xs border border-[var(--border-color)]">
            <div className="text-[var(--text-primary)] mb-2 font-semibold">Formula:</div>
            <div>t = (x̄₁ - x̄₂) / √(s₁²/n₁ + s₂²/n₂)</div>
            <div className="mt-3 text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-panel)] p-2 rounded">
              Where x̄ = mean, s² = variance, n = sample size
            </div>
          </div>
          <p>
            The resulting <strong>t-score</strong> is converted to a <strong>p-value</strong> which
            tells us the probability of seeing this difference by chance.
          </p>
        </div>
      ),
    },
    {
      id: 'ess',
      icon: Info,
      title: 'Effective Sample Size (ESS)',
      content: (
        <div className="space-y-4 text-[var(--text-secondary)] text-sm">
          <p>
            When weighting is applied, the raw sample count doesn't reflect the true
            statistical power. <strong className="text-[var(--text-primary)]">Effective Sample Size</strong> adjusts
            for the impact of weights using Kish's approximation.
          </p>
          <div className="bg-[var(--bg-active)] rounded p-4 font-mono text-xs border border-[var(--border-color)]">
            <div className="text-[var(--text-primary)] mb-2 font-semibold">Kish's Formula:</div>
            <div>ESS = (Σwᵢ)² / Σwᵢ²</div>
            <div className="mt-3 text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-panel)] p-2 rounded">
              Where wᵢ = weight for respondent i
            </div>
          </div>
          <p>
            <strong>Why it matters:</strong> If some respondents have very high weights,
            the ESS will be lower than the raw count. This means fewer "effective" respondents
            and wider confidence intervals.
          </p>
          <div className="bg-[var(--bg-panel)] rounded p-4 border border-[var(--border-color)]">
            <div className="text-[var(--text-primary)] mb-2 font-semibold text-xs">Practical Example:</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Raw n:</span> <span className="font-mono">100 respondents</span></div>
              <div className="flex justify-between text-[var(--color-error)]"><span>With uneven weights ESS:</span> <span className="font-mono font-bold">72</span></div>
            </div>
            <div className="mt-2 text-xs italic text-[var(--text-tertiary)] border-t border-[var(--border-color)] pt-2">
              The statistical test treats this as 72 respondents, not 100, making it harder to reach significance.
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'confidence',
      icon: BookOpen,
      title: 'Confidence Levels',
      content: (
        <div className="space-y-4 text-[var(--text-secondary)] text-sm">
          <p>
            Velocity shows significance at two levels to help distinguish strong
            findings from directional indicators.
          </p>
          <div className="space-y-3">
            <div className="p-4 bg-[var(--bg-active)] rounded border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[var(--color-success)] font-bold text-lg">↑</span>
                <span className="text-[var(--color-success)] font-semibold">95% Confidence</span>
              </div>
              <p className="text-[var(--text-primary)] font-medium mb-1">Strong evidence</p>
              <p>Less than 5% chance this difference is due to random variation. The standard threshold for publication-quality findings.</p>
            </div>

            <div className="p-4 bg-[var(--bg-active)] rounded border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[var(--text-secondary)] font-bold text-lg">↑</span>
                <span className="text-[var(--text-primary)] font-semibold">80% Confidence</span>
              </div>
              <p className="text-[var(--text-primary)] font-medium mb-1">Directional indicator</p>
              <p>About 20% chance of a false positive. Useful for exploratory analysis or when sample sizes are small.</p>
            </div>
          </div>
          <div className="bg-[var(--color-accent)]/10 text-[var(--color-accent)] p-3 rounded text-xs font-medium border border-[var(--color-accent)]/20">
            Tip: Use 95% for reporting and decisions. Use 80% to spot patterns worth investigating with larger samples.
          </div>
        </div>
      ),
    },
  ];

  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[var(--text-primary)]/20 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={reducedMotion ? { duration: 0.01 } : { type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 bottom-0 right-0 w-[400px] bg-[var(--bg-panel)] border-l border-[var(--border-color)] shadow-2xl z-50 flex flex-col methodology-drawer"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)] shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--color-accent)]/10 rounded-lg">
                  <BookOpen size={20} className="text-[var(--color-accent)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] font-display">How We Calculate</h2>
                  <p className="text-xs text-[var(--text-secondary)]">Statistical Methodology</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-[var(--bg-active)] text-[var(--text-secondary)] transition-colors"
                title="Close sidebar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-col border-b border-[var(--border-color)] shrink-0 bg-[var(--bg-surface)] p-2 gap-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`
                      px-4 py-2.5 rounded-md text-sm font-medium transition-all
                      flex items-center gap-3 text-left
                      ${isActive
                        ? 'bg-[var(--bg-panel)] text-[var(--color-accent)] shadow-sm border border-[var(--border-color)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)] border border-transparent'
                      }
                    `}
                  >
                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                    {section.title}
                  </button>
                );
              })}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-app)]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reducedMotion ? 0 : -10 }}
                  transition={{ duration: reducedMotion ? 0.01 : 0.2 }}
                >
                  {sections.find(s => s.id === activeSection)?.content}
                </motion.div>
              </AnimatePresence>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MethodologyDrawer;
