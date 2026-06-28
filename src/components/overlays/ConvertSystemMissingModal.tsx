import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ModalShell } from './ModalShell';

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

  const inputClassName =
    'w-full px-4 py-2.5 border border-[var(--border-color)] rounded-lg text-sm outline-none focus:border-[var(--border-color-active)] focus:ring-2 focus:ring-[var(--border-color-active)]/20 transition-all bg-[var(--bg-panel)] text-[var(--text-primary)]';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      onBackdropClick={isSubmitting ? null : onClose}
      panelClassName="bg-[var(--bg-panel)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto border border-[var(--border-color)]"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Replacement Code</label>
          <input
            ref={codeRef}
            type="number"
            step="any"
            value={codeDraft}
            onChange={(e) => setCodeDraft(e.target.value)}
            placeholder="e.g. 999"
            className={inputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Label</label>
          <input
            type="text"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            placeholder="Recovered from system missing"
            className={inputClassName}
          />
        </div>
        {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium text-[var(--text-inverse)] bg-[var(--color-accent)] hover:opacity-90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Converting...' : submitLabel}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
