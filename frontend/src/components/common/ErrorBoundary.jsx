import { Component } from 'react';

/**
 * Top-level React error boundary. Catches any uncaught error from the
 * subtree and renders a visible message + reset button instead of letting
 * React unmount the whole app and leave a totally blank page.
 *
 * Mounted at the root of App.jsx so a crash anywhere — Three.js geometry,
 * a stray null-deref, a bad Suspense load — still leaves the user with
 * something to read and a way out.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Log so devtools shows it; users can screenshot for support.
    console.error('[ErrorBoundary] Caught render error:', error, info?.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error?.message || String(this.state.error);
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#0a0a12',
          color: '#e5e7eb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          zIndex: 2147483647,
        }}
      >
        <div style={{ maxWidth: 560, width: '100%' }}>
          <div style={{ fontSize: 11, color: '#ef4444', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
            Render Error
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
            Something hit an unexpected state.
          </h1>
          <pre
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8,
              padding: 14,
              fontSize: 12,
              color: '#fca5a5',
              whiteSpace: 'pre-wrap',
              overflow: 'auto',
              maxHeight: 240,
              marginBottom: 16,
            }}
          >
            {message}
          </pre>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={this.reset}
              style={{
                flex: 1,
                padding: '10px 14px',
                background: '#fff',
                color: '#0a0a0a',
                border: 0,
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                flex: 1,
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.06)',
                color: '#d1d5db',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Go to dashboard
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 16 }}>
            If this keeps happening, hard-refresh (Ctrl+Shift+R) to clear any stale cached bundle.
          </p>
        </div>
      </div>
    );
  }
}
