/**
 * context/ThemeContext.jsx
 * ------------------------------------------------------------
 * Manages light/dark/system theme, persisted to localStorage and
 * reflected on the <html> element via the `dark` class (which
 * Tailwind's darkMode:'class' reads). The 'system' mode follows
 * the OS `prefers-color-scheme` preference and reacts to changes.
 */
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

// Resolve the effective theme for the <html> class.
const effective = (t) => {
  if (t === 'system') {
    return typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return t;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.classList.toggle('dark', effective(theme) === 'dark');
      localStorage.setItem('theme', theme);
    };
    apply();

    // Follow OS changes only while in 'system' mode.
    if (theme !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
