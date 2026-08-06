/**
 * components/common/ErrorBoundary.jsx
 * ------------------------------------------------------------
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing the
 * whole app.
 */
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (typeof reportError === 'function') {
      reportError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-lg dark:border-red-800 dark:bg-slate-800">
            <h2 className="mb-2 text-xl font-bold text-red-600 dark:text-red-400">Something went wrong</h2>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              An unexpected error occurred. Please refresh the page or contact support.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
