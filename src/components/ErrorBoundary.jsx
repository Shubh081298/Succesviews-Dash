import { Component } from "react";

/**
 * ErrorBoundary — top-level crash guard. Any render error below it shows a
 * friendly recovery screen instead of a blank white page, and logs the error.
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
    // Hook a real monitoring service (e.g. Sentry) here in production.
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            fontFamily: "'DM Sans', system-ui, sans-serif",
            background: "#F2F5FF",
            color: "#0F172A",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#475569", maxWidth: 420, margin: 0 }}>
            The page hit an unexpected error. Reloading usually fixes it. If it keeps
            happening, please contact support.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 6,
              padding: "10px 20px",
              background: "#162B55",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
          <pre
            style={{
              marginTop: 10,
              maxWidth: 480,
              maxHeight: 160,
              overflow: "auto",
              fontSize: 11,
              color: "#94A3B8",
              whiteSpace: "pre-wrap",
            }}
          >
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
