import { NavLink, Outlet, useLocation } from "react-router";

import { findAreaForPath } from "../navigation/navigation-items";

/**
 * Rahmen eines Hauptbereichs mit seinen Unterbereichen.
 *
 * Der Rahmen lädt keine Domänenansicht selbst, er stellt nur die Reiter davor.
 * Damit bleibt jede Domainseite unverändert und für sich lauffähig, und keine
 * Domain importiert die Oberfläche einer anderen (`AGENTS.md` §3).
 */
export function AreaLayout() {
  const location = useLocation();
  const area = findAreaForPath(location.pathname);

  return (
    <>
      {area ? (
        <nav aria-label={`${area.label}: Unterbereiche`} className="area-tabs">
          <ul className="area-tab-list">
            {area.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  className={({ isActive }) =>
                    `area-tab${isActive ? " area-tab-active" : ""}`
                  }
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <Outlet />
    </>
  );
}
