/**
 * Neutral payload-type contracts for the session import/export modals.
 *
 * These live in a types-only module rather than the modal component files so
 * that app-layer consumers (useSessionLifecycle, ModalHost) depend on a plain
 * contract instead of a React component module. See arch_01 §5.2.
 */
import type { DatasetMatchResult, VelocitySessionFile } from '../../core/session';

export interface SessionExportSummary {
  datasetName: string;
  rowCount: number;
  columnCount: number;
  recodeCount: number;
  slideCount: number;
  filterCount: number;
  sectionCount: number;
}

export interface SessionImportPayload {
  sessionFile: VelocitySessionFile;
  savFileName: string;
  savBuffer: ArrayBuffer;
  matchResult: DatasetMatchResult;
}
