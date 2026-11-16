import React, { useEffect, useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';

interface DeleteActionButtonProps {
  onConfirm: () => void;
  title?: string;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
}

export const DeleteActionButton: React.FC<DeleteActionButtonProps> = ({
  onConfirm,
  title = 'Delete record',
  label,
  compact = true,
  disabled = false,
}) => {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3200);
    return () => clearTimeout(timer);
  }, [confirming]);

  if (confirming) {
    return (
      <div
        className="inline-flex items-center gap-1 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-1.5 py-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
            onConfirm();
          }}
          title="Confirm delete"
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-semibold bg-rose-600 text-white hover:bg-rose-700"
        >
          <Check className="w-3 h-3" />
          Delete
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
          }}
          title="Cancel"
          className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        setConfirming(true);
      }}
      title={title}
      aria-label={title}
      className={`inline-flex items-center gap-1 rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 disabled:pointer-events-none transition-colors ${
        compact ? 'p-1.5' : 'px-2.5 py-1.5 text-xs font-medium border border-rose-200 dark:border-rose-900'
      }`}
    >
      <Trash2 className="w-4 h-4" />
      {label && <span>{label}</span>}
    </button>
  );
};
