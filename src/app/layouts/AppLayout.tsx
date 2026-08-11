import { useRef } from "react";
import { Link, NavLink, Outlet, useNavigation } from "react-router";

import { OfflineIndicator } from "../../components/feedback/OfflineIndicator";
import { NavigationIcon } from "../navigation/icons";
import { DesktopNavigation } from "../navigation/DesktopNavigation";
import { MobileNavigation } from "../navigation/MobileNavigation";
import { secondaryNavigationItems } from "../navigation/navigation-items";
import { ThemeSwitcher } from "../theme/ThemeSwitcher";
import { useRouteAnnouncement } from "./use-route-announcement";

export function AppLayout() {
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";
  const mainRef = useRef<HTMLElement>(null);

  useRouteAnnouncement(mainRef, isLoading);

  return (
    <div className="app-frame">
      {/* Der Farbnebel liegt hinter allem und ist rein dekorativ. */}
      <div aria-hidden="true" className="app-canvas" />

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
            {/*
              Auswertung und Einstellungen: zwei Nebenbereiche, die wöchentlich
              gebraucht werden. Sie stehen hier statt im Band, damit dort die
              vier täglichen Bereiche allein bleiben. Auf Desktop trägt sie
              zusätzlich die Seitenleiste.
            */}
            <nav aria-label="Nebenbereiche" className="top-bar-nav">
              {secondaryNavigationItems.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    `top-bar-nav-link${isActive ? " navigation-link-active" : ""}`
                  }
                  key={item.to}
                  title={item.label}
                  to={item.to}
                >
                  <NavigationIcon name={item.icon} />
                  <span className="visually-hidden">{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <ThemeSwitcher />
          </div>
        </header>

        {isLoading ? (
          <div className="navigation-progress" role="status" aria-live="polite">
            Bereich wird geladen …
          </div>
        ) : null}

        <main
          className="main-content"
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>

      <MobileNavigation />
    </div>
  );
}
