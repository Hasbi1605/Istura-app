import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

type AdminErrorBoundaryProps = {
  children: ReactNode;
  onBackToPublic: () => void;
};

type AdminErrorBoundaryState = {
  hasError: boolean;
};

export class AdminErrorBoundary extends Component<
  AdminErrorBoundaryProps,
  AdminErrorBoundaryState
> {
  state: AdminErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AdminErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Admin panel render failed", error, info);
  }

  private backToPublic = () => {
    this.setState({ hasError: false });
    this.props.onBackToPublic();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="admin-error-boundary" role="alert">
        <div className="admin-error-boundary-card">
          <AlertTriangle size={34} aria-hidden="true" />
          <h1>Panel admin mengalami kendala</h1>
          <p>
            Data yang sudah tersimpan tetap aman. Muat ulang panel untuk mencoba kembali,
            atau kembali ke sisi publik.
          </p>
          <div className="admin-error-boundary-actions">
            <button type="button" className="button button-primary" onClick={() => window.location.reload()}>
              <RefreshCw size={16} aria-hidden="true" />
              Muat ulang panel
            </button>
            <button type="button" className="button button-ghost" onClick={this.backToPublic}>
              <ArrowLeft size={16} aria-hidden="true" />
              Kembali ke publik
            </button>
          </div>
        </div>
      </div>
    );
  }
}
