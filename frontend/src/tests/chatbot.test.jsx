import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config.js';
import Chatbot from '../pages/modules/Chatbot.jsx';
import api from '../services/api.js';

vi.mock('../services/api.js', () => ({
  default: {
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  setToken: vi.fn(),
}));

vi.mock('framer-motion', () => {
  const createFakeComponent = (props = {}) => {
    const { initial, animate, exit, transition, whileHover, whileTap, whileFocus, whileDrag, variants, ...rest } = props || {};
    const filtered = Object.fromEntries(Object.entries(rest).filter(([_, v]) => v !== undefined && v !== false));
    return (props2 = {}) => {
      const { children, ...innerRest } = props2 || {};
      const merged = { ...filtered, ...innerRest };
      const { as: AsComp = 'div', ...finalRest } = merged;
      const Comp = typeof AsComp === 'string' ? AsComp : 'div';
      return <Comp {...finalRest}>{children}</Comp>;
    };
  };

  const motion = {};
  for (const key of ['div', 'section', 'header', 'footer', 'nav', 'aside', 'main', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'button', 'a', 'form', 'input', 'label', 'ul', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img', 'svg', 'path']) {
    motion[key] = createFakeComponent();
  }

  return {
    motion,
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

const renderChatbot = () =>
  render(
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>
        <Chatbot />
      </I18nextProvider>
    </BrowserRouter>
  );

describe('Chatbot Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chat interface with greeting', () => {
    renderChatbot();
    expect(screen.getByText(/ask me anything about cybersecurity/i)).toBeInTheDocument();
  });

  it('sends a message and displays response', async () => {
    api.post.mockResolvedValueOnce({ reply: 'This is a test AI response.' });

    const user = userEvent.setup();
    renderChatbot();
    const input = screen.getByPlaceholderText(/ask about phishing/i);
    await user.type(input, 'What is phishing?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('What is phishing?')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('This is a test AI response.')).toBeInTheDocument();
    });
  });

  it('shows error state when AI fails', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { message: 'AI unavailable' } } });

    const user = userEvent.setup();
    renderChatbot();
    const input = screen.getByPlaceholderText(/ask about phishing/i);
    await user.type(input, 'Test');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/ai unavailable/i)).toBeInTheDocument();
    });
  });
});
