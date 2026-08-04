import { useRouteError } from "react-router";

import { RouteErrorState } from "./RouteErrorState";

/**
 * Grenze für die App-Shell selbst. Sie ersetzt das gesamte Layout und wird
 * nur erreicht, wenn schon der Rahmen nicht dargestellt werden kann.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();

  return (
    <main className="centered-state" role="alert">
      <RouteErrorState error={error} />
    </main>
  );
}
