import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Beaker,
  Layers,
  Settings2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  Database,
} from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { AnalysisEngine } from '../../store/slices/analysisSlice';
import styles from './AdvancedAnalysisPanel.module.css';

interface AdvancedAnalysisPanelProps {
  defaultExpanded?: boolean;
}

/**
 * AdvancedAnalysisPanel
 *
 * Expandable panel for advanced statistical analysis options including:
 * - WebR engine status and initialization
 * - Survey design configuration (weights, clusters, strata)
 * - Mixed effects model specification
 * - Engine selection (auto/duckdb/webr)
 */
export const AdvancedAnalysisPanel: React.FC<AdvancedAnalysisPanelProps> = ({ defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // WebR state
  const webrStatus = useVelocityStore((s) => s.webrStatus);
  const webrInitProgress = useVelocityStore((s) => s.webrInitProgress);
  const webrInitMessage = useVelocityStore((s) => s.webrInitMessage);
  const webrLoadedPackages = useVelocityStore((s) => s.webrLoadedPackages);
  const webrLastError = useVelocityStore((s) => s.webrLastError);
  const initWebR = useVelocityStore((s) => s.initWebR);

  // Analysis settings
  const analysisSettings = useVelocityStore((s) => s.analysisSettings);
  const updateAnalysisSettings = useVelocityStore((s) => s.updateAnalysisSettings);

  const handleEngineChange = (engine: AnalysisEngine) => {
    updateAnalysisSettings({ engine });
    if (engine === 'webr' && webrStatus === 'idle') {
      initWebR();
    }
  };

  const handleDesignEffectsToggle = () => {
    const newValue = !analysisSettings.enableDesignEffects;
    updateAnalysisSettings({ enableDesignEffects: newValue });
    if (newValue && webrStatus === 'idle') {
      initWebR();
    }
  };

  const getStatusIcon = () => {
    switch (webrStatus) {
      case 'ready':
        return <CheckCircle2 size={14} className={styles.statusReady} />;
      case 'initializing':
      case 'busy':
        return <Loader2 size={14} className={styles.statusLoading} />;
      case 'error':
        return <AlertCircle size={14} className={styles.statusError} />;
      default:
        return <Sparkles size={14} className={styles.statusIdle} />;
    }
  };

  const getStatusText = () => {
    switch (webrStatus) {
      case 'ready':
        return 'R Engine Ready';
      case 'initializing':
        return webrInitMessage || 'Initializing...';
      case 'busy':
        return 'Computing...';
      case 'error':
        return webrLastError || 'Error';
      default:
        return 'Not Loaded';
    }
  };

  const sections = [
    {
      id: 'engine',
      icon: Settings2,
      title: 'Engine',
      content: (
        <div className={styles.sectionContent}>
          <p className={styles.sectionDescription}>Choose which computational engine powers your analysis.</p>

          <div className={styles.engineSelector}>
            <button
              className={`${styles.engineOption} ${analysisSettings.engine === 'auto' ? styles.engineActive : ''}`}
              onClick={() => handleEngineChange('auto')}
            >
              <Zap size={16} />
              <span className={styles.engineLabel}>Auto</span>
              <span className={styles.engineDescription}>Best for task</span>
            </button>

            <button
              className={`${styles.engineOption} ${analysisSettings.engine === 'duckdb' ? styles.engineActive : ''}`}
              onClick={() => handleEngineChange('duckdb')}
            >
              <Database size={16} />
              <span className={styles.engineLabel}>DuckDB</span>
              <span className={styles.engineDescription}>Fast SQL</span>
            </button>

            <button
              className={`${styles.engineOption} ${analysisSettings.engine === 'webr' ? styles.engineActive : ''}`}
              onClick={() => handleEngineChange('webr')}
            >
              <Beaker size={16} />
              <span className={styles.engineLabel}>WebR</span>
              <span className={styles.engineDescription}>Full R runtime</span>
            </button>
          </div>

          <div className={styles.webrStatus}>
            <div className={styles.statusHeader}>
              {getStatusIcon()}
              <span className={styles.statusText}>{getStatusText()}</span>
            </div>

            {webrStatus === 'initializing' && (
              <div className={styles.progressContainer}>
                <div className={styles.progressTrack}>
                  <div className={styles.progressBar} style={{ width: `${webrInitProgress}%` }} />
                </div>
                <span className={styles.progressLabel}>{webrInitProgress}%</span>
              </div>
            )}

            {webrStatus === 'ready' && webrLoadedPackages.length > 0 && (
              <div className={styles.packages}>
                <span className={styles.packagesLabel}>Packages:</span>
                {webrLoadedPackages.map((pkg) => (
                  <span key={pkg} className={styles.packageTag}>
                    {pkg}
                  </span>
                ))}
              </div>
            )}

            {webrStatus === 'idle' && (
              <button className={styles.initButton} onClick={() => initWebR()}>
                Initialize R Engine
              </button>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'survey',
      icon: Layers,
      title: 'Survey Design',
      content: (
        <div className={styles.sectionContent}>
          <p className={styles.sectionDescription}>
            Configure complex survey designs for accurate variance estimation and design effects.
          </p>

          <div className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>Enable Design Effects</span>
              <span className={styles.toggleHint}>Calculate deff using svydesign()</span>
            </div>
            <button
              className={`${styles.toggle} ${analysisSettings.enableDesignEffects ? styles.toggleOn : ''}`}
              onClick={handleDesignEffectsToggle}
              role="switch"
              aria-checked={analysisSettings.enableDesignEffects}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>

          {analysisSettings.enableDesignEffects && (
            <div className={styles.surveyFields}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Weight Variable</label>
                <select className={styles.fieldSelect} disabled>
                  <option>Use dataset weight</option>
                </select>
                <span className={styles.fieldHint}>Automatically uses the dataset's weight variable if set</span>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Cluster Variable (PSU)</label>
                <select className={styles.fieldSelect} disabled>
                  <option>None (SRS assumed)</option>
                </select>
                <span className={styles.fieldHint}>Primary sampling unit for clustered designs</span>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Strata Variable</label>
                <select className={styles.fieldSelect} disabled>
                  <option>None</option>
                </select>
                <span className={styles.fieldHint}>Stratification variable for stratified sampling</span>
              </div>
            </div>
          )}

          {!analysisSettings.enableDesignEffects && (
            <div className={styles.infoBox}>
              <Sparkles size={14} />
              <span>Enable design effects to account for complex sampling and get accurate standard errors.</span>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'mixed',
      icon: Beaker,
      title: 'Mixed Models',
      content: (
        <div className={styles.sectionContent}>
          <p className={styles.sectionDescription}>
            Fit hierarchical and multilevel models using lme4's lmer() and glmer().
          </p>

          <div className={styles.infoBox}>
            <Beaker size={14} />
            <span>
              Mixed effects models require the WebR engine and lme4 package. Select a continuous dependent variable and
              specify random effects structure.
            </span>
          </div>

          <div className={styles.comingSoon}>
            <span className={styles.comingSoonBadge}>Coming Soon</span>
            <p>
              Full mixed model specification interface with random effects builder, model comparison, and ICC
              calculation.
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.panel}>
      <button onClick={() => setIsExpanded(!isExpanded)} className={styles.header}>
        <div className={styles.headerLeft}>
          <Beaker size={16} className={styles.headerIcon} />
          <span className={styles.headerTitle}>Advanced Analysis</span>
          {webrStatus === 'ready' && <span className={styles.readyBadge}>R Ready</span>}
        </div>
        {isExpanded ? (
          <ChevronDown size={16} className={styles.chevron} />
        ) : (
          <ChevronRight size={16} className={styles.chevron} />
        )}
      </button>

      {isExpanded && (
        <div className={styles.body}>
          <div className={styles.tabs}>
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(isActive ? null : section.id)}
                  className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                >
                  <Icon size={12} />
                  <span>{section.title}</span>
                </button>
              );
            })}
          </div>

          {activeSection && (
            <div className={styles.content}>{sections.find((s) => s.id === activeSection)?.content}</div>
          )}

          {!activeSection && (
            <div className={styles.placeholder}>Select a topic above to configure advanced statistical options.</div>
          )}
        </div>
      )}
    </div>
  );
};
