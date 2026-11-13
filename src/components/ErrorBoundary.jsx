import { Component } from 'react';
import { resetSavedAppData } from '../lib/workingDraft.js';
import './ErrorBoundary.css';

export const E2eCrashTrigger = () => {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('e2e_crash') === '1') {
    throw new Error('NPV Lab e2e crash trigger');
  }
  return null;
};

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('NPV Lab failed to render', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    resetSavedAppData();
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="app-error-screen">
        <div className="app-error-card">
          <p className="app-error-eyebrow">NPV Lab</p>
          <h1>Something went wrong</h1>
          <p>
            The calculator hit an unexpected error. You can reload and try again, or reset locally
            saved data if a stored project looks like it is causing the problem.
          </p>
          <div className="app-error-actions">
            <button type="button" className="app-error-button-primary" onClick={this.handleReload}>
              Reload
            </button>
            <button type="button" className="app-error-button-secondary" onClick={this.handleReset}>
              Reset saved data
            </button>
          </div>
        </div>
      </div>
    );
  }
}
