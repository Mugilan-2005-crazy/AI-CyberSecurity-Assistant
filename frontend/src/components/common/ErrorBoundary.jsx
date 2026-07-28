import { Component } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheckIcon, ArrowPathIcon, ArrowUturnLeftIcon, HomeIcon, Squares2X2Icon } from '@heroicons/react/24/outline';

function generateErrorId() {
  return `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      errorId: generateErrorId(),
    };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Caught rendering error:', error, errorInfo);
    }
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoToDashboard = () => {
    window.location.href = '/dashboard';
  };

  handleGoHome = () => {
    window.location.href = '/home';
  };

  render() {
    if (this.state.hasError) {
      const isAuthenticated = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');
      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen flex items-center justify-center bg-surface-light dark:bg-surface-dark px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full max-w-lg"
          >
            <div className="glass rounded-3xl shadow-2xl border border-white/40 dark:border-white/10 p-8 md:p-10 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                className="mx-auto w-20 h-20 rounded-full bg-cyber-500/10 dark:bg-cyber-400/10 flex items-center justify-center mb-6"
              >
                <ShieldCheckIcon className="h-10 w-10 text-cyber-500 dark:text-cyber-400" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3"
              >
                Something went wrong
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed"
              >
                Our security systems detected an unexpected error.
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex flex-wrap justify-center gap-3 mb-6"
              >
                <button
                  onClick={this.handleTryAgain}
                  className="btn btn-cyber inline-flex items-center gap-2"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Try Again
                </button>
                <button
                  onClick={this.handleReload}
                  className="btn bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 inline-flex items-center gap-2"
                >
                  <ArrowUturnLeftIcon className="h-4 w-4" />
                  Reload Page
                </button>
                {isAuthenticated && (
                  <button
                    onClick={this.handleGoToDashboard}
                    className="btn bg-primary text-white hover:bg-indigo-500 inline-flex items-center gap-2"
                  >
                    <Squares2X2Icon className="h-4 w-4" />
                    Go to Dashboard
                  </button>
                )}
                {!isAuthenticated && (
                  <button
                    onClick={this.handleGoHome}
                    className="btn bg-primary text-white hover:bg-indigo-500 inline-flex items-center gap-2"
                  >
                    <HomeIcon className="h-4 w-4" />
                    Go Home
                  </button>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="rounded-xl bg-slate-100 dark:bg-slate-800/80 p-4 text-left"
              >
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mb-2">
                  Error ID: <span className="text-primary font-semibold">{this.state.errorId}</span>
                </p>
                {isDev && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                      Show stack trace
                    </summary>
                    <pre className="mt-2 text-xs text-danger font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">
                      {this.state.error?.toString()}
                      {this.state.error?.stack}
                    </pre>
                  </details>
                )}
              </motion.div>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
