import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MENU_ITEMS = [
  { key: 'photos', icon: '📷', label: 'Photos', accept: 'image/png,image/jpeg,image/jpg,image/webp', types: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'] },
  { key: 'files', icon: '📁', label: 'Files', accept: '.pdf,.txt,.docx,.md,.markdown', types: ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown'] },
  { key: 'web', icon: '🌐', label: 'Web Search', action: 'web-search' },
  { key: 'documents', icon: '📄', label: 'Documents', accept: '.pdf,.txt,.docx,.md,.markdown', types: ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown'] },
  { key: 'url', icon: '🔗', label: 'URL Analysis', action: 'url-analysis' },
];

export default function AttachmentMenu({ onSelect, onClose }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileSelect = (item, event) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onSelect('file', { files, accept: item.accept, type: item.types });
    }
    event.target.value = '';
    setOpen(false);
  };

  const handleActionSelect = (item) => {
    onSelect('action', { action: item.action });
    setOpen(false);
  };

  return (
    <div ref={menuRef} className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-600 p-2 min-w-[180px] z-50"
          >
            {MENU_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={(e) => {
                  if (item.action) {
                    handleActionSelect(item);
                  } else {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = item.accept || '';
                    input.multiple = true;
                    input.onchange = (ev) => handleFileSelect(item, ev);
                    input.click();
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left text-sm text-slate-700 dark:text-slate-200"
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        title="Attachment menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
        </svg>
      </button>
    </div>
  );
}