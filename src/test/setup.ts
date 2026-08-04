import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Routen laden ihre Daten über fake-indexeddb. Unter paralleler Testlast
 * überschreitet allein das Laden die Standardwartezeit von einer Sekunde,
 * ohne dass eine Zusicherung verletzt wäre. Die Erwartungen bleiben streng;
 * nur die Geduld beim Warten auf das Ergebnis wächst.
 */
configure({ asyncUtilTimeout: 5000 });

afterEach(() => cleanup());

if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
    writable: true,
  });
}
