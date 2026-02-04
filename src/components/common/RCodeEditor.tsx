import React, { useState, useRef, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import {
  Play,
  Code2,
  Copy,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileCode,
  Loader2,
  Check,
  AlertTriangle,
  Clock,
  Terminal,
} from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { RResult } from '../../types/webr';
import styles from './RCodeEditor.module.css';

interface RCodeEditorProps {
  defaultExpanded?: boolean;
}

interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  code: string;
}

const CODE_TEMPLATES: CodeTemplate[] = [
  {
    id: 'basic-stats',
    name: 'Basic Statistics',
    description: 'Mean, SD, and summary',
    code: `# Basic descriptive statistics
summary(df)

# Calculate mean and standard deviation
mean(df$variable, na.rm = TRUE)
sd(df$variable, na.rm = TRUE)`,
  },
  {
    id: 'survey-mean',
    name: 'Survey Weighted Mean',
    description: 'svymean with design effects',
    code: `# Survey-weighted mean with design effects
library(survey)

# Create survey design (adjust variables as needed)
design <- svydesign(
  ids = ~1,
  weights = ~weight,
  data = df
)

# Calculate weighted mean with deff
result <- svymean(~variable, design, deff = TRUE)
print(result)
print(paste("Design Effect:", deff(result)))`,
  },
  {
    id: 'mixed-model',
    name: 'Mixed Effects Model',
    description: 'Random intercept model',
    code: `# Mixed effects model with random intercepts
library(lme4)

# Fit random intercept model
model <- lmer(
  outcome ~ predictor + (1 | group),
  data = df,
  REML = TRUE
)

# Model summary
summary(model)

# Extract variance components
VarCorr(model)

# Calculate ICC
icc <- as.data.frame(VarCorr(model))
icc_value <- icc$vcov[1] / sum(icc$vcov)
print(paste("ICC:", round(icc_value, 3)))`,
  },
  {
    id: 'crosstab',
    name: 'Crosstabulation',
    description: 'Frequency table with chi-square',
    code: `# Crosstabulation with chi-square test
tab <- table(df$row_var, df$col_var)
print(tab)

# Chi-square test
chisq.test(tab)

# Proportions by column
prop.table(tab, margin = 2)`,
  },
  {
    id: 't-test',
    name: "Welch's T-Test",
    description: 'Compare two groups',
    code: `# Welch's t-test (unequal variances)
t.test(
  outcome ~ group,
  data = df,
  var.equal = FALSE
)`,
  },
];

/**
 * RCodeEditor
 *
 * A collapsible Monaco-based R code editor for power users.
 * Allows writing and executing custom R code via WebR.
 */
