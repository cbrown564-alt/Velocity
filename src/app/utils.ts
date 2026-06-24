import { SESSION_FILE_EXTENSION } from '../core/session';

export function getSessionFilename(datasetName: string, compressed: boolean): string {
  const name = datasetName.replace(/\.[^.]+$/, '');
  const date = new Date().toISOString().slice(0, 10);
  const extension = compressed ? `${SESSION_FILE_EXTENSION}.gz` : SESSION_FILE_EXTENSION;
  return `${name}-${date}${extension}`;
}

export function datasetTableName(datasetId: string): string {
  return `dataset_${datasetId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}
