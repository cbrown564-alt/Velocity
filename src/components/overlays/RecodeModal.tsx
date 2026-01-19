import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Wand2, Save } from 'lucide-react';
import { Variable } from '../../types';
import { dbService } from '../../services/duckDb';

interface RecodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  variable: Variable | null;
  onSave: () => void;
}

export const RecodeModal: React.FC<RecodeModalProps> = ({ isOpen, onClose, variable, onSave }) => {
  const [uniqueValues, setUniqueValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  // Map: OriginalValue -> NewGroupValue
  const [mappings, setMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && variable) {
      const loadValues = async () => {
        setLoading(true);
        try {
          const values = await dbService.getUniqueValues(variable.id);
          setUniqueValues(values);
          // Default mapping is 1:1
          const initialMap: Record<string, string> = {};
          values.forEach(v => initialMap[v] = v);
          setMappings(initialMap);
          setNewVarName(`${variable.label} (Recoded)`);
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      loadValues();
    }
  }, [isOpen, variable]);

  const handleMappingChange = (oldVal: string, newVal: string) => {
    setMappings(prev => ({ ...prev, [oldVal]: newVal }));
  };

  const handleSave = async () => {
    if (!variable) return;
    setLoading(true);
    try {
      await dbService.recodeVariable(variable.id, newVarName, mappings);
      onSave(); // Refresh parent
      onClose();
    } catch (e) {
      alert("Failed to create variable");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                    <Wand2 size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Recode Variable</h2>
                    <p className="text-sm text-slate-500">Group values from <span className="font-semibold text-slate-700">{variable?.label}</span> into a new variable.</p>
                  </div>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto bg-gray-50/50 flex-1">
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">New Variable Name</label>
                  <input
                    type="text"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-800"
                  />
                </div>

                <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-4 p-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div>Original Value</div>
                    <div className="w-8"></div>
                    <div>New Category Label</div>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100">
                    {loading ? (
                      <div className="p-8 text-center text-slate-400">Loading values...</div>
                    ) : (
                      uniqueValues.map((val) => (
                        <div key={val} className="grid grid-cols-[1fr_auto_1fr] gap-4 p-3 items-center hover:bg-indigo-50/30 transition-colors group">
                          <div className="text-sm text-slate-700 font-medium truncate" title={val}>{val}</div>
                          <div className="text-gray-300 group-hover:text-indigo-300">
                            <ArrowRight size={16} />
                          </div>
                          <input
                            type="text"
                            value={mappings[val] || val}
                            onChange={(e) => handleMappingChange(val, e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-gray-100 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading || !newVarName}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <span className="animate-spin">⌛</span> : <Save size={16} />}
                  Create Variable
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};