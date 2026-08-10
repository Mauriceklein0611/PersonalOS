import { Component, type ReactNode } from "react";

type ChartErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type ChartErrorBoundaryState = {
  hasError: boolean;
};

/**
 * Grenze um eine einzelne Zeichenfläche.
 *
 * Ohne sie steigt ein Fehler aus der Diagrammbibliothek bis zur Routengrenze
 * auf und ersetzt die ganze Seite. Genau das ist in #107 passiert: Ein
 * `formatValue`, das an einem berechneten Achsen-Teilstrich wirft, riss die
 * Finanzseite weg, während ein Test noch auf ihr klickte — das sah nach einem
 * wandernden Layout aus, war aber ein Totalausfall der Ansicht.
 *
 * Ein Diagramm ist eine Darstellung, keine Datenquelle. Fällt es aus, bleiben
 * Überschrift, Zeitraum, Datenbasis, Legende und die Wertetabelle stehen, und
 * alles andere auf der Seite bleibt bedienbar.
 */
export class ChartErrorBoundary extends Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  public state: ChartErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ChartErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(): void {
    // Bewusst nur lokal: Es verlässt keine Meldung und kein Wert das Gerät.
  }

  public render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
