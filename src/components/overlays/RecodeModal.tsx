import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Wand2, Save, Layers, ListFilter, Plus, Trash2 } from 'lucide-react';
import { Variable, RecodeMode, RecodeRule } from '../../types';
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

  // Binning State
  const [mode, setMode] = useState<RecodeMode>('categorical');
  const [rules, setRules] = useState<RecodeRule[]>([]);

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

          // Determine default mode - numeric and date are numeric types
          const defaultMode = (variable.type === 'numeric' || variable.type === 'date') ? 'binning' : 'categorical';
          setMode(defaultMode);

          if (defaultMode === 'binning') {
            // Init with one empty rule
            setRules([{ min: undefined, max: undefined, label: 'Group 1' }]);
          }

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
      // Use store action which routes through worker
      await recodeVariable(variable.id, newVarName, {
        mode,
        mappings: mode === 'categorical' ? mappings : undefined,
        rules: mode === 'binning' ? rules : undefined
      });
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

                {/* Mode Switcher (Only for numeric types: numeric and date) */}
                {(variable?.type === 'numeric' || variable?.type === 'date') && (
                  <div className="flex gap-2 mb-6 bg-[var(--color-parchment)] p-1 rounded-lg border border-[var(--gray-200)] w-fit">
                    <button
                      onClick={() => setMode('categorical')}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'categorical'
                        ? 'bg-white text-[var(--color-terracotta)] shadow-sm'
                        : 'text-[var(--gray-400)] hover:text-[var(--gray-600)]'
                        }`}
                    >
                      <ListFilter size={14} />
                      Categorical
                    </button>
                    <button
                      onClick={() => setMode('binning')}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'binning'
                        ? 'bg-white text-[var(--color-terracotta)] shadow-sm'
                        : 'text-[var(--gray-400)] hover:text-[var(--gray-600)]'
                        }`}
                    >
                      <Layers size={14} />
                      Binning (Ranges)
                    </button>
                  </div>
                )}

                {mode === 'categorical' ? (
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
                ) : (
                  <div className="space-y-4">
                    <div className="bg-[var(--color-paper)] border border-[var(--gray-200)] rounded-lg shadow-sm overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[var(--gray-50)] border-b border-[var(--gray-200)] text-xs text-[var(--gray-500)] uppercase tracking-wider">
                            <th className="p-3 font-semibold">Min (&gt;=)</th>
                            <th className="p-3 font-semibold">Max (&lt;)</th>
                            <th className="p-3 font-semibold">Label</th>
                            <th className="p-3 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--gray-100)]">
                          {rules.map((rule, idx) => (
                            <tr key={idx} className="group hover:bg-[var(--gray-50)] transition-colors">
                              <td className="p-2">
                                <input
                                  type="number"
                                  placeholder="-∞"
                                  value={rule.min ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                                    const newRules = [...rules];
                                    newRules[idx].min = val;
                                    setRules(newRules);
                                  }}
                                  className="w-full px-3 py-1.5 border border-[var(--gray-200)] rounded-md text-sm text-[var(--color-ink)] focus:border-[var(--color-terracotta)] outline-none"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  placeholder="+∞"
                                  value={rule.max ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                                    const newRules = [...rules];
                                    newRules[idx].max = val;
                                    setRules(newRules);
                                  }}
                                  className="w-full px-3 py-1.5 border border-[var(--gray-200)] rounded-md text-sm text-[var(--color-ink)] focus:border-[var(--color-terracotta)] outline-none"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={rule.label}
                                  onChange={(e) => {
                                    const newRules = [...rules];
                                    newRules[idx].label = e.target.value;
                                    setRules(newRules);
                                  }}
                                  className="w-full px-3 py-1.5 border border-[var(--gray-200)] rounded-md text-sm text-[var(--color-ink)] focus:border-[var(--color-terracotta)] outline-none"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  onClick={() => setRules(rules.filter((_, i) => i !== idx))}
                                  className="text-[var(--gray-300)] hover:text-red-500 transition-colors p-1"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      onClick={() => setRules([...rules, { min: undefined, max: undefined, label: `Group ${rules.length + 1}` }])}
                      className="flex items-center gap-2 text-xs font-medium text-[var(--color-terracotta)] hover:bg-[var(--color-terracotta)]/10 px-3 py-2 rounded-lg transition-colors border border-[var(--color-terracotta)]/20"
                    >
                      <Plus size={14} />
                      Add Interval
                    </button>
                  </div>
                )}
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