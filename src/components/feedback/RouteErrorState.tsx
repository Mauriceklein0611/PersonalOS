import { isRouteErrorResponse } from "react-router";

type RouteErrorStateProps = {
  error: unknown;
};

/**
 * Der Inhalt ist für beide Fehlergrenzen gleich. Es wird bewusst keine
 * Fehlermeldung und kein Datensatz ausgegeben, sondern nur eine stabile
 * Einordnung mit einem Weg zurück.
 */
export function RouteErrorState({ error }: RouteErrorStateProps) {
  const detail = isRouteErrorResponse(error)
    ? `Fehler ${error.status}`
    : "Unerwarteter Darstellungsfehler";

  return (
    <>
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
    </>
  );
}
