import { Link } from "react-router";

import { BackupPanel } from "../settings/BackupPanel";

export function Component() {
  return (
    <section className="route-page" aria-labelledby="page-title">
      <p className="page-eyebrow">PersonalOS</p>
      <h1 id="page-title">Einstellungen</h1>
      <p className="page-description">
        Passe lokale App-Einstellungen an und sichere deine Daten bewusst.
      </p>
      <BackupPanel />
      <div className="empty-state" role="note">
        <p>Lokale Entwicklungsübersicht</p>
        <span>
          Prüfe die domänenneutralen Bausteine in allen relevanten Zuständen.
        </span>
        <Link
          className="secondary-action settings-preview-link"
          to="/komponenten"
        >
          Komponentenübersicht öffnen
        </Link>
      </div>
    </section>
  );
}
