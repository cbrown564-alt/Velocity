import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Download, ListFilter } from 'lucide-react';

interface DataDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
  loading: boolean;
}

export const DataDrawer: React.FC<DataDrawerProps> = ({ isOpen, onClose, title, data, loading }) => {
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
            className="fixed inset-y-0 right-0 w-[600px] bg-[var(--color-paper)] shadow-[var(--shadow-drag)] z-50 flex flex-col border-l border-[var(--gray-200)]"
          >
            {/* Header */}
            <div className="h-16 border-b border-[var(--gray-200)] flex items-center justify-between px-6 bg-[var(--color-paper)] shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--gray-50)] rounded-lg text-[var(--color-terracotta)]">
                  <ListFilter size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-[var(--color-ink)] leading-tight font-display text-lg">X-Ray View</h2>
                  <p className="text-xs text-[var(--gray-500)] font-medium font-body">{title}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-[var(--gray-100)] rounded-full text-[var(--gray-400)] transition-colors" title="Export CSV (Coming Soon)">
                  <Download size={18} />
                </button>
                <button onClick={onClose} className="p-2 hover:bg-[var(--gray-100)] rounded-full text-[var(--gray-400)] transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 bg-[var(--gray-50)]/50">
              {loading ? (
                <div className="h-full flex items-center justify-center flex-col gap-3 text-[var(--gray-400)]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-terracotta)]"></div>
                  <span className="text-sm font-medium font-body">Fetching raw records...</span>
                </div>
              ) : data.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[var(--gray-400)] text-sm font-body">No records found matching this segment.</div>
              ) : (
                <div className="bg-[var(--color-paper)] border border-[var(--gray-200)] rounded-lg overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--gray-50)] border-b border-[var(--gray-100)] text-[var(--gray-500)] uppercase font-medium font-body">
                        <tr>
                          {Object.keys(data[0]).map(key => (
                            <th key={key} className="px-4 py-3 whitespace-nowrap bg-[var(--gray-50)] sticky top-0 border-b border-[var(--gray-200)]">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--gray-100)] font-body">
                        {data.map((row, i) => (
                          <tr key={i} className="hover:bg-[var(--gray-50)] transition-colors">
                            {Object.values(row).map((val: any, j) => (
                              <td key={j} className="px-4 py-2.5 text-[var(--color-charcoal)] whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                                {val}
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
            <div className="p-3 border-t border-[var(--gray-100)] bg-[var(--color-paper)] text-[10px] text-center text-[var(--gray-400)] font-mono">
              LIMITED TO FIRST 100 RECORDS
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};