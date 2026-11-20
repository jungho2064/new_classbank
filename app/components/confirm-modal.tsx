'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 브라우저 기본 confirm() 대신 앱 다크 테마에 맞춰 사용하는 인앱 확인 모달.
 */
export default function ConfirmModal({
  isOpen,
  title = '확인',
  message,
  confirmText = '확인',
  cancelText = '취소',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500 text-white'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-500 text-white'
      : 'bg-indigo-600 hover:bg-indigo-500 text-white';

  const iconBgClass =
    variant === 'danger'
      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      : variant === 'warning'
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';

  return (
    <div
      style={{ zIndex: 999998 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${iconBgClass}`}>
              <AlertTriangle size={18} />
            </div>
            <h3 className="font-bold text-sm text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
          {message}
        </p>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-800 hover:bg-slate-700 py-2.5 rounded-xl text-xs font-bold text-slate-300 transition active:scale-95"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition active:scale-95 shadow-lg ${confirmBtnClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
