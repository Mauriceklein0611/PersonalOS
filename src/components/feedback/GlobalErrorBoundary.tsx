import { Component, type ReactNode } from "react";

type GlobalErrorBoundaryProps = {
  children: ReactNode;
};

type GlobalErrorBoundaryState = {
  hasError: boolean;
};

export class GlobalErrorBoundary extends Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  public state: GlobalErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(): void {
    // Intentionally local-only: no telemetry or user content leaves the device.
  }

  public render() {
    if (this.state.hasError) {
      return (
        <main className="centered-state" role="alert">
          <p className="state-kicker">PersonalOS konnte nicht weiterladen</p>
          <h1>Etwas ist schiefgelaufen.</h1>
          <p>
            Deine lokalen Daten wurden dadurch nicht verändert. Lade die Ansicht
            neu, um es erneut zu versuchen.
          </p>
          <button
            className="primary-action"
            onClick={() => window.location.reload()}
            type="button"
          >
            Ansicht neu laden
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
