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
 * Die Überschrift wird nicht zu einem geratenen Zeitpunkt abgetastet, sondern
 * beobachtet: Wann eine Seite ihre `h1` aufbaut, hängt an ihrem eigenen Laden
 * und ist nichts, worauf sich der Titel verlassen kann. Ein einmaliges Lesen
 * am Ende der Navigation traf die alte Überschrift, sobald sich die
 * Ladereihenfolge verschob — und lief danach nie wieder (#144).
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
    if (!main) {
      return;
    }

    const announce = () => {
      const heading = main.querySelector("h1")?.textContent?.trim();
      const title = heading ? `${heading} – ${appName}` : appName;
      if (document.title !== title) {
        document.title = title;
      }
    };

    announce();

    const observer = new MutationObserver(announce);
    observer.observe(main, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    const previous = lastAnnounced.current;
    lastAnnounced.current = pathname;
    if (previous !== undefined && previous !== pathname) {
      main.focus();
    }

    return () => {
      observer.disconnect();
    };
  }, [isLoading, mainRef, pathname]);
}
