import React from 'react';
import { useVelocityStore } from '../../store';
import type { ComparisonMethod, CorrectionType } from '../../store/slices/analysisSlice';

interface AnalysisSettingsPanelProps {
  className?: string;
}

/**
 * AnalysisSettingsPanel
 *
 * Compact settings panel for statistical analysis options.
 * Includes comparison method, correction type, and CI toggle.
 */
export const AnalysisSettingsPanel: React.FC<AnalysisSettingsPanelProps> = ({
  className = '',
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

  return (
    <div className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg p-3 ${className}`}>
      <div className="text-xs font-semibold text-[var(--text-accent)] uppercase tracking-wide mb-3">
        Statistical Settings
      </div>

      {/* Comparison Method */}
      <div className="mb-3">
        <label className="text-xs text-[var(--text-secondary)] block mb-1">
          Comparison Method
        </label>
        <div className="flex gap-1">
          <button
            onClick={() => handleComparisonMethodChange('cell_vs_rest')}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              analysisSettings.comparisonMethod === 'cell_vs_rest'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--bg-panel)] text-[var(--text-primary)] hover:bg-[var(--bg-active)]'
            }`}
          >
            Cell vs Rest
          </button>
          <button
            onClick={() => handleComparisonMethodChange('pairwise')}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              analysisSettings.comparisonMethod === 'pairwise'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--bg-panel)] text-[var(--text-primary)] hover:bg-[var(--bg-active)]'
            }`}
          >
            Pairwise (A/B/C)
          </button>
        </div>
      </div>

      {/* Correction Method */}
      <div className="mb-3">
        <label className="text-xs text-[var(--text-secondary)] block mb-1">
          Multiple Testing Correction
        </label>
        <select
          value={analysisSettings.correctionType}
          onChange={(e) => handleCorrectionChange(e.target.value as CorrectionType)}
          className="w-full px-2 py-1 text-xs bg-[var(--bg-panel)] border border-[var(--border-color)] rounded text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        >
          <option value="none">None</option>
          <option value="bonferroni">Bonferroni (FWER)</option>
          <option value="fdr">Benjamini-Hochberg (FDR)</option>
        </select>
      </div>

      {/* Confidence Intervals Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-[var(--text-secondary)]">
          Show Confidence Intervals
        </label>
        <button
          onClick={handleCIToggle}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            analysisSettings.showConfidenceIntervals
              ? 'bg-[var(--color-accent)]'
              : 'bg-[var(--bg-active)]'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
              analysisSettings.showConfidenceIntervals ? 'translate-x-4' : ''
            }`}
          />
        </button>
      </div>

      {/* Info Text */}
      <div className="mt-3 pt-3 border-t border-[var(--border-color)] text-[10px] text-[var(--text-secondary)]">
        {analysisSettings.comparisonMethod === 'cell_vs_rest' ? (
          <span>Compares each cell to the rest of the sample (arrows)</span>
        ) : (
          <span>Compares columns pairwise, showing letters for significant differences</span>
        )}
      </div>
    </div>
  );
};
