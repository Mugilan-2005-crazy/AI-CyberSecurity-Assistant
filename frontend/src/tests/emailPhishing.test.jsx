import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config.js';
import EmailPhishing from '../pages/modules/EmailPhishing.jsx';
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
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn() }),
    useInView: () => false,
    useScroll: () => ({ scrollX: 0, scrollY: 0, scrollXProgress: 0, scrollYProgress: 0 }),
    useTransform: (val) => val,
    useSpring: (val) => val,
    useMotionValue: (val) => ({ get: () => val, set: vi.fn() }),
    useTime: () => ({ get: () => 0 }),
    useVelocity: () => ({ get: () => 0 }),
  };
});

const renderWithI18n = (component) =>
  render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);

describe('Email Phishing Detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email input field', () => {
    renderWithI18n(<EmailPhishing />);
    expect(screen.getByLabelText(/sender/i)).toBeInTheDocument();
  });

  it('renders body text area', () => {
    renderWithI18n(<EmailPhishing />);
    expect(screen.getByLabelText(/paste the raw email/i)).toBeInTheDocument();
  });

  it('renders analyze button', () => {
    renderWithI18n(<EmailPhishing />);
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();
  });

  it('submits email content for phishing detection', async () => {
    api.post.mockResolvedValueOnce({
      success: true,
      result: { verdict: 'phishing', riskScore: 85 },
    });

    const user = userEvent.setup();
    renderWithI18n(<EmailPhishing />);
    await user.type(screen.getByLabelText(/sender/i), 'phisher@evil.com');
    await user.type(screen.getByLabelText(/paste the raw email/i), 'Click this link to verify your account');
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/scan/email?ai=false', expect.objectContaining({
        body: 'Click this link to verify your account',
        sender: 'phisher@evil.com',
      }));
    });
  });

  it('shows loading state during analysis', async () => {
    api.post.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, result: { verdict: 'safe' } }), 100))
    );

    const user = userEvent.setup();
    renderWithI18n(<EmailPhishing />);
    await user.type(screen.getByLabelText(/paste the raw email/i), 'Test email content');
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    const loadingRegion = document.querySelector('[aria-busy="true"]');
    await waitFor(() => {
      expect(loadingRegion).toBeInTheDocument();
    });
  });

  it('shows error state when analysis fails', async () => {
    api.post.mockRejectedValueOnce(new Error('Analysis failed'));

    const user = userEvent.setup();
    renderWithI18n(<EmailPhishing />);
    await user.type(screen.getByLabelText(/paste the raw email/i), 'Test email content');
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    await waitFor(() => {
      expect(screen.getByText(/analysis failed/i)).toBeInTheDocument();
    });
  });

  it('shows empty state before analysis', () => {
    renderWithI18n(<EmailPhishing />);
    expect(screen.getByText(/no analysis yet/i)).toBeInTheDocument();
  });
});