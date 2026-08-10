import { Link, NavLink } from "react-router";

import { NavigationIcon } from "./icons";
import {
  primaryNavigationItems,
  secondaryNavigationItems,
  type NavigationArea,
} from "./navigation-items";

/**
 * Auf Desktop ist Platz für die Unterbereiche; sie stehen eingerückt unter
 * ihrem Bereich, statt hinter einem Reiter zu warten. Die Reihenfolge ist
 * dieselbe wie im mobilen Band, damit sich beide Größen gleich anfühlen.
 */
export function DesktopNavigation() {
  return (
    <aside className="desktop-sidebar">
      <Link className="brand-link" to="/" aria-label="PersonalOS – Heute">
        <span className="brand-mark" aria-hidden="true">
          P
        </span>
        <span>PersonalOS</span>
      </Link>

      <nav aria-label="Hauptnavigation">
        <ul className="desktop-nav-list">
          {primaryNavigationItems.map((area) => (
            <AreaEntry area={area} key={area.to} />
          ))}
        </ul>
      </nav>

      <nav aria-label="Nebenbereiche">
        <ul className="desktop-nav-list desktop-nav-secondary">
          {secondaryNavigationItems.map((area) => (
            <AreaEntry area={area} key={area.to} />
          ))}
        </ul>
      </nav>

      <p className="sidebar-note">Privat auf diesem Gerät</p>
    </aside>
  );
}

function AreaEntry({ area }: { area: NavigationArea }) {
  return (
    <li>
      <NavLink
        className={({ isActive }) =>
          `navigation-link${isActive ? " navigation-link-active" : ""}`
        }
        end={area.to === "/"}
        to={area.to}
      >
        <NavigationIcon name={area.icon} />
        {area.label}
      </NavLink>

      {area.items.length > 0 ? (
        <ul className="desktop-subnav-list">
          {area.items.map((item) => (
            <li key={item.to}>
              <NavLink
                className={({ isActive }) =>
                  `navigation-sublink${isActive ? " navigation-link-active" : ""}`
                }
                to={item.to}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
