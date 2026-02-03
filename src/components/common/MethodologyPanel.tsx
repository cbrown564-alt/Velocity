import React, { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen, Calculator, Scale, Info } from 'lucide-react';

interface MethodologyPanelProps {
  /** Start expanded */
  defaultExpanded?: boolean;
}

/**
 * MethodologyPanel
 *
 * An expandable panel explaining the statistical methodology used
 * in Velocity's analysis. Covers Cell-vs-Rest testing, ESS calculation,
 * and confidence level interpretation.
 */
export const MethodologyPanel: React.FC<MethodologyPanelProps> = ({
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const sections = [
    {
      id: 'cell-vs-rest',
      icon: Calculator,
      title: 'Cell vs Rest Testing',
      content: (
        <div className="space-y-3 text-[var(--text-secondary)]">
          <p>
            Velocity uses a <strong className="text-[var(--text-primary)]">Cell vs Rest</strong> comparison
            methodology. For each cell in your crosstab, we compare its value against the complement
            (all other cells combined).
          </p>
          <div className="bg-[var(--bg-active)] rounded p-3 font-mono text-xs">
            <div className="text-[var(--text-primary)] mb-2">Example:</div>
            <div>Cell: Brand A, Age 25-34 = 45%</div>
            <div>Rest: All other Age groups for Brand A = 38%</div>
            <div className="mt-2 text-[var(--color-success)]">
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
        <div className="space-y-3 text-[var(--text-secondary)]">
          <p>
            We use <strong className="text-[var(--text-primary)]">Welch's T-Test</strong> rather
            than Student's T-Test because it doesn't assume equal variances between groups.
            This is more appropriate for survey data where group sizes often differ.
          </p>
          <div className="bg-[var(--bg-active)] rounded p-3 font-mono text-xs">
            <div className="text-[var(--text-primary)] mb-2">Formula:</div>
            <div>t = (x̄₁ - x̄₂) / √(s₁²/n₁ + s₂²/n₂)</div>
            <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
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
        <div className="space-y-3 text-[var(--text-secondary)]">
          <p>
            When weighting is applied, the raw sample count doesn't reflect the true
            statistical power. <strong className="text-[var(--text-primary)]">Effective Sample Size</strong> adjusts
            for the impact of weights using Kish's approximation.
          </p>
          <div className="bg-[var(--bg-active)] rounded p-3 font-mono text-xs">
            <div className="text-[var(--text-primary)] mb-2">Kish's Formula:</div>
            <div>ESS = (Σwᵢ)² / Σwᵢ²</div>
            <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
              Where wᵢ = weight for respondent i
            </div>
          </div>
          <p>
            <strong>Why it matters:</strong> If some respondents have very high weights,
            the ESS will be lower than the raw count. This means fewer "effective" respondents
            and wider confidence intervals.
          </p>
          <div className="bg-[var(--bg-active)] rounded p-3 text-xs">
            <div className="text-[var(--text-primary)] mb-1">Example:</div>
            <div>Raw n = 100 respondents</div>
            <div>With uneven weights: ESS = 72</div>
            <div className="mt-1 text-[10px]">
              The statistical test treats this as 72 respondents, not 100
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
        <div className="space-y-3 text-[var(--text-secondary)]">
          <p>
            Velocity shows significance at two levels to help distinguish strong
            findings from directional indicators.
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-2 bg-[var(--bg-active)] rounded">
              <div className="w-16 text-[var(--color-success)] font-semibold">95% CI</div>
              <div>
                <strong className="text-[var(--text-primary)]">Strong evidence.</strong>{' '}
                Less than 5% chance this difference is due to random variation.
                Standard threshold for publication-quality findings.
              </div>
            </div>
            <div className="flex items-start gap-3 p-2 bg-[var(--bg-active)] rounded">
              <div className="w-16 text-[var(--text-secondary)] font-semibold">80% CI</div>
              <div>
                <strong className="text-[var(--text-primary)]">Directional indicator.</strong>{' '}
                About 20% chance of false positive. Useful for exploratory analysis
                or when sample sizes are small.
              </div>
            </div>
          </div>
          <p className="text-[11px] italic">
            Tip: Use 95% for reporting and decisions. Use 80% to spot patterns worth
            investigating with larger samples.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-active)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-[var(--color-accent)]" />
          <span className="font-semibold text-[var(--text-primary)]">
            How We Calculate
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown size={16} className="text-[var(--text-secondary)]" />
        ) : (
          <ChevronRight size={16} className="text-[var(--text-secondary)]" />
        )}
      </button>

      {/* Content - Expandable */}
      {isExpanded && (
        <div className="border-t border-[var(--border-color)]">
          {/* Section Navigation */}
          <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(isActive ? null : section.id)}
                  className={`
                    flex-1 px-3 py-2 text-xs font-medium transition-colors
                    flex items-center justify-center gap-1.5
                    ${isActive
                      ? 'text-[var(--color-accent)] bg-[var(--bg-panel)] border-b-2 border-[var(--color-accent)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)]'
                    }
                  `}
                >
                  <Icon size={12} />
                  <span className="hidden sm:inline">{section.title}</span>
                </button>
              );
            })}
          </div>

          {/* Active Section Content */}
          {activeSection && (
            <div className="p-4 text-sm leading-relaxed animate-[fadeInUp_0.15s_ease-out]">
              {sections.find(s => s.id === activeSection)?.content}
            </div>
          )}

          {/* Default message when no section selected */}
          {!activeSection && (
            <div className="p-4 text-sm text-[var(--text-secondary)] text-center">
              Select a topic above to learn about our statistical methodology.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
