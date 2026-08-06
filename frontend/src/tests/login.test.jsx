import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config.js';
import Login from '../pages/Login.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import api from '../services/api.js';

vi.mock('../services/api.js', () => ({
  default: {
    get: vi.fn(),
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

const renderLogin = () =>
  render(
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </I18nextProvider>
    </BrowserRouter>
  );

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ user: { id: '1', email: 'test@example.com', role: 'user' } });
  });

  it('renders login form with email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it('renders submit button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation error for empty fields on submit', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: /sign in/i }));
  });

  it('calls login API with correct credentials', async () => {
    api.post.mockResolvedValueOnce({
      accessToken: 'test-token',
      user: { id: '1', email: 'test@example.com', role: 'user' },
    });

    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login-enhanced', expect.objectContaining({
        email: 'test@example.com',
        password: 'Password123!',
      }));
    });
  });

  it('shows error on failed login', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { message: 'Invalid credentials' } } });

    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/^email$/i), 'wrong@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
