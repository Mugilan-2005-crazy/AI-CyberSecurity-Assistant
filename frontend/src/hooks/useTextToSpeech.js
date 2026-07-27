import { useState, useRef, useCallback, useEffect } from 'react';

const VOICE_MAP = {
  en: 'en-US',
  ta: 'ta-IN',
  tanglish: 'en-IN',
  hi: 'hi-IN',
};

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const utteranceRef = useRef(null);
  const voicesRef = useRef([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.speechSynthesis) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    loadVoices();

    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (speechSynthesis) {
        speechSynthesis.cancel();
        if (speechSynthesis.onvoiceschanged !== undefined) {
          speechSynthesis.onvoiceschanged = null;
        }
      }
    };
  }, []);

  const getVoiceForLanguage = useCallback((lang) => {
    const targetLang = VOICE_MAP[lang] || 'en-US';
    const voices = voicesRef.current;
    if (!voices.length) return null;

    const voice = voices.find((v) => v.lang.startsWith(targetLang));
    if (voice) return voice;

    return voices.find((v) => v.lang.startsWith('en')) || null;
  }, []);

  const speak = useCallback((text, language = 'en') => {
    if (typeof window === 'undefined') return;
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getVoiceForLanguage(language);
    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = VOICE_MAP[language] || 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setSpokenText(text);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpokenText('');
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpokenText('');
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [getVoiceForLanguage]);

  const stop = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSpokenText('');
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    spokenText,
    isSupported: typeof window !== 'undefined' && !!window.speechSynthesis,
  };
}

export default useTextToSpeech;