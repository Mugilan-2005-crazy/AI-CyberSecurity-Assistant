import { useEffect, useRef, useState } from 'react';
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function StreamingResponse({ onComplete, onError }) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  const startStream = async (url, options = {}) => {
    setIsStreaming(true);
    setContent('');
    setError(null);

    try {
      const response = await fetch(url, {
        method: options.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}`,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const text = await response.text();
        setContent(text);
        if (onComplete) onComplete(text);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setContent((prev) => prev + parsed.content);
              }
            } catch {
              setContent((prev) => prev + data);
            }
          }
        }
      }

      reader.releaseLock();
      setIsStreaming(false);
      if (onComplete) onComplete(content);
    } catch (err) {
      setError(err.message);
      setIsStreaming(false);
      if (onError) onError(err);
    }
  };

  const stopStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setIsStreaming(false);
  };

  const clearContent = () => {
    setContent('');
    setError(null);
  };

  return {
    isStreaming,
    content,
    error,
    startStream,
    stopStream,
    clearContent,
  };
}