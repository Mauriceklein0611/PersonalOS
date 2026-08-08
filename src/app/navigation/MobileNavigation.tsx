import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";

import { NavigationIcon } from "./icons";
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
  const panelRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const isMoreOpen =
    moreMenuState.isOpen && moreMenuState.pathname === location.pathname;
  const activeSecondaryItem = secondaryNavigationItems.find(
    (item) => location.pathname === item.to,
  );
  const hasActiveSecondaryItem = activeSecondaryItem !== undefined;

  /**
   * Nach dem Schließen ohne Navigation gehört der Fokus zurück auf den
   * Auslöser. Wer über einen Eintrag schließt, wechselt den Bereich; dort
   * wäre ein Rücksprung in das Band störend.
   */
  const closeMoreMenu = useCallback((restoreFocus: boolean) => {
    setMoreMenuState((state) => ({ ...state, isOpen: false }));
    if (restoreFocus) moreButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isMoreOpen) {
      return undefined;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMoreMenu(true);
    };

    // `pointerdown` statt `click`: Das Menü schließt beim Tippen daneben,
    // noch bevor der Tap irgendwo anders eine Aktion auslöst.
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      // Der Auslöser schaltet selbst um; sonst öffnete und schlösse er zugleich.
      if (moreButtonRef.current?.contains(target)) return;
      closeMoreMenu(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [closeMoreMenu, isMoreOpen]);

  // Beim Öffnen steht der Fokus auf dem ersten Eintrag; ohne ihn bliebe er
  // hinter dem geöffneten Menü zurück.
  useEffect(() => {
    if (!isMoreOpen) return;
    panelRef.current?.querySelector("a")?.focus();
  }, [isMoreOpen]);

  return (
    <nav className="mobile-navigation" aria-label="Hauptnavigation mobil">
      {isMoreOpen ? (
        <div
          className="mobile-overflow-panel"
          id="mobile-more-navigation"
          aria-label="Weitere Bereiche"
          ref={panelRef}
        >
          {secondaryNavigationItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `mobile-overflow-link${isActive ? " navigation-link-active" : ""}`
              }
              key={item.to}
              onClick={() => closeMoreMenu(false)}
              to={item.to}
            >
              <NavigationIcon name={item.icon} />
              <span>{item.label}</span>
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
            to={item.to}
          >
            <NavigationIcon name={item.icon} />
            <span className="mobile-nav-label">{item.label}</span>
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
            isMoreOpen
              ? closeMoreMenu(false)
              : setMoreMenuState({
                  isOpen: true,
                  pathname: location.pathname,
                })
          }
          ref={moreButtonRef}
          type="button"
        >
          <NavigationIcon name="more" />
          <span className="mobile-nav-label">Mehr</span>
        </button>
      </div>
    </nav>
  );
}
