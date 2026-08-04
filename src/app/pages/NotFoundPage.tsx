import { Link } from "react-router";

export function Component() {
  return (
    <section className="route-page not-found" aria-labelledby="page-title">
      <p className="page-eyebrow">Fehler 404</p>
      <h1 id="page-title">Diese Seite gibt es nicht.</h1>
      <p className="page-description">
        Der aufgerufene Pfad gehört zu keinem Bereich von PersonalOS.
      </p>
      <Link className="primary-action" to="/">
        Zur Tagesübersicht
      </Link>
    </section>
  );
}
