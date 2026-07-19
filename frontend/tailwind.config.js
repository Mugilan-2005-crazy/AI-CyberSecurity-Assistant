/* tailwind.config.js
 * ------------------------------------------------------------
 * Tailwind theme extension: custom cyber color palette (used
 * across the app), dark mode via class strategy, and animation
 * keyframes for the modern UI (fade, float, glow).
 */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          900: '#064e3b',
        },
        danger: '#ef4444',
        warning: '#f59e0b',
        primary: '#6366f1',
        surface: {
          light: '#f8fafc',
          dark: '#0f172a',
          card: '#1e293b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-in',
        float: 'float 6s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        glow: { '0%': { boxShadow: '0 0 5px #10b981' }, '100%': { boxShadow: '0 0 20px #10b981' } },
      },
    },
  },
  plugins: [],
};
