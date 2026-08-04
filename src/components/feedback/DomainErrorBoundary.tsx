import { useRouteError } from "react-router";

import { RouteErrorState } from "./RouteErrorState";

/**
 * Grenze für eine einzelne Domänenroute. Sie ersetzt nur den Inhaltsbereich,
 * damit Navigation, Theme und alle übrigen Bereiche bedienbar bleiben.
 */
export function DomainErrorBoundary() {
  const error = useRouteError();

  return (
    <section className="centered-state" role="alert">
      <RouteErrorState error={error} />
    </section>
  );
}
