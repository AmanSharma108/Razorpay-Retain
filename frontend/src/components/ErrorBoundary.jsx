import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // In production, send to observability platform (e.g. Sentry / Datadog)
    console.error('Uncaught React runtime error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-slate-900/90 border border-red-500/30 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center space-x-4 mb-6">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Something went wrong</h1>
                <p className="text-sm text-slate-400">An unexpected rendering error occurred</p>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-lg p-4 border border-slate-800 text-xs font-mono text-slate-300 mb-6 overflow-x-auto max-h-40">
              {this.state.error?.toString() || 'Unknown application error'}
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Go to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
