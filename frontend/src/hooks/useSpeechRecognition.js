import { useState, useRef, useEffect, useCallback } from 'react';

const SUPPORTED_LANGUAGES = {
  en: 'en-US',
  ta: 'ta-IN',
  hi: 'hi-IN',
};

export function useSpeechRecognition() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const recordingRef = useRef(false);
  const languageRef = useRef('en-US');

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = languageRef.current;

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcriptSegment;
        } else {
          interimTranscript += transcriptSegment;
        }
      }
      setTranscript(finalTranscriptRef.current + interimTranscript);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;
      if (event.error === 'audio-capture') {
        setError('No microphone found. Please check your device.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone usage.');
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      recordingRef.current = false;
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (recordingRef.current) {
        try {
          recognition.start();
        } catch {
          recordingRef.current = false;
          setIsRecording(false);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const startRecording = useCallback(async (lang) => {
    finalTranscriptRef.current = '';
    setTranscript('');
    setError(null);

    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    if (lang) {
      languageRef.current = lang;
      recognitionRef.current.lang = lang;
    }

    try {
      recognitionRef.current.start();
      recordingRef.current = true;
      setIsRecording(true);
    } catch (err) {
      if (err.name === 'AlreadyStartedError') {
        return;
      }
      setError(`Failed to start recording: ${err.message}`);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }
    recordingRef.current = false;
    setIsRecording(false);
  }, []);

  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
    setTranscript('');
    setError(null);
  }, []);

  const setLanguage = useCallback((lang) => {
    languageRef.current = lang;
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang;
    }
  }, []);

  return {
    isRecording,
    transcript,
    error,
    startRecording,
    stopRecording,
    resetTranscript,
    setLanguage,
    isSupported: !!window.SpeechRecognition || !!window.webkitSpeechRecognition,
  };
}

export default useSpeechRecognition;