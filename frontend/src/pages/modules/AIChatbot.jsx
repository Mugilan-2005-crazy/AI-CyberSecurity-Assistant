/**
 * pages/modules/AIChatbot.jsx
 * ------------------------------------------------------------
 * Module 5 — AI Security Chatbot (new enterprise chat page).
 * Integrates with the existing backend endpoint POST /chat/message
 * (already protected + rate-limited in chatRoutes.js). The frontend
 * sends the latest message plus the running history so the backend
 * can hold multi-turn context, and renders the assistant reply.
 *
 * Features:
 *  - Chat bubbles for user (right) and AI (left).
 *  - Scrollable history with auto-scroll to the latest message.
 *  - Multiline textarea: Enter sends, Shift+Enter inserts newline.
 *  - Send button with loading spinner + disabled while awaiting AI.
 *  - Clear Chat button (resets the session, keeps page mounted).
 *  - Welcome message describing the chatbot's purpose.
 *  - Backend errors surfaced via toast notifications.
 *  - Session-only history (preserved until cleared or page reload).
 *  - Responsive layout (mobile + desktop) matching the dashboard theme.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  PaperAirplaneIcon, TrashIcon,
  ClockIcon, ChevronLeftIcon, SparklesIcon, PaperClipIcon,
  MicrophoneIcon, ClipboardDocumentIcon, ArrowPathIcon, SpeakerWaveIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import endpoints, { sendMultimodalMessage } from '../../services/endpoints.js';
import ScanShell from '../../components/modules/ScanShell.jsx';
import Loader from '../../components/ui/Loader.jsx';
import TypingDots from '../../components/ui/TypingDots.jsx';
import AttachmentMenu from '../../components/chat/AttachmentMenu.jsx';
import SecurityReportCard from '../../components/chat/SecurityReportCard.jsx';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition.js';
import { useTextToSpeech } from '../../hooks/useTextToSpeech.js';
import { renderMarkdown } from '../../utils/markdown.js';

// Opening message shown before the first exchange.
const WELCOME = {
  role: 'model',
  text: "👋 Hi! I'm your Cyber Security Assistant. Ask me about phishing, malware, passwords, safe browsing, or anything security-related. You can also upload files (PDF, images, videos) for AI security analysis.",
};

const newSessionId = () =>
  `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
];

const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'docx', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'mov', 'avi'];
const BLOCKED_EXTENSIONS = ['exe', 'bat', 'cmd', 'js', 'sh', 'ps1'];
const MAX_SIZE = 25 * 1024 * 1024;

export default function AIChatbot() {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(newSessionId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [provider, setProvider] = useState('gemini');
  const [attachment, setAttachment] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadStage, setUploadStage] = useState(null);
  const [aiStatus, setAiStatus] = useState({ ollama: 'unknown', gemini: 'unknown' });
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [typingProvider, setTypingProvider] = useState(null);
  const [speakingIndex, setSpeakingIndex] = useState(null);

  const scrollRef = useRef(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const { isRecording: speechRecording, transcript: speechTranscript, startRecording, stopRecording, error: speechError, setLanguage } = useSpeechRecognition();
  const { speak, stop: stopSpeech, isSpeaking, language: ttsLanguage } = useTextToSpeech();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const SPEECH_LANG_MAP = {
    en: 'en-US',
    ta: 'ta-IN',
    hi: 'hi-IN',
    tanglish: 'en-US',
  };

  useEffect(() => {
    if (typeof setLanguage === 'function') {
      setLanguage(SPEECH_LANG_MAP[i18n.language] || 'en-US');
    }
  }, [i18n.language, setLanguage]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await endpoints.getChatHistory();
      setHistory(data);
    } catch {
      toast.error(t('chatbot.failedToLoadHistory'));
    } finally {
      setLoadingHistory(false);
    }
  }, [t]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await endpoints.getAIStatus();
        setAiStatus({
          ollama: data?.ollama?.status || 'unknown',
          gemini: data?.gemini?.status || 'unknown',
        });
      } catch {
        setAiStatus({ ollama: 'unknown', gemini: 'unknown' });
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const processFiles = (files) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;
    const file = fileArr[0];
    console.log('[AIChatbot] processFile selected:', { name: file.name, size: file.size, type: file.type });
    if (file.size > MAX_SIZE) {
      toast.error(t('chatbot.fileTooLarge'));
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      toast.error(t('chatbot.blockedFileType'));
      return;
    }
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(t('chatbot.unsupportedFileType'));
      return;
    }
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setAttachment({
      file,
      preview,
      name: file.name,
      size: file.size,
      type: file.type,
      ext,
      progress: 0,
      status: 'ready',
      error: null,
    });
    setUploadStage('ready');
  };

  const processFile = (file) => {
    processFiles([file]);
  };

  const onFilesSelected = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    e.target.value = '';
    setMenuOpen(false);
  };

  const removeAttachment = () => {
    if (attachment?.preview) URL.revokeObjectURL(attachment.preview);
    setAttachment(null);
    setUploadStage(null);
  };

  const handleAttachmentMenuSelect = (type, data) => {
    if (type === 'file' && data.files && data.files.length > 0) {
      processFiles(data.files);
    } else if (type === 'action') {
      if (data.action === 'web-search') {
        setMenuOpen(false);
        setInput(prev => 'web search: ' + prev);
        textareaRef.current?.focus();
      } else if (data.action === 'url-analysis') {
        setMenuOpen(false);
        setInput(prev => 'analyze URL: ' + prev);
        textareaRef.current?.focus();
      }
    }
  };

  const toggleVoiceRecording = async () => {
    if (isRecording) {
      stopRecording();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      try {
        await startRecording(SPEECH_LANG_MAP[i18n.language] || 'en-US');
      } catch (err) {
        toast.error(t('chatbot.voiceRecordingFailed'));
        setIsRecording(false);
      }
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const getFileIcon = (ext) => {
    const map = { pdf: 'PDF', docx: 'DOC', txt: 'TXT', png: 'IMG', jpg: 'IMG', jpeg: 'IMG', mp4: 'VID', mov: 'VID', avi: 'VID' };
    return map[ext] || 'FILE';
  };

  useEffect(() => {
    if (speechTranscript && speechTranscript.trim()) {
      setInput(speechTranscript);
    }
  }, [speechTranscript]);

  const send = async (text) => {
    let msgText = (text || input).trim();
    if (!msgText && !attachment) return;
    if (loading) return;

    if (msgText.startsWith('web search: ')) {
      msgText = msgText.replace('web search: ', '').trim();
      if (msgText) {
        setTypingProvider('web-search');
        try {
          const r = await api.post('/chat/web-search', { query: msgText, sessionId });
          setTypingProvider(null);
          setMessages((prev) => [
            ...prev,
            { role: 'user', text: msgText, timestamp: new Date().toISOString() },
            { role: 'model', text: r.reply || r.answer || r.response || 'Search results unavailable.', provider: 'web-search', timestamp: new Date().toISOString() },
          ]);
          setInput('');
        } catch (err) {
          setTypingProvider(null);
          toast.error('Web search failed. Please try again.');
        }
        return;
      }
    }

    if (msgText.startsWith('analyze URL: ')) {
      msgText = msgText.replace('analyze URL: ', '').trim();
      if (msgText) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', text: msgText, timestamp: new Date().toISOString() },
        ]);
        setInput('');
        setLoading(true);
        setTypingProvider('url-scanner');
        try {
          const r = await api.post('/scan/url', { url: msgText });
          setTypingProvider(null);
          setMessages((prev) => [
            ...prev,
            {
              role: 'model',
              text: `URL Analysis Result:\nVerdict: ${r.verdict}\nRisk Score: ${r.riskScore}/100\n${r.details || ''}`,
              provider: 'url-scanner',
              timestamp: new Date().toISOString(),
            },
          ]);
        } catch (err) {
          setTypingProvider(null);
          toast.error('URL analysis failed. Please try again.');
        } finally {
          setLoading(false);
        }
        return;
      }
    }

    const attachmentData = attachment ? { name: attachment.name, size: attachment.size, type: attachment.type, ext: attachment.ext } : null;

    const userMsg = {
      role: 'user',
      text: msgText || t('chatbot.analyzing'),
      timestamp: new Date().toISOString(),
      attachment: attachmentData,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    const currentAttachment = attachment;
    setAttachment(null);
    setLoading(true);
    setTypingProvider(null);

    try {
      if (currentAttachment) {
        setTypingProvider('gemini-vision');
        setUploadStage('uploading');
        const r = await sendMultimodalMessage(currentAttachment.file, msgText, sessionId);
        setUploadStage('analyzing');
        setTypingProvider(r.provider || 'gemini-vision');
        setMessages((prev) => [
          ...prev,
          {
            role: 'model',
            text: r.reply,
            category: r.category,
            suggestions: r.suggestions,
            timestamp: r.timestamp,
            provider: r.provider || 'gemini-vision',
            attachment: r.attachment || attachmentData,
            report: r.report,
          },
        ]);
      } else {
        const historyPayload = next
          .filter((m) => m !== WELCOME)
          .slice(0, -1)
          .map((m) => ({ role: m.role, text: m.text }));

        const r = await api.post('/chat/message', { message: msgText, history: historyPayload, sessionId });
        setTypingProvider(r.provider || 'gemini');
        setMessages((prev) => [
          ...prev,
          { role: 'model', text: r.reply, category: r.category, provider: r.provider || 'gemini', suggestions: r.suggestions, timestamp: r.timestamp },
        ]);
      }
    } catch (err) {
      const msgText = err.response?.data?.message || 'Failed to reach the AI assistant. Please try again.';
      toast.error(msgText);
      setTypingProvider(currentAttachment ? 'gemini-vision' : 'gemini');
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: `⚠ ${msgText}`, timestamp: new Date().toISOString(), provider: 'none' },
      ]);
    } finally {
      setLoading(false);
      setUploadStage(null);
      setTypingProvider(null);
      if (isRecording) {
        stopRecording();
        setIsRecording(false);
      }
    }
  };

  // Enter sends; Shift+Enter inserts a newline.
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Clear the conversation and start a fresh session.
  const clearChat = () => {
    setMessages([WELCOME]);
    setSessionId(newSessionId());
    setProvider('gemini');
    setAttachment(null);
    toast.info(t('chatbot.conversationCleared'));
  };

  const loadConversation = (conv) => {
    setMessages(conv.messages || [WELCOME]);
    setSessionId(conv.sessionId);
    setSidebarOpen(false);
  };

  const handleClearHistory = async () => {
    try {
      await endpoints.clearChatHistory();
      setHistory([]);
      toast.success(t('chatbot.historyCleared'));
    } catch {
      toast.error(t('chatbot.failedToClearHistory'));
    }
  };

  const sendSuggestion = (suggestion) => {
    send(suggestion);
  };

  const isNewChat = messages.length <= 1;

  const renderProvider = (p) => {
    if (p === 'ollama') return t('chatbot.providerOllama');
    if (p === 'gemini') return t('chatbot.providerGemini');
    if (p === 'gemini-vision') return t('chatbot.providerGeminiVision');
    if (p === 'multimodal-fallback') return t('chatbot.providerMultimodalFallback');
    if (p === 'web-search') return t('chatbot.providerWebSearch');
    return t('chatbot.providerNone');
  };

  const renderAIStatus = () => {
    const ollamaStatus = aiStatus?.ollama;
    const geminiStatus = aiStatus?.gemini;
    if (ollamaStatus === 'online') {
      if (geminiStatus === 'available') {
        return <span className="text-[10px] text-green-500">🟢 Local AI Online</span>;
      }
      return <span className="text-[10px] text-yellow-500">🟡 Gemini Limited / Local AI Active</span>;
    }
    if (geminiStatus === 'available') {
      return <span className="text-[10px] text-green-500">☁ Gemini Online</span>;
    }
    return <span className="text-[10px] text-red-500">🔴 AI Offline</span>;
  };

  const copyMessage = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('chatbot.copied') || 'Copied to clipboard');
    } catch {
      toast.error(t('chatbot.copyFailed') || 'Failed to copy');
    }
  };

  const speakMessage = (text, index) => {
    if (isSpeaking && speakingIndex === index) {
      stopSpeech();
      setSpeakingIndex(null);
    } else {
      stopSpeech();
      speak(text);
      setSpeakingIndex(index);
    }
  };

  const regenerateMessage = async (aiMessageIndex) => {
    let lastUserMsg = null;
    for (let j = aiMessageIndex - 1; j >= 0; j--) {
      if (messages[j].role === 'user') {
        lastUserMsg = messages[j];
        break;
      }
    }
    if (!lastUserMsg) return;
    const userIdx = messages.findIndex((m) => m === lastUserMsg);
    setMessages(messages.slice(0, userIdx));
    await send(lastUserMsg.text);
  };

  const renderEmptyState = () => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full text-center px-4 py-8"
    >
      <div className="p-3 rounded-2xl bg-primary/10 text-primary mb-3">
        <SparklesIcon className="h-8 w-8" />
      </div>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
        {t('chatbot.startConversation')}
      </p>
      <p className="text-xs text-slate-400 max-w-xs">
        Ask me about phishing, malware, passwords, or upload a file for security analysis.
      </p>
    </motion.div>
  );

  return (
    <ScanShell
      title={t('chatbot.title')}
      description={t('chatbot.description')}
      icon={SparklesIcon}
      max="max-w-5xl"
    >
      <div className="flex gap-4 h-[70vh] min-h-[500px] relative">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {renderProvider(provider)}
              </span>
              {typingProvider && (
                <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                  {renderProvider(typingProvider)}
                </span>
              )}
            </div>
            {renderAIStatus()}
          </div>
          <div
            ref={scrollRef}
            className={`flex-1 overflow-y-auto space-y-3 pr-1 rounded-xl transition-colors ${dragOver ? 'bg-primary/5 ring-2 ring-primary/30' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {isNewChat ? (
              renderEmptyState()
            ) : (
              messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] sm:max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                    {m.attachment && (
                      <div className="mb-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                        <PaperClipIcon className="h-3 w-3" />
                        <span className="truncate max-w-[180px]">{m.attachment.name}</span>
                        <span className="text-slate-400">{formatFileSize(m.attachment.size)}</span>
                      </div>
                    )}
                    {(() => {
                      const msgClass = `px-4 py-2.5 rounded-2xl text-sm break-words ${
                        m.role === 'user'
                          ? 'bg-primary text-white rounded-br-sm whitespace-pre-wrap'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                      }`;
                      if (m.role === 'model') {
                        return (
                          <div
                            className={msgClass}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text || '') }}
                          />
                        );
                      }
                      return (
                        <div className={msgClass}>
                          {m.text}
                        </div>
                      );
                    })()}
                    {m.role === 'model' && (
                      <div className="flex items-center gap-1 mt-1 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity px-1">
                        <button
                          type="button"
                          onClick={() => copyMessage(m.text)}
                          className="p-1 rounded text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Copy"
                        >
                          <ClipboardDocumentIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => speakMessage(m.text, i)}
                          className={`p-1 rounded transition-colors ${
                            isSpeaking && speakingIndex === i
                              ? 'text-primary bg-slate-100 dark:bg-slate-700'
                              : 'text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                          title={isSpeaking && speakingIndex === i ? 'Stop' : 'Listen'}
                        >
                          <SpeakerWaveIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => regenerateMessage(i)}
                          className="p-1 rounded text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Regenerate"
                        >
                          <ArrowPathIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {m.role === 'model' && m.report && (
                      <SecurityReportCard report={m.report} />
                    )}
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {formatTime(m.timestamp)}
                    </span>
                  </div>
                </motion.div>
                )))}
            {dragOver && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-center py-8 border-2 border-dashed border-primary rounded-xl text-primary text-sm font-medium"
              >
                {t('chatbot.dragDropActive')}
              </motion.div>
            )}
          </div>

          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start mt-3"
            >
              <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
                <TypingDots label={t('chatbot.aiThinking')} />
              </div>
            </motion.div>
          )}
          <div ref={endRef} />

          {/* Input Area */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            {isRecording && (
              <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                  {t('chatbot.recording')}
                </span>
                <button
                  type="button"
                  onClick={() => { stopRecording(); setIsRecording(false); }}
                  className="ml-auto text-xs text-red-500 hover:text-red-700"
                >
                  {t('chatbot.stopRecording')}
                </button>
              </div>
             )}
 
             {/* Input Row */}
             <div className="flex items-end gap-2">
              <AttachmentMenu
                onSelect={handleAttachmentMenuSelect}
                onClose={() => setMenuOpen(false)}
              />

              <button
                type="button"
                onClick={toggleVoiceRecording}
                className={`p-2.5 rounded-xl transition-colors ${
                  isRecording
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-500 animate-pulse'
                    : 'text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title={isRecording ? t('chatbot.stopRecording') : t('chatbot.voiceInput')}
              >
                <MicrophoneIcon className="h-5 w-5" />
              </button>

              <label htmlFor="ai-chat-input" className="sr-only">{t('chatbot.placeholder')}</label>
              <textarea
                id="ai-chat-input"
                ref={textareaRef}
                rows={1}
                className="input resize-none flex-1 max-h-40 min-h-[42px]"
                placeholder={t('chatbot.placeholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                aria-required="true"
                disabled={isRecording}
              />
              <button
                type="button"
                onClick={() => send()}
                className="btn-cyber whitespace-nowrap flex items-center gap-1.5"
                disabled={loading || (!input.trim() && !attachment)}
              >
                {loading ? <Loader label="" /> : <PaperAirplaneIcon className="h-4 w-4" />}
                <span>{loading ? t('chatbot.sending') : t('chatbot.send')}</span>
              </button>
            </div>

            <div className="flex justify-between items-center mt-2">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={clearChat}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-danger transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                  {t('chatbot.clearChat')}
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary transition-colors"
                >
                  <ClockIcon className="h-4 w-4" />
                  {t('chatbot.history')}
                </button>
              </div>
              <span className="text-xs text-slate-400">
                Press <kbd className="px-1 rounded bg-slate-200 dark:bg-slate-700">Enter</kbd> to send ·{' '}
                <kbd className="px-1 rounded bg-slate-200 dark:bg-slate-700">Shift</kbd>+
                <kbd className="px-1 rounded bg-slate-200 dark:bg-slate-700">Enter</kbd> for newline
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden lg:flex w-72 flex-col glass rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-sm">{t('chatbot.history')}</h3>
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-xs text-slate-400 hover:text-danger transition-colors"
            >
              {t('chatbot.clearAll')}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadingHistory ? (
              <Loader label={t('common.loading')} />
            ) : history.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">{t('chatbot.noConversations')}</p>
            ) : (
              <div className="space-y-1">
                {history.map((h) => (
                  <button
                    key={h.sessionId}
                    type="button"
                    onClick={() => loadConversation(h)}
                    className={`w-full text-left p-3 rounded-xl transition-colors ${
                      h.sessionId === sessionId
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <p className="text-sm font-medium truncate">{h.conversationTitle}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{h.preview}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-slate-400">{formatDate(h.updatedAt)}</span>
                      <span className="text-[10px] text-slate-400">{h.messageCount} msgs</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                key="sidebar"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-80 glass z-50 lg:hidden flex flex-col border-l border-slate-200 dark:border-slate-700"
              >
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{t('chatbot.history')}</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className="text-xs text-slate-400 hover:text-danger transition-colors"
                    >
                      {t('chatbot.clearAll')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {loadingHistory ? (
                    <Loader label={t('common.loading')} />
                  ) : history.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">{t('chatbot.noConversations')}</p>
                  ) : (
                    <div className="space-y-1">
                      {history.map((h) => (
                        <button
                          key={h.sessionId}
                          type="button"
                          onClick={() => loadConversation(h)}
                          className={`w-full text-left p-3 rounded-xl transition-colors ${
                            h.sessionId === sessionId
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          <p className="text-sm font-medium truncate">{h.conversationTitle}</p>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{h.preview}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-slate-400">{formatDate(h.updatedAt)}</span>
                            <span className="text-[10px] text-slate-400">{h.messageCount} msgs</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </ScanShell>
  );
}

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
