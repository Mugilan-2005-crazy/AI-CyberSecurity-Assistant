import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config.js';
import FileScanner from '../pages/modules/FileScanner.jsx';
import api from '../services/api.js';

vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

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

describe('File Malware Scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders file input', () => {
    renderWithI18n(<FileScanner />);
    expect(screen.getByLabelText(/file to scan/i)).toBeInTheDocument();
  });

  it('renders scan button', () => {
    renderWithI18n(<FileScanner />);
    expect(screen.getByRole('button', { name: /scan/i })).toBeInTheDocument();
  });

  it('shows empty state before scanning', () => {
    renderWithI18n(<FileScanner />);
    expect(screen.getByText(/no file scanned/i)).toBeInTheDocument();
  });

  it('shows error state when scan fails', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { message: 'Scan failed' } } });

    renderWithI18n(<FileScanner />);
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = await screen.findByLabelText(/file to scan/i);

    await waitFor(() => {
      expect(input).toBeInTheDocument();
    });

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(screen.getByText(/scan failed/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});