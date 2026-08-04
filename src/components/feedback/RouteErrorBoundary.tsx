import { isRouteErrorResponse, useRouteError } from "react-router";

export function RouteErrorBoundary() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `Fehler ${error.status}`
    : "Unerwarteter Darstellungsfehler";

  return (
    <main className="centered-state" role="alert">
      <p className="state-kicker">{detail}</p>
      <h1>Dieser Bereich konnte nicht angezeigt werden.</h1>
      <p>
        Die übrige App bleibt unverändert. Kehre zur Tagesübersicht zurück oder
        lade die Ansicht neu.
      </p>
      <div className="state-actions">
        <a className="primary-action" href="/">
          Zur Tagesübersicht
        </a>
        <button
          className="secondary-action"
          onClick={() => window.location.reload()}
          type="button"
        >
          Neu laden
        </button>
      </div>
    </main>
  );
}