export const RCodeEditor: React.FC<RCodeEditorProps> = ({
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [code, setCode] = useState<string>('# Write R code here\n\n');
  const [result, setResult] = useState<RResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const editorRef = useRef<any>(null);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  // Store state
  const webrStatus = useVelocityStore((s) => s.webrStatus);
  const executeR = useVelocityStore((s) => s.executeR);
  const initWebR = useVelocityStore((s) => s.initWebR);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleExecute = useCallback(async () => {
    if (!code.trim()) return;

    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      // Auto-initialize WebR if needed
      if (webrStatus === 'idle') {
        await initWebR();
      }

      const execResult = await executeR(code);
      setResult(execResult);
    } catch (err: any) {
      setError(err.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  }, [code, webrStatus, initWebR, executeR]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleClear = useCallback(() => {
    setCode('# Write R code here\n\n');
    setResult(null);
    setError(null);
  }, []);

  const handleTemplateSelect = useCallback((template: CodeTemplate) => {
    setCode(template.code);
    setShowTemplates(false);
    setResult(null);
    setError(null);
  }, []);

  const canExecute = webrStatus === 'ready' || webrStatus === 'idle';
  const isWebRBusy = webrStatus === 'initializing' || webrStatus === 'busy';

  return (
    <div className={styles.editor}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={styles.header}
      >
        <div className={styles.headerLeft}>
          <Terminal size={16} className={styles.headerIcon} />
          <span className={styles.headerTitle}>R Console</span>
          <span className={styles.headerBadge}>Power User</span>
        </div>
        <div className={styles.headerRight}>
          {webrStatus === 'ready' && (
            <span className={styles.statusBadge}>
              <span className={styles.statusDot} />
              R Ready
            </span>
          )}
          {isExpanded ? (
            <ChevronDown size={16} className={styles.chevron} />
          ) : (
            <ChevronRight size={16} className={styles.chevron} />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className={styles.body}>
          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              {/* Templates Dropdown */}
              <div className={styles.templateWrapper} ref={templateDropdownRef}>
                <button
                  className={styles.templateButton}
                  onClick={() => setShowTemplates(!showTemplates)}
                >
                  <FileCode size={14} />
                  <span>Templates</span>
                  <ChevronDown size={12} />
                </button>

                {showTemplates && (
                  <div className={styles.templateDropdown}>
                    {CODE_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        className={styles.templateOption}
                        onClick={() => handleTemplateSelect(template)}
                      >
                        <span className={styles.templateName}>
                          {template.name}
                        </span>
                        <span className={styles.templateDesc}>
                          {template.description}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.toolbarRight}>
              <button
                className={styles.toolButton}
                onClick={handleCopy}
                title="Copy code"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>

              <button
                className={styles.toolButton}
                onClick={handleClear}
                title="Clear"
              >
                <Trash2 size={14} />
              </button>

              <button
                className={`${styles.runButton} ${!canExecute || isExecuting ? styles.runButtonDisabled : ''}`}
                onClick={handleExecute}
                disabled={!canExecute || isExecuting}
              >
                {isExecuting || isWebRBusy ? (
                  <Loader2 size={14} className={styles.spinner} />
                ) : (
                  <Play size={14} />
                )}
                <span>{isExecuting ? 'Running...' : 'Run'}</span>
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className={styles.editorContainer}>
            <Editor
              height="200px"
              defaultLanguage="r"
              value={code}
              onChange={(value) => setCode(value || '')}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: 'JetBrains Mono, monospace',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                padding: { top: 12, bottom: 12 },
                renderLineHighlight: 'line',
                cursorBlinking: 'smooth',
                smoothScrolling: true,
              }}
            />
          </div>

          {/* Results Area */}
          {(result || error) && (
            <div className={styles.results}>
              <div className={styles.resultsHeader}>
                <Code2 size={14} />
                <span>Output</span>
                {result && (
                  <span className={styles.duration}>
                    <Clock size={10} />
                    {result.durationMs.toFixed(1)}ms
                  </span>
                )}
              </div>

              <div className={styles.resultsBody}>
                {error && (
                  <div className={styles.errorOutput}>
                    <AlertTriangle size={14} />
                    <span>{error}</span>
                  </div>
                )}

                {result && (
                  <>
                    {result.warnings && result.warnings.length > 0 && (
                      <div className={styles.warningOutput}>
                        {result.warnings.map((w, i) => (
                          <div key={i} className={styles.warningLine}>
                            <AlertTriangle size={12} />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <pre className={styles.consoleOutput}>
                      {result.output || '(No output)'}
                    </pre>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Status Footer */}
          {webrStatus !== 'ready' && (
            <div className={styles.footer}>
              {webrStatus === 'idle' && (
                <span className={styles.footerText}>
                  WebR not loaded. Click Run to initialize.
                </span>
              )}
              {webrStatus === 'initializing' && (
                <span className={styles.footerText}>
                  <Loader2 size={12} className={styles.spinner} />
                  Initializing R runtime...
                </span>
              )}
              {webrStatus === 'error' && (
                <span className={styles.footerError}>
                  <AlertTriangle size={12} />
                  WebR initialization failed
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
