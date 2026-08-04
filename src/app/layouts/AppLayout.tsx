import { Link, Outlet, useNavigation } from "react-router";

import { OfflineIndicator } from "../../components/feedback/OfflineIndicator";
import { DesktopNavigation } from "../navigation/DesktopNavigation";
import { MobileNavigation } from "../navigation/MobileNavigation";
import { ThemeSwitcher } from "../theme/ThemeSwitcher";

export function AppLayout() {
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Zum Inhalt springen
      </a>

      <DesktopNavigation />

      <div className="shell-column">
        <header className="top-bar">
          <Link className="mobile-brand" to="/" aria-label="PersonalOS – Heute">
            PersonalOS
          </Link>
          <div className="top-bar-actions">
            <OfflineIndicator />
            <ThemeSwitcher />
          </div>
        </header>

        {isLoading ? (
          <div className="navigation-progress" role="status" aria-live="polite">
            Bereich wird geladen …
          </div>
        ) : null}

        <main className="main-content" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <MobileNavigation />
    </div>
  );
}
