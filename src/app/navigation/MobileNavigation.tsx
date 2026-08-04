import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router";

import {
  primaryNavigationItems,
  secondaryNavigationItems,
} from "./navigation-items";

export function MobileNavigation() {
  const location = useLocation();
  const [moreMenuState, setMoreMenuState] = useState({
    isOpen: false,
    pathname: location.pathname,
  });
  const isMoreOpen =
    moreMenuState.isOpen && moreMenuState.pathname === location.pathname;
  const activeSecondaryItem = secondaryNavigationItems.find(
    (item) => location.pathname === item.to,
  );
  const hasActiveSecondaryItem = activeSecondaryItem !== undefined;

  useEffect(() => {
    if (!isMoreOpen) {
      return undefined;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreMenuState((state) => ({ ...state, isOpen: false }));
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMoreOpen]);

  return (
    <nav className="mobile-navigation" aria-label="Hauptnavigation mobil">
      {isMoreOpen ? (
        <div
          className="mobile-overflow-panel"
          id="mobile-more-navigation"
          aria-label="Weitere Bereiche"
        >
          {secondaryNavigationItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `mobile-overflow-link${isActive ? " navigation-link-active" : ""}`
              }
              key={item.to}
              onClick={() =>
                setMoreMenuState((state) => ({ ...state, isOpen: false }))
              }
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      ) : null}

      <div className="mobile-nav-row">
        {primaryNavigationItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `mobile-nav-link${isActive ? " navigation-link-active" : ""}`
            }
            end={item.to === "/"}
            key={item.to}
            aria-label={item.label}
            to={item.to}
          >
            {item.shortLabel}
          </NavLink>
        ))}
        <button
          aria-controls="mobile-more-navigation"
          aria-current={hasActiveSecondaryItem ? "page" : undefined}
          aria-expanded={isMoreOpen}
          aria-label={
            activeSecondaryItem === undefined
              ? "Mehr"
              : `Mehr, aktueller Bereich ${activeSecondaryItem.label}`
          }
          className={`mobile-more-button${hasActiveSecondaryItem ? " navigation-link-active" : ""}`}
          onClick={() =>
            setMoreMenuState({
              isOpen: !isMoreOpen,
              pathname: location.pathname,
            })
          }
          type="button"
        >
          Mehr
        </button>
      </div>
    </nav>
  );
}
