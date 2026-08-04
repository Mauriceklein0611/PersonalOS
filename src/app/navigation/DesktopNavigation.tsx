import { Link, NavLink } from "react-router";

import { navigationItems } from "./navigation-items";

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
          {navigationItems.map((item) => (
            <li key={item.to}>
              <NavLink
                className={({ isActive }) =>
                  `navigation-link${isActive ? " navigation-link-active" : ""}`
                }
                end={item.to === "/"}
                to={item.to}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <p className="sidebar-note">Privat auf diesem Gerät</p>
    </aside>
  );
}
