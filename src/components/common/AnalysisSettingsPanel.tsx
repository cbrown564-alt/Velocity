import React from 'react';
import { useVelocityStore } from '../../store';
import type { ComparisonMethod, CorrectionType } from '../../store/slices/analysisSlice';

interface AnalysisSettingsPanelProps {
  className?: string;
  /** 'standalone' renders with border/bg/header; 'inline' renders flat for embedding in a tray */
  variant?: 'standalone' | 'inline';
}

/**
 * AnalysisSettingsPanel
 *
 * Compact settings panel for statistical analysis options.
 * Includes comparison method, correction type, and CI toggle.
 */
export const AnalysisSettingsPanel: React.FC<AnalysisSettingsPanelProps> = ({
  className = '',
  variant = 'standalone',
}) => {
  const analysisSettings = useVelocityStore((state) => state.analysisSettings);
  const updateAnalysisSettings = useVelocityStore((state) => state.updateAnalysisSettings);

  const handleComparisonMethodChange = (method: ComparisonMethod) => {
    updateAnalysisSettings({ comparisonMethod: method });
  };

  const handleCorrectionChange = (correction: CorrectionType) => {
    updateAnalysisSettings({ correctionType: correction });
  };

  const handleCIToggle = () => {
    updateAnalysisSettings({ showConfidenceIntervals: !analysisSettings.showConfidenceIntervals });
  };

  const handleCellNToggle = () => {
    updateAnalysisSettings({ showCellN: !analysisSettings.showCellN });
  };

  const handleColumnBasesToggle = () => {
    updateAnalysisSettings({ showColumnBases: !analysisSettings.showColumnBases });
  };

  const isInline = variant === 'inline';

  const wrapperClass = isInline
    ? `flex flex-wrap items-center gap-4 ${className}`
    : `bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg p-3 ${className}`;

  return (
    <div className={wrapperClass}>
      {!isInline && (
        <div className="text-xs font-semibold text-[var(--text-accent)] uppercase tracking-wide mb-3">
          Statistical Settings
        </div>
      )}

      {/* Comparison Method */}
      <div className={isInline ? 'flex items-center gap-2' : 'mb-3'}>
        <label className="text-xs text-[var(--text-secondary)] shrink-0">
          {isInline ? 'Compare:' : 'Comparison Method'}
        </label>
        <div className="flex gap-1">
          <button
            onClick={() => handleComparisonMethodChange('cell_vs_rest')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              analysisSettings.comparisonMethod === 'cell_vs_rest'
                ? 'bg-[var(--color-accent)] text-[var(--text-inverse)]'
                : 'bg-[var(--bg-panel)] text-[var(--text-primary)] hover:bg-[var(--bg-active)]'
            } ${isInline ? '' : 'flex-1'}`}
          >
            Cell vs Rest
          </button>
          <button
            onClick={() => handleComparisonMethodChange('pairwise')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              analysisSettings.comparisonMethod === 'pairwise'
                ? 'bg-[var(--color-accent)] text-[var(--text-inverse)]'
                : 'bg-[var(--bg-panel)] text-[var(--text-primary)] hover:bg-[var(--bg-active)]'
            } ${isInline ? '' : 'flex-1'}`}
          >
            Pairwise (A/B/C)
          </button>
        </div>
      </div>

      {/* Correction Method */}
      <div className={isInline ? 'flex items-center gap-2' : 'mb-3'}>
        <label className="text-xs text-[var(--text-secondary)] shrink-0">
          {isInline ? 'Correct:' : 'Multiple Testing Correction'}
        </label>
        <select
          value={analysisSettings.correctionType}
          onChange={(e) => handleCorrectionChange(e.target.value as CorrectionType)}
          className={`px-2 py-1 text-xs bg-[var(--bg-panel)] border border-[var(--border-color)] rounded text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] ${isInline ? '' : 'w-full'}`}
        >
          <option value="none">None</option>
          <option value="bonferroni">Bonferroni (FWER)</option>
          <option value="fdr">Benjamini-Hochberg (FDR)</option>
        </select>
      </div>

      {/* Confidence Intervals Toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-[var(--text-secondary)] shrink-0">
          {isInline ? 'Intervals:' : 'Show Confidence Intervals'}
        </label>
        <button
          type="button"
          onClick={handleCIToggle}
          aria-pressed={analysisSettings.showConfidenceIntervals}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            analysisSettings.showConfidenceIntervals ? 'bg-[var(--color-accent)]' : 'bg-[var(--bg-active)]'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-[var(--bg-panel)] rounded-full transition-transform shadow-sm ${
              analysisSettings.showConfidenceIntervals ? 'translate-x-4' : ''
            }`}
          />
        </button>
      </div>

      {/* Table display toggles (UXP-040) */}
      <div className={isInline ? 'flex flex-wrap items-center gap-4 w-full pt-2 border-t border-[var(--border-color)]' : 'mt-3 pt-3 border-t border-[var(--border-color)] space-y-3'}>
        <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
          Table display
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="toggle-show-cell-n" className="text-xs text-[var(--text-secondary)] shrink-0">
            Show cell n
          </label>
          <button
            id="toggle-show-cell-n"
            type="button"
            onClick={handleCellNToggle}
            aria-pressed={analysisSettings.showCellN}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              analysisSettings.showCellN ? 'bg-[var(--color-accent)]' : 'bg-[var(--bg-active)]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-[var(--bg-panel)] rounded-full transition-transform shadow-sm ${
                analysisSettings.showCellN ? 'translate-x-4' : ''
              }`}
            />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="toggle-show-column-bases" className="text-xs text-[var(--text-secondary)] shrink-0">
            Show column bases
          </label>
          <button
            id="toggle-show-column-bases"
            type="button"
            onClick={handleColumnBasesToggle}
            aria-pressed={analysisSettings.showColumnBases}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              analysisSettings.showColumnBases ? 'bg-[var(--color-accent)]' : 'bg-[var(--bg-active)]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-[var(--bg-panel)] rounded-full transition-transform shadow-sm ${
                analysisSettings.showColumnBases ? 'translate-x-4' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Info Text */}
      <div
        className={
          isInline
            ? 'w-full text-[10px] text-[var(--text-secondary)] pt-2 border-t border-[var(--border-color)]'
            : 'mt-3 pt-3 border-t border-[var(--border-color)] text-[10px] text-[var(--text-secondary)]'
        }
      >
        {analysisSettings.comparisonMethod === 'cell_vs_rest' ? (
          <span>Cell vs Rest compares each cell to the remaining sample (↑↓ arrows)</span>
        ) : (
          <span>Pairwise compares columns to each other, showing letters for significant differences</span>
        )}
      </div>
    </div>
  );
};
