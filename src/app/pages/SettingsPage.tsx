import { Link } from "react-router";

import { AppPreferencesPanel } from "../settings/AppPreferencesPanel";
import { BackupPanel } from "../settings/BackupPanel";
import { LocalDataPanel } from "../settings/LocalDataPanel";
import "./settings-page.css";

export function Component() {
  return (
    <section className="route-page" aria-labelledby="page-title">
      <header className="page-header">
        <div className="page-header-copy">
          <p className="page-eyebrow">PersonalOS</p>
          <h1 id="page-title">Einstellungen</h1>
          <p className="page-description">
            Passe lokale App-Einstellungen an und sichere deine Daten bewusst.
          </p>
        </div>
      </header>
      <div className="settings-grid">
        <AppPreferencesPanel />
        <BackupPanel />
        <LocalDataPanel />
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
      </div>
    </section>
  );
}
