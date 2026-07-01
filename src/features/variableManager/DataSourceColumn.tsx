/**
 * DataSourceColumn Component
 *
 * Column 1 in the Miller Column navigation.
 * Displays loaded datasets (currently single-source, future multi-source support).
 */

import React, { useEffect } from 'react';
import { Database, ChevronRight } from 'lucide-react';
import { useVelocityStore } from '../../store';
import styles from './MillerColumns.module.css';

interface DataSourceColumnProps {
  className?: string;
}

export const DataSourceColumn: React.FC<DataSourceColumnProps> = ({ className }) => {
  const dataset = useVelocityStore((state) => state.dataset);
  const selectedDataSourceId = useVelocityStore((state) => state.selectedDataSourceId);
  const setSelectedDataSourceId = useVelocityStore((state) => state.setSelectedDataSourceId);

  // Auto-select the only dataset on load
  useEffect(() => {
    if (dataset && !selectedDataSourceId) {
      setSelectedDataSourceId(dataset.id);
    }
  }, [dataset, selectedDataSourceId, setSelectedDataSourceId]);

  const handleSelect = (id: string) => {
    setSelectedDataSourceId(id);
  };

  return (
    <div className={`${styles.column} ${styles.col1} ${className || ''}`}>
      <div className={styles.columnHeader}>
        <span className={styles.columnTitle}>Sources</span>
      </div>

      <div className={styles.columnContent}>
        {dataset ? (
          <div
            className={`${styles.item} ${selectedDataSourceId === dataset.id ? styles.itemActive : ''}`}
            onClick={() => handleSelect(dataset.id)}
          >
            <div className={styles.itemContent}>
              <Database className={styles.itemIcon} size={16} />
              <span className={styles.itemLabel}>{dataset.name}</span>
            </div>
            <div className={styles.itemMeta}>
              <ChevronRight className={styles.itemChevron} size={14} />
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Database className={styles.emptyIcon} />
            <span className={styles.emptyText}>No data loaded</span>
          </div>
        )}
      </div>
    </div>
  );
};
