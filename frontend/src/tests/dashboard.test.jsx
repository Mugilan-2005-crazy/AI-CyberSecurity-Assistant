import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config.js';
import Dashboard from '../pages/Dashboard.jsx';
import * as endpoints from '../services/endpoints.js';

vi.mock('../services/endpoints.js', () => {
  const actual = {
    getDashboard: vi.fn(),
    getNotifications: vi.fn(),
    getAIStatus: vi.fn(),
    getSecurityInsights: vi.fn(),
  };
  return { __esModule: true, default: actual, ...actual };
});

vi.mock('../hooks/useRealtimeDashboard.js', () => ({
  __esModule: true,
  default: () => {},
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
  for (const key of ['div', 'section', 'header', 'footer', 'nav', 'aside', 'main', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'button', 'a', 'form', 'input', 'label', 'ul', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img', 'svg', 'path', 'circle']) {
    motion[key] = createFakeComponent();
  }

  return {
    motion,
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

const renderDashboard = () =>
  render(
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>
        <Dashboard />
      </I18nextProvider>
    </BrowserRouter>
  );

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    endpoints.getDashboard.mockResolvedValue({
      totalScans: 42,
      threatsDetected: 3,
      safeScans: 39,
      securityScore: 85,
      recentActivity: [],
      riskTrends: [],
      threatCategories: [],
      kpis: {},
      compliance: { overallCompliance: 90, frameworks: [] },
      businessMetrics: {},
    });
    endpoints.getNotifications.mockResolvedValue([]);
    endpoints.getAIStatus.mockResolvedValue({ available: true });
    endpoints.getSecurityInsights.mockResolvedValue(null);
  });

  it('renders dashboard without crashing', async () => {
    renderDashboard();
    expect(document.querySelector('.space-y-6')).toBeInTheDocument();
  });

  it('shows error state when dashboard fails to load', async () => {
    endpoints.getDashboard.mockRejectedValueOnce(new Error('Failed'));
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/couldn't load/i)).toBeInTheDocument();
    });
  });
});
