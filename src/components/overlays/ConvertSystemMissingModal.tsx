import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ConvertSystemMissingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: { code: number; label: string }) => Promise<void> | void;
  initialCode?: number;
  initialLabel?: string;
  title?: string;
  submitLabel?: string;
}

export const ConvertSystemMissingModal: React.FC<ConvertSystemMissingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialCode,
  initialLabel = 'Recovered from system missing',
  title = 'Convert System Missing',
  submitLabel = 'Convert',
}) => {
  const [codeDraft, setCodeDraft] = useState(initialCode !== undefined ? String(initialCode) : '');
  const [labelDraft, setLabelDraft] = useState(initialLabel);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCodeDraft(initialCode !== undefined ? String(initialCode) : '');
    setLabelDraft(initialLabel);
    setError(null);
    setIsSubmitting(false);
    setTimeout(() => codeRef.current?.focus(), 100);
  }, [isOpen, initialCode, initialLabel]);

  const parsedCode = useMemo(() => Number(codeDraft.trim()), [codeDraft]);
  const isValidCode = Number.isFinite(parsedCode);
  const isValidLabel = labelDraft.trim().length > 0;
  const canSubmit = isValidCode && isValidLabel && !isSubmitting;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isValidCode) {
      setError('Replacement code must be a valid number.');
      return;
    }
    if (!isValidLabel) {
      setError('Label is required.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({ code: parsedCode, label: labelDraft.trim() });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to convert system missing values.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isSubmitting ? undefined : onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Replacement Code</label>
                  <input
                    ref={codeRef}
                    type="number"
                    step="any"
                    value={codeDraft}
                    onChange={(e) => setCodeDraft(e.target.value)}
                    placeholder="e.g. 999"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
                  <input
                    type="text"
                    value={labelDraft}
                    onChange={(e) => setLabelDraft(e.target.value)}
                    placeholder="Recovered from system missing"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
                {error && (
                  <p className="text-xs text-red-600">{error}</p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Converting...' : submitLabel}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

