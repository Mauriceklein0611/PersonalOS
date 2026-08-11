import { Link } from "react-router";

import { PageToolbar } from "../../components/ui";
import { AppPreferencesPanel } from "../settings/AppPreferencesPanel";
import { BackupPanel } from "../settings/BackupPanel";
import { LocalDataPanel } from "../settings/LocalDataPanel";
import "./settings-page.css";

export function Component() {
  return (
    <section
      className="route-page settings-page"
      aria-labelledby="page-title"
      data-surface="settings"
    >
      <PageToolbar
        description="Passe lokale App-Einstellungen an, prüfe den Browser-Speicher und sichere deine Daten bewusst. Hosting ist keine Synchronisation."
        eyebrow="Local-first"
        surface="settings"
        title="Einstellungen"
      />
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
