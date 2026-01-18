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
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
          />
          
          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 w-[600px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-100"
          >
            {/* Header */}
            <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <ListFilter size={20} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-800 leading-tight">X-Ray View</h2>
                    <p className="text-xs text-slate-500 font-medium">{title}</p>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                 <button className="p-2 hover:bg-gray-100 rounded-full text-slate-400 transition-colors" title="Export CSV (Coming Soon)">
                    <Download size={18} />
                 </button>
                 <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-slate-400 transition-colors">
                    <X size={18} />
                 </button>
               </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
               {loading ? (
                 <div className="h-full flex items-center justify-center flex-col gap-3 text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                    <span className="text-sm font-medium">Fetching raw records...</span>
                 </div>
               ) : data.length === 0 ? (
                 <div className="h-full flex items-center justify-center text-slate-400 text-sm">No records found matching this segment.</div>
               ) : (
                 <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 border-b border-gray-100 text-slate-500 uppercase font-medium">
                          <tr>
                            {Object.keys(data[0]).map(key => (
                              <th key={key} className="px-4 py-3 whitespace-nowrap bg-gray-50 sticky top-0 border-b border-gray-200">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.map((row, i) => (
                            <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                              {Object.values(row).map((val: any, j) => (
                                <td key={j} className="px-4 py-2.5 text-slate-700 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
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
             <div className="p-3 border-t border-gray-100 bg-white text-[10px] text-center text-slate-400 font-mono">
                LIMITED TO FIRST 100 RECORDS
             </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};