import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config.js';
import QrChecker from '../pages/modules/QrChecker.jsx';
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

describe('QR Code Scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders camera start button', () => {
    renderWithI18n(<QrChecker />);
    expect(screen.getByRole('button', { name: /start camera/i })).toBeInTheDocument();
  });

  it('renders QR text input', () => {
    renderWithI18n(<QrChecker />);
    expect(screen.getByLabelText(/paste/i)).toBeInTheDocument();
  });

  it('renders check button', () => {
    renderWithI18n(<QrChecker />);
    expect(screen.getByRole('button', { name: /check/i })).toBeInTheDocument();
  });

  it('shows empty state before scanning', () => {
    renderWithI18n(<QrChecker />);
    expect(screen.getByText(/no qr scanned/i)).toBeInTheDocument();
  });

  it('shows error state when check fails', async () => {
    api.post.mockRejectedValueOnce(new Error('Check failed'));

    const user = userEvent.setup();
    renderWithI18n(<QrChecker />);
    await user.type(screen.getByLabelText(/paste/i), 'https://malicious.example.com');
    await user.click(screen.getByRole('button', { name: /check/i }));

    await waitFor(() => {
      expect(screen.getByText(/check failed/i)).toBeInTheDocument();
    });
  });
});