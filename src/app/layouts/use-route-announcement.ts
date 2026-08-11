import { useEffect, useRef, type RefObject } from "react";
import { useLocation } from "react-router";

const appName = "PersonalOS";

/**
 * Ein Bereichswechsel tauscht in dieser App nur den Inhaltsbereich aus. Ohne
 * Zutun bliebe deshalb beides stehen, woran ein Screenreader eine neue Seite
 * erkennt: der Dokumenttitel und der Fokus.
 *
 * Der Titel kommt aus der Überschrift der Seite selbst. Eine zweite Liste aus
 * Pfad und Titel würde sonst neben der Überschrift veralten.
 *
 * Der erste Aufruf setzt nur den Titel. Fokus zu verschieben, ohne dass jemand
 * navigiert hat, wäre eine Bewegung ohne Auslöser.
 */
export function useRouteAnnouncement(
  mainRef: RefObject<HTMLElement | null>,
  isLoading: boolean,
): void {
  const { pathname } = useLocation();
  const lastAnnounced = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const main = mainRef.current;
    const heading = main?.querySelector("h1")?.textContent?.trim();
    document.title = heading ? `${heading} – ${appName}` : appName;

    const previous = lastAnnounced.current;
    lastAnnounced.current = pathname;
    if (previous === undefined || previous === pathname) {
      return;
    }

    main?.focus();
  }, [isLoading, mainRef, pathname]);
}
