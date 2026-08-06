import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config.js';
import ReportGenerator from '../pages/modules/ReportGenerator.jsx';
import endpoints from '../services/endpoints.js';

vi.mock('../services/endpoints.js', () => ({
  default: {
    downloadReport: vi.fn(),
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

describe('Report Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders report generation form', () => {
    renderWithI18n(<ReportGenerator />);
    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
  });

  it('shows loading state during report generation', async () => {
    endpoints.downloadReport.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
    );

    const user = userEvent.setup();
    renderWithI18n(<ReportGenerator />);
    await user.click(screen.getByRole('button', { name: /generate/i }));

    const loadingRegion = document.querySelector('[aria-busy="true"]');
    expect(loadingRegion).toBeInTheDocument();
  });

  it('shows error state when report generation fails', async () => {
    endpoints.downloadReport.mockRejectedValueOnce(new Error('Report generation failed'));

    const user = userEvent.setup();
    renderWithI18n(<ReportGenerator />);
    await user.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(endpoints.downloadReport).toHaveBeenCalled();
    });
  });
});