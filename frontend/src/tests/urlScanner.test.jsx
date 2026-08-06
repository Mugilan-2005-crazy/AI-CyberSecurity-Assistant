import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UrlScanner from '../pages/modules/UrlScanner.jsx';
import api from '../services/api.js';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config.js';

vi.mock('../services/api.js', () => ({
  default: {
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  setToken: vi.fn(),
}));

vi.mock('@heroicons/react/24/outline', () => {
  const MockIcon = (props) => <span data-testid="icon" {...props} />;
  return {
    ...vi.importActual('@heroicons/react/24/outline'),
    LinkIcon: MockIcon,
    SparklesIcon: MockIcon,
    ExclamationTriangleIcon: MockIcon,
    InformationCircleIcon: MockIcon,
    CheckCircleIcon: MockIcon,
    XCircleIcon: MockIcon,
    ArrowRightIcon: MockIcon,
  };
});

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

describe('URL Scanner Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input field for URL entry', () => {
    renderWithI18n(<UrlScanner />);
    const urlInput = screen.getByRole('textbox');
    expect(urlInput).toBeInTheDocument();
  });

  it('renders scan button', () => {
    renderWithI18n(<UrlScanner />);
    const scanButton = screen.getByRole('button', { name: /scan/i });
    expect(scanButton).toBeInTheDocument();
  });

  it('submits URL for scanning', async () => {
    api.post.mockResolvedValueOnce({
      success: true,
      result: { verdict: 'safe', threats: [] },
    });

    const user = userEvent.setup();
    renderWithI18n(<UrlScanner />);
    const urlInput = screen.getByRole('textbox');
    await user.type(urlInput, 'https://example.com');
    await user.click(screen.getByRole('button', { name: /scan/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/scan/url', expect.objectContaining({
        url: 'https://example.com',
      }));
    });
  });

  it('displays loading state during scan', async () => {
    api.post.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, result: { verdict: 'safe' } }), 100))
    );

    const user = userEvent.setup();
    renderWithI18n(<UrlScanner />);
    await user.type(screen.getByRole('textbox'), 'https://example.com');
    await user.click(screen.getByRole('button', { name: /scan/i }));

    const loadingRegion = document.querySelector('[aria-busy="true"]');
    expect(loadingRegion).toBeInTheDocument();
  });
});
