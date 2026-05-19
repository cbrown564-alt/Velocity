/**
 * HarmonizationWorkspace
 *
 * Full-screen overlay for cross-wave variable harmonization.
 * Layout: Mapping Table (left 40%) | Sankey Diagram (right 60%)
 *         With Value Remap panel below Sankey when a mapping is selected.
 */

import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, getBackdropProps, getMotionProps, DURATIONS } from '../../lib/motion';
import { X, Play, Check, CheckCheck, Crosshair, ArrowRight, Layers } from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { Variable } from '../../types/index';
import { MappingTable } from './components/MappingTable';
import { SankeyDiagram } from './components/SankeyDiagram';
import { ValueRemapPanel } from './components/ValueRemapPanel';
import { LassoSelector } from './components/LassoSelector';
import styles from './HarmonizationWorkspace.module.css';

interface HarmonizationWorkspaceProps {
  /** Source dataset variables (Wave 1) */
  sourceVars: Variable[];
  /** Target dataset variables (Wave 2) */
  targetVars: Variable[];
  /** Display names for the waves */
  sourceDatasetName?: string;
  targetDatasetName?: string;
  /** DuckDB source table name for wave 1 */
  sourceTableName: string;
  /** DuckDB source table name for wave 2 */
  targetTableName: string;
}

const SANKEY_W = 580;
const SANKEY_H = 420;

