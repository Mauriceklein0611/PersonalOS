import { NavLink } from "react-router";

import { NavigationIcon } from "./icons";
import { primaryNavigationItems } from "./navigation-items";

/**
 * Genau vier Einträge, jeder mit Icon und ausgeschriebener Beschriftung.
 *
 * Das Überlaufmenü ist entfallen. Es lag vorher zwischen dem Daumen und vier
 * von acht Bereichen — darunter die Finanzen, die eine der häufigsten
 * Erfassungsaktionen tragen. Auswertung und Einstellungen stehen jetzt in der
 * Kopfzeile; sie werden wöchentlich gebraucht, nicht stündlich.
 */
export function MobileNavigation() {
  return (
    <nav className="mobile-navigation" aria-label="Hauptnavigation mobil">
      <div className="mobile-nav-row">
        {primaryNavigationItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `mobile-nav-link${isActive ? " navigation-link-active" : ""}`
            }
            end={item.to === "/"}
            key={item.to}
            to={item.to}
          >
            <NavigationIcon name={item.icon} />
            <span className="mobile-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
