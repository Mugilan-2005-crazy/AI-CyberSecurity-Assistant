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
import { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import ScanShell from '../../components/modules/ScanShell.jsx';
import Loader from '../../components/ui/Loader.jsx';

// Opening message shown before the first exchange.
const WELCOME = {
  role: 'model',
  text:
    "👋 Hi! I'm your AI Security Assistant. Ask me anything about cybersecurity — " +
    'phishing, ransomware, password hygiene, safe browsing, or how our tools work. ' +
    'I can explain threats in plain language and suggest practical steps to stay safe.',
};

// Stable per-session id so the backend can persist/continue context.
const newSessionId = () =>
  `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function AIChatbot() {
  // messages: { role: 'user' | 'model', text } — kept for the current session only.
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(newSessionId);

  const scrollRef = useRef(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to the newest message whenever the conversation changes.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Send the current input to the backend chatbot endpoint.
  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Append the user's message and clear the input immediately.
    const userMsg = { role: 'user', text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    // Build history (excluding the greeting) in the shape the backend expects.
    const history = next
      .filter((m) => m !== WELCOME)
      .slice(0, -1)
      .map((m) => ({ role: m.role, text: m.text }));

    try {
      const r = await api.post('/chat/message', { message: text, history, sessionId });
      setMessages((prev) => [...prev, { role: 'model', text: r.reply }]);
    } catch (err) {
      // Surface the backend error to the user without losing their message.
      const msg = err.response?.data?.message || 'Failed to reach the AI assistant. Please try again.';
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: `⚠ ${msg}` },
      ]);
    } finally {
      setLoading(false);
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
    toast.info('Conversation cleared');
  };

  return (
    <ScanShell
      title="AI Security Chatbot"
      description="Get plain-language guidance on threats, best practices, and our tools."
      icon={ChatBubbleLeftRightIcon}
      max="max-w-3xl"
    >
      <div className="flex flex-col h-[60vh] min-h-[400px]" role="log" aria-live="polite" aria-label="Chat conversation">
        {/* Scrollable conversation history */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] sm:max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                  m.role === 'user'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {/* Typing indicator while the AI is responding */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl px-4 py-2">
                <Loader label="Thinking..." />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Composer: multiline input + actions */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-end gap-2">
            <label htmlFor="ai-chat-input" className="sr-only">Message the AI assistant</label>
            <textarea
              id="ai-chat-input"
              ref={textareaRef}
              rows={1}
              className="input resize-none flex-1 max-h-40 min-h-[42px]"
              placeholder="Ask about phishing, ransomware, or best practices... (Enter to send, Shift+Enter for newline)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              aria-required="true"
            />
            <button
              type="button"
              onClick={send}
              className="btn-cyber whitespace-nowrap flex items-center gap-1.5"
              disabled={loading || !input.trim()}
            >
              {loading ? <Loader label="" /> : <PaperAirplaneIcon className="h-4 w-4" />}
              <span>{loading ? 'Sending' : 'Send'}</span>
            </button>
          </div>

          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-slate-400">
              Press <kbd className="px-1 rounded bg-slate-200 dark:bg-slate-700">Enter</kbd> to send ·{' '}
              <kbd className="px-1 rounded bg-slate-200 dark:bg-slate-700">Shift</kbd>+
              <kbd className="px-1 rounded bg-slate-200 dark:bg-slate-700">Enter</kbd> for newline
            </span>
            <button
              type="button"
              onClick={clearChat}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-danger transition-colors"
            >
              <TrashIcon className="h-4 w-4" />
              Clear Chat
            </button>
          </div>
        </div>
      </div>
    </ScanShell>
  );
}
