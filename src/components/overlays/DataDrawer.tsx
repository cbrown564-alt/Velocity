import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ListFilter, ChevronDown, Loader2 } from 'lucide-react';

interface DataDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
  loading: boolean;
  /** Total matching records (for pagination info) */
  totalCount: number;
  /** Records currently loaded */
  loadedCount: number;
  /** Callback to load more records */
  onLoadMore?: () => void;
  /** Column names that are being filtered on (for visual highlighting) */
  filterColumns?: string[];
}

export const DataDrawer: React.FC<DataDrawerProps> = ({
  isOpen,
  onClose,
  title,
  data,
  loading,
  totalCount,
  loadedCount,
  onLoadMore,
  filterColumns = []
}) => {
  const hasMore = loadedCount < totalCount;

  // Compute ordered columns: filter columns first, then the rest
  const orderedColumns = useMemo(() => {
    if (data.length === 0) return { filterCols: [], otherCols: [] };

    const allColumns = Object.keys(data[0]);
    const filterColsLower = new Set(filterColumns.map(c => c.toLowerCase()));

    const filterCols = allColumns.filter(col => filterColsLower.has(col.toLowerCase()));
    const otherCols = allColumns.filter(col => !filterColsLower.has(col.toLowerCase()));

    return { filterCols, otherCols };
  }, [data, filterColumns]);

  const handleExportCSV = () => {
    if (data.length === 0) return;

    // Export with reordered columns
    const headers = [...orderedColumns.filterCols, ...orderedColumns.otherCols];
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(h => {
          const val = row[h];
          const str = String(val ?? '');
          return str.includes(',') || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(',')
      )
    ];
    const csvContent = csvRows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `xray_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isFilterColumn = (colName: string) => {
    return filterColumns.some(fc => fc.toLowerCase() === colName.toLowerCase());
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[var(--color-ink)]/20 backdrop-blur-sm z-40"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 w-[700px] bg-[var(--color-paper)] shadow-[var(--shadow-drag)] z-50 flex flex-col border-l border-[var(--gray-200)]"
          >
            {/* Header */}
            <div className="h-16 border-b border-[var(--gray-200)] flex items-center justify-between px-6 bg-[var(--color-paper)] shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--gray-50)] rounded-lg text-[var(--color-terracotta)]">
                  <ListFilter size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-[var(--color-ink)] leading-tight font-display text-lg">X-Ray View</h2>
                  <p className="text-xs text-[var(--gray-500)] font-medium font-body max-w-[300px] truncate" title={title}>
                    {title}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={data.length === 0}
                  className="p-2 hover:bg-[var(--gray-100)] rounded-full text-[var(--gray-400)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Export to CSV"
                >
                  <Download size={18} />
                </button>
                <button onClick={onClose} className="p-2 hover:bg-[var(--gray-100)] rounded-full text-[var(--gray-400)] transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 bg-[var(--gray-50)]/50">
              {loading && data.length === 0 ? (
                <div className="h-full flex items-center justify-center flex-col gap-3 text-[var(--gray-400)]">
                  <Loader2 className="animate-spin h-8 w-8 text-[var(--color-terracotta)]" />
                  <span className="text-sm font-medium font-body">Fetching raw records...</span>
                </div>
              ) : data.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[var(--gray-400)] text-sm font-body">
                  No records found matching this segment.
                </div>
              ) : (
                <div className="bg-[var(--color-paper)] border border-[var(--gray-200)] rounded-lg overflow-hidden shadow-sm">
                  <div className="overflow-x-auto max-h-[calc(100vh-220px)]">
                    <table className="w-full text-xs text-left">
                      <thead className="border-b border-[var(--gray-100)] text-[var(--gray-500)] uppercase font-medium font-body sticky top-0 z-10">
                        <tr>
                          {/* Row number column */}
                          <th className="px-3 py-2.5 whitespace-nowrap bg-[var(--gray-50)] border-b border-[var(--gray-200)] text-center w-12">
                            #
                          </th>
                          {/* Filter columns - highlighted */}
                          {orderedColumns.filterCols.map((key, idx) => (
                            <th
                              key={key}
                              className={`px-3 py-2.5 whitespace-nowrap border-b border-[var(--gray-200)] bg-[var(--gray-50)] text-[var(--color-terracotta)] font-semibold ${idx === orderedColumns.filterCols.length - 1 ? 'border-r-2 border-r-[var(--color-terracotta)]/30' : ''
                                }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <ListFilter size={10} className="opacity-60" />
                                {key}
                              </div>
                            </th>
                          ))}
                          {/* Other columns */}
                          {orderedColumns.otherCols.map(key => (
                            <th key={key} className="px-3 py-2.5 whitespace-nowrap bg-[var(--gray-50)] border-b border-[var(--gray-200)]">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--gray-100)] font-body">
                        {data.map((row, i) => (
                          <tr key={i} className="hover:bg-[var(--gray-50)] transition-colors">
                            {/* Row number */}
                            <td className="px-3 py-2 text-center text-[var(--gray-400)] font-mono text-[10px]">
                              {i + 1}
                            </td>
                            {/* Filter column values - highlighted */}
                            {orderedColumns.filterCols.map((col, idx) => (
                              <td
                                key={col}
                                className={`px-3 py-2 whitespace-nowrap max-w-[180px] overflow-hidden text-ellipsis bg-[var(--color-terracotta)]/5 text-[var(--color-ink)] font-medium ${idx === orderedColumns.filterCols.length - 1 ? 'border-r-2 border-r-[var(--color-terracotta)]/20' : ''
                                  }`}
                              >
                                {row[col] === null || row[col] === undefined
                                  ? <span className="text-[var(--gray-300)]">—</span>
                                  : String(row[col])}
                              </td>
                            ))}
                            {/* Other column values */}
                            {orderedColumns.otherCols.map(col => (
                              <td key={col} className="px-3 py-2 text-[var(--color-charcoal)] whitespace-nowrap max-w-[180px] overflow-hidden text-ellipsis">
                                {row[col] === null || row[col] === undefined
                                  ? <span className="text-[var(--gray-300)]">—</span>
                                  : String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with pagination */}
            <div className="p-3 border-t border-[var(--gray-100)] bg-[var(--color-paper)] flex items-center justify-between">
              <div className="text-xs text-[var(--gray-500)] font-body">
                Showing <span className="font-semibold text-[var(--color-ink)]">{loadedCount.toLocaleString()}</span> of{' '}
                <span className="font-semibold text-[var(--color-ink)]">{totalCount.toLocaleString()}</span> records
              </div>
              {hasMore && (
                <button
                  onClick={onLoadMore}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-terracotta)] hover:bg-[var(--gray-100)] rounded-md transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                  Load More
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};