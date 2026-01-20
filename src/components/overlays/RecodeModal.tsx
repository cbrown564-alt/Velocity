import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Wand2, Save } from 'lucide-react';
import { Variable } from '../../types';
import { useVelocityStore } from '../../store';

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

  // Get store actions for unified data access
  const getUniqueValues = useVelocityStore(state => state.getUniqueValues);
  const recodeVariable = useVelocityStore(state => state.recodeVariable);

  useEffect(() => {
    if (isOpen && variable) {
      const loadValues = async () => {
        setLoading(true);
        try {
          // Use store action which routes through worker (or uses embedded metadata)
          const values = await getUniqueValues(variable.id);
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
  }, [isOpen, variable, getUniqueValues]);

  const handleMappingChange = (oldVal: string, newVal: string) => {
    setMappings(prev => ({ ...prev, [oldVal]: newVal }));
  };

  const handleSave = async () => {
    if (!variable) return;
    setLoading(true);
    try {
      // Use store action which routes through worker
      await recodeVariable(variable.id, newVarName, mappings);
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
            className="fixed inset-0 bg-[var(--color-ink)]/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-[var(--color-paper)] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="p-6 border-b border-[var(--gray-200)] flex items-center justify-between bg-[var(--color-paper)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--gray-50)] text-[var(--color-terracotta)] rounded-lg">
                    <Wand2 size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[var(--color-ink)] font-display">Recode Variable</h2>
                    <p className="text-sm text-[var(--gray-500)] font-body">Group values from <span className="font-semibold text-[var(--color-charcoal)]">{variable?.label}</span> into a new variable.</p>
                  </div>
                </div>
                <button onClick={onClose} className="text-[var(--gray-400)] hover:text-[var(--gray-600)] transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto bg-[var(--gray-50)]/50 flex-1 font-body">
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-[var(--gray-500)] uppercase tracking-wider mb-2">New Variable Name</label>
                  <input
                    type="text"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    className="w-full px-4 py-2 border border-[var(--gray-300)] rounded-lg focus:ring-2 focus:ring-[var(--color-terracotta)]/20 focus:border-[var(--color-terracotta)] outline-none font-medium text-[var(--color-ink)] bg-[var(--color-parchment)]"
                  />
                </div>

                <div className="bg-[var(--color-paper)] border border-[var(--gray-200)] rounded-lg shadow-sm">
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-4 p-3 bg-[var(--gray-50)] border-b border-[var(--gray-200)] text-xs font-semibold text-[var(--gray-500)] uppercase tracking-wider">
                    <div>Original Value</div>
                    <div className="w-8"></div>
                    <div>New Category Label</div>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto divide-y divide-[var(--gray-100)]">
                    {loading ? (
                      <div className="p-8 text-center text-[var(--gray-400)]">Loading values...</div>
                    ) : (
                      uniqueValues.map((val) => {
                        // Find label if available
                        const labelObj = variable?.valueLabels?.find(vl => String(vl.value) === String(val));
                        const displayLabel = labelObj ? `${labelObj.label} (${val})` : val;

                        return (
                          <div key={val} className="grid grid-cols-[1fr_auto_1fr] gap-4 p-3 items-center hover:bg-[var(--gray-50)] transition-colors group">
                            <div className="text-sm text-[var(--color-charcoal)] font-medium truncate" title={displayLabel}>{displayLabel}</div>
                            <div className="text-[var(--gray-300)] group-hover:text-[var(--color-terracotta)]/50">
                              <ArrowRight size={16} />
                            </div>
                            <input
                              type="text"
                              value={mappings[val] || val}
                              onChange={(e) => handleMappingChange(val, e.target.value)}
                              className="w-full px-3 py-1.5 border border-[var(--gray-200)] rounded-md text-sm text-[var(--color-ink)] focus:border-[var(--color-terracotta)] focus:ring-2 focus:ring-[var(--color-terracotta)]/20 outline-none"
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[var(--gray-100)] bg-[var(--color-paper)] flex justify-end gap-3 font-body">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--gray-600)] hover:bg-[var(--gray-100)] rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading || !newVarName}
                  className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-terracotta)] hover:bg-[#c96950] active:bg-[#b55d46] rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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