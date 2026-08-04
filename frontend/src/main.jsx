/**
 * main.jsx
 * ------------------------------------------------------------
 * React entry point. Registers the Chart.js components used by
 * the dashboard/admin charts and wraps the app in the Auth and
 * Theme providers.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import Loader from './components/ui/Loader.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <React.Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader label="Loading…" /></div>}>
              <App />
            </React.Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