export const HarmonizationWorkspace: React.FC<HarmonizationWorkspaceProps> = ({
  sourceVars,
  targetVars,
  sourceDatasetName = 'Wave 1',
  targetDatasetName = 'Wave 2',
  sourceTableName,
  targetTableName,
}) => {
  const {
    harmonization,
    closeHarmonization,
    runAutoMatch,
    confirmMapping,
    confirmAllMappings,
    selectMapping,
    updateValueMapping,
    updateMapping,
    refreshSankeyData,
    applyHarmonization,
  } = useVelocityStore();

  const { isOpen, session, matchingInProgress, sankeyData, selectedMappingId } = harmonization;

  const [lassoActive, setLassoActive] = useState(false);
  const [nodeCenters, setNodeCenters] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [applyInProgress, setApplyInProgress] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Rebuild Sankey when mappings change (stub counts — real counts come from worker)
  const stubCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of sourceVars) counts[v.id] = 100;
    for (const v of targetVars) counts[v.id] = 95;
    return counts;
  }, [sourceVars, targetVars]);

  useEffect(() => {
    if (session && session.mappings.length > 0) {
      refreshSankeyData(sourceVars, targetVars, stubCounts, stubCounts);
    }
  }, [session?.mappings, sourceVars, targetVars, stubCounts, refreshSankeyData]);

  const handleAutoMatch = useCallback(() => {
    runAutoMatch(sourceVars, targetVars);
  }, [runAutoMatch, sourceVars, targetVars]);

  const handleUnmap = useCallback(
    (mappingId: string) => {
      updateMapping(mappingId, { targetVariableId: null, status: 'unmapped', score: null, valueMappings: [] });
    },
    [updateMapping]
  );

  const selectedMapping = useMemo(
    () => session?.mappings.find(m => m.id === selectedMappingId) ?? null,
    [session?.mappings, selectedMappingId]
  );

  const selectedSourceVar = useMemo(
    () => selectedMapping ? sourceVars.find(v => v.id === selectedMapping.sourceVariableId) : null,
    [selectedMapping, sourceVars]
  );

  const selectedTargetVar = useMemo(
    () => selectedMapping?.targetVariableId
      ? targetVars.find(v => v.id === selectedMapping.targetVariableId)
      : null,
    [selectedMapping, targetVars]
  );

  // Status counts
  const counts = useMemo(() => {
    const mappings = session?.mappings ?? [];
    return {
      confirmed: mappings.filter(m => m.confirmed).length,
      autoMatched: mappings.filter(m => m.status === 'auto_matched' && !m.confirmed).length,
      unmapped: mappings.filter(m => m.status === 'unmapped').length,
      total: mappings.length,
    };
  }, [session?.mappings]);

  const handleLassoSelection = useCallback(
    (selectedNodeIds: string[]) => {
      // Select first source node in lasso selection
      const firstSource = selectedNodeIds.find(id => id.startsWith('source::'));
      if (firstSource) {
        const varId = firstSource.replace('source::', '');
        const mapping = session?.mappings.find(m => m.sourceVariableId === varId);
        if (mapping) selectMapping(mapping.id);
      }
      setLassoActive(false);
    },
    [session?.mappings, selectMapping]
  );

  const handleApply = useCallback(async () => {
    if (!session) return;
    setApplyError(null);
    setApplyInProgress(true);
    try {
      await applyHarmonization({
        sourceTable: sourceTableName,
        targetTable: targetTableName,
        sourceVars,
        targetVars,
      });
      closeHarmonization();
    } catch (error: any) {
      setApplyError(error?.message || 'Failed to apply harmonization');
    } finally {
      setApplyInProgress(false);
    }
  }, [
    session,
    applyHarmonization,
    sourceTableName,
    targetTableName,
    sourceVars,
    targetVars,
    closeHarmonization,
  ]);

  const reducedMotion = useReducedMotion();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        {...getBackdropProps(reducedMotion)}
      >
        <motion.div
          className={styles.workspace}
          {...getMotionProps({ preset: 'fadeScale', duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal, reducedMotion })}
        >
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.headerIcon}>
                <Layers size={16} />
              </div>
              <div>
                <div className={styles.headerTitle}>Harmonization Workspace</div>
                <div className={styles.headerSubtitle}>
                  {counts.total} variables · {counts.confirmed} confirmed
                </div>
              </div>
            </div>

            <div className={styles.waveCrumbs}>
              <span className={styles.waveName}>{sourceDatasetName}</span>
              <ArrowRight size={12} className={styles.waveArrow} />
              <span className={styles.waveName}>{targetDatasetName}</span>
            </div>

            <div className={styles.headerActions}>
              <button
                className={styles.btnSecondary}
                onClick={handleAutoMatch}
                disabled={matchingInProgress}
              >
                {matchingInProgress ? (
                  <>
                    <div className={styles.spinner} />
                    Matching…
                  </>
                ) : (
                  <>
                    <Play size={12} />
                    Auto-match
                  </>
                )}
              </button>

              {counts.autoMatched > 0 && (
                <button className={styles.btnSecondary} onClick={confirmAllMappings}>
                  <CheckCheck size={12} />
                  Confirm all
                </button>
              )}

              <button
                className={styles.btnPrimary}
                disabled={counts.confirmed === 0 || applyInProgress}
                onClick={handleApply}
              >
                <Check size={12} />
                {applyInProgress ? 'Applying…' : `Apply (${counts.confirmed})`}
              </button>

              <button className={styles.btnClose} onClick={closeHarmonization}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Status bar */}
          {session && session.mappings.length > 0 && (
            <div className={styles.statusBar}>
              <div className={styles.statusStat}>
                <span className={`${styles.statusDot} ${styles.confirmed}`} />
                {counts.confirmed} confirmed
              </div>
              <div className={styles.statusSeparator} />
              <div className={styles.statusStat}>
                <span className={`${styles.statusDot} ${styles.matched}`} />
                {counts.autoMatched} auto-matched
              </div>
              <div className={styles.statusSeparator} />
              <div className={styles.statusStat}>
                <span className={`${styles.statusDot} ${styles.unmapped}`} />
                {counts.unmapped} unmapped
              </div>

              <button
                className={[styles.lassoToggle, lassoActive ? styles.lassoActive : ''].join(' ')}
                onClick={() => setLassoActive(v => !v)}
                title="Lasso-select nodes (or hold Shift)"
              >
                <Crosshair size={11} />
                Lasso
              </button>
            </div>
          )}
          {applyError && (
            <div className={styles.statusBar}>
              <div className={styles.statusStat}>{applyError}</div>
            </div>
          )}

          {/* Body */}
          <div className={styles.body}>
            {/* Left: Mapping Table */}
            <div className={styles.leftPanel}>
              {!session || session.mappings.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>Click <strong>Auto-match</strong> to automatically map variables across waves using name, label, type, and value-label similarity.</p>
                </div>
              ) : (
                <MappingTable
                  mappings={session.mappings}
                  sourceVars={sourceVars}
                  targetVars={targetVars}
                  selectedMappingId={selectedMappingId}
                  onSelect={selectMapping}
                  onConfirm={confirmMapping}
                  onUnmap={handleUnmap}
                />
              )}
            </div>

            {/* Right: Sankey + ValueRemap */}
            <div className={styles.rightPanel}>
              <div className={styles.sankeyWrapper}>
                {sankeyData ? (
                  <>
                    <SankeyDiagram
                      data={sankeyData}
                      selectedMappingId={selectedMapping?.sourceVariableId ?? null}
                      onSelectMapping={(varId) => {
                        if (varId === null) {
                          selectMapping(null);
                          return;
                        }
                        const m = session?.mappings.find(m => m.sourceVariableId === varId);
                        if (m) selectMapping(m.id);
                      }}
                      width={SANKEY_W}
                      height={SANKEY_H}
                      onNodeCentersChange={setNodeCenters}
                    />
                    <LassoSelector
                      nodes={sankeyData.nodes}
                      width={SANKEY_W}
                      height={SANKEY_H}
                      nodeCenters={nodeCenters}
                      onSelectionCommit={handleLassoSelection}
                      isActive={lassoActive}
                      onActiveChange={setLassoActive}
                    />
                  </>
                ) : (
                  <div className={styles.emptyState}>
                    {matchingInProgress ? (
                      <div className={styles.loadingSpinner}>
                        <div className={styles.spinner} />
                        Running auto-match…
                      </div>
                    ) : (
                      <p>Sankey diagram will appear after auto-match</p>
                    )}
                  </div>
                )}
              </div>

              {/* Value remap panel */}
              {selectedMapping && selectedSourceVar && selectedTargetVar && (
                <div className={styles.valueRemapWrapper}>
                  <ValueRemapPanel
                    mapping={selectedMapping}
                    sourceVar={selectedSourceVar}
                    targetVar={selectedTargetVar}
                    onUpdateValueMappings={updateValueMapping}
                  />
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default HarmonizationWorkspace;
