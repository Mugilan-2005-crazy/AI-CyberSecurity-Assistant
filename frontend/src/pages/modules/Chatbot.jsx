/**
 * pages/modules/Chatbot.jsx
 * Module 5 — AI Security Chatbot (Phase 2 polish).
 * Reuses POST /chat/message. Adds glass shell, accessible chat
 * log, typing indicator, empty/greeting state, and ARIA live
 * region for screen readers.
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import api from '../../services/api.js';
import ScanShell from '../../components/modules/ScanShell.jsx';
import Loader from '../../components/ui/Loader.jsx';
import StateView from '../../components/ui/StateView.jsx';

const GREETING = { role: 'model', parts: [{ text: 'Hello! Ask me anything about cybersecurity. 🔐' }] };

export default function Chatbot() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const next = [...messages, { role: 'user', parts: [{ text: input }] }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const history = next.slice(0, -1).map((m) => ({ role: m.role, text: m.parts?.[0]?.text || m.text }));
      const r = await api.post('/chat/message', { message: input, history });
      setMessages([...next, { role: 'model', parts: [{ text: r.reply }] }]);
    } catch (err) {
      setMessages([...next, { role: 'model', parts: [{ text: '⚠ ' + (err.response?.data?.message || 'Error talking to AI') }] }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScanShell title={t('chatbot.title')} description={t('chatbot.description')} icon={ChatBubbleLeftRightIcon} max="max-w-3xl">
      <div className="h-[60vh] flex flex-col" role="log" aria-live="polite" aria-label="Chat conversation">
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.length === 1 && messages[0].role === 'model' && (
            <StateView type="empty" title={t('chatbot.startConversation')} message={t('chatbot.placeholder')} />
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                m.role === 'user' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700'
              }`}>
                {m.parts[0].text}
              </div>
            </div>
          ))}
          {loading && <div className="justify-start flex"><div className="bg-slate-200 dark:bg-slate-700 rounded-2xl px-4 py-2"><Loader label={t('chatbot.aiThinking')} /></div></div>}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="flex gap-2 pt-3">
          <label htmlFor="chat" className="sr-only">{t('chatbot.placeholder')}</label>
          <input id="chat" className="input" placeholder={t('chatbot.placeholder')} value={input}
            onChange={(e) => setInput(e.target.value)} aria-required="true" />
          <button className="btn-cyber" disabled={loading}>{t('chatbot.send')}</button>
        </form>
      </div>
    </ScanShell>
  );
}
