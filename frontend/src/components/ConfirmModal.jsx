import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ isOpen: false, title: '', message: '', confirmText: '확인', cancelText: '취소' });
  const resolveRef = useRef(null);

  const confirm = useCallback(({ title = '확인', message, confirmText = '확인', cancelText = '취소' } = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ isOpen: true, title, message, confirmText, cancelText });
    });
  }, []);

  const handleConfirm = () => {
    setState((s) => ({ ...s, isOpen: false }));
    resolveRef.current?.(true);
  };

  const handleCancel = () => {
    setState((s) => ({ ...s, isOpen: false }));
    resolveRef.current?.(false);
  };

  // ESC key
  useEffect(() => {
    if (!state.isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') handleCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state.isOpen]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm animate-fade-in"
            onClick={handleCancel}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-xl border border-ink-100 w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="px-6 pt-6 pb-4">
              <h3 className="font-display text-lg font-bold text-ink-950 tracking-tight">
                {state.title}
              </h3>
              {state.message && (
                <p className="mt-2 text-sm text-ink-600 leading-relaxed">
                  {state.message}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 px-6 pb-5">
              <button
                onClick={handleCancel}
                className="btn-secondary flex-1 text-sm"
                autoFocus={false}
              >
                {state.cancelText}
              </button>
              <button
                onClick={handleConfirm}
                className="btn-primary flex-1 text-sm bg-red-600 hover:bg-red-700"
                autoFocus
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used within ConfirmProvider');
  return confirm;
}
