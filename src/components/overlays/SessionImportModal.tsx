import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, FileUp, Upload, X } from 'lucide-react';
import { parseSavMetadata } from '@velocity/readstat-wasm';
import type { DatasetMatchResult, VelocitySessionFile } from '../../core/session';
import { parseSessionFile, validateDatasetMatch } from '../../core/session';
import { decodeSessionFile } from '../../services/sessionFileCodec';

export interface SessionImportPayload {
  sessionFile: VelocitySessionFile;
  savFileName: string;
  savBuffer: ArrayBuffer;
  matchResult: DatasetMatchResult;
}

interface SessionImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (payload: SessionImportPayload) => Promise<void>;
}

function formatStatus(status: DatasetMatchResult['status']): string {
  if (status === 'strict_match') return 'Exact dataset match';
  if (status === 'partial_match') return 'Partial dataset match';
  return 'Dataset mismatch';
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function previewColumnList(columns: string[], max = 6): string {
  if (columns.length === 0) return '';
  if (columns.length <= max) return columns.join(', ');
  const preview = columns.slice(0, max).join(', ');
  return `${preview}, +${columns.length - max} more`;
}

export const SessionImportModal: React.FC<SessionImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [sessionFileName, setSessionFileName] = React.useState<string | null>(null);
  const [sessionFile, setSessionFile] = React.useState<VelocitySessionFile | null>(null);
  const [savFileName, setSavFileName] = React.useState<string | null>(null);
  const [savBuffer, setSavBuffer] = React.useState<ArrayBuffer | null>(null);
  const [savRowCount, setSavRowCount] = React.useState<number | null>(null);
  const [matchResult, setMatchResult] = React.useState<DatasetMatchResult | null>(null);
  const [isValidatingSav, setIsValidatingSav] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sessionInputRef = React.useRef<HTMLInputElement>(null);
  const savInputRef = React.useRef<HTMLInputElement>(null);

  const reset = React.useCallback(() => {
    setSessionFileName(null);
    setSessionFile(null);
    setSavFileName(null);
    setSavBuffer(null);
    setSavRowCount(null);
    setMatchResult(null);
    setIsValidatingSav(false);
    setIsImporting(false);
    setError(null);
  }, []);

  const handleClose = React.useCallback(() => {
    if (isImporting || isValidatingSav) return;
    reset();
    onClose();
  }, [isImporting, isValidatingSav, onClose, reset]);

  React.useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  const handleSessionSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setSavFileName(null);
    setSavBuffer(null);
    setSavRowCount(null);
    setMatchResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const raw = await decodeSessionFile(buffer, file.name);
      const parsed = parseSessionFile(raw);
      setSessionFile(parsed);
      setSessionFileName(file.name);
    } catch (importError: any) {
      setSessionFile(null);
      setSessionFileName(null);
      setError(importError?.message || 'Failed to parse session file');
    }
  };

  const handleSavSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !sessionFile) return;

    setError(null);
    setMatchResult(null);
    setSavFileName(file.name);
    setSavBuffer(null);
    setIsValidatingSav(true);

    try {
      const buffer = await file.arrayBuffer();
      const metadata = await parseSavMetadata(buffer);
      setSavRowCount(metadata.metadata.rowCount);
      const result = validateDatasetMatch(sessionFile.dataset, {
        rowCount: metadata.metadata.rowCount,
        columnNames: metadata.metadata.variables.map((variable) => variable.name),
      }, {
        sessionVariables: sessionFile.variables,
      });

      setMatchResult(result);
      if (result.canProceed) {
        setSavBuffer(buffer);
      } else {
        setError(result.issues[0] || 'Uploaded SAV does not match this session');
      }
    } catch (savError: any) {
      setError(savError?.message || 'Failed to validate SAV file');
    } finally {
      setIsValidatingSav(false);
    }
  };

  const handleImport = async () => {
    if (!sessionFile || !savBuffer || !savFileName || !matchResult?.canProceed) return;

    setError(null);
    setIsImporting(true);
    try {
      await onImport({
        sessionFile,
        savFileName,
        savBuffer,
        matchResult,
      });
      handleClose();
    } catch (importError: any) {
      setError(importError?.message || 'Failed to import session');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  const recodeCount = sessionFile?.transformLog.filter((transform) => transform.type === 'recode').length ?? 0;
  const slideCount = sessionFile?.slides.length ?? 0;
  const datasetLabel = sessionFile?.dataset
    ? `${sessionFile.dataset.originalFilename} (${sessionFile.dataset.rowCount.toLocaleString()} rows x ${sessionFile.dataset.fingerprint.columnCount} cols)`
    : null;
  const matchTone = matchResult?.status === 'strict_match'
    ? 'success'
    : matchResult?.status === 'partial_match'
      ? 'warning'
      : 'danger';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[140] flex items-center justify-center bg-[var(--text-primary)]/40 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      >
        <motion.div
          className="w-full max-w-2xl rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-2xl"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Import Session</h2>
              <p className="text-xs text-[var(--text-secondary)]">Step 1: choose .velocity session. Step 2: upload matching SAV.</p>
            </div>
            <button
              onClick={handleClose}
              className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-active)]"
              aria-label="Close import modal"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4 p-5">
            <input
              ref={sessionInputRef}
              type="file"
              accept=".velocity,.json,.gz,.velocity.gz"
              className="hidden"
              onChange={handleSessionSelect}
            />
            <input
              ref={savInputRef}
              type="file"
              accept=".sav"
              className="hidden"
              onChange={handleSavSelect}
            />

            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">1. Session File</div>
              <button
                onClick={() => sessionInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-active)]"
              >
                <FileUp size={16} />
                {sessionFileName ? `Loaded: ${sessionFileName}` : 'Select .velocity file'}
              </button>
              {datasetLabel && (
                <div className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
                  <div>{datasetLabel}</div>
                  <div>{recodeCount} recoded variables</div>
                  <div>{slideCount} analysis slides</div>
                </div>
              )}
            </div>

            <div className={`rounded-lg border p-4 ${sessionFile ? 'border-[var(--border-color)] bg-[var(--bg-app)]' : 'border-[var(--border-color-muted)] bg-[var(--bg-app)] opacity-60'}`}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">2. Matching SAV</div>
              <button
                onClick={() => savInputRef.current?.click()}
                disabled={!sessionFile || isValidatingSav}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-active)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload size={16} />
                {isValidatingSav
                  ? 'Validating SAV...'
                  : savFileName
                    ? `Selected: ${savFileName}`
                    : 'Upload .sav file'}
              </button>

              {matchResult && (
                <div
                  className={`mt-3 rounded-md border px-3 py-2 text-xs ${
                    matchTone === 'success'
                      ? 'border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--color-success)]'
                      : matchTone === 'warning'
                        ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-text)]'
                        : 'border-[var(--status-error-border)] bg-[var(--status-error-surface)] text-[var(--color-error)]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    {matchResult.canProceed ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                    {formatStatus(matchResult.status)}
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                    <div>
                      Rows: {matchResult.rowCountMatches ? 'match' : 'differ'} ({formatCount(sessionFile?.dataset.rowCount ?? 0)} expected, {formatCount(savRowCount ?? 0)} uploaded)
                    </div>
                    <div>
                      Columns: {formatCount(matchResult.matchingColumnCount)}/{formatCount(matchResult.expectedColumnCount)} matched ({(matchResult.overlapRatio * 100).toFixed(1)}%)
                    </div>
                  </div>

                  {!matchResult.rowCountMatches && (
                    <div className="mt-1">
                      Row count differs (expected {formatCount(sessionFile?.dataset.rowCount ?? 0)}, got {formatCount(savRowCount ?? 0)}).
                    </div>
                  )}

                  {matchResult.actualColumnCount !== matchResult.expectedColumnCount && (
                    <div className="mt-1">
                      Column count differs (expected {formatCount(matchResult.expectedColumnCount)}, got {formatCount(matchResult.actualColumnCount)}).
                    </div>
                  )}

                  {matchResult.issues.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 space-y-1">
                      {matchResult.issues.map((issue, index) => (
                        <li key={`issue-${index}`}>{issue}</li>
                      ))}
                    </ul>
                  )}

                  {matchResult.warnings.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 space-y-1">
                      {matchResult.warnings.map((warning, index) => (
                        <li key={`warning-${index}`}>{warning}</li>
                      ))}
                    </ul>
                  )}

                  {matchResult.missingColumns.length > 0 && (
                    <div className="mt-2">
                      Missing columns: {previewColumnList(matchResult.missingColumns)}
                    </div>
                  )}
                  {matchResult.extraColumns.length > 0 && (
                    <div className="mt-1">
                      Extra columns: {previewColumnList(matchResult.extraColumns)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-surface)] px-3 py-2 text-xs text-[var(--color-error)]">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--border-color)] px-5 py-4">
            <button
              onClick={handleClose}
              disabled={isImporting}
              className="rounded-md border border-[var(--border-color)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-active)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!sessionFile || !savBuffer || !matchResult?.canProceed || isImporting || isValidatingSav}
              className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm text-[var(--text-inverse)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImporting ? 'Importing...' : 'Continue'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
