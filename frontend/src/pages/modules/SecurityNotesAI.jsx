/**
 * pages/modules/SecurityNotesAI.jsx
 * ============================================================
 * Security Notes AI — NotebookLM-style document Q&A.
 * Upload cybersecurity documents, then ask questions
 * based only on the uploaded sources.
 *
 * Features:
 *  - Drag-and-drop file upload (PDF, TXT, DOCX, MD)
 *  - Uploaded document list with delete
 *  - Processing status indicators
 *  - RAG-based chat interface
 *  - Multilingual support (en, ta, tanglish, hi)
 *  - Matches glass cybersecurity theme
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DocumentTextIcon,
  ArrowUpTrayIcon,
  ChatBubbleLeftRightIcon,
  TrashIcon,
  CloudArrowUpIcon,
  GlobeAltIcon,
  DocumentDuplicateIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import endpoints from '../../services/endpoints.js';
import ScanShell from '../../components/modules/ScanShell.jsx';
import Loader from '../../components/ui/Loader.jsx';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.docx', '.md', '.markdown'];

const FILE_TYPE_ICONS = {
  pdf: '📄',
  txt: '📝',
  docx: '📘',
  markdown: '📋',
};

const STATUS_LABELS = {
  uploaded: '⚡ Uploaded',
  extracting: '🔄 Extracting...',
  chunking: '🔄 Chunking...',
  embedding: '🧠 Generating embeddings...',
  ready: '✅ Ready',
  failed: '❌ Failed',
};

export default function SecurityNotesAI() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: "👋 Welcome to Security Notes AI. Upload your cybersecurity documents and ask questions based only on your sources. I'll answer using the document context.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadDocuments = async () => {
    try {
      const data = await endpoints.getDocuments();
      setDocuments(data.documents || []);
    } catch {
      toast.error(t('securityNotes.failedToLoadDocuments'));
    }
  };

  const loadChatHistory = async (docId) => {
    try {
      const data = await api.get(`/notes/history/${docId}`);
      setChatHistory(data.history || []);
    } catch {
      setChatHistory([]);
    }
  };

  const handleFileSelect = async (files) => {
    const fileList = Array.from(files);
    for (const file of fileList) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_TYPES.includes(file.type)) {
        toast.error(
          t('securityNotes.invalidFileType', { file: file.name, ext })
        );
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error(
          t('securityNotes.fileTooLarge', { file: file.name, max: '25MB' })
        );
        continue;
      }

      await uploadFile(file);
    }
  };

  const uploadFile = async (file) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const data = await api.post('/notes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(t('securityNotes.uploadSuccess', { file: file.name }));
      setProcessingIds((prev) => new Set(prev).add(data.document.id));
      await loadDocuments();
    } catch (err) {
      const msg = err.response?.data?.message || t('securityNotes.uploadFailed');
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileSelect(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDeleteDocument = async (docId, filename) => {
    try {
      await api.delete(`/notes/${docId}`);
      toast.success(t('securityNotes.documentDeleted', { file: filename }));
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (selectedDocId === docId) {
        setSelectedDocId(null);
        setChatHistory([]);
        setMessages([
          {
            role: 'model',
            text: t('securityNotes.welcomeMessage'),
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      toast.error(t('securityNotes.deleteFailed'));
    }
  };

  const selectDocument = (docId) => {
    setSelectedDocId(docId);
    const doc = documents.find((d) => d.id === docId);
    if (doc && doc.status === 'ready') {
      loadChatHistory(docId);
    }
  };

  const sendChat = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    if (!selectedDocId) {
      toast.warning(t('securityNotes.selectDocument'));
      return;
    }

    const userMsg = { role: 'user', text: msg, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const r = await api.post('/notes/chat', {
        documentId: selectedDocId,
        message: msg,
        language: localStorage.getItem('language') || 'en',
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: r.answer,
          provider: r.provider,
          timestamp: r.timestamp,
        },
      ]);
    } catch (err) {
      const msgText =
        err.response?.data?.message ||
        t('securityNotes.chatFailed');
      toast.error(msgText);
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: `⚠ ${msgText}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const isDocSelected = selectedDocId && documents.some((d) => d.id === selectedDocId);

  return (
    <ScanShell
      title={t('securityNotes.title')}
      description={t('securityNotes.description')}
      icon={DocumentTextIcon}
      max="max-w-6xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Upload + Documents */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Upload Section */}
          <div className="glass rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <ArrowUpTrayIcon className="h-4 w-4 text-primary" />
              {t('securityNotes.uploadSection')}
            </h3>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                dragActive
                  ? 'border-primary bg-primary/10'
                  : 'border-slate-300 dark:border-slate-600 hover:border-primary/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label={t('securityNotes.uploadLabel')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  fileInputRef.current?.click();
                }
              }}
            >
              <CloudArrowUpIcon className="h-10 w-10 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {t('securityNotes.dropZone')}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                PDF, TXT, DOCX, MD — Max 25MB
              </p>
              {uploading && (
                <div className="mt-3">
                  <Loader label={t('common.uploading')} />
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.docx,.md,.markdown"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </div>

          {/* Documents List */}
          <div className="flex-1 glass rounded-2xl p-4 border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <DocumentDuplicateIcon className="h-4 w-4 text-primary" />
              {t('securityNotes.yourDocuments')}
              <span className="text-xs text-slate-400 font-normal ml-auto">
                {documents.length}
              </span>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2">
              {documents.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  {t('securityNotes.noDocuments')}
                </p>
              ) : (
                documents.map((doc) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedDocId === doc.id
                        ? 'bg-primary/10 border-primary/30'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    } ${doc.status !== 'ready' ? 'opacity-60' : ''}`}
                    onClick={() => selectDocument(doc.id)}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg shrink-0">
                        {FILE_TYPE_ICONS[doc.fileType] || '📁'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {doc.filename}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {STATUS_LABELS[doc.status] || doc.status} (
                          {(doc.fileSize / 1024).toFixed(1)} KB)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(doc.id, doc.filename);
                        }}
                        className="shrink-0 p-1 text-slate-400 hover:text-danger transition-colors"
                        aria-label={t('common.delete')}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Chat */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="glass rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden flex-1 min-h-[60vh]">
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BeakerIcon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">
                  {t('securityNotes.askYourDocuments')}
                </h3>
              </div>
              {isDocSelected && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <DocumentTextIcon className="h-3.5 w-3.5" />
                  {t('securityNotes.contextActive')}
                </span>
              )}
              {!isDocSelected && (
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  {t('securityNotes.selectDocumentHint')}
                </span>
              )}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                        m.role === 'user'
                          ? 'bg-primary text-white rounded-br-sm'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {formatTime(m.timestamp)}
                    </span>
                  </div>
                </motion.div>
              ))}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl px-4 py-2">
                    <Loader label={t('common.loading')} />
                  </div>
                </motion.div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-end gap-2">
                <label htmlFor="notes-chat-input" className="sr-only">
                  {t('securityNotes.chatPlaceholder')}
                </label>
                <textarea
                  id="notes-chat-input"
                  rows={1}
                  className="input resize-none flex-1 max-h-32 min-h-[42px]"
                  placeholder={
                    isDocSelected
                      ? t('securityNotes.chatPlaceholder')
                      : t('securityNotes.selectDocumentFirst')
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={!isDocSelected || loading}
                  aria-required={isDocSelected}
                />
                <button
                  type="button"
                  onClick={() => sendChat()}
                  className="btn-cyber whitespace-nowrap flex items-center gap-1.5"
                  disabled={loading || !input.trim() || !isDocSelected}
                >
                  {loading ? (
                    <Loader label="" />
                  ) : (
                    <ChatBubbleLeftRightIcon className="h-4 w-4" />
                  )}
                  <span>
                    {loading ? t('common.loading') : t('common.send')}
                  </span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                {isDocSelected
                  ? t('securityNotes.answerFromDocs')
                  : t('securityNotes.uploadFirstHint')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </ScanShell>
  );
}