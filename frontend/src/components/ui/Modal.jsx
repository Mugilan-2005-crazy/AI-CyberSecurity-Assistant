/**
 * components/ui/Modal.jsx
 * ------------------------------------------------------------
 * Accessible, reusable modal dialog. Renders a backdrop + centered
 * panel, closes on backdrop click or Escape, and locks scroll.
 * Used by Profile/Settings for inline editing dialogs.
 */
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    if (open) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
      <motion.div
           className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
           role="presentation"
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           onClick={onClose}
         >
           <motion.div
             className="w-full max-w-lg bg-white dark:bg-surface-card rounded-2xl shadow-xl p-6"
             role="dialog"
             aria-modal="true"
             aria-labelledby={title ? "modal-title" : undefined}
             initial={{ scale: 0.95, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             exit={{ scale: 0.95, opacity: 0 }}
             onClick={(e) => e.stopPropagation()}
           >
             {title && <h2 id="modal-title" className="text-lg font-semibold mb-4">{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
